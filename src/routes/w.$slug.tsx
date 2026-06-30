import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Share2, Users, UserPlus, Car as CarIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CarFormDialog } from "@/components/wedding/CarFormDialog";
import { JoinCarDialog } from "@/components/wedding/JoinCarDialog";
import { CarCard } from "@/components/wedding/CarCard";
import type { CarWithPassengers, Wedding } from "@/components/wedding/types";

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

function WeddingBoard() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
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

  // Realtime: invalidate on any change for this wedding
  useEffect(() => {
    if (!wedding?.id) return;
    const channel = supabase
      .channel(`wedding-${wedding.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cars", filter: `wedding_id=eq.${wedding.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["cars", wedding.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "passengers", filter: `wedding_id=eq.${wedding.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["cars", wedding.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, wedding?.id]);


  const allCars = useMemo(() => cars ?? [], [cars]);

  const counts = useMemo(
    () => ({
      cars: allCars.length,
      passengers: allCars.reduce((n, c) => n + (c.passengers?.length ?? 0), 0),
      seatsLeft: allCars.reduce((n, c) => n + Math.max(0, c.seats_total - (c.passengers?.length ?? 0)), 0),
    }),
    [allCars],
  );

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "טרמפים לחתונה", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("הקישור הועתק!");
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

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
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
        <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
          הוסיפו רכב לנסיעה הלוך וחזור, או הצטרפו לרכב של חבר.
          <br />
          כדי להצטרף, תזדקקו לסיסמה בת 4 תווים מהנהג.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button onClick={handleShare} variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            שיתוף הקישור
          </Button>
        </div>
      </header>


      {/* Main */}
      <main className="px-4 max-w-2xl mx-auto">
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat icon={<CarIcon className="h-4 w-4" />} label="רכבים" value={counts.cars} />
            <Stat icon={<Users className="h-4 w-4" />} label="נוסעים" value={counts.passengers} />
            <Stat icon={<UserPlus className="h-4 w-4" />} label="מקומות פנויים" value={counts.seatsLeft} />
          </div>

          <Button
            onClick={() => { setEditCar(null); setAddOpen(true); }}
            className="w-full h-12 gap-2 text-base shadow-soft"
          >
            <Plus className="h-5 w-5" />
            הוספת רכב
          </Button>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">טוען…</p>
          ) : allCars.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {allCars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  onJoin={() => setJoinCar(car)}
                  onEdit={() => { setEditCar(car); setAddOpen(true); }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <CarFormDialog
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); if (!o) setEditCar(null); }}
        car={editCar}
        weddingId={wedding.id}
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

function EmptyState() {
  return (
    <div className="text-center py-12 px-4 rounded-2xl bg-card/50 border border-dashed border-border">
      <CarIcon className="h-10 w-10 mx-auto text-muted-foreground/60" />
      <p className="mt-3 text-muted-foreground">
        עדיין אין רכבים לחתונה.
        <br />
        היו הראשונים להוסיף!
      </p>
    </div>
  );
}
