"use client";

import { useEffect, useState } from "react";

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
    <div className="widget-enter fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {showCallout && (
        <div className="callout-enter relative max-w-[250px] rounded-2xl rounded-br-sm border border-[#F4D4C9] bg-white px-4 py-3 text-sm text-stone-800 shadow-lg">
          <button
            onClick={dismissCallout}
            aria-label="Tutup"
            className="press absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#DFD9D2] bg-white text-[10px] text-stone-500 hover:text-[#C13D0D]"
          >
            &#10005;
          </button>
          <p className="font-bold text-stone-900">Ada pertanyaan?</p>
          <p className="mt-0.5 text-xs text-stone-500">
            Coba tanya langsung ke Chat &amp; Kajian, jawabannya diambil dari seluruh
            dokumen jurnal.
          </p>
        </div>
      )}

      <button
        onClick={handleOpen}
        aria-label="Buka Chat & Kajian"
        className={`press relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#D14715] to-[#A0320A] text-white shadow-lg ring-2 ring-white/80 hover:brightness-105 ${
          showCallout ? "widget-bounce" : ""
        }`}
      >
        {showCallout && (
          <span className="notify-ping absolute inset-0 rounded-full bg-accent" />
        )}
        <svg viewBox="0 0 20 20" fill="none" className="relative h-6 w-6">
          <path
            d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v7A1.5 1.5 0 0 1 15.5 13H8l-3.5 3.5V13H4.5A1.5 1.5 0 0 1 3 11.5v-7Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
