"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        className="flex items-center gap-2 rounded-full border border-white/25 bg-black/20 py-1 pl-1 pr-3.5 text-sm text-white transition-colors hover:bg-black/35 cursor-pointer"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#123B72] shadow-xs">
          {initial}
        </span>
        <span className="hidden max-w-[130px] truncate text-xs font-semibold text-white sm:inline">
          {user.fullName}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[#D9E1EC] bg-white p-3 text-[#1C1917] shadow-xl animate-in fade-in-0 zoom-in-95">
          <div className="px-2 py-1.5">
            <div className="truncate text-sm font-bold text-[#0B254B]">{user.fullName}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B]">
              <Badge variant={isAdmin ? "default" : "secondary"} className="text-[10px]">
                {isAdmin ? "Admin" : "Pengguna"}
              </Badge>
              {user.unit && <span className="truncate">&bull; {user.unit}</span>}
            </div>
          </div>
          <div className="mt-2 border-t border-[#D9E1EC] pt-2">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Keluar Sesi</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
