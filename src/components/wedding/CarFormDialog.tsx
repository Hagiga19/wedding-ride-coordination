import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import type { CarWithPassengers } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  car: CarWithPassengers | null;
  weddingId: string;
  weddingVenue: string;
  accessKey: string;
  adminKey: string;
}

const empty = {
  driver_name: "",
  driver_phone: "",
  from_location: "",
  to_location: "",
  seats_total: 3,
  password: "",
  departure_time: "",
  notes: "",
};

export function CarFormDialog({ open, onOpenChange, car, weddingId, weddingVenue, accessKey, adminKey }: Props) {
  const qc = useQueryClient();
  const editing = !!car;
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const fixedVenue = weddingVenue.trim();

  useEffect(() => {
    if (open) {
      if (car) {
        setForm({
          driver_name: car.driver_name,
          driver_phone: car.driver_phone,
          from_location: car.from_location,
          to_location: fixedVenue || car.to_location,
          seats_total: car.seats_total,
          password: car.password,
          departure_time: car.departure_time ?? "",
          notes: car.notes ?? "",
        });
      } else {
        setForm({ ...empty, to_location: fixedVenue });
      }
    }
  }, [open, car, fixedVenue]);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.driver_name.trim();
    const phone = form.driver_phone.trim();
    const fromL = form.from_location.trim();
    const toL = fixedVenue || form.to_location.trim();
    const password = form.password.trim();

    if (!name || !phone || !fromL || !toL) {
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

    setSaving(true);
    const { error } = editing
      ? await supabase.rpc("update_car_for_wedding", {
          p_wedding_id: weddingId,
          p_car_id: car!.id,
          p_access_key: accessKey,
          p_admin_key: adminKey || null,
          p_driver_name: name,
          p_driver_phone: phone,
          p_from_location: fromL,
          p_to_location: toL,
          p_seats_total: form.seats_total,
          p_password: password,
          p_departure_time: form.departure_time.trim() || null,
          p_notes: form.notes.trim() || null,
        })
      : await supabase.rpc("create_car_for_wedding", {
          p_wedding_id: weddingId,
          p_access_key: accessKey,
          p_admin_key: adminKey || null,
          p_driver_name: name,
          p_driver_phone: phone,
          p_from_location: fromL,
          p_to_location: toL,
          p_seats_total: form.seats_total,
          p_password: password,
          p_departure_time: form.departure_time.trim() || null,
          p_notes: form.notes.trim() || null,
        });
    setSaving(false);

    if (error) {
      toast.error("שגיאה בשמירה: " + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cars", weddingId] });
    toast.success(editing ? "הרכב עודכן" : "הרכב נוסף בהצלחה");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "עריכת רכב" : "הוספת רכב"}
          </DialogTitle>
          <DialogDescription>
            הרכב יוצג כנסיעה הלוך וחזור לחתונה.
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="נקודת יציאה">
              <Input value={form.from_location} onChange={(e) => update("from_location", e.target.value)} required />
            </Field>
            <Field label="מקום החתונה">
              <Input
                value={fixedVenue || form.to_location}
                onChange={(e) => update("to_location", e.target.value)}
                readOnly={!!fixedVenue}
                className={fixedVenue ? "bg-muted/60 text-muted-foreground" : undefined}
                required
              />
              {fixedVenue && (
                <p className="text-xs text-muted-foreground mt-1">
                  נקבע ביצירת החתונה.
                </p>
              )}
            </Field>
          </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
