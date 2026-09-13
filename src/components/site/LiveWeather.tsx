import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudSun, Droplets, Loader2, MapPin, Search, TriangleAlert, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicWeather, describeWeather, type WeatherRisk } from "@/lib/weather.functions";

const SEVERITY_STYLES: Record<WeatherRisk["severity"], string> = {
  watch: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  warning: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  severe: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
};

type Coords = { latitude: number; longitude: number };

export function LiveWeather() {
  const fetchWeather = useServerFn(getPublicWeather);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [place, setPlace] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [located, setLocated] = useState(false);

  useEffect(() => {
    let done = false;

    const finish = (next: Coords | null, name?: string) => {
      if (done) return;
      done = true;
      if (next) setCoords(next);
      if (name) setPlace(name);
      setLocated(true);
    };

    // Fallback: approximate location from the visitor's network, never a fixed city.
    const byNetwork = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("lookup failed");
        const json = (await res.json()) as {
          latitude?: number;
          longitude?: number;
          city?: string;
          country_name?: string;
        };
        if (json.latitude != null && json.longitude != null) {
          finish(
            { latitude: json.latitude, longitude: json.longitude },
            [json.city, json.country_name].filter(Boolean).join(", ") || undefined,
          );
          return;
        }
      } catch {
        /* ignore */
      }
      finish(null);
    };

    if (!("geolocation" in navigator)) {
      byNetwork();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => byNetwork(),
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["public-weather", coords?.latitude, coords?.longitude, place],
    enabled: located,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchWeather({ data: { ...(coords ?? {}), ...(place ? { place } : {}) } }),
  });

  return (
    <div className="w-full rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm backdrop-blur">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!search.trim()) return;
          setCoords(null);
          setPlace(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Check another city…"
          aria-label="Search a city"
        />
        <Button type="submit" variant="secondary" size="icon" aria-label="Search">
          <Search className="size-4" />
        </Button>
      </form>

      <div className="mt-5">
        {!data && isFetching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Getting the current conditions…
          </div>
        )}
        {isError && !data && (
          <p className="text-sm text-muted-foreground">
            Couldn't load the weather right now. Try another city.
          </p>
        )}
        {data && (
          <div>
            {data.risks.length > 0 && (
              <div className="mb-4 space-y-2">
                {data.risks.slice(0, 3).map((risk, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${SEVERITY_STYLES[risk.severity]}`}
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-medium">{risk.label}</span>
                      {" — "}
                      {risk.detail}{" "}
                      <span className="opacity-80">
                        (
                        {new Date(risk.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        )
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" /> {data.place}
            </p>
            <div className="mt-2 flex items-end gap-4">
              <span className="font-display text-5xl font-semibold leading-none">
                {Math.round(data.temperature)}°C
              </span>
              <span className="flex items-center gap-2 pb-1 text-sm text-muted-foreground">
                <CloudSun className="size-4 text-primary" />
                {describeWeather(data.code)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground sm:grid-cols-4">
              <span>Feels {Math.round(data.apparent)}°</span>
              {data.high != null && data.low != null && (
                <span>
                  H {Math.round(data.high)}° / L {Math.round(data.low)}°
                </span>
              )}
              {data.humidity != null && (
                <span className="flex items-center gap-1">
                  <Droplets className="size-3.5" /> {Math.round(data.humidity)}%
                </span>
              )}
              {data.wind != null && (
                <span className="flex items-center gap-1">
                  <Wind className="size-3.5" /> {Math.round(data.wind)} km/h
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
