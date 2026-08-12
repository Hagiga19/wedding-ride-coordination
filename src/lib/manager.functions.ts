import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type ManagerSession = { unlocked?: boolean };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "manager-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const getManagerStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<ManagerSession>(sessionConfig());
  return { unlocked: session.data.unlocked === true };
});

export const unlockManager = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["MANAGER_PASSWORD"];
    if (!expected) throw new Error("MANAGER_PASSWORD is not set");
    if (!matches(data.password ?? "", expected)) return { ok: false as const };
    const session = await useSession<ManagerSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockManager = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<ManagerSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const deleteWedding = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const session = await useSession<ManagerSession>(sessionConfig());
    if (!session.data.unlocked) throw new Error("Unauthorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cars, error: carsErr } = await supabaseAdmin
      .from("cars")
      .select("id")
      .eq("wedding_id", data.id);
    if (carsErr) throw carsErr;

    const carIds = (cars ?? []).map((c) => c.id);
    if (carIds.length > 0) {
      const { error: pErr } = await supabaseAdmin.from("passengers").delete().in("car_id", carIds);
      if (pErr) throw pErr;
      const { error: cErr } = await supabaseAdmin.from("cars").delete().in("id", carIds);
      if (cErr) throw cErr;
    }

    const { error: wErr } = await supabaseAdmin.from("weddings").delete().eq("id", data.id);
    if (wErr) throw wErr;

    return { ok: true as const };
  });
