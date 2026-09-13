import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (nextUser: User | null) => {
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", nextUser.id)
          .eq("role", "admin")
          .maybeSingle();
        if (active) setIsAdmin(Boolean(data));
      } else {
        setIsAdmin(false);
      }
      if (active) setLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => load(data.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isAdmin, loading };
}
