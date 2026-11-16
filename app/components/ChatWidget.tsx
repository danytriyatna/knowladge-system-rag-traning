"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

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
        className={`press relative flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl ring-2 ring-[#EAB308]/90 hover:brightness-105 hover:scale-105 transition-all p-0.5 cursor-pointer ${
          showCallout ? "widget-bounce" : ""
        }`}
      >
        {showCallout && (
          <span className="notify-ping absolute inset-0 rounded-full bg-[#EAB308]/40" />
        )}
        <Image
          src="/jp-insight-logo.png?v=20261115_v2_gold_ring"
          alt="Maskot JP Insight"
          width={56}
          height={56}
          className="relative h-full w-full rounded-full object-contain"
          priority
          unoptimized
        />
      </button>
    </div>
  );
}
