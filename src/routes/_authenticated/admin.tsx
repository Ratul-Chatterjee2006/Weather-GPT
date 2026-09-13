import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileText,
  Mail,
  TriangleAlert,
  Users,
  Plus,
  Trash2,
  Pencil,
  ShieldCheck,
  ShieldMinus,
  Check,
  Ban,
  RotateCcw,
  BarChart3,
  Radio,
  Megaphone,
  MessageSquare,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import {
  setUserActive,
  listUserStatus,
  checkDataSources,
  requestRemoveAdmin,
  requestDeactivateUser,
  listAdminRequests,
  reviewAdminRequest,
  listDirectors,
  setDirector,
  cleanupUnverifiedAccounts,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — WeatherGPT" },
      { name: "description", content: "Manage WeatherGPT content, users and weather alerts." },
      { property: "og:title", content: "Admin panel — WeatherGPT" },
      { property: "og:description", content: "Manage content, users and alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type PostForm = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_url: string;
  published: boolean;
};

const EMPTY_POST: PostForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_url: "",
  published: false,
};

// This account's admin access can't be revoked from the panel (and is also
// enforced at the database level — see supabase/004-protect-admin.sql).
const PROTECTED_ADMIN_EMAIL = "ratulc686@gmail.com";

type AlertForm = {
  id?: string;
  title: string;
  message: string;
  severity: string;
  region: string;
  active: boolean;
  latitude: string;
  longitude: string;
  radius_km: string;
  expires_at: string;
};

const EMPTY_ALERT: AlertForm = {
  title: "",
  message: "",
  severity: "info",
  region: "",
  active: true,
  latitude: "",
  longitude: "",
  radius_km: "50",
  expires_at: "",
};

function AdminPage() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-6xl px-4 py-24 text-muted-foreground">Loading…</div>
      </SiteLayout>
    );
  }

  if (!isAdmin) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-semibold">Admins only</h1>
          <p className="mt-3 text-muted-foreground">
            This area is restricted. If you think you should have access, get in touch.
          </p>
          <Button asChild className="mt-6">
            <Link to="/chat">Go to chat</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Admin panel</h1>
        <p className="mt-2 text-muted-foreground">Content, people and alerts in one place.</p>

        <Tabs defaultValue="dashboard" className="mt-8">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="blog">Blog</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="sources">Data sources</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6">
            <Dashboard />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
          <TabsContent value="requests" className="mt-6">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="blog" className="mt-6">
            <BlogTab />
          </TabsContent>
          <TabsContent value="alerts" className="mt-6">
            <AlertsTab />
          </TabsContent>
          <TabsContent value="messages" className="mt-6">
            <MessagesTab />
          </TabsContent>
          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab />
          </TabsContent>
          <TabsContent value="sources" className="mt-6">
            <DataSourcesTab />
          </TabsContent>
          <TabsContent value="maintenance" className="mt-6">
            <MaintenanceTab />
          </TabsContent>
          <TabsContent value="broadcast" className="mt-6">
            <BroadcastTab />
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [users, posts, published, messages, alerts, chatsToday, topLocations] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("posts").select("id", { count: "exact", head: true }),
          supabase.from("posts").select("id", { count: "exact", head: true }).eq("published", true),
          supabase.from("contact_messages").select("id", { count: "exact", head: true }),
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("active", true),
          supabase
            .from("chat_logs")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startOfDay.toISOString()),
          supabase.from("chat_logs").select("location").not("location", "is", null),
        ]);

      const counts = new Map<string, number>();
      for (const row of topLocations.data ?? []) {
        const loc = row.location;
        if (!loc) continue;
        counts.set(loc, (counts.get(loc) ?? 0) + 1);
      }
      const top5 = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([location, count]) => ({ location, count }));

      return {
        users: users.count ?? 0,
        posts: posts.count ?? 0,
        published: published.count ?? 0,
        messages: messages.count ?? 0,
        alerts: alerts.count ?? 0,
        chatsToday: chatsToday.count ?? 0,
        top5,
      };
    },
  });

  const { data: recentMessages } = useQuery({
    queryKey: ["admin", "recent-messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_messages")
        .select("id,name,email,subject,message,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const stats = [
    { label: "Registered users", value: data?.users ?? 0, icon: Users },
    { label: "Chats today", value: data?.chatsToday ?? 0, icon: MessageSquare },
    { label: "Active alerts", value: data?.alerts ?? 0, icon: TriangleAlert },
    { label: "Blog posts", value: `${data?.published ?? 0}/${data?.posts ?? 0}`, icon: FileText },
    { label: "Contact messages", value: data?.messages ?? 0, icon: Mail },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <s.icon className="size-5 text-primary" />
              <p className="mt-3 font-display text-3xl font-semibold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 queried locations</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.top5.length ? (
              <ul className="space-y-2">
                {data.top5.map((l, i) => (
                  <li key={l.location} className="flex items-center justify-between text-sm">
                    <span>
                      {i + 1}. {l.location}
                    </span>
                    <span className="text-muted-foreground">{l.count} queries</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No chat queries logged yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest contact messages</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMessages?.length ? (
              <div className="space-y-4">
                {recentMessages.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {m.name} <span className="text-muted-foreground">· {m.email}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                    {m.subject && <p className="mt-1 text-sm font-medium">{m.subject}</p>}
                    <p className="mt-1 text-sm text-muted-foreground">{m.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReasonDialog({
  open,
  title,
  description,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setReason("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why, so the owner has context when reviewing this."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!reason.trim() || submitting} onClick={() => onSubmit(reason.trim())}>
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PendingRequest = { type: "remove_admin" | "deactivate_user"; userId: string } | null;

function UsersTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(listUserStatus);
  const fetchDirectors = useServerFn(listDirectors);
  const toggleActive = useServerFn(setUserActive);
  const removeAdminRequest = useServerFn(requestRemoveAdmin);
  const deactivateRequest = useServerFn(requestDeactivateUser);
  const toggleDirector = useServerFn(setDirector);
  const [pendingDialog, setPendingDialog] = useState<PendingRequest>(null);

  const { data } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,display_name,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "user" }));
    },
  });

  const { data: banned } = useQuery({
    queryKey: ["admin", "user-status"],
    queryFn: () => fetchStatus(),
  });

  const { data: directors } = useQuery({
    queryKey: ["admin", "directors"],
    queryFn: () => fetchDirectors(),
  });

  const myEmail = user?.email?.toLowerCase();
  const iAmOwner = myEmail === PROTECTED_ADMIN_EMAIL;
  const iAmDirector = !iAmOwner && !!user && (directors ?? []).includes(user.id);
  const iAmAuthority = iAmOwner || iAmDirector;

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "user-status"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "directors"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
  };

  const promote = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin access granted");
      invalidateUsers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAdmin = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      removeAdminRequest({ data: reason ? { userId, reason } : { userId } }),
    onSuccess: (res) => {
      toast.success(
        res.pending ? "Request submitted — pending owner approval" : "Admin access removed",
      );
      setPendingDialog(null);
      invalidateUsers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) =>
      toggleActive({ data: { userId, active } }),
    onSuccess: (_data, vars) => {
      toast.success(vars.active ? "Account reactivated" : "Account deactivated");
      invalidateUsers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestDeactivate = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      deactivateRequest({ data: { userId, reason } }),
    onSuccess: (res) => {
      toast.success(
        res.pending ? "Request submitted — pending owner approval" : "Account deactivated",
      );
      setPendingDialog(null);
      invalidateUsers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const director = useMutation({
    mutationFn: ({ userId, grant }: { userId: string; grant: boolean }) =>
      toggleDirector({ data: { userId, grant } }),
    onSuccess: (_data, vars) => {
      toast.success(vars.grant ? "Granted director access" : "Revoked director access");
      invalidateUsers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((u) => {
              const isSelf = u.id === user?.id;
              const isProtected = u.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL;
              const isDirector = (directors ?? []).includes(u.id);
              const isBanned = banned?.[u.id] ?? false;
              const targetIsAdmin = u.role === "admin";
              const busy =
                removeAdmin.isPending || setActive.isPending || requestDeactivate.isPending;

              // Instant only for: the owner acting on anyone, or a director
              // acting on a plain admin. Director-on-director always needs
              // the owner's sign-off (a request), same as a plain admin.
              const removeInstant = iAmOwner || (iAmDirector && !isDirector);
              const deactivateInstant = iAmOwner || (iAmDirector && !isDirector);

              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.display_name ?? "—"}
                    {isProtected && (
                      <Badge className="ml-2" variant="default">
                        Owner
                      </Badge>
                    )}
                    {isDirector && !isProtected && (
                      <Badge className="ml-2" variant="secondary">
                        Director
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={targetIsAdmin ? "default" : "secondary"}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isBanned ? "destructive" : "outline"}>
                      {isBanned ? "Deactivated" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {targetIsAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || isProtected || isSelf}
                          title={
                            isProtected
                              ? "This account's admin access is protected and can't be removed"
                              : isSelf
                                ? "You can't remove your own admin access"
                                : undefined
                          }
                          onClick={() => {
                            if (removeInstant) removeAdmin.mutate({ userId: u.id });
                            else setPendingDialog({ type: "remove_admin", userId: u.id });
                          }}
                        >
                          <ShieldMinus className="size-4" />
                          {removeInstant ? "Remove admin" : "Request removal"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={promote.isPending}
                          onClick={() => promote.mutate(u.id)}
                        >
                          <ShieldCheck className="size-4" /> Make admin
                        </Button>
                      )}

                      {iAmOwner && !isProtected && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={director.isPending || !targetIsAdmin}
                          title={
                            !targetIsAdmin
                              ? "Only current admins can be made a director"
                              : undefined
                          }
                          onClick={() => director.mutate({ userId: u.id, grant: !isDirector })}
                        >
                          {isDirector ? "Revoke director" : "Make director"}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          busy ||
                          isSelf ||
                          (isProtected && !isBanned) ||
                          (!iAmAuthority && (targetIsAdmin || isBanned))
                        }
                        title={
                          isProtected && !isBanned
                            ? "This account is protected and can't be deactivated"
                            : isSelf
                              ? "You can't deactivate your own account"
                              : !iAmAuthority && targetIsAdmin
                                ? "Admins can't deactivate other admins"
                                : !iAmAuthority && isBanned
                                  ? "Only the owner or a director can reactivate accounts"
                                  : undefined
                        }
                        onClick={() => {
                          if (isBanned) {
                            setActive.mutate({ userId: u.id, active: true });
                          } else if (deactivateInstant) {
                            setActive.mutate({ userId: u.id, active: false });
                          } else {
                            setPendingDialog({ type: "deactivate_user", userId: u.id });
                          }
                        }}
                      >
                        {isBanned ? (
                          <>
                            <RotateCcw className="size-4" /> Reactivate
                          </>
                        ) : (
                          <>
                            <Ban className="size-4" />{" "}
                            {deactivateInstant ? "Deactivate" : "Request deactivation"}
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ReasonDialog
        open={pendingDialog?.type === "remove_admin"}
        title="Request admin removal"
        description="This needs the owner's approval before it takes effect. Explain why this director/admin should be removed."
        onOpenChange={(o) => !o && setPendingDialog(null)}
        submitting={removeAdmin.isPending}
        onSubmit={(reason) => {
          if (pendingDialog) removeAdmin.mutate({ userId: pendingDialog.userId, reason });
        }}
      />
      <ReasonDialog
        open={pendingDialog?.type === "deactivate_user"}
        title="Request deactivation"
        description="This needs the owner's approval before it takes effect. Explain why this account should be deactivated."
        onOpenChange={(o) => !o && setPendingDialog(null)}
        submitting={requestDeactivate.isPending}
        onSubmit={(reason) => {
          if (pendingDialog) requestDeactivate.mutate({ userId: pendingDialog.userId, reason });
        }}
      />
    </Card>
  );
}

function RequestsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchRequests = useServerFn(listAdminRequests);
  const fetchDirectors = useServerFn(listDirectors);
  const review = useServerFn(reviewAdminRequest);

  const { data: directors } = useQuery({
    queryKey: ["admin", "directors"],
    queryFn: () => fetchDirectors(),
  });
  const myEmail = user?.email?.toLowerCase();
  const iAmOwner = myEmail === PROTECTED_ADMIN_EMAIL;
  const iAmAuthority = iAmOwner || (!!user && (directors ?? []).includes(user.id));

  const { data: requests } = useQuery({
    queryKey: ["admin", "requests"],
    queryFn: () => fetchRequests(),
  });

  const decide = useMutation({
    mutationFn: ({ requestId, decision }: { requestId: string; decision: "approve" | "reject" }) =>
      review({ data: { requestId, decision } }),
    onSuccess: (_data, vars) => {
      toast.success(vars.decision === "approve" ? "Request approved" : "Request rejected");
      queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const history = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {iAmAuthority ? "Pending requests" : "Your submitted requests"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          )}
          {pending.map((r) => {
            const canReview = iAmAuthority && (!r.owner_only || iAmOwner);
            return (
              <div key={r.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.type === "remove_admin" ? "Remove admin" : "Deactivate user"}:{" "}
                      {r.target_name}
                      {r.owner_only && (
                        <Badge className="ml-2" variant="outline">
                          Director — owner review only
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Requested by {r.requested_by_name}
                    </p>
                    {r.reason && <p className="mt-1 text-sm">{r.reason}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  {canReview ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ requestId: r.id, decision: "approve" })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ requestId: r.id, decision: "reject" })}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No reviewed requests yet.</p>
          )}
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span>
                {r.type === "remove_admin" ? "Remove admin" : "Deactivate"}: {r.target_name} — by{" "}
                {r.requested_by_name}
              </span>
              <Badge variant={r.status === "approved" ? "default" : "destructive"}>
                {r.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function BlogTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PostForm>(EMPTY_POST);

  const { data: posts } = useQuery({
    queryKey: ["admin", "posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id,slug,title,excerpt,content,cover_url,published,created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (input: PostForm) => {
      const payload = {
        title: input.title,
        slug: input.slug || slugify(input.title),
        excerpt: input.excerpt || null,
        content: input.content,
        cover_url: input.cover_url || null,
        published: input.published,
      };
      const { error } = input.id
        ? await supabase.from("posts").update(payload).eq("id", input.id)
        : await supabase.from("posts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post saved");
      setForm(EMPTY_POST);
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{form.id ? "Edit post" : "New post"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                    slug: form.id ? form.slug : slugify(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <Input
                id="slug"
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Input
                id="excerpt"
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover">Cover image URL</Label>
              <Input
                id="cover"
                value={form.cover_url}
                onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                rows={10}
                required
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="published"
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: v })}
              />
              <Label htmlFor="published">Published</Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                <Plus className="size-4" /> {form.id ? "Save changes" : "Create post"}
              </Button>
              {form.id && (
                <Button type="button" variant="outline" onClick={() => setForm(EMPTY_POST)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {posts?.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-4"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">/{p.slug}</p>
                <Badge className="mt-2" variant={p.published ? "default" : "secondary"}>
                  {p.published ? "Published" : "Draft"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      title: p.title,
                      slug: p.slug,
                      excerpt: p.excerpt ?? "",
                      content: p.content,
                      cover_url: p.cover_url ?? "",
                      published: p.published,
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {posts?.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AlertForm>(EMPTY_ALERT);

  const { data: alerts } = useQuery({
    queryKey: ["admin", "alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select(
          "id,title,message,severity,region,active,created_at,latitude,longitude,radius_km,expires_at",
        )
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (input: AlertForm) => {
      const lat = input.latitude.trim() ? Number(input.latitude) : null;
      const lng = input.longitude.trim() ? Number(input.longitude) : null;
      const payload = {
        title: input.title,
        message: input.message,
        severity: input.severity,
        region: input.region || null,
        active: input.active,
        latitude: lat,
        longitude: lng,
        radius_km: input.radius_km.trim() ? Number(input.radius_km) : 50,
        expires_at: input.expires_at ? new Date(input.expires_at).toISOString() : null,
      };
      const { error } = input.id
        ? await supabase.from("alerts").update(payload).eq("id", input.id)
        : await supabase.from("alerts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert saved");
      setForm(EMPTY_ALERT);
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["public-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["public-alerts-map"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("alerts").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["public-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["public-alerts-map"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["public-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["public-alerts-map"] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{form.id ? "Edit alert" : "New alert"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="atitle">Title</Label>
              <Input
                id="atitle"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amessage">Message</Label>
              <Textarea
                id="amessage"
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info / watch</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="alat">Latitude</Label>
                <Input
                  id="alat"
                  type="number"
                  step="any"
                  placeholder="e.g. 20.27"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alng">Longitude</Label>
                <Input
                  id="alng"
                  type="number"
                  step="any"
                  placeholder="e.g. 85.83"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aradius">Radius (km)</Label>
                <Input
                  id="aradius"
                  type="number"
                  min="1"
                  value={form.radius_km}
                  onChange={(e) => setForm({ ...form, radius_km: e.target.value })}
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Latitude/longitude place this alert on the map as a circle. Leave blank to keep it
              region-text only (won't appear on the map).
            </p>
            <div className="space-y-2">
              <Label htmlFor="aexpires">Expires at (optional)</Label>
              <Input
                id="aexpires"
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                <Plus className="size-4" /> {form.id ? "Save changes" : "Create alert"}
              </Button>
              {form.id && (
                <Button type="button" variant="outline" onClick={() => setForm(EMPTY_ALERT)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts?.map((a) => (
            <div key={a.id} className="rounded-lg border border-border/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="secondary">{a.severity}</Badge>
                    {a.region && <Badge variant="outline">{a.region}</Badge>}
                    {a.latitude != null && <Badge variant="outline">On map</Badge>}
                    {a.expires_at && (
                      <Badge variant="outline">
                        Expires {new Date(a.expires_at).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={a.active}
                    onCheckedChange={(v) => toggle.mutate({ id: a.id, active: v })}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: a.id,
                        title: a.title,
                        message: a.message,
                        severity: a.severity,
                        region: a.region ?? "",
                        active: a.active,
                        latitude: a.latitude != null ? String(a.latitude) : "",
                        longitude: a.longitude != null ? String(a.longitude) : "",
                        radius_km: String(a.radius_km ?? 50),
                        expires_at: a.expires_at ? a.expires_at.slice(0, 16) : "",
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => remove.mutate(a.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {alerts?.length === 0 && <p className="text-sm text-muted-foreground">No alerts yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function MessagesTab() {
  const queryClient = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ["admin", "messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_messages")
        .select("id,name,email,subject,message,handled,created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const setHandled = useMutation({
    mutationFn: async ({ id, handled }: { id: string; handled: boolean }) => {
      const { error } = await supabase.from("contact_messages").update({ handled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "messages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contact messages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages?.map((m) => (
          <div key={m.id} className="rounded-lg border border-border/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {m.name} <span className="text-muted-foreground">· {m.email}</span>
                </p>
                {m.subject && <p className="mt-1 text-sm font-medium">{m.subject}</p>}
                <p className="mt-1 text-sm text-muted-foreground">{m.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.handled ? "default" : "secondary"}>
                  {m.handled ? "Handled" : "Open"}
                </Badge>
                {!m.handled && (
                  <Button
                    size="icon"
                    variant="outline"
                    title="Mark as handled"
                    onClick={() => setHandled.mutate({ id: m.id, handled: true })}
                  >
                    <Check className="size-4" />
                  </Button>
                )}
                <Button size="icon" variant="outline" onClick={() => remove.mutate(m.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {messages?.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

const PIE_COLORS = ["#2563eb", "#f97316", "#64748b"];

function AnalyticsTab() {
  const { data } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("chat_logs")
        .select("location,language,category")
        .order("created_at", { ascending: false })
        .limit(2000);

      const byLanguage = new Map<string, number>();
      const byCategory = new Map<string, number>();
      const byLocation = new Map<string, number>();
      for (const row of rows ?? []) {
        const lang = row.language ?? "unknown";
        byLanguage.set(lang, (byLanguage.get(lang) ?? 0) + 1);
        byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1);
        if (row.location) byLocation.set(row.location, (byLocation.get(row.location) ?? 0) + 1);
      }

      return {
        total: rows?.length ?? 0,
        language: [...byLanguage.entries()].map(([language, count]) => ({ language, count })),
        category: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
        locations: [...byLocation.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([location, count]) => ({ location, count })),
      };
    },
  });

  if (data && data.total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No chat activity logged yet — analytics fill in as people use the chat.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" /> Queries per language
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.language ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="language" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query types</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data?.category ?? []}
                dataKey="count"
                nameKey="category"
                outerRadius={90}
                label
              >
                {(data?.category ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Most common locations</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.locations.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.locations.map((l, i) => (
                <li key={l.location} className="flex items-center justify-between text-sm">
                  <span>
                    {i + 1}. {l.location}
                  </span>
                  <span className="text-muted-foreground">{l.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No locations logged yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DataSourcesTab() {
  const fetchStatus = useServerFn(checkDataSources);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin", "data-sources"],
    queryFn: () => fetchStatus(),
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="size-4" /> Data sources
        </CardTitle>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>
          Recheck now
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.sources.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-lg border border-border/60 p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={`size-2.5 rounded-full ${s.ok ? "bg-green-500" : "bg-red-500"}`}
                aria-hidden
              />
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  Last checked {new Date(s.checkedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <Badge variant={s.ok ? "default" : "destructive"}>
              {s.ok ? "Online" : "Unreachable"}
            </Badge>
          </div>
        ))}
        {data?.note && <p className="text-xs text-muted-foreground">{data.note}</p>}
      </CardContent>
    </Card>
  );
}

function MaintenanceTab() {
  const runCleanup = useServerFn(cleanupUnverifiedAccounts);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Unverified sign-ups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Removes accounts that started signing up but never entered their email verification code,
          once they're more than 24 hours old. Verified accounts (including every Google sign-in)
          are never touched.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await runCleanup();
              setLastResult(res.deleted);
              toast.success(
                res.deleted === 0
                  ? "Nothing to clean up right now"
                  : `Removed ${res.deleted} unverified account${res.deleted === 1 ? "" : "s"}`,
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Cleanup failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Cleaning up…" : "Clean up now"}
        </Button>
        {lastResult !== null && (
          <p className="text-xs text-muted-foreground">Last run removed {lastResult} account(s).</p>
        )}
        <p className="text-xs text-muted-foreground">
          Want this automatic? Enable the pg_cron extension (Database → Extensions) in Supabase,
          then run the scheduling snippet at the bottom of{" "}
          <code>007-cleanup-unverified-accounts.sql</code> to run this daily on its own.
        </p>
      </CardContent>
    </Card>
  );
}

function BroadcastTab() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: active } = useQuery({
    queryKey: ["admin", "broadcast-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("id,message,created_at,active")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const send = useMutation({
    mutationFn: async (text: string) => {
      await supabase.from("broadcasts").update({ active: false }).eq("active", true);
      const { error } = await supabase.from("broadcasts").insert({ message: text, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Broadcast sent — it'll show on every visitor's next page load");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcast-active"] });
      queryClient.invalidateQueries({ queryKey: ["public-broadcast"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broadcasts").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Broadcast stopped");
      queryClient.invalidateQueries({ queryKey: ["admin", "broadcast-active"] });
      queryClient.invalidateQueries({ queryKey: ["public-broadcast"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="size-4" /> Broadcast message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active && (
          <div className="rounded-lg border border-border/60 bg-accent/40 p-4">
            <p className="text-sm font-medium">Currently live</p>
            <p className="mt-1 text-sm">{active.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => stop.mutate(active.id)}
            >
              Stop showing this
            </Button>
          </div>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) send.mutate(message.trim());
          }}
        >
          <Label htmlFor="broadcast">New broadcast</Label>
          <Textarea
            id="broadcast"
            rows={3}
            placeholder="e.g. Scheduled maintenance tonight 11pm–12am IST."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Shown once as a dismissible banner to every visitor. Sending a new one replaces the
            current one.
          </p>
          <Button type="submit" disabled={send.isPending || !message.trim()}>
            Send broadcast
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
