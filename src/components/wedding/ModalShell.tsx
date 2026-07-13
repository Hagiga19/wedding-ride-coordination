import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ModalShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  dir: "rtl" | "ltr";
  closeLabel: string;
  className?: string;
};

export function ModalShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  dir,
  closeLabel,
  className,
}: ModalShellProps) {
  if (!open) return null;

  return (
    <section
      data-wedding-modal="content"
      dir={dir}
      className={cn(
        "my-4 grid w-full gap-4 rounded-lg border bg-background p-4 shadow-lg",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col space-y-1.5">
          <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <button
          type="button"
          aria-label={closeLabel}
          className="shrink-0 rounded-sm px-2 text-xl leading-none opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => onOpenChange(false)}
        >
          <span aria-hidden="true">x</span>
        </button>
      </div>
      {children}
    </section>
  );
}
