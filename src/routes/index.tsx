import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function Landing() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteWedding, setDeleteWedding] = useState<Wedding | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const effectiveSlug = slugTouched ? slugify(slug) : slugify(name);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    const finalSlug = effectiveSlug;
    if (!finalName) return toast.error("יש להזין שם לחתונה");
    if (finalSlug.length < 2) return toast.error("כתובת ה־URL חייבת לכלול לפחות 2 תווים (אותיות באנגלית/ספרות/מקפים)");

    setCreating(true);
    const { data, error } = await supabase
      .from("weddings")
      .insert({ name: finalName, slug: finalSlug })
      .select()
      .maybeSingle();
    setCreating(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("הכתובת הזו תפוסה — בחרו אחרת");
      } else {
        toast.error("שגיאה ביצירה: " + error.message);
      }
      return;
    }
    qc.invalidateQueries({ queryKey: ["weddings"] });
    toast.success("החתונה נוצרה!");
    navigate({ to: "/w/$slug", params: { slug: data!.slug } });
  };

  const closeDeleteDialog = () => {
    setDeleteWedding(null);
  };

  const handleDeleteWedding = async () => {
    if (!deleteWedding) return;

    setDeleting(true);
    const { data, error } = await supabase
      .from("weddings")
      .delete()
      .eq("id", deleteWedding.id)
      .select("id")
      .maybeSingle();
    setDeleting(false);

    if (error) {
      toast.error("שגיאה במחיקה: " + error.message);
      return;
    }

    if (!data) {
      toast.error("החתונה לא נמחקה. יש לעדכן את הרשאות המחיקה במסד הנתונים.");
      return;
    }

    toast.success("החתונה נמחקה");
    closeDeleteDialog();
    qc.invalidateQueries({ queryKey: ["weddings"] });
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
        {/* Create new */}
        <section className="rounded-2xl bg-card border border-border shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-semibold text-primary">חתונה חדשה</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label>שם החתונה</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: דנה ויוסי"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>כתובת הקישור</Label>
              <div className="flex items-center gap-1 text-sm" dir="ltr">
                <span className="text-muted-foreground">/w/</span>
                <Input
                  value={slugTouched ? slug : effectiveSlug}
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
                  placeholder="dana-yossi"
                  className="font-mono"
                  dir="ltr"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                אותיות אנגלית קטנות, ספרות ומקפים בלבד. זה מה שיופיע בקישור שתשתפו.
              </p>
            </div>
            <Button type="submit" disabled={creating} className="w-full h-11 gap-2">
              <Plus className="h-4 w-4" />
              {creating ? "יוצר…" : "צור חתונה חדשה"}
            </Button>
          </form>
        </section>

        {/* Existing */}
        {weddings && weddings.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              חתונות קיימות
            </h2>
            <ul className="space-y-2">
              {weddings.map((w) => (
                <li key={w.id} className="flex items-stretch gap-2">
                  <Link
                    to="/w/$slug"
                    params={{ slug: w.slug }}
                    className="flex min-w-0 flex-1 items-center justify-between rounded-xl bg-card/70 border border-border hover:border-primary hover:bg-card transition p-4 group"
                  >
                    <div className="text-right">
                      <div className="font-semibold text-primary">{w.name}</div>
                      <div className="text-xs text-muted-foreground font-mono" dir="ltr">/w/{w.slug}</div>
                    </div>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-auto w-12 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                    aria-label={`מחק את ${w.name}`}
                    onClick={() => {
                      setDeleteWedding(w);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Dialog
        open={!!deleteWedding}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>מחיקת חתונה</DialogTitle>
            <DialogDescription>
              האם אתם בטוחים שתרצו למחוק את החתונה הזו?
            </DialogDescription>
          </DialogHeader>
          {deleteWedding && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <div className="font-medium text-foreground">{deleteWedding.name}</div>
                <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                  /w/{deleteWedding.slug}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                פעולה זו תמחק גם את כל הרכבים וכל הנוסעים של החתונה.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={closeDeleteDialog}>
              ביטול
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteWedding}
            >
              {deleting ? "מוחק..." : "מחיקה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
