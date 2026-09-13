import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CloudSun,
  Send,
  Loader2,
  History,
  Plus,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  sendChatMessage,
  listConversations,
  getConversationMessages,
  deleteConversation,
  type ChatMessage,
} from "@/lib/chat.functions";
import {
  startListening,
  speak,
  stopSpeaking,
  VOICE_LANGUAGES,
  type VoiceListener,
} from "@/lib/voice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Weather chat — WeatherGPT" },
      {
        name: "description",
        content: "Chat with WeatherGPT and get live forecast answers for any location.",
      },
      { property: "og:title", content: "Weather chat — WeatherGPT" },
      { property: "og:description", content: "Live forecast answers in a conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Chat,
});

const SUGGESTIONS = [
  "Will it rain in Dhaka tomorrow afternoon?",
  "Compare the weekend weather in Paris and Rome",
  "Is it windy in Reykjavik right now?",
];

function HistoryPanel({
  activeId,
  onSelect,
  onNewChat,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  const queryClient = useQueryClient();
  const fetchConversations = useServerFn(listConversations);
  const removeConversation = useServerFn(deleteConversation);
  const { data: conversations } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => fetchConversations(),
  });

  return (
    <div className="flex h-full flex-col">
      <Button variant="outline" className="justify-start" onClick={onNewChat}>
        <Plus className="size-4" /> New chat
      </Button>
      <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
        {conversations?.length === 0 && (
          <p className="px-2 text-sm text-muted-foreground">No past chats yet.</p>
        )}
        {conversations?.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg px-2 py-2 text-sm",
              c.id === activeId ? "bg-accent" : "hover:bg-accent/60",
            )}
          >
            <button className="flex-1 truncate text-left" onClick={() => onSelect(c.id)}>
              {c.title}
            </button>
            <button
              className="opacity-0 transition-opacity group-hover:opacity-100"
              title="Delete conversation"
              onClick={async () => {
                try {
                  await removeConversation({ data: { conversationId: c.id } });
                  queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
                  if (c.id === activeId) onNewChat();
                } catch {
                  toast.error("Couldn't delete that conversation.");
                }
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chat() {
  const send = useServerFn(sendChatMessage);
  const fetchMessages = useServerFn(getConversationMessages);
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>("en-IN");
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listenerRef = useRef<VoiceListener | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    // Stop any mic/playback in progress if the page is left.
    return () => {
      listenerRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  async function selectConversation(id: string) {
    setHistoryOpen(false);
    setBusy(true);
    try {
      const rows = await fetchMessages({ data: { conversationId: id } });
      setConversationId(id);
      setMessages(rows);
    } catch {
      toast.error("Couldn't load that conversation.");
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await send({
        data: conversationId ? { messages: next, conversationId } : { messages: next },
      });
      const withReply = [...next, { role: "assistant" as const, content: result.content }];
      setMessages(withReply);
      setConversationId(result.conversationId);
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      if (voiceMode) {
        const replyIndex = withReply.length - 1;
        const ok = speak(result.content, voiceLang, () => setSpeakingIndex(null));
        if (ok) setSpeakingIndex(replyIndex);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The assistant couldn't answer right now.",
      );
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  function toggleListening() {
    if (listening) {
      listenerRef.current?.stop();
      listenerRef.current = null;
      setListening(false);
      return;
    }
    const listener = startListening(
      voiceLang,
      (transcript, isFinal) => {
        setInput(transcript);
        if (isFinal) {
          listenerRef.current = null;
          setListening(false);
          if (voiceMode) void ask(transcript);
        }
      },
      () => {
        listenerRef.current = null;
        setListening(false);
      },
      (message) => {
        toast.error(message);
        listenerRef.current = null;
        setListening(false);
      },
    );
    if (!listener) {
      toast.error("Voice input isn't supported in this browser — try Chrome, Edge, or Safari.");
      return;
    }
    listenerRef.current = listener;
    setListening(true);
  }

  function toggleSpeak(index: number, content: string) {
    if (speakingIndex === index) {
      stopSpeaking();
      setSpeakingIndex(null);
      return;
    }
    const ok = speak(content, voiceLang, () => setSpeakingIndex(null));
    if (!ok) {
      toast.error("Voice playback isn't supported in this browser.");
      return;
    }
    setSpeakingIndex(index);
  }

  return (
    <SiteLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CloudSun className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold">Weather chat</h1>
              <p className="text-sm text-muted-foreground">
                Ask about anywhere — answers use live forecast data.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={newChat}>
              <Plus className="size-4" /> New
            </Button>
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="size-4" /> History
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-4">
                <SheetHeader className="px-0">
                  <SheetTitle>Chat history</SheetTitle>
                </SheetHeader>
                <div className="mt-2 h-[calc(100vh-6rem)]">
                  <HistoryPanel
                    activeId={conversationId}
                    onSelect={selectConversation}
                    onNewChat={newChat}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={voiceLang} onValueChange={setVoiceLang}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={voiceMode ? "default" : "outline"}
            onClick={() => setVoiceMode((v) => !v)}
            title="When on, speaking your question auto-sends it and replies are read aloud"
          >
            {voiceMode ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            Voice mode {voiceMode ? "on" : "off"}
          </Button>
        </div>

        <div className="mt-6 min-h-[50vh] space-y-5">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-border/60 bg-accent/30 p-6">
              <p className="text-sm font-medium">Try one of these</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl text-sm leading-relaxed",
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-primary px-4 py-3 text-primary-foreground"
                    : "space-y-3 text-foreground [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold",
                )}
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <>
                    <button
                      onClick={() => toggleSpeak(i, m.content)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {speakingIndex === i ? (
                        <>
                          <VolumeX className="size-3.5" /> Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="size-3.5" /> Listen
                        </>
                      )}
                    </button>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking the forecast…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="sticky bottom-4 mt-6 rounded-2xl border border-border/60 bg-card p-2 shadow-sm"
        >
          {listening && (
            <p className="flex items-center gap-1.5 px-2 pt-1 text-xs text-primary">
              <Mic className="size-3.5 animate-pulse" /> Listening…
            </p>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={2}
            placeholder="Ask about the weather anywhere…"
            className="resize-none border-0 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-end gap-2 px-1 pb-1">
            <Button
              type="button"
              variant={listening ? "default" : "outline"}
              size="icon"
              onClick={toggleListening}
              title={listening ? "Stop listening" : "Speak your question"}
            >
              {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Button type="submit" size="sm" disabled={busy || !input.trim()}>
              <Send className="size-4" /> Send
            </Button>
          </div>
        </form>
      </div>
    </SiteLayout>
  );
}
