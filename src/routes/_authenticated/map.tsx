import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, Share2, CloudRain, Wind as WindIcon, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Weather map — WeatherGPT" },
      {
        name: "description",
        content: "Active weather alerts, rainfall radar and wind on an interactive map.",
      },
      { property: "og:title", content: "Weather map — WeatherGPT" },
      { property: "og:description", content: "Alerts, rainfall and wind on one map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

type LatLng = { lat: number; lng: number };

const DEFAULT_CENTER: LatLng = { lat: 20.5937, lng: 78.9629 }; // geographic centre of India
const DEFAULT_ZOOM = 5;

type Alert = {
  id: string;
  title: string;
  message: string;
  severity: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  created_at: string;
  expires_at: string | null;
};

function severityColor(severity: string) {
  if (severity === "severe") return "#ef4444"; // red
  if (severity === "warning") return "#f97316"; // orange
  return "#eab308"; // yellow — info / watch
}

function dotIcon(color: string, size = 16) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function arrowIcon(directionDeg: number) {
  // wind_direction_10m is where the wind comes FROM — rotate 180° so the
  // arrow points the way the wind is actually blowing.
  const rotate = directionDeg + 180;
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${rotate}deg);color:#2563eb;filter:drop-shadow(0 0 2px white) drop-shadow(0 0 2px white)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function parseInitialView(): { center: LatLng; zoom: number } {
  if (typeof window === "undefined") return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const zoom = Number(params.get("zoom"));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { center: { lat, lng }, zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_ZOOM };
  }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}

function hasUrlView() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("lat") && params.has("lng");
}

/** Locates the visitor (GPS, falling back to network) unless a shared view was in the URL. */
function useUserLocation(skip: boolean) {
  const [coords, setCoords] = useState<LatLng | null>(null);

  useEffect(() => {
    if (skip) return;
    let done = false;
    const finish = (c: LatLng | null) => {
      if (!done) {
        done = true;
        setCoords(c);
      }
    };
    const byNetwork = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const json = (await res.json()) as { latitude?: number; longitude?: number };
        if (json.latitude != null && json.longitude != null) {
          finish({ lat: json.latitude, lng: json.longitude });
          return;
        }
      } catch {
        /* ignore */
      }
      finish(null);
    };
    if (!("geolocation" in navigator)) {
      void byNetwork();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => void byNetwork(),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, [skip]);

  return coords;
}

function RainfallLayer() {
  const { data } = useQuery({
    queryKey: ["rainviewer-frames"],
    queryFn: async () => {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const json = (await res.json()) as {
        host: string;
        radar?: { past?: Array<{ path: string }>; nowcast?: Array<{ path: string }> };
      };
      const frame =
        json.radar?.nowcast?.[json.radar.nowcast.length - 1] ??
        json.radar?.past?.[json.radar.past.length - 1];
      return frame ? `${json.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png` : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;
  return <TileLayer url={data} opacity={0.55} attribution="Rain radar © RainViewer" />;
}

type WindPoint = { lat: number; lng: number; speed: number; direction: number };

function WindLayer() {
  const map = useMap();
  const [points, setPoints] = useState<WindPoint[]>([]);

  async function loadForBounds() {
    const bounds = map.getBounds();
    const steps = 4;
    const lats: number[] = [];
    const lngs: number[] = [];
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        lats.push(bounds.getSouth() + ((bounds.getNorth() - bounds.getSouth()) * i) / (steps - 1));
        lngs.push(bounds.getWest() + ((bounds.getEast() - bounds.getWest()) * j) / (steps - 1));
      }
    }
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lngs.join(",")}` +
        `&current=wind_speed_10m,wind_direction_10m&timezone=auto`;
      const res = await fetch(url);
      const json = (await res.json()) as
        | Array<{
            latitude: number;
            longitude: number;
            current: { wind_speed_10m: number; wind_direction_10m: number };
          }>
        | {
            latitude: number;
            longitude: number;
            current: { wind_speed_10m: number; wind_direction_10m: number };
          };
      const list = Array.isArray(json) ? json : [json];
      setPoints(
        list.map((p) => ({
          lat: p.latitude,
          lng: p.longitude,
          speed: p.current.wind_speed_10m,
          direction: p.current.wind_direction_10m,
        })),
      );
    } catch {
      /* leave previous points in place */
    }
  }

  useEffect(() => {
    void loadForBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({ moveend: () => void loadForBounds() });

  return (
    <>
      {points.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]} icon={arrowIcon(p.direction)}>
          <Popup>
            {Math.round(p.speed)} km/h from {Math.round(p.direction)}°
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function AlertsLayer({ alerts }: { alerts: Alert[] }) {
  return (
    <>
      {alerts
        .filter((a) => a.latitude != null && a.longitude != null)
        .map((a) => (
          <Circle
            key={a.id}
            center={[a.latitude!, a.longitude!]}
            radius={a.radius_km * 1000}
            pathOptions={{
              color: severityColor(a.severity),
              fillColor: severityColor(a.severity),
              fillOpacity: 0.25,
            }}
          >
            <Popup>
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 text-sm">{a.message}</p>
              <p className="mt-2 text-xs capitalize text-muted-foreground">
                Severity: {a.severity}
                {a.region ? ` · ${a.region}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Valid from {new Date(a.created_at).toLocaleString()}
                {a.expires_at ? ` until ${new Date(a.expires_at).toLocaleString()}` : ""}
              </p>
            </Popup>
          </Circle>
        ))}
    </>
  );
}

function ShareViewButton({ mapRef }: { mapRef: React.RefObject<L.Map | null> }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const map = mapRef.current;
        if (!map) return;
        const c = map.getCenter();
        const url = new URL(window.location.href);
        url.searchParams.set("lat", c.lat.toFixed(4));
        url.searchParams.set("lng", c.lng.toFixed(4));
        url.searchParams.set("zoom", String(map.getZoom()));
        void navigator.clipboard.writeText(url.toString()).then(
          () => toast.success("Map link copied to clipboard"),
          () => toast.error("Couldn't copy the link"),
        );
      }}
    >
      <Share2 className="size-4" /> Share map view
    </Button>
  );
}

function MapPage() {
  const skipGeolocation = hasUrlView();
  const [{ center, zoom }] = useState(parseInitialView);
  const located = useUserLocation(skipGeolocation);
  const mapRef = useRef<L.Map | null>(null);

  const [layers, setLayers] = useState({ alerts: true, rainfall: false, wind: false });

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["public-alerts-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select(
          "id,title,message,severity,region,latitude,longitude,radius_km,active,created_at,expires_at",
        )
        .eq("active", true);
      const now = Date.now();
      return (data ?? []).filter(
        (a) => !a.expires_at || new Date(a.expires_at).getTime() > now,
      ) as Alert[];
    },
  });

  const unlocated = (alerts ?? []).filter((a) => a.latitude == null || a.longitude == null).length;

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Weather map</h1>
            <p className="mt-2 text-muted-foreground">
              Active alerts, live rainfall radar and wind — open to every signed-in account.
            </p>
          </div>
          <ShareViewButton mapRef={mapRef} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={layers.alerts ? "default" : "outline"}
            onClick={() => setLayers((l) => ({ ...l, alerts: !l.alerts }))}
          >
            <TriangleAlert className="size-4" /> Alerts
          </Button>
          <Button
            size="sm"
            variant={layers.rainfall ? "default" : "outline"}
            onClick={() => setLayers((l) => ({ ...l, rainfall: !l.rainfall }))}
          >
            <CloudRain className="size-4" /> Rainfall (next 24h)
          </Button>
          <Button
            size="sm"
            variant={layers.wind ? "default" : "outline"}
            onClick={() => setLayers((l) => ({ ...l, wind: !l.wind }))}
          >
            <WindIcon className="size-4" /> Wind
          </Button>
        </div>

        <div className="relative mt-4 h-[70vh] w-full overflow-hidden rounded-2xl border border-border/60">
          <MapContainer
            ref={mapRef}
            center={[center.lat, center.lng]}
            zoom={zoom}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {layers.rainfall && <RainfallLayer />}
            {layers.wind && <WindLayer />}
            {layers.alerts && alerts && <AlertsLayer alerts={alerts} />}
            {located && (
              <Marker position={[located.lat, located.lng]} icon={dotIcon("#2563eb")}>
                <Popup>You are here</Popup>
              </Marker>
            )}
          </MapContainer>

          {isLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-border/60 bg-background/90 p-3 text-xs shadow-sm backdrop-blur">
            <p className="font-medium">Alert severity</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: severityColor("severe") }}
              />{" "}
              Severe
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: severityColor("warning") }}
              />{" "}
              Warning
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: severityColor("watch") }}
              />{" "}
              Watch / info
            </div>
          </div>
        </div>

        {unlocated > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {unlocated} active alert{unlocated > 1 ? "s don't" : " doesn't"} have a map location set
            yet — add latitude/longitude in the admin panel to show{unlocated > 1 ? "them" : "it"}{" "}
            here.
          </p>
        )}
      </div>
    </SiteLayout>
  );
}
