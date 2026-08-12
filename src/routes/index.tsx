import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, ArrowLeft, Sparkles, Calendar, Clock, MapPin, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Wedding } from "@/components/wedding/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "טרמפים לחתונה — צרו או בחרו חתונה" },
      { name: "description", content: "צרו דף תיאום טרמפים לחתונה משלכם, או היכנסו לחתונה קיימת." },
    ],
  }),
  component: Landing,
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const STEPS = 3;

function Landing() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: weddings } = useQuery({
    queryKey: ["weddings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Wedding[];
    },
  });

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return date.trim().length > 0;
    if (step === 2) return location.trim().length > 0;
    return false;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step < STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleCreate();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleCreate = async () => {
    const finalName = name.trim();
    const finalSlug = slugify(finalName);
    if (!finalName) return toast.error("יש להזין שם לחתונה");
    if (finalSlug.length < 2)
      return toast.error("שם החתונה חייב לכלול לפחות 2 תווים באנגלית או ספרות");

    setCreating(true);
    const { data, error } = await supabase
      .from("weddings")
      .insert({
        name: finalName,
        slug: finalSlug,
        wedding_date: date || null,
        wedding_time: time || null,
        wedding_location: location.trim() || null,
      })
      .select()
      .maybeSingle();
    setCreating(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("החתונה הזו כבר קיימת — בחרו שם אחר");
      } else {
        toast.error("שגיאה ביצירה: " + error.message);
      }
      return;
    }
    qc.invalidateQueries({ queryKey: ["weddings"] });
    toast.success("החתונה נוצרה!");
    navigate({ to: "/w/$slug", params: { slug: data!.slug } });
  };

  return (
    <div className="min-h-screen pb-16">
      <header className="px-4 pt-12 pb-8 text-center">
        <div className="inline-flex items-center justify-center gap-2 text-gold mb-3">
          <Heart className="h-5 w-5 fill-current" />
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            תיאום טרמפים
          </span>
          <Heart className="h-5 w-5 fill-current" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">
          טרמפים לחתונה
        </h1>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
          צרו דף חדש לחתונה שלכם, או היכנסו לחתונה קיימת.
          <br />כל חתונה היא לגמרי נפרדת — עם קישור משלה לשיתוף.
        </p>
      </header>

      <main className="px-4 max-w-xl mx-auto space-y-8">
        {/* Create new — wizard */}
        <section className="rounded-2xl bg-card border border-border shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-semibold text-primary">חתונה חדשה</h2>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {Array.from({ length: STEPS }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className={
                    "h-2 rounded-full transition-all duration-300 " +
                    (i < step
                      ? "bg-primary flex-1"
                      : i === step
                        ? "bg-primary flex-1"
                        : "bg-secondary flex-1")
                  }
                />
              </div>
            ))}
          </div>

          {/* Step 0: Name */}
          {step === 0 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <Label>שם החתונה</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="לדוגמה: דנה ויוסי"
                  required
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                הקישור לחתונה ייווצר אוטומטית מהשם שתבחרו.
              </p>
            </div>
          )}

          {/* Step 1: Date & Time */}
          {step === 1 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  תאריך החתונה
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  שעת החתונה
                </Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="19:00"
                />
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  מיקום החתונה
                </Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="כתובת אולם האירועים"
                  required
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                המיקום ישמש כיעד קבוע לכל הרכבים — נוסעים לחתונה יצאו אליו, ונוסעים חזרה יצאו ממנו.
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-2 mt-5">
            {step > 0 && (
              <Button type="button" variant="ghost" onClick={handleBack} className="flex-1">
                חזור
              </Button>
            )}
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || creating}
              className="flex-1 h-11 gap-2"
            >
              {creating ? (
                "יוצר…"
              ) : step === STEPS - 1 ? (
                <>
                  <Check className="h-4 w-4" />
                  צור חתונה
                </>
              ) : (
                "המשך"
              )}
            </Button>
          </div>
        </section>

        {/* Existing */}
        {weddings && weddings.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              חתונות קיימות
            </h2>
            <ul className="space-y-2">
              {weddings.map((w) => (
                <li key={w.id}>
                  <Link
                    to="/w/$slug"
                    params={{ slug: w.slug }}
                    className="flex items-center justify-between rounded-xl bg-card/70 border border-border hover:border-primary hover:bg-card transition p-4 group"
                  >
                    <div className="text-right">
                      <div className="font-semibold text-primary">{w.name}</div>
                      <div className="text-xs text-muted-foreground font-mono" dir="ltr">/w/{w.slug}</div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
