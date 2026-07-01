import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, Clock, Users, Trash2, Pencil, UserPlus, MessageCircle, Home, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { languageDirection, weddingCopy, type WeddingLanguage } from "./i18n";
import type { CarWithPassengers } from "./types";

interface Props {
  car: CarWithPassengers;
  onJoin: () => void;
  onEdit: () => void;
  accessKey: string;
  adminKey: string;
  language: WeddingLanguage;
}

export function CarCard({ car, onJoin, onEdit, accessKey, adminKey, language }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const copy = weddingCopy[language].carCard;
  const passengers = car.passengers ?? [];
  const seatsLeft = car.seats_total - passengers.length;
  const seatBarSlots = Math.min(Math.max(car.seats_total, 0), 20);
  const full = seatsLeft <= 0;

  const deleteCar = async () => {
    const { error } = await supabase.rpc("delete_car_for_wedding", {
      p_wedding_id: car.wedding_id,
      p_car_id: car.id,
      p_access_key: accessKey,
      p_admin_key: adminKey || null,
    });
    if (error) toast.error(copy.deleteError);
    else {
      qc.invalidateQueries({ queryKey: ["cars", car.wedding_id] });
      toast.success(copy.deleteSuccess);
    }
  };

  const removePassenger = async (id: string, name: string) => {
    const { error } = await supabase.rpc("delete_passenger_for_wedding", {
      p_wedding_id: car.wedding_id,
      p_passenger_id: id,
      p_access_key: accessKey,
      p_admin_key: adminKey || null,
    });
    if (error) toast.error(copy.removeError);
    else {
      qc.invalidateQueries({ queryKey: ["cars", car.wedding_id] });
      toast.success(copy.removeSuccess(name));
    }
  };

  const waLink = (phone: string, msg: string) => {
    const clean = phone.replace(/\D/g, "").replace(/^0/, "972");
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <article className="rounded-2xl bg-card border border-border/70 shadow-card overflow-hidden transition-shadow hover:shadow-soft">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-foreground truncate">{car.driver_name}</h3>
              <span
                className={
                  full
                    ? "text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium"
                    : "text-xs px-2 py-0.5 rounded-full bg-gold/30 text-gold-foreground font-medium"
                }
              >
                {full ? copy.full : copy.available(seatsLeft)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {car.from_location} <span className="text-primary mx-1">↔</span> {car.to_location}
              </span>
            </div>
            {car.departure_time && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{car.departure_time}</span>
              </div>
            )}
            {car.notes && (
              <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                {car.notes}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5" aria-label={copy.seatsAria(passengers.length, car.seats_total)}>
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex gap-1 flex-1">
            {Array.from({ length: seatBarSlots }).map((_, i) => (
              <span
                key={i}
                className={
                  i < passengers.length
                    ? "h-2 flex-1 rounded-full bg-primary"
                    : "h-2 flex-1 rounded-full bg-secondary"
                }
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {passengers.length}/{car.seats_total}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onJoin} disabled={full} className="flex-1 gap-1.5 min-w-[140px]" size="sm">
            <UserPlus className="h-4 w-4" />
            {copy.join}
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={`tel:${car.driver_phone}`}>
              <Phone className="h-4 w-4" />
              {copy.call}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a
              href={waLink(car.driver_phone, copy.whatsappMessage(car.driver_name))}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              {copy.whatsapp}
            </a>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{passengers.length === 0 ? copy.noPassengers : copy.passengerCount(passengers.length)}</span>
          <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (expanded ? "rotate-180" : "")} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {passengers.length > 0 && (
              <ul className="space-y-1.5">
                {passengers.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-2 bg-muted/40 rounded-lg p-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Home className="h-3 w-3" />
                        <span className="truncate">{p.address}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <a href={`tel:${p.phone}`} className="hover:underline">
                          {p.phone}
                        </a>
                      </div>
                    </div>
                    <ConfirmDelete
                      title={copy.removePassengerTitle(p.name)}
                      onConfirm={() => removePassenger(p.id, p.name)}
                      language={language}
                    >
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </ConfirmDelete>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-1">
              <Button onClick={onEdit} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <Pencil className="h-3.5 w-3.5" />
                {copy.editCar}
              </Button>
              <ConfirmDelete
                title={copy.deleteCarTitle}
                description={copy.deleteCarDescription}
                onConfirm={deleteCar}
                language={language}
              >
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  {copy.deleteCar}
                </Button>
              </ConfirmDelete>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function ConfirmDelete({
  children,
  title,
  description,
  onConfirm,
  language,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  onConfirm: () => void;
  language: WeddingLanguage;
}) {
  const copy = weddingCopy[language].carCard;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent dir={languageDirection(language)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{copy.delete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
