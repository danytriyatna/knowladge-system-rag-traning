"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal masuk");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col puskim-canvas text-foreground">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#B93A0C] via-[#C13D0D] to-[#962D08]" />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="fresh-card grid w-full max-w-4xl overflow-hidden rounded-3xl md:grid-cols-12">
          <div className="flex flex-col justify-between bg-gradient-to-br from-[#B93A0C] via-[#C13D0D] to-[#8C2806] p-8 text-white md:col-span-5 sm:p-10">
            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-md">
                <Image
                  src="/logo-pu.png"
                  alt="Logo PU"
                  width={44}
                  height={44}
                  className="object-contain"
                  priority
                />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-white/75">
                Ekosistem Jurnal Permukiman
              </p>
              <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">
                JP-Insight
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Sistem referensi ilmiah, analisis peraturan dirujuk, celah riset, dan asistensi
                kajian berbasis arsip terbit Jurnal Permukiman.
              </p>
            </div>

            <div className="mt-8 border-t border-white/20 pt-4 text-xs text-white/80">
              <p className="font-semibold text-white">
                Direktorat Bina Teknik Permukiman dan Perumahan
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <a
                  href="http://localhost/jurnalpermukiman/index.php/JP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                >
                  Portal OJS ↗
                </a>
                <a
                  href="http://localhost:3000/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                >
                  MQC Assistant ↗
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-white p-8 md:col-span-7 sm:p-10">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="h-5 w-1.5 rounded-full bg-[#C13D0D]" aria-hidden="true" />
                  <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                    Masuk ke JP-Insight
                  </h1>
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  Gunakan akun redaksi atau peneliti unit terdaftar.
                </p>
              </div>
              <Image
                src="/kemenpu_pill_clean.png"
                alt="Kementerian PU"
                width={116}
                height={28}
                className="hidden h-7 w-auto object-contain sm:block"
              />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-stone-600">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border border-[#DFD9D2] bg-[#FAF8F5] px-4 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-[#C13D0D] focus:bg-white focus:ring-1 focus:ring-[#C13D0D]"
                  placeholder="nama@pu.go.id"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-stone-600">Kata Sandi</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border border-[#DFD9D2] bg-[#FAF8F5] px-4 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-[#C13D0D] focus:bg-white focus:ring-1 focus:ring-[#C13D0D]"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="fade-in text-sm text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="press mt-2 w-full rounded-xl bg-gradient-to-r from-[#D14715] to-[#A0320A] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:brightness-105 disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-stone-400">
              Belum punya akun? Hubungi admin sekretariat jurnal untuk dibuatkan akses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
