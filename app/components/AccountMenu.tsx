"use client";

import { useEffect, useRef, useState } from "react";

interface AccountMenuUser {
  fullName: string;
  role: "admin" | "unit_user";
  unit: string | null;
}

export default function AccountMenu({
  user,
  onLogout,
}: {
  user: AccountMenuUser;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === "admin";
  const initial = user.fullName.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu akun"
        className="press flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm hover:bg-background"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
          {initial}
        </span>
        <span className="hidden max-w-[120px] truncate font-medium text-foreground sm:inline">
          {user.fullName}
        </span>
      </button>

      {open && (
        <div className="popover-panel popover-panel-right absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="px-1 pb-2">
            <div className="truncate text-sm font-medium text-foreground">{user.fullName}</div>
            <div className="truncate text-xs text-muted">
              {isAdmin ? "Admin" : "Pengguna Unit"}
              {user.unit ? ` · ${user.unit}` : ""}
            </div>
          </div>
          <div className="border-t border-border pt-2">
            <button
              onClick={onLogout}
              className="press flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
                <path
                  d="M8 3H4.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1H8M13 13.5 17 10l-4-3.5M7 10h10"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
