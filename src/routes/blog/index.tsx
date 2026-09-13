import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "WeatherGPT Blog — Forecasting, explained" },
      {
        name: "description",
        content:
          "Guides and notes on reading forecasts, understanding weather data and getting more from WeatherGPT.",
      },
      { property: "og:title", content: "WeatherGPT Blog" },
      { property: "og:description", content: "Forecasting and weather data, explained simply." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogList,
});

function BlogList() {
  const { data, isLoading } = useQuery({
    queryKey: ["posts", "published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,slug,title,excerpt,cover_url,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-5xl px-4 py-16 md:py-24">
        <p className="font-medium text-primary">Blog</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Forecasting, explained
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Short reads on weather data, how our assistant works, and how to get a better answer out
          of any forecast.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
          {data?.map((post) => (
            <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }}>
              <Card className="h-full border-border/60 transition-shadow hover:shadow-md">
                {post.cover_url && (
                  <img
                    src={post.cover_url}
                    alt={post.title}
                    className="h-40 w-full rounded-t-xl object-cover"
                  />
                )}
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold">{post.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
                  <p className="mt-4 text-sm font-medium text-primary">Read article →</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!isLoading && data?.length === 0 && (
            <p className="text-muted-foreground">No articles published yet.</p>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
