import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "weathergpt-dismissed-broadcast";

export function BroadcastBanner() {
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    setDismissedId(localStorage.getItem(STORAGE_KEY));
  }, []);

  const { data } = useQuery({
    queryKey: ["public-broadcast"],
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("id,message")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60 * 1000,
  });

  if (!data || data.id === dismissedId) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
      <Megaphone className="size-4 shrink-0" />
      <span>{data.message}</span>
      <button
        aria-label="Dismiss"
        className="ml-2 shrink-0 opacity-80 hover:opacity-100"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, data.id);
          setDismissedId(data.id);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
