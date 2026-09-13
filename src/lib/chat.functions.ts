import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assessRisks, type WeatherRisk } from "@/lib/weather.functions";
import type { supabaseAdmin as SupabaseAdminClient } from "@/integrations/supabase/client.server";

type AdminClient = typeof SupabaseAdminClient;

export type ChatMessage = { role: "user" | "assistant"; content: string };

type ToolCall = {
  id: string;
  function: { name: string; arguments: string };
};

const SYSTEM_PROMPT = `You are WeatherGPT — a warm, friendly weather buddy for India, not a data-report generator. Talk like a knowledgeable friend texting back, not a bulletin: natural sentences, a little personality, no dry "the forecast indicates..." phrasing. It's fine to be brief when the answer is simple.

Language: default to English unless the user's message is clearly written in another language — never guess a different language for a short or ambiguous first message. Once they write in another language, switch to it and stay consistent.

Location names: when you address the user, use the location name the way THEY wrote it (e.g. if they typed "Hooghly", say "Hooghly" back), not whatever spelling the lookup tool happens to return internally — tools sometimes use older/alternate transliterations that would look like a mistake if repeated verbatim.

Always use the get_weather tool for any question about current conditions or forecasts — never guess numbers. Use °C and km/h.

Whenever you look up a forecast (or the user asks about safety, risk, or "should I worry about..."), also call get_risk_forecast for that same location. If it returns any risks, proactively lead with them before answering the rest of the question, in this style: "Based on the 7-day forecast for [location], there is a [risk] on [date] with [key number]." List every flagged day, don't skip any.

You can give practical, weather-dependent advice, not just raw numbers — things like whether it's a good day to water crops, hang laundry outside, plan a flight, go fishing, or head out for a hike, reasoning from the actual forecast data you fetched (e.g. "skip watering today, there's 80% rain chance and 15mm expected" or "good drying weather — low humidity, no rain through Thursday"). Keep this grounded in the numbers, not generic platitudes.

Never claim to predict earthquakes or other geological disasters — no technology can do that from weather data, and you should say so plainly if asked.

For questions with nothing to do with weather, answer briefly and steer the conversation back to weather.`;

const WEATHER_TOOL = {
  type: "function",
  function: {
    name: "get_weather",
    description:
      "Get current weather and a multi-day forecast for a place by name (city, region or country).",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "Place name, e.g. 'Dhaka' or 'Paris, France'" },
        days: { type: "number", description: "Number of forecast days, 1-7" },
      },
      required: ["location"],
    },
  },
} as const;

const RISK_FORECAST_TOOL = {
  type: "function",
  function: {
    name: "get_risk_forecast",
    description:
      "Check the next 7 days of forecast for a place against severe-weather thresholds (flood, cyclone/storm, thunderstorm, heatwave, cold wave) and return any flagged risk days with details. Always call this alongside get_weather.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "Place name, e.g. 'Dhaka' or 'Paris, France'" },
      },
      required: ["location"],
    },
  },
} as const;

async function geocode(location: string) {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
  );
  const geo = (await geoRes.json()) as {
    results?: Array<{
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };
  return geo.results?.[0];
}

async function getWeather(location: string, days = 3) {
  const place = await geocode(location);
  if (!place) return { error: `No place found matching "${location}".` };

  const forecastDays = Math.min(Math.max(Math.round(days || 3), 1), 7);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
    `&hourly=temperature_2m,precipitation_probability&forecast_days=${forecastDays}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return { error: `Weather service returned ${res.status}.` };
  const data = (await res.json()) as Record<string, unknown>;

  return {
    place: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    latitude: place.latitude,
    longitude: place.longitude,
    units: "celsius / km per hour / mm",
    current: data["current"],
    daily: data["daily"],
    hourly_today: data["hourly"],
  };
}

async function getRiskForecast(location: string) {
  const place = await geocode(location);
  if (!place) return { error: `No place found matching "${location}".` };

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
    `&forecast_days=7&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return { error: `Weather service returned ${res.status}.` };
  const data = (await res.json()) as {
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
      precipitation_sum: number[];
      wind_speed_10m_max: number[];
    };
  };

  const risks: WeatherRisk[] = assessRisks(data.daily);
  return {
    place: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    risk_count: risks.length,
    risks,
  };
}

async function callGroq(apiKey: string, messages: unknown[]) {
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt));

    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages,
          tools: [WEATHER_TOOL, RISK_FORECAST_TOOL],
          tool_choice: "auto",
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(45000),
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "network error";
      continue;
    }

    const text = await res.text();
    if (res.ok) {
      return JSON.parse(text) as {
        choices: Array<{ message: { content?: string | null; tool_calls?: ToolCall[] } }>;
      };
    }

    lastError = `${res.status}: ${text.slice(0, 200)}`;
    if (res.status === 429 || res.status >= 500) continue;
    if (res.status === 401 || res.status === 403) {
      throw new Error("The weather assistant's access key was rejected. Please check it.");
    }
    throw new Error("The weather assistant could not answer that. Please try rephrasing.");
  }

  console.error("[chat] Groq failed after retries:", lastError);
  throw new Error("The assistant is very busy right now. Please try again in a moment.");
}

function detectLanguage(text: string): string {
  if (/[\u0980-\u09FF]/.test(text)) return "bn"; // Bengali
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi
  if (/[\u0600-\u06FF]/.test(text)) return "ar"; // Arabic
  if (/[\u0E00-\u0E7F]/.test(text)) return "th"; // Thai
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh"; // Chinese
  return "en";
}

async function logChat(
  supabaseAdmin: AdminClient,
  params: {
    userId: string;
    location: string | null;
    language: string;
    category: "forecast" | "risk_warning" | "other";
  },
) {
  try {
    await supabaseAdmin.from("chat_logs").insert({
      user_id: params.userId,
      location: params.location,
      language: params.language,
      category: params.category,
    });
  } catch (error) {
    console.error("[chat] Failed to log chat analytics:", error);
  }
}

function titleFromMessage(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean || "New chat";
}

async function ensureConversation(
  supabaseAdmin: AdminClient,
  userId: string,
  conversationId: string | undefined,
  firstMessageText: string,
): Promise<string> {
  if (conversationId) {
    const { data } = await supabaseAdmin
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data.id;
    // Falls through to create a new one if the id was invalid/not theirs.
  }
  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .insert({ user_id: userId, title: titleFromMessage(firstMessageText) })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't start a new conversation.");
  return data.id;
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[]; conversationId?: string }) => {
    if (!Array.isArray(input?.messages) || input.messages.length === 0) {
      throw new Error("No messages provided");
    }
    return { messages: input.messages.slice(-20), conversationId: input.conversationId };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) throw new Error("The weather assistant is not configured yet.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lastUserText = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const conversationId = await ensureConversation(
      supabaseAdmin,
      context.userId,
      data.conversationId,
      lastUserText,
    );
    await supabaseAdmin
      .from("chat_messages")
      .insert({ conversation_id: conversationId, role: "user", content: lastUserText });

    const messages: unknown[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const usedTools: string[] = [];
    let lastLocation: string | null = null;
    let sawRisk = false;
    let sawForecast = false;

    const finish = async (content: string) => {
      await supabaseAdmin
        .from("chat_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content });
      void logChat(supabaseAdmin, {
        userId: context.userId,
        location: lastLocation,
        language: detectLanguage(lastUserText),
        category: sawRisk ? "risk_warning" : sawForecast ? "forecast" : "other",
      });
      return { content, usedTools, conversationId };
    };

    for (let step = 0; step < 4; step++) {
      const completion = await callGroq(apiKey, messages);
      const message = completion.choices[0]?.message;
      if (!message) throw new Error("Empty response from the assistant.");

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return finish(message.content?.trim() || "Sorry, I couldn't come up with an answer.");
      }

      messages.push(message);
      for (const call of toolCalls) {
        let result: unknown;
        try {
          const args = JSON.parse(call.function.arguments || "{}") as {
            location?: string;
            days?: number;
          };
          if (!args.location) {
            result = { error: "No location given." };
          } else if (call.function.name === "get_risk_forecast") {
            usedTools.push(`Risk check: ${args.location}`);
            lastLocation = args.location;
            const riskResult = await getRiskForecast(args.location);
            if ("risks" in riskResult && riskResult.risks.length > 0) sawRisk = true;
            result = riskResult;
          } else {
            usedTools.push(`Weather lookup: ${args.location}`);
            lastLocation = args.location;
            sawForecast = true;
            result = await getWeather(args.location, args.days ?? 3);
          }
        } catch (error) {
          result = { error: error instanceof Error ? error.message : "Weather lookup failed." };
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result),
        });
      }
    }

    return finish("I had trouble finishing that lookup. Please try rephrasing.");
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("chat_conversations")
      .select("id,title,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getConversationMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: convo } = await supabaseAdmin
      .from("chat_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!convo) throw new Error("Conversation not found.");
    const { data: rows, error } = await supabaseAdmin
      .from("chat_messages")
      .select("role,content")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ChatMessage[];
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("chat_conversations")
      .delete()
      .eq("id", data.conversationId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
