import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Plus,
  Share2,
  Users,
  UserPlus,
  Car as CarIcon,
  ArrowRight,
  MapPin,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CarFormDialog } from "@/components/wedding/CarFormDialog";
import { JoinCarDialog } from "@/components/wedding/JoinCarDialog";
import { CarCard } from "@/components/wedding/CarCard";
import {
  isWeddingLanguage,
  languageDirection,
  WEDDING_LANGUAGE_STORAGE_KEY,
  weddingCopy,
  type WeddingLanguage,
} from "@/components/wedding/i18n";
import type { CarWithPassengers, Direction, Wedding } from "@/components/wedding/types";

type WeddingSearch = {
  access?: string;
};

const ADMIN_STORAGE_KEY = "wedding-ride-admin-key";

export const Route = createFileRoute("/w/$slug")({
  validateSearch: (search: Record<string, unknown>): WeddingSearch => ({
    access: typeof search.access === "string" ? search.access : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `${weddingCopy.he.page.metaTitlePrefix} - ${params.slug}` },
      { name: "description", content: weddingCopy.he.page.metaDescription },
    ],
  }),
  component: WeddingBoard,
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
      <h1 className="text-2xl font-bold text-primary">{weddingCopy.he.page.notFoundTitle}</h1>
      <p className="text-muted-foreground">{weddingCopy.he.page.notFoundDescription}</p>
      <Link to="/" className="underline text-primary">
        {weddingCopy.he.page.backHome}
      </Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="min-h-screen flex items-center justify-center p-4">
      <button onClick={reset} className="underline">
        {weddingCopy.he.page.retry}
      </button>
    </div>
  ),
});

function weddingVenueText(wedding: Wedding): string {
  return [wedding.venue_name, wedding.venue_address].filter(Boolean).join(" - ");
}

function mapsUrl(wedding: Wedding): string | null {
  const query = [wedding.venue_name, wedding.venue_address].filter(Boolean).join(", ");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

function WeddingBoard() {
  const { slug } = Route.useParams();
  const { access } = Route.useSearch();
  const qc = useQueryClient();
  const accessKey = typeof access === "string" ? access.trim() : "";
  const [adminKey, setAdminKey] = useState("");
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [language, setLanguage] = useState<WeddingLanguage>("he");
  const [tab, setTab] = useState<Direction>("to");
  const [addOpen, setAddOpen] = useState(false);
  const [editCar, setEditCar] = useState<CarWithPassengers | null>(null);
  const [joinCar, setJoinCar] = useState<CarWithPassengers | null>(null);
  const copy = weddingCopy[language];
  const dir = languageDirection(language);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAdminKey(window.localStorage.getItem(ADMIN_STORAGE_KEY) ?? "");
      const storedLanguage = window.localStorage.getItem(WEDDING_LANGUAGE_STORAGE_KEY);
      if (isWeddingLanguage(storedLanguage)) {
        setLanguage(storedLanguage);
      }
    }
    setAdminLoaded(true);
  }, []);

  const updateLanguage = (nextLanguage: WeddingLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem(WEDDING_LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const {
    data: wedding,
    isLoading: weddingLoading,
    error: weddingError,
  } = useQuery({
    queryKey: ["wedding", slug, accessKey, adminKey],
    enabled: adminLoaded || !!accessKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_wedding_by_slug", {
          p_slug: slug,
          p_access_key: accessKey,
          p_admin_key: adminKey || null,
        });
      if (error) throw error;
      return ((data ?? []) as Wedding[])[0] ?? null;
    },
  });

  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars", wedding?.id, accessKey, adminKey],
    enabled: !!wedding?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cars_for_wedding", {
        p_wedding_id: wedding!.id,
        p_access_key: accessKey,
        p_admin_key: adminKey || null,
      });
      if (error) throw error;
      return (data ?? []) as CarWithPassengers[];
    },
  });

  useEffect(() => {
    if (!wedding?.id) return;
    const channel = supabase
      .channel(`wedding-${wedding.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cars", filter: `wedding_id=eq.${wedding.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["cars", wedding.id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "passengers",
          filter: `wedding_id=eq.${wedding.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["cars", wedding.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, wedding?.id]);

  const venueText = wedding ? weddingVenueText(wedding) : "";
  const groupedCars = useMemo(() => {
    const allCars = cars ?? [];
    const fixedVenue = venueText.trim();
    const isFromWeddingCar = (car: CarWithPassengers) =>
      car.direction === "from" ||
      (!!fixedVenue &&
        car.from_location.trim() === fixedVenue &&
        car.to_location.trim() !== fixedVenue);

    return {
      to: allCars.filter((car) => !isFromWeddingCar(car)),
      from: allCars.filter(isFromWeddingCar),
    };
  }, [cars, venueText]);

  const counts = useMemo(() => {
    const summarize = (list: CarWithPassengers[]) => ({
      cars: list.length,
      passengers: list.reduce((n, c) => n + (c.passengers?.length ?? 0), 0),
      seatsLeft: list.reduce(
        (n, c) => n + Math.max(0, c.seats_total - (c.passengers?.length ?? 0)),
        0,
      ),
    });
    return {
      to: summarize(groupedCars.to),
      from: summarize(groupedCars.from),
    };
  }, [groupedCars]);

  const handleShare = async () => {
    const shareAccessKey = accessKey || wedding?.guest_token || "";
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.search = "";
    url.hash = `/w/${encodeURIComponent(wedding.slug)}?access=${encodeURIComponent(shareAccessKey)}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: copy.page.shareTitle, url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
        toast.success(copy.page.shareSuccess);
      }
    } catch {
      /* user cancelled */
    }
  };

  if ((!adminLoaded && !accessKey) || weddingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {copy.page.loading}
      </div>
    );
  }
  if (weddingError || !wedding) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4"
        dir={dir}
      >
        <h1 className="text-2xl font-bold text-primary">{copy.page.notFoundTitle}</h1>
        <Link to="/" className="underline text-primary">
          {copy.page.backHome}
        </Link>
      </div>
    );
  }

  const navigationUrl = mapsUrl(wedding);

  return (
    <div className="min-h-screen pb-24" dir={dir} lang={language}>
      <header className="px-4 pt-8 pb-6 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          {adminKey && (
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowRight className="h-3 w-3" />
              {copy.page.managementLink}
            </Link>
          )}
          <div
            aria-label={copy.page.languageLabel}
            className="inline-flex overflow-hidden rounded-full border border-border bg-card/70 p-0.5 text-xs shadow-card"
            role="group"
          >
            <button
              type="button"
              className={
                "rounded-full px-3 py-1 transition " +
                (language === "he"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
              onClick={() => updateLanguage("he")}
            >
              {copy.page.hebrew}
            </button>
            <button
              type="button"
              className={
                "rounded-full px-3 py-1 transition " +
                (language === "en"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
              onClick={() => updateLanguage("en")}
            >
              {copy.page.english}
            </button>
          </div>
        </div>

        <div className="inline-flex items-center justify-center gap-2 text-gold mb-3">
          <Heart className="h-5 w-5 fill-current" />
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {copy.page.eyebrow}
          </span>
          <Heart className="h-5 w-5 fill-current" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">
          {wedding.name}
        </h1>
        {venueText && (
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card/70 border border-border px-3 py-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{wedding.venue_name || wedding.venue_address}</span>
            </div>
            {wedding.venue_address && (
              <div className="max-w-md truncate text-xs">{wedding.venue_address}</div>
            )}
          </div>
        )}
        <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
          {copy.page.introLine1}
          <br />
          {copy.page.introLine2}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button onClick={handleShare} variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            {copy.page.shareButton}
          </Button>
          {navigationUrl && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={navigationUrl} target="_blank" rel="noreferrer">
                <Navigation className="h-4 w-4" />
                {copy.page.navigate}
              </a>
            </Button>
          )}
        </div>
      </header>

      <main className="px-4 max-w-2xl mx-auto">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Direction)} dir={dir}>
          <TabsList className="grid w-full grid-cols-2 h-12 bg-secondary/60 backdrop-blur">
            <TabsTrigger
              value="to"
              className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {copy.page.tabTo}
            </TabsTrigger>
            <TabsTrigger
              value="from"
              className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {copy.page.tabFrom}
            </TabsTrigger>
          </TabsList>

          {(["to", "from"] as const).map((direction) => (
            <TabsContent key={direction} value={direction} className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat
                  icon={<CarIcon className="h-4 w-4" />}
                  label={copy.page.cars}
                  value={counts[direction].cars}
                />
                <Stat
                  icon={<Users className="h-4 w-4" />}
                  label={copy.page.passengers}
                  value={counts[direction].passengers}
                />
                <Stat
                  icon={<UserPlus className="h-4 w-4" />}
                  label={copy.page.seatsLeft}
                  value={counts[direction].seatsLeft}
                />
              </div>

              <Button
                onClick={() => {
                  setTab(direction);
                  setEditCar(null);
                  setAddOpen(true);
                }}
                className="w-full h-12 gap-2 text-base shadow-soft"
              >
                <Plus className="h-5 w-5" />
                {direction === "to" ? copy.page.addCarTo : copy.page.addCarFrom}
              </Button>

              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">{copy.page.loading}</p>
              ) : groupedCars[direction].length === 0 ? (
                <EmptyState direction={direction} language={language} />
              ) : (
                <div className="space-y-3">
                  {groupedCars[direction].map((car) => (
                    <CarCard
                      key={car.id}
                      car={car}
                      onJoin={() => setJoinCar(car)}
                      onEdit={() => {
                        setTab(direction);
                        setEditCar(car);
                        setAddOpen(true);
                      }}
                      accessKey={accessKey}
                      adminKey={adminKey}
                      language={language}
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
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setEditCar(null);
        }}
        direction={tab}
        car={editCar}
        weddingId={wedding.id}
        weddingVenue={venueText}
        accessKey={accessKey}
        adminKey={adminKey}
        language={language}
      />
      <JoinCarDialog
        car={joinCar}
        open={!!joinCar}
        onOpenChange={(o) => {
          if (!o) setJoinCar(null);
        }}
        accessKey={accessKey}
        adminKey={adminKey}
        language={language}
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

function EmptyState({ direction, language }: { direction: Direction; language: WeddingLanguage }) {
  const copy = weddingCopy[language].page;

  return (
    <div className="text-center py-12 px-4 rounded-2xl bg-card/50 border border-dashed border-border">
      <CarIcon className="h-10 w-10 mx-auto text-muted-foreground/60" />
      <p className="mt-3 text-muted-foreground">
        {direction === "to" ? copy.emptyToLine1 : copy.emptyFromLine1}
        <br />
        {copy.emptyLine2}
      </p>
    </div>
  );
}
