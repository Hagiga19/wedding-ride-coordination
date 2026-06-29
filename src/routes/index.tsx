import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Share2, Users, UserPlus, Car as CarIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CarFormDialog } from "@/components/wedding/CarFormDialog";
import { JoinCarDialog } from "@/components/wedding/JoinCarDialog";
import { CarCard } from "@/components/wedding/CarCard";
import type { CarWithPassengers, Direction } from "@/components/wedding/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "טרמפים לחתונה" },
      { name: "description", content: "תיאום טרמפים — הוסיפו רכב או הצטרפו לרכב של חבר" },
    ],
  }),
  component: Index,
});

function Index() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Direction>("to");
  const [addOpen, setAddOpen] = useState(false);
  const [editCar, setEditCar] = useState<CarWithPassengers | null>(null);
  const [joinCar, setJoinCar] = useState<CarWithPassengers | null>(null);

  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*, passengers(*)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CarWithPassengers[];
    },
  });

  // Realtime: invalidate on any change
  useEffect(() => {
    const channel = supabase
      .channel("wedding-carpool")
      .on("postgres_changes", { event: "*", schema: "public", table: "cars" }, () => {
        qc.invalidateQueries({ queryKey: ["cars"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "passengers" }, () => {
        qc.invalidateQueries({ queryKey: ["cars"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

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

  const activeList = grouped[tab];
  const activeCounts = counts[tab];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="px-4 pt-8 pb-6 text-center">
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
          הוסיפו רכב שאתם נוסעים בו, או הצטרפו לרכב של חבר.
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
              {/* Summary */}
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
              ) : activeList.length === 0 && tab === dir ? (
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
