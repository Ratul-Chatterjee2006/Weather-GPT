import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdminClient } from "@/integrations/supabase/client.server";

type AdminClient = typeof SupabaseAdminClient;

// The one account nothing can touch — enforced again at the DB level in
// supabase/004-protect-admin.sql regardless of what happens here.
const PROTECTED_ADMIN_EMAIL = "ratulc686@gmail.com";

// Supabase bans by duration, not a flag, so a very long ban is how
// "deactivated until an admin restores it" is represented.
const DEACTIVATED_DURATION = "876000h"; // ~100 years

type Tier = "owner" | "director" | "admin" | "user";

async function getTier(supabaseAdmin: AdminClient, userId: string): Promise<Tier> {
  const { data: userRes, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError) throw new Error(userError.message);
  if (userRes.user?.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL) return "owner";

  const { data: director } = await supabaseAdmin
    .from("admin_directors")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (director) return "director";

  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role) return "admin";

  return "user";
}

async function loadAdminContext(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tier = await getTier(supabaseAdmin, userId);
  if (tier === "user") throw new Error("Admins only.");
  return { supabaseAdmin, tier };
}

// ---------------------------------------------------------------- deactivate

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, tier } = await loadAdminContext(context.userId);

    if (data.userId === context.userId) {
      throw new Error(
        data.active
          ? "You can't reactivate yourself from here."
          : "You can't deactivate your own account.",
      );
    }
    if (tier === "admin") {
      throw new Error(
        "Only the owner or a director can do this directly — submit a request instead.",
      );
    }

    const targetTier = await getTier(supabaseAdmin, data.userId);
    if (!data.active) {
      if (targetTier === "owner")
        throw new Error("This account is protected and can't be deactivated.");
      if (targetTier === "director" && tier !== "owner") {
        throw new Error(
          "Directors can't deactivate other directors — only the owner can. Submit a request instead.",
        );
      }
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : DEACTIVATED_DURATION,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUserStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await loadAdminContext(context.userId);
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    const banned: Record<string, boolean> = {};
    for (const u of data.users) {
      const bannedUntil = (u as { banned_until?: string | null }).banned_until;
      banned[u.id] = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
    }
    return banned;
  });

// ------------------------------------------------------------- remove admin

export const requestRemoveAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, tier } = await loadAdminContext(context.userId);
    if (data.userId === context.userId) throw new Error("You can't remove your own admin access.");

    const targetTier = await getTier(supabaseAdmin, data.userId);
    if (targetTier === "owner") {
      throw new Error("This account's admin access is protected and can't be removed.");
    }

    // Instant only for: owner acting on anyone, or a director acting on a
    // plain admin. A director acting on another director always needs the
    // owner's sign-off, and a plain admin always needs sign-off.
    const instant = tier === "owner" || (tier === "director" && targetTier !== "director");

    if (!instant) {
      if (!data.reason?.trim()) throw new Error("Please explain why this admin should be removed.");
      const { error } = await supabaseAdmin.from("admin_requests").insert({
        type: "remove_admin",
        target_user_id: data.userId,
        requested_by: context.userId,
        reason: data.reason.trim(),
      });
      if (error) throw new Error(error.message);
      return { ok: true, pending: true };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_requests").insert({
      type: "remove_admin",
      target_user_id: data.userId,
      requested_by: context.userId,
      reason: data.reason?.trim() || null,
      status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    });
    return { ok: true, pending: false };
  });

export const requestDeactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, tier } = await loadAdminContext(context.userId);
    if (data.userId === context.userId) throw new Error("You can't deactivate your own account.");

    const targetTier = await getTier(supabaseAdmin, data.userId);
    if (targetTier === "owner")
      throw new Error("This account is protected and can't be deactivated.");

    if (tier === "admin") {
      // Plain admins can only ever act on regular users, and always via request.
      if (targetTier !== "user") throw new Error("Admins can't deactivate other admins.");
      if (!data.reason?.trim())
        throw new Error("Please explain why this account should be deactivated.");
      const { error } = await supabaseAdmin.from("admin_requests").insert({
        type: "deactivate_user",
        target_user_id: data.userId,
        requested_by: context.userId,
        reason: data.reason.trim(),
      });
      if (error) throw new Error(error.message);
      return { ok: true, pending: true };
    }

    // Owner or director. Instant unless a director is targeting another director.
    const instant = tier === "owner" || targetTier !== "director";
    if (!instant) {
      if (!data.reason?.trim())
        throw new Error("Please explain why this account should be deactivated.");
      const { error } = await supabaseAdmin.from("admin_requests").insert({
        type: "deactivate_user",
        target_user_id: data.userId,
        requested_by: context.userId,
        reason: data.reason.trim(),
      });
      if (error) throw new Error(error.message);
      return { ok: true, pending: true };
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: DEACTIVATED_DURATION,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_requests").insert({
      type: "deactivate_user",
      target_user_id: data.userId,
      requested_by: context.userId,
      reason: data.reason?.trim() || null,
      status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    });
    return { ok: true, pending: false };
  });

export const listAdminRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, tier } = await loadAdminContext(context.userId);
    const isAuthority = tier === "owner" || tier === "director";
    let query = supabaseAdmin
      .from("admin_requests")
      .select(
        "id,type,target_user_id,requested_by,reason,status,reviewed_by,reviewed_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (!isAuthority) query = query.eq("requested_by", context.userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    for (const r of data ?? []) {
      ids.add(r.target_user_id);
      ids.add(r.requested_by);
      if (r.reviewed_by) ids.add(r.reviewed_by);
    }
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name")
      .in("id", [...ids]);
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.email || p.id]));

    const results = [];
    for (const r of data ?? []) {
      const targetTier = await getTier(supabaseAdmin, r.target_user_id);
      results.push({
        ...r,
        target_name: nameOf.get(r.target_user_id) ?? r.target_user_id,
        requested_by_name: nameOf.get(r.requested_by) ?? r.requested_by,
        // Only the owner may review a request about a director — a director
        // reviewing a peer's request would be a conflict of interest.
        owner_only: targetTier === "director" || targetTier === "owner",
      });
    }
    return results;
  });

export const reviewAdminRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; decision: "approve" | "reject" }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, tier } = await loadAdminContext(context.userId);
    const isAuthority = tier === "owner" || tier === "director";
    if (!isAuthority) throw new Error("Only the owner or a director can review requests.");

    const { data: reqRow, error: reqError } = await supabaseAdmin
      .from("admin_requests")
      .select("id,type,target_user_id,status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqError || !reqRow) throw new Error("Request not found.");
    if (reqRow.status !== "pending") throw new Error("This request has already been reviewed.");

    const targetTier = await getTier(supabaseAdmin, reqRow.target_user_id);
    if ((targetTier === "director" || targetTier === "owner") && tier !== "owner") {
      throw new Error("Only the owner can review a request about a director.");
    }

    if (data.decision === "approve") {
      if (targetTier === "owner")
        throw new Error("This account is protected — the request can't be approved.");
      if (reqRow.type === "remove_admin") {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", reqRow.target_user_id)
          .eq("role", "admin");
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(reqRow.target_user_id, {
          ban_duration: DEACTIVATED_DURATION,
        });
        if (error) throw new Error(error.message);
      }
    }

    const { error } = await supabaseAdmin
      .from("admin_requests")
      .update({
        status: data.decision === "approve" ? "approved" : "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------- directors

export const listDirectors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await loadAdminContext(context.userId);
    const { data, error } = await supabaseAdmin.from("admin_directors").select("user_id");
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => d.user_id);
  });

// Only the owner's own account may call this — not even a director can
// promote or demote another director.
export const setDirector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; grant: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await loadAdminContext(context.userId);
    const { data: caller, error: callerError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (callerError) throw new Error(callerError.message);
    if (caller.user?.email?.toLowerCase() !== PROTECTED_ADMIN_EMAIL) {
      throw new Error("Only the owner can grant or revoke director access.");
    }
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("admin_directors")
        .upsert({ user_id: data.userId, granted_by: context.userId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("admin_directors")
        .delete()
        .eq("user_id", data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// --------------------------------------------------------------- maintenance

export const cleanupUnverifiedAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await loadAdminContext(context.userId);
    const { data, error } = await supabaseAdmin.rpc("cleanup_unverified_users", {
      older_than: "24 hours",
    });
    if (error) throw new Error(error.message);
    return { deleted: data ?? 0 };
  });

// ------------------------------------------------------------- data sources

// Honest status for the sources this app actually calls. There is no IMD
// integration in this codebase, so we don't fabricate a status for it — add
// a real check here if IMD API access is ever wired in.
export const checkDataSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const checkedAt = new Date().toISOString();
    let openMeteoOk = false;
    try {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=20.59&longitude=78.96&current=temperature_2m",
        { signal: AbortSignal.timeout(6000) },
      );
      openMeteoOk = res.ok;
    } catch {
      openMeteoOk = false;
    }
    return {
      sources: [{ name: "Open-Meteo", ok: openMeteoOk, checkedAt }],
      note: "IMD is not integrated in this app yet — add real API access to monitor it here.",
    };
  });
