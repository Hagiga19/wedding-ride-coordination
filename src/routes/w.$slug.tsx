import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Share2, Users, UserPlus, Car as CarIcon, ArrowRight, Calendar, Clock, MapPin, Navigation, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CarFormDialog } from "@/components/wedding/CarFormDialog";
import { JoinCarDialog } from "@/components/wedding/JoinCarDialog";
import { CarCard } from "@/components/wedding/CarCard";
import type { CarWithPassengers, Direction, Wedding } from "@/components/wedding/types";

export const Route = createFileRoute("/w/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `טרמפים — ${params.slug}` },
      { name: "description", content: "תיאום טרמפים — הוסיפו רכב או הצטרפו לרכב של חבר" },
    ],
  }),
  component: WeddingBoard,
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
      <h1 className="text-2xl font-bold text-primary">החתונה לא נמצאה</h1>
      <p className="text-muted-foreground">בדקו את הקישור או צרו חתונה חדשה.</p>
      <Link to="/" className="underline text-primary">חזרה לדף הבית</Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="min-h-screen flex items-center justify-center p-4">
      <button onClick={reset} className="underline">נסה שוב</button>
    </div>
  ),
});

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function WeddingBoard() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Direction>("to");
  const [addOpen, setAddOpen] = useState(false);
  const [editCar, setEditCar] = useState<CarWithPassengers | null>(null);
  const [joinCar, setJoinCar] = useState<CarWithPassengers | null>(null);

  const { data: wedding, isLoading: weddingLoading, error: weddingError } = useQuery({
    queryKey: ["wedding", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Wedding;
    },
  });

  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars", wedding?.id],
    enabled: !!wedding?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*, passengers(*)")
        .eq("wedding_id", wedding!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CarWithPassengers[];
    },
  });

  useEffect(() => {
    if (!wedding?.id) return;
    const channel = supabase
      .channel(`wedding-${wedding.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cars", filter: `wedding_id=eq.${wedding.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["cars", wedding.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "passengers" }, () => {
        qc.invalidateQueries({ queryKey: ["cars", wedding.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, wedding?.id]);

  const grouped = useMemo(() => {
    const all = cars ?? [];
    return {
      to: all.filter((c) => c.direction === "to"),
      from: all.filter((c) => c.direction === "from"),
    };
  }, [cars]);

  const counts = useMemo(() => {
    const sum = (list: CarWithPassengers[]) => ({
      cars: list.length,
      drivers: list.length,
      passengers: list.reduce((n, c) => n + (c.passengers?.length ?? 0), 0),
      seatsLeft: list.reduce((n, c) => n + Math.max(0, c.seats_total - (c.passengers?.length ?? 0)), 0),
    });
    return { to: sum(grouped.to), from: sum(grouped.from) };
  }, [grouped]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = wedding
    ? `טרמפים ל${wedding.name}!\n${shareUrl}\n\nהצטרפו לרכב או הוסיפו רכב לחתונה.`
    : shareUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("הקישור הועתק!");
    } catch {
      toast.error("לא הצלחנו להעתיק את הקישור");
    }
  };

  const handleWhatsApp = () => {
    const clean = shareText.replace(/\n/g, "%0A");
    window.open(`https://wa.me/?text=${clean}`, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "טרמפים לחתונה", text: shareText });
      } else {
        await handleCopy();
      }
    } catch {
      /* user cancelled */
    }
  };

  if (weddingLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">טוען…</div>;
  }
  if (weddingError || !wedding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
        <h1 className="text-2xl font-bold text-primary">החתונה לא נמצאה</h1>
        <Link to="/" className="underline text-primary">חזרה לדף הבית</Link>
      </div>
    );
  }

  const formattedDate = formatDate(wedding.wedding_date);
  const mapsHref = wedding.wedding_location
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(wedding.wedding_location)}`
    : null;

  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-8 pb-6 text-center">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-3">
          <ArrowRight className="h-3 w-3" />
          כל החתונות
        </Link>
        <div className="inline-flex items-center justify-center gap-2 text-gold mb-3">
          <Heart className="h-5 w-5 fill-current" />
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            תיאום טרמפים
          </span>
          <Heart className="h-5 w-5 fill-current" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">
          {wedding.name}
        </h1>

        {/* Wedding details */}
        {(formattedDate || wedding.wedding_time || wedding.wedding_location) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            {formattedDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formattedDate}
              </span>
            )}
            {wedding.wedding_time && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {wedding.wedding_time}
              </span>
            )}
            {wedding.wedding_location && (
              <a
                href={mapsHref ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 transition"
              >
                <MapPin className="h-4 w-4" />
                <span className="underline">{wedding.wedding_location}</span>
                <Navigation className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
          הוסיפו רכב שאתם נוסעים בו, או הצטרפו לרכב של חבר.
          <br />
          כדי להצטרף, תזדקקו לסיסמה בת 4 תווים מהנהג.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                שיתוף הקישור
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={handleCopy} className="gap-2">
                <Copy className="h-4 w-4" />
                העתקת קישור
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleWhatsApp} className="gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                שליחה בווטסאפ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNativeShare} className="gap-2">
                <Share2 className="h-4 w-4" />
                שיתוף באפליקציה
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="px-4 max-w-2xl mx-auto">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Direction)} dir="rtl">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-secondary/60 backdrop-blur">
            <TabsTrigger value="to" className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              לחתונה
            </TabsTrigger>
            <TabsTrigger value="from" className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              חזרה מהחתונה
            </TabsTrigger>
          </TabsList>

          {(["to", "from"] as const).map((dir) => (
            <TabsContent key={dir} value={dir} className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat icon={<CarIcon className="h-4 w-4" />} label="רכבים" value={counts[dir].cars} />
                <Stat icon={<Users className="h-4 w-4" />} label="נוסעים" value={counts[dir].passengers} />
                <Stat icon={<UserPlus className="h-4 w-4" />} label="מקומות פנויים" value={counts[dir].seatsLeft} />
              </div>

              <Button
                onClick={() => { setEditCar(null); setAddOpen(true); }}
                className="w-full h-12 gap-2 text-base shadow-soft"
              >
                <Plus className="h-5 w-5" />
                הוספת רכב {dir === "to" ? "לחתונה" : "חזרה"}
              </Button>

              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">טוען…</p>
              ) : grouped[dir].length === 0 ? (
                <EmptyState direction={dir} />
              ) : (
                <div className="space-y-3">
                  {grouped[dir].map((car) => (
                    <CarCard
                      key={car.id}
                      car={car}
                      onJoin={() => setJoinCar(car)}
                      onEdit={() => { setEditCar(car); setAddOpen(true); }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <CarFormDialog
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); if (!o) setEditCar(null); }}
        direction={tab}
        car={editCar}
        weddingId={wedding.id}
        weddingLocation={wedding.wedding_location}
      />
      <JoinCarDialog
        car={joinCar}
        open={!!joinCar}
        onOpenChange={(o) => { if (!o) setJoinCar(null); }}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card/70 backdrop-blur border border-border/60 py-3 px-2 shadow-card">
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-primary mt-0.5">{value}</div>
    </div>
  );
}

function EmptyState({ direction }: { direction: Direction }) {
  return (
    <div className="text-center py-12 px-4 rounded-2xl bg-card/50 border border-dashed border-border">
      <CarIcon className="h-10 w-10 mx-auto text-muted-foreground/60" />
      <p className="mt-3 text-muted-foreground">
        עדיין אין רכבים {direction === "to" ? "לחתונה" : "לחזרה"}.
        <br />
        היו הראשונים להוסיף!
      </p>
    </div>
  );
}
