import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/blog/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — WeatherGPT Blog` },
      {
        name: "description",
        content: "An article from the WeatherGPT blog on weather data and forecasting.",
      },
      { property: "og:title", content: "WeatherGPT Blog article" },
      {
        property: "og:description",
        content: "An article from the WeatherGPT blog on weather data and forecasting.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogDetail,
});

function BlogDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,title,excerpt,content,cover_url,created_at")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <SiteLayout>
      <article className="mx-auto w-full max-w-3xl px-4 py-16 md:py-24">
        <Link to="/blog" className="text-sm text-primary hover:underline">
          ← All articles
        </Link>
        {isLoading && <Skeleton className="mt-8 h-64 w-full rounded-xl" />}
        {!isLoading && !data && (
          <p className="mt-8 text-muted-foreground">This article could not be found.</p>
        )}
        {data && (
          <>
            <p className="mt-8 text-sm text-muted-foreground">
              {new Date(data.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              {data.title}
            </h1>
            {data.excerpt && <p className="mt-4 text-lg text-muted-foreground">{data.excerpt}</p>}
            {data.cover_url && (
              <img
                src={data.cover_url}
                alt={data.title}
                className="mt-8 w-full rounded-xl object-cover"
              />
            )}
            <div className="mt-8 space-y-5 text-base leading-relaxed">
              {data.content.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </>
        )}
      </article>
    </SiteLayout>
  );
}
