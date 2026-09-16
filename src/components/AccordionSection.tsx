import { useState, type ReactNode } from "react";

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  colorClass: string;
  children: ReactNode;
}

export function AccordionSection({ title, subtitle, defaultOpen = false, colorClass, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`rounded-3xl ${colorClass} text-ink`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <h2 className="text-sm font-black">{title}</h2>
        <div className="flex items-center gap-2">
          {subtitle && <span className="text-xs font-bold opacity-60">{subtitle}</span>}
          <span className={`text-base font-black transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </div>
      </button>
      {open && <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>}
    </section>
  );
}
