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
        className="press flex items-center gap-2 rounded-full border border-white/25 bg-black/20 py-1 pl-1 pr-3 text-sm text-white transition-colors hover:bg-black/30"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#A0320A]">
          {initial}
        </span>
        <span className="hidden max-w-[130px] truncate text-xs font-semibold text-white sm:inline">
          {user.fullName}
        </span>
      </button>

      {open && (
        <div className="popover-panel popover-panel-right absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-[#DFD9D2] bg-white p-3 shadow-lg">
          <div className="px-1 pb-2">
            <div className="truncate text-sm font-semibold text-stone-900">{user.fullName}</div>
            <div className="truncate text-xs text-stone-500">
              {isAdmin ? "Admin" : "Pengguna Unit"}
              {user.unit ? ` · ${user.unit}` : ""}
            </div>
          </div>
          <div className="border-t border-[#EFEAE4] pt-2">
            <button
              onClick={onLogout}
              className="press flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-stone-700 hover:bg-[#FDF4F0] hover:text-[#A0320A]"
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
