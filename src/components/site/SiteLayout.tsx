import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X, CloudSun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BroadcastBanner } from "@/components/site/BroadcastBanner";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/blog", label: "Blog" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BroadcastBanner />
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CloudSun className="size-4" />
            </span>
            WeatherGPT
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  pathname === item.to && "bg-accent text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <Link
                to="/chat"
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Chat
              </Link>
            )}
            {user && (
              <Link
                to="/map"
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Map
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <span className="max-w-[160px] truncate text-sm text-muted-foreground">
                  {user.email}
                </span>
                <Button variant="outline" size="sm" onClick={signOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>

          <button className="md:hidden" aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-border/60 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-accent"
                >
                  {item.label}
                </Link>
              ))}
              {user && (
                <Link
                  to="/chat"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-accent"
                >
                  Chat
                </Link>
              )}
              {user && (
                <Link
                  to="/map"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-accent"
                >
                  Map
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-accent"
                >
                  Admin
                </Link>
              )}
              <div className="mt-2">
                {user ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
                    Sign out
                  </Button>
                ) : (
                  <Button asChild size="sm" className="w-full">
                    <Link to="/auth" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} WeatherGPT. Forecast data from Open-Meteo.</p>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
            <Link to="/blog" className="hover:text-foreground">
              Blog
            </Link>
            <Link to="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
