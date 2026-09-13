import { createServerFn } from "@tanstack/react-start";

export type PublicWeather = {
  place: string;
  temperature: number;
  apparent: number;
  humidity: number | null;
  wind: number | null;
  precipitation: number | null;
  code: number;
  high: number | null;
  low: number | null;
  risks: WeatherRisk[];
};

export type WeatherRisk = {
  date: string;
  type: "flood" | "cyclone" | "thunderstorm" | "heatwave" | "cold_wave";
  severity: "watch" | "warning" | "severe";
  label: string;
  detail: string;
};

type DailyRiskInput = {
  time: string[];
  weather_code?: number[];
  precipitation_probability_max?: number[];
  precipitation_sum?: number[];
  wind_speed_10m_max?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
};

/**
 * Threshold-based risk flags derived from the same physics-based forecast
 * models the app already calls (Open-Meteo). This is NOT extrapolated from
 * historical averages — it just calls out when the forecast itself crosses
 * known danger thresholds, so they're easy to spot instead of buried in
 * numbers. "severity" mirrors the admin alert scale (watch < warning < severe)
 * so these can share the same colour coding on the map (yellow/orange/red).
 *
 * Thresholds:
 *  - Rainfall > 50mm/day        -> Flood risk
 *  - Wind > 60 km/h             -> Cyclone / storm risk
 *  - Thunderstorm-coded day with
 *    precipitation chance > 70% -> Thunderstorm warning
 *    (Open-Meteo has no standalone "thunderstorm probability" field, so this
 *    uses precipitation_probability_max on days the model codes as a
 *    thunderstorm as the closest available proxy.)
 *  - Temperature > 45°C         -> Heatwave alert
 *  - Temperature < 5°C          -> Cold wave warning
 */
export function assessRisks(daily: DailyRiskInput): WeatherRisk[] {
  const risks: WeatherRisk[] = [];
  const days = daily.time ?? [];

  for (let i = 0; i < days.length; i++) {
    const date = days[i]!;
    const precipSum = daily.precipitation_sum?.[i] ?? 0;
    const precipProb = daily.precipitation_probability_max?.[i] ?? 0;
    const windMax = daily.wind_speed_10m_max?.[i] ?? 0;
    const tempMax = daily.temperature_2m_max?.[i] ?? -Infinity;
    const tempMin = daily.temperature_2m_min?.[i] ?? Infinity;
    const code = daily.weather_code?.[i] ?? 0;

    if (precipSum > 50) {
      risks.push({
        date,
        type: "flood",
        severity: precipSum > 100 ? "severe" : "warning",
        label: "Flood risk",
        detail: `Expected rainfall of ${Math.round(precipSum)}mm — heavy enough to cause local flooding.`,
      });
    }

    if (windMax > 60) {
      risks.push({
        date,
        type: "cyclone",
        severity: windMax > 100 ? "severe" : "warning",
        label: "Cyclone / storm risk",
        detail: `Wind speeds up to ${Math.round(windMax)} km/h expected.`,
      });
    }

    if ((code === 95 || code === 96 || code === 99) && precipProb > 70) {
      risks.push({
        date,
        type: "thunderstorm",
        severity: code === 95 ? "warning" : "severe",
        label: "Thunderstorm warning",
        detail: `${Math.round(precipProb)}% chance of thunderstorms${code !== 95 ? ", possible hail" : ""}.`,
      });
    }

    if (tempMax > 45) {
      risks.push({
        date,
        type: "heatwave",
        severity: tempMax > 47 ? "severe" : "warning",
        label: "Heatwave alert",
        detail: `High of ${Math.round(tempMax)}°C — heatstroke risk, avoid strenuous outdoor activity.`,
      });
    }

    if (tempMin < 5) {
      risks.push({
        date,
        type: "cold_wave",
        severity: tempMin < 0 ? "severe" : "warning",
        label: "Cold wave warning",
        detail: `Low of ${Math.round(tempMin)}°C expected.`,
      });
    }
  }

  return risks;
}

const WEATHER_TEXT: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export function describeWeather(code: number) {
  return WEATHER_TEXT[code] ?? "Mixed conditions";
}

export const getPublicWeather = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { latitude?: number; longitude?: number; place?: string } | undefined) => ({
      latitude: input?.latitude,
      longitude: input?.longitude,
      place: input?.place,
    }),
  )
  .handler(async ({ data }): Promise<PublicWeather> => {
    let latitude = data.latitude;
    let longitude = data.longitude;
    let place = data.place ?? "";

    if (latitude == null || longitude == null) {
      const query = place || "Dhaka";
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
      );
      const geo = (await geoRes.json()) as {
        results?: Array<{ name: string; country?: string; latitude: number; longitude: number }>;
      };
      const hit = geo.results?.[0];
      if (!hit) throw new Error("Could not find that place.");
      latitude = hit.latitude;
      longitude = hit.longitude;
      place = [hit.name, hit.country].filter(Boolean).join(", ");
    }

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&forecast_days=7&timezone=auto`,
    );
    if (!res.ok) throw new Error("Weather service unavailable.");
    const json = (await res.json()) as {
      current: Record<string, number>;
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weather_code: number[];
        precipitation_probability_max: number[];
        precipitation_sum: number[];
        wind_speed_10m_max: number[];
      };
    };

    if (!place) {
      const revRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      ).catch(() => null);
      if (revRes?.ok) {
        const rev = (await revRes.json()) as {
          city?: string;
          locality?: string;
          countryName?: string;
        };
        place = [rev.city || rev.locality, rev.countryName].filter(Boolean).join(", ");
      }
    }

    return {
      place: place || "Your location",
      temperature: json.current["temperature_2m"]!,
      apparent: json.current["apparent_temperature"]!,
      humidity: json.current["relative_humidity_2m"] ?? null,
      wind: json.current["wind_speed_10m"] ?? null,
      precipitation: json.current["precipitation"] ?? null,
      code: json.current["weather_code"] ?? 0,
      high: json.daily?.temperature_2m_max?.[0] ?? null,
      low: json.daily?.temperature_2m_min?.[0] ?? null,
      risks: json.daily ? assessRisks(json.daily) : [],
    };
  });
