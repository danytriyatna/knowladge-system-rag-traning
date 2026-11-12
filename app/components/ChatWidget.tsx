"use client";

import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";

const DISMISS_KEY = "jp_insight_chat_widget_dismissed";

export default function ChatWidget({ onOpen }: { onOpen: () => void }) {
  const [showCallout, setShowCallout] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // localStorage tidak tersedia, anggap belum pernah ditutup
    }
    if (dismissed) return;
    const timer = setTimeout(() => setShowCallout(true), 900);
    return () => clearTimeout(timer);
  }, []);

  function dismissCallout() {
    setShowCallout(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // abaikan jika localStorage tidak tersedia
    }
  }

  function handleOpen() {
    dismissCallout();
    onOpen();
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 animate-in fade-in-0 duration-300">
      {showCallout && (
        <div className="relative max-w-[250px] rounded-2xl rounded-br-xs border border-[#C7D8EE] bg-white px-4 py-3 text-sm text-[#1C1917] shadow-lg animate-in zoom-in-95">
          <button
            onClick={dismissCallout}
            aria-label="Tutup"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#D9E1EC] bg-white text-xs text-[#64748B] hover:text-[#123B72] hover:bg-[#EEF4FC] cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="font-bold text-[#0B254B]">Ada pertanyaan?</p>
          <p className="mt-0.5 text-xs text-[#64748B] leading-relaxed">
            Coba tanya langsung ke Tanya JP &amp; Kajian, jawabannya dirujuk dari seluruh arsip jurnal.
          </p>
        </div>
      )}

      <button
        onClick={handleOpen}
        aria-label="Buka Chat & Kajian"
        className={`group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#123B72] via-[#0E3161] to-[#081A36] text-white shadow-xl ring-2 ring-[#EAB308]/90 transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
          showCallout ? "animate-bounce" : ""
        }`}
      >
        {showCallout && (
          <span className="absolute inset-0 rounded-full bg-[#123B72] opacity-75 animate-ping" />
        )}
        <MessageSquare className="relative h-6 w-6 transition-transform group-hover:scale-110" />
      </button>
    </div>
  );
}
