// Thin wrapper around the browser's built-in Web Speech APIs. No API key,
// no external service — support varies by browser (well-supported in
// Chrome/Edge/Safari, not in Firefox), so every export is safe to call
// where unsupported and simply no-ops / reports unsupported.

interface SpeechAlternativeLike {
  transcript: string;
}
interface SpeechResultLike extends ArrayLike<SpeechAlternativeLike> {
  isFinal: boolean;
}
type SpeechResultListLike = ArrayLike<SpeechResultLike>;
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechResultListLike;
}
interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** A curated set of languages relevant to Indian users, for both mic input and read-aloud replies. */
export const VOICE_LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "bn-IN", label: "বাংলা (Bengali)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "mr-IN", label: "मराठी (Marathi)" },
  { code: "gu-IN", label: "ગુજરાતી (Gujarati)" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml-IN", label: "മലയാളം (Malayalam)" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ur-IN", label: "اردو (Urdu)" },
] as const;

export type VoiceListener = {
  stop: () => void;
};

/**
 * Starts listening and streams transcripts back via onResult (called
 * repeatedly with interim text, then once more with isFinal=true). Returns
 * null if the browser doesn't support speech recognition at all.
 */
export function startListening(
  lang: string,
  onResult: (transcript: string, isFinal: boolean) => void,
  onEnd: () => void,
  onError: (message: string) => void,
): VoiceListener | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const recognizer = new Ctor();
  recognizer.lang = lang;
  recognizer.continuous = false;
  recognizer.interimResults = true;

  recognizer.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alt = result?.[0];
      if (!alt) continue;
      if (result.isFinal) finalText += alt.transcript;
      else interimText += alt.transcript;
    }
    if (finalText.trim()) onResult(finalText.trim(), true);
    else if (interimText.trim()) onResult(interimText.trim(), false);
  };
  recognizer.onerror = (event) => {
    onError(
      event.error === "not-allowed" || event.error === "permission-denied"
        ? "Microphone access was blocked — allow it in your browser settings to use voice input."
        : "Couldn't hear that — please try again.",
    );
  };
  recognizer.onend = onEnd;

  try {
    recognizer.start();
  } catch {
    return null;
  }
  return { stop: () => recognizer.stop() };
}

/** Reads text aloud. Cancels anything already speaking first (only one reply plays at a time). */
export function speak(text: string, lang: string, onEnd?: () => void): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  window.speechSynthesis.cancel();
  // Markdown syntax reads awkwardly aloud (asterisks, bullets) — strip the basics.
  const plain = text
    .replace(/[*_#>`]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, ". ");
  const utterance = new SpeechSynthesisUtterance(plain);
  utterance.lang = lang;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
