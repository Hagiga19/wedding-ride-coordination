import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { languageDirection, weddingCopy, type WeddingLanguage } from "./i18n";
import { ModalShell } from "./ModalShell";
import type { CarWithPassengers } from "./types";

interface Props {
  car: CarWithPassengers | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accessKey: string;
  adminKey: string;
  language: WeddingLanguage;
}

const empty = { name: "", phone: "", address: "", password: "" };

export function JoinCarDialog({ car, open, onOpenChange, accessKey, adminKey, language }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const copy = weddingCopy[language].joinDialog;

  if (!open || !car) return null;
  const seatsLeft = car.seats_total - (car.passengers?.length ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = readFormValue(formData, "name");
    const phone = readFormValue(formData, "phone");
    const address = readFormValue(formData, "address");
    const password = readFormValue(formData, "password");

    if (!name || !phone || !address) {
      toast.error(copy.requiredError);
      return;
    }
    if (phone.length < 7) {
      toast.error(copy.phoneError);
      return;
    }
    if (password.length !== 4) {
      toast.error(copy.passwordError);
      return;
    }
    if (password !== car.password) {
      toast.error(copy.wrongPassword);
      return;
    }
    if (seatsLeft <= 0) {
      toast.error(copy.fullError);
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("join_car_with_password", {
      p_car_id: car.id,
      p_access_key: accessKey,
      p_admin_key: adminKey || null,
      p_password: password,
      p_name: name,
      p_phone: phone,
      p_address: address,
    });
    setSaving(false);

    if (error) {
      toast.error(copy.addError + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cars", car.wedding_id] });
    toast.success(copy.joined(car.driver_name));
    onOpenChange(false);
  };

  return (
    <ModalShell
      open
      onOpenChange={onOpenChange}
      dir={languageDirection(language)}
      closeLabel={copy.cancel}
      title={copy.title(car.driver_name)}
      description={
        <>
          {car.from_location} ↔ {car.to_location}
          {car.departure_time ? ` · ${car.departure_time}` : ""} · {copy.seatsLeft(seatsLeft)}
        </>
      }
    >
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label={copy.fullName}>
            <Input name="name" defaultValue={empty.name} required />
          </Field>
          <Field label={copy.phone}>
            <Input
              type="tel"
              inputMode="tel"
              name="phone"
              defaultValue={empty.phone}
              placeholder="050-1234567"
              required
            />
          </Field>
          <Field label={copy.pickupAddress}>
            <Input
              name="address"
              defaultValue={empty.address}
              placeholder={copy.pickupPlaceholder}
              required
            />
          </Field>
          <Field label={copy.password}>
            <Input
              name="password"
              defaultValue={empty.password}
              maxLength={4}
              required
              className="text-center tracking-[0.5em] font-mono text-lg"
            />
            <a
              href={`tel:${car.driver_phone}`}
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              {copy.callDriver(car.driver_phone)}
            </a>
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? copy.joining : copy.confirm}
            </Button>
          </div>
        </form>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">{label}</label>
      {children}
    </div>
  );
}

function readFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
