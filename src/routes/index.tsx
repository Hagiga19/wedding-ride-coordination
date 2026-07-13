import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, ArrowLeft, Sparkles, Trash2, MapPin, Lock, LogOut } from "lucide-react";
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

function makeFallbackSlug(): string {
  return `wedding-${Math.random().toString(36).slice(2, 8)}`;
}

function weddingUrl(wedding: Pick<Wedding, "slug" | "guest_token">): string {
  return `/#/w/${encodeURIComponent(wedding.slug)}?access=${encodeURIComponent(wedding.guest_token)}`;
}

const ADMIN_STORAGE_KEY = "wedding-ride-admin-key";

function Landing() {
  const qc = useQueryClient();
  const [adminKey, setAdminKey] = useState("");
  const [adminInput, setAdminInput] = useState("");
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fallbackSlug, setFallbackSlug] = useState(makeFallbackSlug);
  const [creating, setCreating] = useState(false);
  const [deleteWedding, setDeleteWedding] = useState<Wedding | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const storedKey = window.localStorage.getItem(ADMIN_STORAGE_KEY) ?? "";
    setAdminKey(storedKey);
    setAdminInput(storedKey);
    setAdminLoaded(true);
  }, []);

  const { data: weddings, error: weddingsError } = useQuery({
    queryKey: ["weddings", adminKey],
    enabled: adminLoaded && !!adminKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_weddings_admin", {
        p_admin_key: adminKey,
      });
      if (error) throw error;
      return (data ?? []) as Wedding[];
    },
  });

  const effectiveSlug = slugify(slug);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) {
      const nextSlug = slugify(value);
      setSlug(value.trim() ? nextSlug || fallbackSlug : "");
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextAdminKey = adminInput.trim();
    if (!nextAdminKey) {
      toast.error("יש להזין סיסמת ניהול");
      return;
    }

    setCheckingAdmin(true);
    const { data, error } = await supabase.rpc("is_wedding_admin", {
      p_admin_key: nextAdminKey,
    });
    setCheckingAdmin(false);

    if (error || !data) {
      toast.error("סיסמת הניהול לא נכונה");
      return;
    }

    window.localStorage.setItem(ADMIN_STORAGE_KEY, nextAdminKey);
    setAdminKey(nextAdminKey);
    qc.invalidateQueries({ queryKey: ["weddings"] });
    toast.success("נכנסת לניהול");
  };

  const handleAdminLogout = () => {
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdminKey("");
    setAdminInput("");
    setDeleteWedding(null);
    qc.removeQueries({ queryKey: ["weddings"] });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey) return toast.error("יש להתחבר לניהול");

    const finalName = name.trim();
    const finalVenueName = venueName.trim();
    const finalVenueAddress = venueAddress.trim();
    const finalSlug = effectiveSlug;
    if (!finalName) return toast.error("יש להזין שם לחתונה");
    if (!finalVenueName) return toast.error("יש להזין את מקום החתונה");
    if (!finalVenueAddress) return toast.error("יש להזין כתובת לניווט");
    if (finalSlug.length < 2) return toast.error("כתובת ה־URL חייבת לכלול לפחות 2 תווים (אותיות באנגלית/ספרות/מקפים)");

    setCreating(true);
    const { data, error } = await supabase
      .rpc("create_wedding_admin", {
        p_admin_key: adminKey,
        p_name: finalName,
        p_slug: finalSlug,
        p_venue_name: finalVenueName,
        p_venue_address: finalVenueAddress,
      })
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
    setName("");
    setVenueName("");
    setVenueAddress("");
    setSlug("");
    setSlugTouched(false);
    setFallbackSlug(makeFallbackSlug());
    window.location.assign(weddingUrl(data!));
  };

  const closeDeleteDialog = () => {
    setDeleteWedding(null);
  };

  const handleDeleteWedding = async () => {
    if (!deleteWedding) return;
    if (!adminKey) return toast.error("יש להתחבר לניהול");

    setDeleting(true);
    const { data, error } = await supabase.rpc("delete_wedding_admin", {
      p_admin_key: adminKey,
      p_wedding_id: deleteWedding.id,
    });
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
          ניהול חתונות וקישורי שיתוף.
        </p>
        {adminKey && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4 gap-2"
            onClick={handleAdminLogout}
          >
            <LogOut className="h-4 w-4" />
            יציאה מניהול
          </Button>
        )}
      </header>

      <main className="px-4 max-w-xl mx-auto space-y-8">
        {!adminKey ? (
          <section className="rounded-2xl bg-card border border-border shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-gold" />
              <h2 className="text-lg font-semibold text-primary">כניסה לניהול</h2>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label>סיסמת ניהול</Label>
                <Input
                  type="password"
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {weddingsError && (
                <p className="text-sm text-destructive">
                  אין הרשאת ניהול פעילה.
                </p>
              )}
              <Button type="submit" disabled={checkingAdmin} className="w-full h-11 gap-2">
                <Lock className="h-4 w-4" />
                {checkingAdmin ? "בודק…" : "כניסה"}
              </Button>
            </form>
          </section>
        ) : (
          <>
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
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="לדוגמה: דנה ויוסי"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>מקום החתונה</Label>
                    <Input
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      placeholder="לדוגמה: גן האירועים עדן"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>כתובת לניווט</Label>
                    <Input
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      placeholder="לדוגמה: דרך הים 12, קיסריה"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>כתובת הקישור</Label>
                  <div className="flex items-center gap-1 text-sm" dir="ltr">
                    <span className="text-muted-foreground">#/w/</span>
                    <Input
                      value={slug}
                      onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                      placeholder="dana-yossi"
                      className="font-mono"
                      dir="ltr"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    שם החתונה יכול להיות בעברית. הקישור הוא כתובת טכנית לשיתוף, ואפשר להשאיר אותו אוטומטי.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    כפתור ניווט ייפתח לפי כתובת החתונה, והיעד ימולא אוטומטית בכל רכב.
                  </p>
                </div>
                <Button type="submit" disabled={creating} className="w-full h-11 gap-2">
                  <Plus className="h-4 w-4" />
                  {creating ? "יוצר…" : "צור חתונה חדשה"}
                </Button>
              </form>
            </section>

            {weddingsError && (
              <section className="rounded-2xl bg-card border border-destructive/40 shadow-card p-5">
                <p className="text-sm text-destructive">סיסמת הניהול לא תקינה או שפג התוקף.</p>
                <Button type="button" variant="outline" className="mt-3" onClick={handleAdminLogout}>
                  חזרה לכניסה
                </Button>
              </section>
            )}

            {/* Existing */}
            {weddings && weddings.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  חתונות קיימות
                </h2>
                <ul className="space-y-2">
                  {weddings.map((w) => (
                    <li key={w.id} className="flex items-stretch gap-2">
                      <a
                        href={weddingUrl(w)}
                        className="flex min-w-0 flex-1 items-center justify-between rounded-xl bg-card/70 border border-border hover:border-primary hover:bg-card transition p-4 group"
                      >
                        <div className="text-right">
                          <div className="font-semibold text-primary">{w.name}</div>
                          {(w.venue_name || w.venue_address) && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{w.venue_name || w.venue_address}</span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground font-mono" dir="ltr">#/w/{w.slug}</div>
                        </div>
                        <ArrowLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                      </a>
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

            {weddings && weddings.length === 0 && !weddingsError && (
              <section className="rounded-2xl bg-card/70 border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                עדיין אין חתונות.
              </section>
            )}
          </>
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
                  #/w/{deleteWedding.slug}
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
