"use client";

import { useEffect, useState } from "react";

export interface PublicPortalUrls {
  ojsPublicUrl: string;
  mqcPublicUrl: string;
}

const DEFAULT_PORTAL_URLS: PublicPortalUrls = {
  ojsPublicUrl: "http://localhost:8000/index.php/JP",
  mqcPublicUrl: "http://localhost:3000/dashboard",
};

/**
 * Mengambil URL portal OJS dan MQC dari runtime server (/api/public-config)
 * sehingga satu image Docker portabel di localhost maupun IP VPS.
 */
export function usePublicPortalUrls(): PublicPortalUrls {
  const [urls, setUrls] = useState<PublicPortalUrls>(DEFAULT_PORTAL_URLS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public-config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Partial<PublicPortalUrls> | null) => {
        if (cancelled || !data) return;
        setUrls({
          ojsPublicUrl: data.ojsPublicUrl?.trim() || DEFAULT_PORTAL_URLS.ojsPublicUrl,
          mqcPublicUrl: data.mqcPublicUrl?.trim() || DEFAULT_PORTAL_URLS.mqcPublicUrl,
        });
      })
      .catch(() => {
        // Pertahankan nilai bawaan localhost bila endpoint gagal dihubungi
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return urls;
}
