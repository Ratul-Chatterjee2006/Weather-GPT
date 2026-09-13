import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Database, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About WeatherGPT — Weather answers in plain language" },
      {
        name: "description",
        content:
          "WeatherGPT pairs a conversational assistant with live Open-Meteo forecast data so you get real numbers, explained simply.",
      },
      { property: "og:title", content: "About WeatherGPT" },
      {
        property: "og:description",
        content: "How WeatherGPT turns live forecast data into plain-language answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const VALUES = [
  {
    icon: Database,
    title: "Real data, always",
    body: "Every forecast number comes from a live weather service at the moment you ask, never from the model's memory.",
  },
  {
    icon: Compass,
    title: "Anywhere on earth",
    body: "Ask about a village or a capital city. We resolve the place, then pull hourly and daily forecasts for it.",
  },
  {
    icon: Users,
    title: "Built for humans",
    body: "No dashboards to decode. Ask the way you'd ask a friend and get an answer you can act on.",
  },
];

function About() {
  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-4xl px-4 py-16 md:py-24">
        <p className="font-medium text-primary">About us</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Weather should be a conversation, not a chart
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          WeatherGPT started with a simple frustration: forecasts are everywhere, but they rarely
          answer the question you actually have. Should I take an umbrella to the 6pm meeting? Is
          Saturday the better hiking day? Will the wind drop before the flight?
        </p>
        <p className="mt-4 text-lg text-muted-foreground">
          So we built an assistant that understands the question, fetches the real forecast for the
          right place and time, and answers in a sentence or two. Behind the friendly reply sits an
          open, transparent data source and a fast language model doing the interpretation.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {VALUES.map((v) => (
            <Card key={v.title} className="border-border/60">
              <CardContent className="pt-6">
                <v.icon className="size-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-border/60 bg-accent/40 p-8">
          <h2 className="font-display text-2xl font-semibold">Want to try it?</h2>
          <p className="mt-2 text-muted-foreground">
            Create a free account and ask your first question in under a minute.
          </p>
          <Button asChild className="mt-5">
            <Link to="/auth">Start chatting</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
