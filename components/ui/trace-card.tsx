"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TraceCardContextType {
  isOpen: boolean;
  toggle: () => void;
}

const TraceCardContext = React.createContext<TraceCardContextType>({
  isOpen: false,
  toggle: () => {},
});

interface TraceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
}

export function TraceCard({
  defaultOpen = false,
  className,
  children,
  ...props
}: TraceCardProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <TraceCardContext.Provider
      value={{
        isOpen,
        toggle: () => setIsOpen((prev) => !prev),
      }}
    >
      <div
        className={cn(
          "w-full rounded-2xl border border-[#D9E1EC] bg-white/95 shadow-xs transition-all overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TraceCardContext.Provider>
  );
}

interface TraceCardHeaderProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
}

export function TraceCardHeader({
  icon,
  title,
  badge,
  className,
  children,
  ...props
}: TraceCardHeaderProps) {
  const { isOpen, toggle } = React.useContext(TraceCardContext);

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs font-bold transition-colors hover:bg-[#F6F9FD]",
        isOpen && "border-b border-[#E6ECF5] bg-[#F8FAFD]",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-[#123B72]">{icon}</span>}
        <span className="truncate text-stone-800">{title}</span>
        {badge && <span className="shrink-0">{badge}</span>}
      </div>
      <div className="flex items-center gap-1.5 text-stone-400">
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-[#123B72]"
          )}
        />
      </div>
    </button>
  );
}

export function TraceCardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen } = React.useContext(TraceCardContext);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "p-3.5 text-xs text-stone-700 animate-in fade-in-0 duration-150",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
