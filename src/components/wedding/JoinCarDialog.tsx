import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  car: CarWithPassengers | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const empty = { name: "", phone: "", address: "", password: "" };

export function JoinCarDialog({ car, open, onOpenChange }: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(empty);
  }, [open]);

  if (!car) return null;
  const seatsLeft = car.seats_total - (car.passengers?.length ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const password = form.password.trim();

    if (!name || !phone || !address) {
      toast.error("יש למלא את כל השדות");
      return;
    }
    if (phone.length < 7) {
      toast.error("מספר טלפון לא תקין");
      return;
    }
    if (password.length !== 4) {
      toast.error("הסיסמה חייבת להיות באורך 4 תווים");
      return;
    }
    if (password !== car.password) {
      toast.error("סיסמה שגויה. פנו לנהג לקבלת הסיסמה.");
      return;
    }
    if (seatsLeft <= 0) {
      toast.error("אין יותר מקומות פנויים ברכב");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("passengers").insert({
      car_id: car.id,
      name,
      phone,
      address,
    });
    setSaving(false);

    if (error) {
      toast.error("שגיאה בהוספה: " + error.message);
      return;
    }
    toast.success(`נוספת לרכב של ${car.driver_name}!`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הצטרפות לרכב של {car.driver_name}</DialogTitle>
          <DialogDescription>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(car.from_location)}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition underline"
            >
              {car.from_location}
            </a>
            {" ← "}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(car.to_location)}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition underline"
            >
              {car.to_location}
            </a>
            {car.departure_time ? ` · ${car.departure_time}` : ""} · נותרו {seatsLeft} מקומות
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="שם מלא">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="טלפון">
            <Input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="050-1234567"
              required
            />
          </Field>
          <Field label="כתובת לאיסוף">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="רחוב, מספר, עיר"
              required
            />
          </Field>
          <Field label="סיסמת הצטרפות (קבלו מהנהג)">
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value.slice(0, 4) })}
              maxLength={4}
              required
              className="text-center tracking-[0.5em] font-mono text-lg"
            />
            <a
              href={`tel:${car.driver_phone}`}
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              חיוג לנהג ({car.driver_phone}) לקבלת הסיסמה
            </a>
          </Field>
          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "מצטרף…" : "אישור והצטרפות"}
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
