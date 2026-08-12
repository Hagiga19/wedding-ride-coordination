import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CarWithPassengers, Direction } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: Direction;
  car: CarWithPassengers | null;
  weddingId: string;
  weddingLocation: string | null;
}

const empty = {
  driver_name: "",
  driver_phone: "",
  pickup_location: "",
  seats_total: 3,
  password: "",
  departure_time: "",
  notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

export function CarFormDialog({ open, onOpenChange, direction, car, weddingId, weddingLocation }: Props) {
  const editing = !!car;
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const weddingLoc = weddingLocation ?? "מיקום החתונה";

  useEffect(() => {
    if (open) {
      if (car) {
        setForm({
          driver_name: car.driver_name,
          driver_phone: car.driver_phone,
          pickup_location: direction === "to" ? car.from_location : car.to_location,
          seats_total: car.seats_total,
          password: car.password,
          departure_time: car.departure_time ?? "",
          notes: car.notes ?? "",
        });
      } else {
        setForm(empty);
      }
    }
  }, [open, car, direction]);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.driver_name.trim();
    const phone = form.driver_phone.trim();
    const pickup = form.pickup_location.trim();
    const password = form.password.trim();

    if (!name || !phone || !pickup) {
      toast.error("יש למלא את כל השדות החיוניים");
      return;
    }
    if (form.seats_total < 1 || form.seats_total > 20) {
      toast.error("מספר המקומות חייב להיות בין 1 ל-20");
      return;
    }
    if (password.length !== 4) {
      toast.error("הסיסמה חייבת להיות באורך 4 תווים");
      return;
    }
    if (phone.length < 7) {
      toast.error("מספר טלפון לא תקין");
      return;
    }

    const from_location = direction === "to" ? pickup : weddingLoc;
    const to_location = direction === "to" ? weddingLoc : pickup;

    setSaving(true);
    const payload = {
      wedding_id: weddingId,
      driver_name: name,
      driver_phone: phone,
      direction,
      from_location,
      to_location,
      seats_total: form.seats_total,
      password,
      departure_time: form.departure_time.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("cars").update(payload).eq("id", car!.id)
      : await supabase.from("cars").insert(payload);
    setSaving(false);

    if (error) {
      toast.error("שגיאה בשמירה: " + error.message);
      return;
    }
    toast.success(editing ? "הרכב עודכן" : "הרכב נוסף בהצלחה");
    onOpenChange(false);
  };

  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(weddingLoc)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "עריכת רכב" : `הוספת רכב ${direction === "to" ? "לחתונה" : "חזרה מהחתונה"}`}
          </DialogTitle>
          <DialogDescription>
            פרטי הנוסע יוסיפו את עצמם באמצעות סיסמה.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="שם הנהג">
            <Input value={form.driver_name} onChange={(e) => update("driver_name", e.target.value)} required />
          </Field>
          <Field label="טלפון הנהג">
            <Input
              type="tel"
              inputMode="tel"
              value={form.driver_phone}
              onChange={(e) => update("driver_phone", e.target.value)}
              placeholder="050-1234567"
              required
            />
          </Field>

          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {direction === "to" ? "יעד (מיקום החתונה)" : "נקודת יציאה (מיקום החתונה)"}
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground flex-1 truncate">{weddingLoc}</span>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:text-primary/80 transition shrink-0"
                title="פתח בניווט"
              >
                <Navigation className="h-4 w-4" />
              </a>
            </div>
          </div>

          <Field label={direction === "to" ? "נקודת איסוף (מאיפה יוצאים)" : "יעד (לאן חוזרים)"}>
            <Input
              value={form.pickup_location}
              onChange={(e) => update("pickup_location", e.target.value)}
              placeholder={direction === "to" ? "כתובת האיסוף" : "כתובת היעד"}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="מספר מקומות פנויים">
              <Input
                type="number"
                min={1}
                max={20}
                value={form.seats_total}
                onChange={(e) => update("seats_total", Number(e.target.value))}
                required
              />
            </Field>
            <Field label="שעת יציאה">
              <Input
                value={form.departure_time}
                onChange={(e) => update("departure_time", e.target.value)}
                placeholder="20:00"
              />
            </Field>
          </div>
          <Field label="סיסמת הצטרפות (4 תווים)">
            <Input
              value={form.password}
              onChange={(e) => update("password", e.target.value.slice(0, 4))}
              maxLength={4}
              placeholder="1234"
              required
              className="text-center tracking-[0.5em] font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">
              שתפו את הסיסמה רק עם מי שאתם רוצים להעלות לרכב.
            </p>
          </Field>
          <Field label="הערות (לא חובה)">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="לדוגמה: יש מקום למזוודה אחת בלבד"
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר…" : editing ? "שמירת שינויים" : "הוספת הרכב"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
