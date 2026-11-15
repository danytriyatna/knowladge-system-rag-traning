"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

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
        <div className="callout-enter relative max-w-[250px] rounded-2xl rounded-br-sm border border-[#C7D8EE] bg-white px-4 py-3 text-sm text-stone-800 shadow-lg">
          <button
            onClick={dismissCallout}
            aria-label="Tutup"
            className="press absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#D9E1EC] bg-white text-[10px] text-stone-500 hover:text-[#123B72]"
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
        className={`press relative flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl ring-2 ring-[#EAB308]/90 hover:brightness-105 hover:scale-105 transition-all p-0.5 ${
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
        />
      </button>
    </div>
  );
}
