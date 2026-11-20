export const DEFAULT_MAX_QUESTION_LENGTH = 500;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 10;
export const DEFAULT_RATE_LIMIT_PER_DAY = 50;
export const MAX_WIDGET_BODY_BYTES = 16_384;

const MINUTE_WINDOW_MS = 60_000;
const DAY_WINDOW_MS = 86_400_000;
const MAX_TRACKED_IPS = 10_000;

export interface WidgetRateBucket {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

export interface WidgetCorsEvaluation {
  allowed: boolean;
  origin: string | null;
  headers: Record<string, string>;
}

export interface WidgetRateLimitResult {
  allowed: boolean;
  ip: string;
  retryAfterSeconds: number;
  limitType?: "minute" | "daily";
  message?: string;
}

export type WidgetQuestionValidation =
  | { ok: true; question: string }
  | { ok: false; status: 400; error: string };

declare global {
  var __jpWidgetRateLimitStore: Map<string, WidgetRateBucket> | undefined;
}

function getRateLimitStore(): Map<string, WidgetRateBucket> {
  if (!globalThis.__jpWidgetRateLimitStore) {
    globalThis.__jpWidgetRateLimitStore = new Map<string, WidgetRateBucket>();
  }
  return globalThis.__jpWidgetRateLimitStore;
}

/** Mengosongkan state rate-limit (khusus untuk kebutuhan unit test). */
export function resetWidgetRateLimitStore(): void {
  globalThis.__jpWidgetRateLimitStore?.clear();
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function addLoopbackSibling(origin: string, target: Set<string>): void {
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      target.add(parsed.origin);
    } else if (parsed.hostname === "127.0.0.1") {
      parsed.hostname = "localhost";
      target.add(parsed.origin);
    }
  } catch {
    // Abaikan URL tidak valid
  }
}

function resolveRequestSameOrigin(request: Request): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    let proto = forwardedProto;
    if (!proto) {
      try {
        proto = new URL(request.url).protocol.replace(":", "");
      } catch {
        proto = "http";
      }
    }
    return toOrigin(`${proto || "http"}://${host}`);
  }
  try {
    return toOrigin(new URL(request.url).origin);
  } catch {
    return null;
  }
}

/**
 * Menyusun daftar origin resmi yang diizinkan mengakses endpoint widget chat
 * (OJS publik, MQC dashboard, JP-Insight sendiri, atau override via WIDGET_ALLOWED_ORIGINS).
 */
export function resolveAllowedWidgetOrigins(
  env: Record<string, string | undefined> = process.env,
  request?: Request,
): Set<string> {
  const allowed = new Set<string>();
  const isDev = env.NODE_ENV !== "production";

  const explicitList = env.WIDGET_ALLOWED_ORIGINS?.split(/[,\s]+/).filter(Boolean) ?? [];
  const candidates = [
    ...explicitList,
    env.OJS_PUBLIC_URL,
    env.OJS_ARTICLE_BASE_URL,
    env.MQC_PUBLIC_URL,
    env.AUTH_URL,
    env.JP_INSIGHT_PUBLIC_URL,
    env.NEXT_PUBLIC_APP_URL,
  ];

  for (const raw of candidates) {
    const origin = toOrigin(raw);
    if (origin) {
      allowed.add(origin);
      if (isDev) {
        addLoopbackSibling(origin, allowed);
      }
    }
  }

  if (allowed.size === 0 && isDev) {
    for (const devOrigin of [
      "http://localhost:8000",
      "http://127.0.0.1:8000",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ]) {
      allowed.add(devOrigin);
    }
  }

  if (request) {
    const sameOrigin = resolveRequestSameOrigin(request);
    if (sameOrigin) {
      allowed.add(sameOrigin);
    }
  }

  return allowed;
}

/**
 * Mengevaluasi header Origin request terhadap daftar whitelist origin resmi.
 * Permintaan browser lintas-origin dari domain asing ditolak dengan 403 tanpa header ACAO.
 */
export function evaluateWidgetCors(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): WidgetCorsEvaluation {
  const rawOrigin = request.headers.get("origin")?.trim() ?? "";
  if (!rawOrigin) {
    return {
      allowed: true,
      origin: null,
      headers: { Vary: "Origin" },
    };
  }

  const normalizedOrigin = toOrigin(rawOrigin);
  const allowedOrigins = resolveAllowedWidgetOrigins(env, request);

  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    return {
      allowed: false,
      origin: normalizedOrigin,
      headers: { Vary: "Origin" },
    };
  }

  return {
    allowed: true,
    origin: normalizedOrigin,
    headers: {
      "Access-Control-Allow-Origin": normalizedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      Vary: "Origin",
    },
  };
}

/** Mengekstrak IP klien dari header proxy standar dengan fallback aman. */
export function resolveClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = cfIp || xff || realIp || "unknown";
  return candidate.replace(/^::ffff:/i, "").trim().toLowerCase() || "unknown";
}

function pruneRateLimitStore(store: Map<string, WidgetRateBucket>, nowMs: number): void {
  if (store.size < MAX_TRACKED_IPS) return;
  for (const [key, bucket] of store.entries()) {
    if (nowMs >= bucket.dayResetAt) {
      store.delete(key);
    }
  }
  while (store.size >= MAX_TRACKED_IPS) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

/**
 * Menerapkan batas permintaan per IP (per menit dan per hari) di memori proses
 * agar trafik spam/bot tidak menguras kuota Gemini API publik.
 */
export function checkWidgetRateLimit(
  request: Request,
  env: Record<string, string | undefined> = process.env,
  nowMs: number = Date.now(),
): WidgetRateLimitResult {
  const perMinute = parsePositiveInt(env.WIDGET_RATE_LIMIT_PER_MIN, DEFAULT_RATE_LIMIT_PER_MINUTE);
  const perDay = parsePositiveInt(env.WIDGET_RATE_LIMIT_PER_DAY, DEFAULT_RATE_LIMIT_PER_DAY);
  const ip = resolveClientIp(request);
  const store = getRateLimitStore();

  let bucket = store.get(ip);
  if (!bucket) {
    pruneRateLimitStore(store, nowMs);
    bucket = {
      minuteCount: 0,
      minuteResetAt: nowMs + MINUTE_WINDOW_MS,
      dayCount: 0,
      dayResetAt: nowMs + DAY_WINDOW_MS,
    };
  } else {
    if (nowMs >= bucket.minuteResetAt) {
      bucket.minuteCount = 0;
      bucket.minuteResetAt = nowMs + MINUTE_WINDOW_MS;
    }
    if (nowMs >= bucket.dayResetAt) {
      bucket.dayCount = 0;
      bucket.dayResetAt = nowMs + DAY_WINDOW_MS;
    }
  }

  if (bucket.dayCount >= perDay) {
    store.set(ip, bucket);
    return {
      allowed: false,
      ip,
      limitType: "daily",
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.dayResetAt - nowMs) / 1000)),
      message: "Batas pertanyaan harian untuk alamat Anda telah tercapai. Silakan coba kembali besok.",
    };
  }

  if (bucket.minuteCount >= perMinute) {
    store.set(ip, bucket);
    return {
      allowed: false,
      ip,
      limitType: "minute",
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.minuteResetAt - nowMs) / 1000)),
      message: "Terlalu banyak pertanyaan dalam waktu singkat. Mohon tunggu sebentar sebelum mencoba lagi.",
    };
  }

  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  store.set(ip, bucket);

  return {
    allowed: true,
    ip,
    retryAfterSeconds: 0,
  };
}

/** Mengambil batas panjang maksimum karakter pertanyaan widget. */
export function getMaxWidgetQuestionLength(
  env: Record<string, string | undefined> = process.env,
): number {
  return parsePositiveInt(env.WIDGET_MAX_QUESTION_LENGTH, DEFAULT_MAX_QUESTION_LENGTH);
}

/** Memvalidasi teks pertanyaan widget (tidak kosong & tidak melebihi batas karakter). */
export function validateWidgetQuestion(
  rawQuestion: unknown,
  env: Record<string, string | undefined> = process.env,
): WidgetQuestionValidation {
  const question = typeof rawQuestion === "string" ? rawQuestion.trim() : "";
  if (!question) {
    return { ok: false, status: 400, error: "Pertanyaan tidak boleh kosong" };
  }

  const maxLen = getMaxWidgetQuestionLength(env);
  if (Array.from(question).length > maxLen) {
    return {
      ok: false,
      status: 400,
      error: `Pertanyaan terlalu panjang (maksimal ${maxLen} karakter). Mohon ringkas pertanyaan Anda.`,
    };
  }

  return { ok: true, question };
}
