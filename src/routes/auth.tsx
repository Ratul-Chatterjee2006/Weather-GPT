import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudSun } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — WeatherGPT" },
      {
        name: "description",
        content: "Sign in or create a WeatherGPT account to chat with live forecast data.",
      },
      { property: "og:title", content: "Sign in — WeatherGPT" },
      {
        property: "og:description",
        content: "Sign in or create a WeatherGPT account to chat with live forecast data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/chat", replace: true });
    });
  }, [navigate]);

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      // On success the browser is redirected to Google, so this only
      // returns if something went wrong before the redirect happened.
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          toast.error("The two passwords don't match.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to WeatherGPT!");
          navigate({ to: "/chat" });
        } else {
          setStep("verify");
          toast.success("We emailed you a verification code.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/chat" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "signup",
      });
      if (error) throw error;
      toast.success("Account verified — welcome!");
      navigate({ to: "/chat" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast.success("New code sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't resend the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-background px-4 py-12 dark:from-slate-900">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 flex items-center justify-center gap-2 font-display text-xl font-semibold"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CloudSun className="size-5" />
          </span>
          WeatherGPT
        </Link>
        <Card>
          {step === "verify" ? (
            <>
              <CardHeader>
                <CardTitle>Enter your verification code</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to {email}. Enter it below to finish creating your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={verify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Verification code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Checking…" : "Verify and continue"}
                  </Button>
                </form>
                <div className="mt-4 flex justify-between text-sm">
                  <button
                    type="button"
                    className="text-muted-foreground hover:underline"
                    onClick={() => setStep("form")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={resend}
                    disabled={busy}
                  >
                    Send a new code
                  </button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
                <CardDescription>
                  {mode === "signin"
                    ? "Sign in to chat with live weather data."
                    : "It takes a few seconds and it's free."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={signInWithGoogle}
                  disabled={busy}
                >
                  <svg viewBox="0 0 24 24" className="mr-2 size-4" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.09 3.58-5.17 3.58-8.85Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
                    />
                  </svg>
                  Continue with Google
                </Button>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or use your email
                  <span className="h-px flex-1 bg-border" />
                </div>
                <form onSubmit={submit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Display name</Label>
                      <Input
                        id="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex Rivera"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="confirm">Re-enter password</Label>
                      <Input
                        id="confirm"
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setMode(mode === "signin" ? "signup" : "signin");
                      setConfirmPassword("");
                    }}
                  >
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
