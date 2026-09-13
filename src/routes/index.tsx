import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CloudSun,
  MessageCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  Wind,
  TriangleAlert,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import heroSky from "@/assets/hero-sky.jpg";
import { LiveWeather } from "@/components/site/LiveWeather";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeatherGPT — Ask the weather, get real answers" },
      {
        name: "description",
        content:
          "WeatherGPT is a chat assistant that answers weather questions with live forecast data for any place on earth.",
      },
      { property: "og:title", content: "WeatherGPT — Ask the weather, get real answers" },
      {
        property: "og:description",
        content: "Chat your way to an accurate forecast, backed by live Open-Meteo data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Ask in plain language",
    body: "“Do I need a jacket in Lisbon tonight?” gets a straight answer, not a wall of numbers.",
  },
  {
    icon: Radar,
    title: "Live forecast lookups",
    body: "The assistant calls a real weather service for every question — current, hourly and daily.",
  },
  {
    icon: Wind,
    title: "Beyond temperature",
    body: "Wind, humidity, rain probability and how it will actually feel outside.",
  },
  {
    icon: Sparkles,
    title: "Fast answers",
    body: "Powered by a lightning-quick model, so replies land in a couple of seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Your account is yours. Conversations stay in your session, not in a public feed.",
  },
  {
    icon: CloudSun,
    title: "Anywhere on earth",
    body: "Cities, towns and coastlines worldwide, resolved automatically from the name you use.",
  },
];

function Home() {
  const { data: alerts } = useQuery({
    queryKey: ["public-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("id,title,message,severity,region")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <img
          src={heroSky}
          alt="Layered clouds at golden hour"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/75 to-background" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-24 md:py-32 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Live data, conversational answers
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Ask the weather like you'd ask a friend
            </h1>
            <p className="mt-5 text-lg text-muted-foreground md:text-xl">
              WeatherGPT understands your question, pulls the real forecast for the place and time
              you care about, and answers in a sentence you can act on.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Start chatting free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/about">How it works</Link>
              </Button>
            </div>
          </div>
          <LiveWeather />
        </div>
      </section>

      {alerts && alerts.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-4">
          <div className="grid gap-3 md:grid-cols-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex gap-3 rounded-xl border border-border/60 bg-card p-4 text-sm"
              >
                <TriangleAlert
                  className={
                    a.severity === "danger"
                      ? "mt-0.5 size-4 shrink-0 text-destructive"
                      : a.severity === "warning"
                        ? "mt-0.5 size-4 shrink-0 text-amber-500"
                        : "mt-0.5 size-4 shrink-0 text-primary"
                  }
                />
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 text-muted-foreground">{a.message}</p>
                  {a.region && <p className="mt-1 text-xs text-muted-foreground">{a.region}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Everything a forecast app should have said
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Built around one idea: you shouldn't have to interpret a chart to decide whether to take
          an umbrella.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-border/60 transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-accent/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              Your first forecast is one question away
            </h2>
            <p className="mt-2 text-muted-foreground">Free account, no card, no setup. Just ask.</p>
          </div>
          <Button asChild size="lg">
            <Link to="/auth">Create your account</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
