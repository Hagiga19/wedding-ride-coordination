import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { languageDirection, weddingCopy, type WeddingLanguage } from "./i18n";
import { ModalShell } from "./ModalShell";
import type { CarWithPassengers, Direction } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: Direction;
  car: CarWithPassengers | null;
  weddingId: string;
  weddingVenue: string;
  accessKey: string;
  adminKey: string;
  language: WeddingLanguage;
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

export function CarFormDialog({
  open,
  onOpenChange,
  direction,
  car,
  weddingId,
  weddingVenue,
  accessKey,
  adminKey,
  language,
}: Props) {
  const qc = useQueryClient();
  const editing = !!car;
  const [saving, setSaving] = useState(false);
  const fixedVenue = weddingVenue.trim();
  const effectiveDirection = direction;
  const copy = weddingCopy[language].carForm;
  const initial = initialCarForm(car, fixedVenue, effectiveDirection);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);

    const name = readFormValue(formData, "driver_name");
    const phone = readFormValue(formData, "driver_phone");
    const fromL = readFormValue(formData, "from_location");
    const toL = readFormValue(formData, "to_location");
    const seatsTotal = Number(readFormValue(formData, "seats_total"));
    const departureTime = readFormValue(formData, "departure_time");
    const notes = readFormValue(formData, "notes");
    const password = readFormValue(formData, "password");

    if (!name || !phone || !fromL || !toL) {
      toast.error(copy.requiredError);
      return;
    }
    if (!Number.isFinite(seatsTotal) || seatsTotal < 1 || seatsTotal > 20) {
      toast.error(copy.seatsError);
      return;
    }
    if (password.length !== 4) {
      toast.error(copy.passwordError);
      return;
    }
    if (phone.length < 7) {
      toast.error(copy.phoneError);
      return;
    }

    setSaving(true);
    const error = editing
      ? await updateCar({
          p_wedding_id: weddingId,
          p_car_id: car!.id,
          p_access_key: accessKey,
          p_admin_key: adminKey || null,
          p_driver_name: name,
          p_driver_phone: phone,
          p_direction: effectiveDirection,
          p_from_location: fromL,
          p_to_location: toL,
          p_seats_total: seatsTotal,
          p_password: password,
          p_departure_time: departureTime || null,
          p_notes: notes || null,
        })
      : await createCar({
          p_wedding_id: weddingId,
          p_access_key: accessKey,
          p_admin_key: adminKey || null,
          p_driver_name: name,
          p_driver_phone: phone,
          p_direction: effectiveDirection,
          p_from_location: fromL,
          p_to_location: toL,
          p_seats_total: seatsTotal,
          p_password: password,
          p_departure_time: departureTime || null,
          p_notes: notes || null,
        });
    setSaving(false);

    if (error) {
      toast.error(copy.saveError + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cars", weddingId] });
    toast.success(editing ? copy.updated : copy.added);
    onOpenChange(false);
  };

  const modalTitle = editing
    ? copy.editTitle
    : effectiveDirection === "to"
      ? copy.addTitleTo
      : copy.addTitleFrom;
  const modalDescription = effectiveDirection === "to" ? copy.descriptionTo : copy.descriptionFrom;

  if (!open) return null;

  return (
    <ModalShell
      open
      onOpenChange={onOpenChange}
      dir={languageDirection(language)}
      closeLabel={copy.cancel}
      title={modalTitle}
      description={modalDescription}
    >
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label={copy.driverName}>
            <Input
              name="driver_name"
              defaultValue={initial.driver_name}
              required
            />
          </Field>
          <Field label={copy.driverPhone}>
            <Input
              type="tel"
              inputMode="tel"
              name="driver_phone"
              defaultValue={initial.driver_phone}
              placeholder="050-1234567"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {effectiveDirection === "to" ? (
              <>
                <Field label={copy.fromLocation}>
                  <Input
                    name="from_location"
                    defaultValue={initial.from_location}
                    required
                  />
                </Field>
                <FixedVenueField
                  name="to_location"
                  value={fixedVenue || initial.to_location}
                  label={copy.weddingVenue}
                  help={copy.fixedVenue}
                />
              </>
            ) : (
              <>
                <FixedVenueField
                  name="from_location"
                  value={fixedVenue || initial.from_location}
                  label={copy.weddingVenue}
                  help={copy.fixedVenue}
                />
                <Field label={copy.toLocation}>
                  <Input
                    name="to_location"
                    defaultValue={initial.to_location}
                    required
                  />
                </Field>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.seats}>
              <Input
                type="number"
                min={1}
                max={20}
                name="seats_total"
                defaultValue={initial.seats_total}
                required
              />
            </Field>
            <Field label={copy.departureTime}>
              <Input
                name="departure_time"
                defaultValue={initial.departure_time}
                placeholder="20:00"
              />
            </Field>
          </div>
          <Field label={copy.password}>
            <Input
              name="password"
              defaultValue={initial.password}
              maxLength={4}
              placeholder="1234"
              required
              className="text-center tracking-[0.5em] font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">{copy.passwordHelp}</p>
          </Field>
          <Field label={copy.notes}>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={initial.notes}
              placeholder={copy.notesPlaceholder}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? copy.saving : editing ? copy.saveChanges : copy.addCar}
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

function FixedVenueField({
  label,
  value,
  help,
  name,
}: {
  label: string;
  value: string;
  help: string;
  name: string;
}) {
  return (
    <Field label={label}>
      <Input
        name={name}
        defaultValue={value}
        readOnly
        className="bg-muted/60 text-muted-foreground"
        required
      />
      <p className="text-xs text-muted-foreground mt-1">{help}</p>
    </Field>
  );
}

function readFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function initialCarForm(
  car: CarWithPassengers | null,
  fixedVenue: string,
  direction: Direction,
): typeof empty {
  if (car) {
    return {
      driver_name: car.driver_name,
      driver_phone: car.driver_phone,
      from_location: car.from_location,
      to_location: fixedVenue || car.to_location,
      seats_total: car.seats_total,
      password: car.password,
      departure_time: car.departure_time ?? "",
      notes: car.notes ?? "",
    };
  }

  return direction === "to"
    ? { ...empty, to_location: fixedVenue }
    : { ...empty, from_location: fixedVenue };
}

type CreateCarArgs = {
  p_wedding_id: string;
  p_access_key: string;
  p_admin_key: string | null;
  p_driver_name: string;
  p_driver_phone: string;
  p_direction: Direction;
  p_from_location: string;
  p_to_location: string;
  p_seats_total: number;
  p_password: string;
  p_departure_time: string | null;
  p_notes: string | null;
};

type UpdateCarArgs = CreateCarArgs & {
  p_car_id: string;
};

type RpcError = { code?: string; message?: string };

async function createCar(args: CreateCarArgs): Promise<RpcError | null> {
  const { error } = await supabase.rpc("create_car_for_wedding", args);
  if (!shouldRetryLegacyCarRpc(error)) return error;

  const { p_direction: _direction, ...legacyArgs } = args;
  const legacy = await supabase.rpc("create_car_for_wedding", legacyArgs as never);
  return legacy.error;
}

async function updateCar(args: UpdateCarArgs): Promise<RpcError | null> {
  const { error } = await supabase.rpc("update_car_for_wedding", args);
  if (!shouldRetryLegacyCarRpc(error)) return error;

  const { p_direction: _direction, ...legacyArgs } = args;
  const legacy = await supabase.rpc("update_car_for_wedding", legacyArgs as never);
  return legacy.error;
}

function shouldRetryLegacyCarRpc(error: RpcError | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST202" ||
    (message.includes("p_direction") && message.includes("schema cache"))
  );
}
