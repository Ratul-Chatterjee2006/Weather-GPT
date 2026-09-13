import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — WeatherGPT" },
      { name: "description", content: "Completing your WeatherGPT sign-in." },
      { property: "og:title", content: "Signing you in — WeatherGPT" },
      { property: "og:description", content: "Completing your WeatherGPT sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const authError =
          url.searchParams.get("error_description") ?? hash.get("error_description");

        if (authError) throw new Error(authError);

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session) {
          window.history.replaceState({}, "", "/auth/callback");
          navigate({ to: "/chat", replace: true });
        } else {
          navigate({ to: "/auth", replace: true });
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Sign-in could not be completed.");
      }
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      {error ? (
        <>
          <h1 className="font-display text-lg font-semibold">We couldn't finish signing you in</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
          <button
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => navigate({ to: "/auth", replace: true })}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Signing you in…
        </p>
      )}
    </div>
  );
}
