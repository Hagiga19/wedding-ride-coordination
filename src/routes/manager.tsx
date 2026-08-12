import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";

import { unlockManager } from "@/lib/manager.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/manager")({
  head: () => ({
    meta: [
      { title: "כניסת מנהל — טרמפים לחתונה" },
      { name: "description", content: "אזור מנהל לניהול כל החתונות בדף תיאום הטרמפים." },
      { property: "og:title", content: "כניסת מנהל — טרמפים לחתונה" },
      { property: "og:description", content: "אזור מנהל לניהול כל החתונות." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagerLogin,
});

function ManagerLogin() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockManager);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const res = await unlock({ data: { password } });
      if (res.ok) {
        await navigate({ to: "/" });
      } else {
        setError(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-card p-6 space-y-4"
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="rounded-full bg-secondary p-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-primary">אזור מנהל</h1>
          <p className="text-sm text-muted-foreground">
            להצגת כל החתונות ולניהולן יש להזין סיסמת מנהל.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="manager-password">סיסמת מנהל</Label>
          <Input
            id="manager-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">סיסמה שגויה</p>}
        </div>

        <Button type="submit" className="w-full h-11" disabled={busy || !password}>
          {busy ? "מאמת…" : "כניסה"}
        </Button>
      </form>
    </div>
  );
}
