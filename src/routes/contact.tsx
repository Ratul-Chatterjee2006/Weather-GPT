import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageSquare, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact WeatherGPT — Questions, feedback, partnerships" },
      {
        name: "description",
        content:
          "Send the WeatherGPT team a message about product feedback, data questions or partnership ideas.",
      },
      { property: "og:title", content: "Contact WeatherGPT" },
      { property: "og:description", content: "Get in touch with the WeatherGPT team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name,
      email: form.email,
      subject: form.subject || null,
      message: form.message,
    });
    setBusy(false);
    if (error) {
      toast.error("Message could not be sent. Please try again.");
      return;
    }
    toast.success("Thanks! We'll get back to you soon.");
    setForm({ name: "", email: "", subject: "", message: "" });
  }

  return (
    <SiteLayout>
      <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 md:grid-cols-[1fr_1.2fr] md:py-24">
        <div>
          <p className="font-medium text-primary">Contact</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
            Tell us what you need
          </h1>
          <p className="mt-4 text-muted-foreground">
            Feedback, a bug, a data question, or an idea for working together — it all lands in the
            same inbox and we read every message.
          </p>
          <div className="mt-8 space-y-5 text-sm">
            <div className="flex gap-3">
              <Mail className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-muted-foreground">hello@weathergpt.app</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MessageSquare className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-medium">Product feedback</p>
                <p className="text-muted-foreground">
                  Use the form — it reaches the team directly.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-medium">Response time</p>
                <p className="text-muted-foreground">Usually within two business days.</p>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  required
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Sending…" : "Send message"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </SiteLayout>
  );
}
