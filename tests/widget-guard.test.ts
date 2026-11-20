import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_QUESTION_LENGTH,
  checkWidgetRateLimit,
  evaluateWidgetCors,
  resetWidgetRateLimitStore,
  resolveAllowedWidgetOrigins,
  resolveClientIp,
  validateWidgetQuestion,
} from "../lib/widgetGuard";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
}));
vi.mock("@/lib/embedding", () => ({
  embedTexts: vi.fn(),
}));
vi.mock("@/lib/rag", () => ({
  countEmbeddings: vi.fn().mockResolvedValue(10),
  searchSimilarChunks: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/chat", () => ({
  answerFromContext: vi.fn(),
  logAndDescribeGeminiError: vi.fn(() => ({ status: 502, message: "error", kind: "internal" })),
}));

describe("Widget Public Security Guards (lib/widgetGuard)", () => {
  beforeEach(() => {
    resetWidgetRateLimitStore();
  });

  describe("CORS Origin Whitelist", () => {
    const prodEnv: Record<string, string> = {
      NODE_ENV: "production",
      OJS_PUBLIC_URL: "https://jurnalpermukiman.pu.go.id/index.php/JP",
      MQC_PUBLIC_URL: "https://mqc.jurnalpermukiman.pu.go.id/dashboard",
      AUTH_URL: "https://insight.jurnalpermukiman.pu.go.id",
    };

    it("mengizinkan origin resmi OJS, MQC, JP-Insight, dan WIDGET_ALLOWED_ORIGINS tanpa wildcard *", () => {
      const env = {
        ...prodEnv,
        WIDGET_ALLOWED_ORIGINS: "http://43.133.144.81, http://43.133.144.81:3000",
      };
      const req = new Request("https://insight.jurnalpermukiman.pu.go.id/api/widget/chat", {
        method: "POST",
        headers: { origin: "https://jurnalpermukiman.pu.go.id" },
      });

      const cors = evaluateWidgetCors(req, env);
      expect(cors.allowed).toBe(true);
      expect(cors.headers["Access-Control-Allow-Origin"]).toBe("https://jurnalpermukiman.pu.go.id");
      expect(cors.headers["Access-Control-Allow-Origin"]).not.toBe("*");
      expect(cors.headers.Vary).toBe("Origin");

      const allowed = resolveAllowedWidgetOrigins(env, req);
      expect(allowed.has("https://mqc.jurnalpermukiman.pu.go.id")).toBe(true);
      expect(allowed.has("http://43.133.144.81")).toBe(true);
      expect(allowed.has("http://43.133.144.81:3000")).toBe(true);
    });

    it("menolak origin website asing dan origin null dengan header tanpa Access-Control-Allow-Origin", () => {
      const evilReq = new Request("https://insight.jurnalpermukiman.pu.go.id/api/widget/chat", {
        method: "POST",
        headers: { origin: "https://evil-attacker.example" },
      });
      const evilCors = evaluateWidgetCors(evilReq, prodEnv);
      expect(evilCors.allowed).toBe(false);
      expect(evilCors.headers["Access-Control-Allow-Origin"]).toBeUndefined();
      expect(evilCors.headers.Vary).toBe("Origin");

      const nullReq = new Request("https://insight.jurnalpermukiman.pu.go.id/api/widget/chat", {
        method: "OPTIONS",
        headers: { origin: "null" },
      });
      const nullCors = evaluateWidgetCors(nullReq, prodEnv);
      expect(nullCors.allowed).toBe(false);
      expect(nullCors.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("mengizinkan panggilan non-browser tanpa header Origin namun tidak memasang wildcard *", () => {
      const req = new Request("https://insight.jurnalpermukiman.pu.go.id/api/widget/chat", {
        method: "POST",
      });
      const cors = evaluateWidgetCors(req, prodEnv);
      expect(cors.allowed).toBe(true);
      expect(cors.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });
  });

  describe("Batas Panjang Pertanyaan", () => {
    it("menolak pertanyaan kosong atau melebihi batas karakter maksimal", () => {
      const empty = validateWidgetQuestion("   ");
      expect(empty.ok).toBe(false);
      if (!empty.ok) expect(empty.status).toBe(400);

      const exact = validateWidgetQuestion("a".repeat(DEFAULT_MAX_QUESTION_LENGTH));
      expect(exact.ok).toBe(true);

      const tooLong = validateWidgetQuestion("a".repeat(DEFAULT_MAX_QUESTION_LENGTH + 1));
      expect(tooLong.ok).toBe(false);
      if (!tooLong.ok) {
        expect(tooLong.status).toBe(400);
        expect(tooLong.error).toContain("500");
      }

      const customLong = validateWidgetQuestion("123456", { WIDGET_MAX_QUESTION_LENGTH: "5" });
      expect(customLong.ok).toBe(false);
    });
  });

  describe("Rate Limit per IP", () => {
    it("mengekstrak IP pertama dari x-forwarded-for dan menormalkan prefix ::ffff:", () => {
      const req = new Request("http://localhost:3001/api/widget/chat", {
        headers: { "x-forwarded-for": "::ffff:203.0.113.9, 10.0.0.1" },
      });
      expect(resolveClientIp(req)).toBe("203.0.113.9");
    });

    it("memblokir setelah melewati batas per menit per IP namun tidak memblokir IP lain", () => {
      const env = { WIDGET_RATE_LIMIT_PER_MIN: "2", WIDGET_RATE_LIMIT_PER_DAY: "10" };
      const reqA = new Request("http://localhost:3001/api/widget/chat", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      });
      const reqB = new Request("http://localhost:3001/api/widget/chat", {
        headers: { "x-forwarded-for": "198.51.100.2" },
      });

      const t0 = 1_700_000_000_000;
      expect(checkWidgetRateLimit(reqA, env, t0).allowed).toBe(true);
      expect(checkWidgetRateLimit(reqA, env, t0 + 1000).allowed).toBe(true);

      const blocked = checkWidgetRateLimit(reqA, env, t0 + 2000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.limitType).toBe("minute");
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

      // IP berbeda tetap diizinkan
      expect(checkWidgetRateLimit(reqB, env, t0 + 2000).allowed).toBe(true);

      // Setelah lewat 60 detik, IP A kembali diizinkan
      expect(checkWidgetRateLimit(reqA, env, t0 + 60_001).allowed).toBe(true);
    });

    it("memblokir saat batas harian per IP tercapai dan reset setelah 24 jam", () => {
      const env = { WIDGET_RATE_LIMIT_PER_MIN: "10", WIDGET_RATE_LIMIT_PER_DAY: "3" };
      const req = new Request("http://localhost:3001/api/widget/chat", {
        headers: { "x-real-ip": "198.51.100.55" },
      });
      const t0 = 1_700_000_000_000;
      expect(checkWidgetRateLimit(req, env, t0).allowed).toBe(true);
      expect(checkWidgetRateLimit(req, env, t0 + 70_000).allowed).toBe(true);
      expect(checkWidgetRateLimit(req, env, t0 + 140_000).allowed).toBe(true);

      const dailyBlocked = checkWidgetRateLimit(req, env, t0 + 210_000);
      expect(dailyBlocked.allowed).toBe(false);
      expect(dailyBlocked.limitType).toBe("daily");

      expect(checkWidgetRateLimit(req, env, t0 + 86_400_001).allowed).toBe(true);
    });
  });

  describe("Integrasi Handler /api/widget/chat (OPTIONS & POST)", () => {
    it("menolak OPTIONS & POST lintas origin asing dengan 403, dan menolak payload panjang dengan 400", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("OJS_PUBLIC_URL", "http://43.133.144.81/index.php/JP");
      try {
        const { OPTIONS, POST } = await import("../app/api/widget/chat/route");

        const badPreflight = await OPTIONS(
          new Request("http://43.133.144.81:3001/api/widget/chat", {
            method: "OPTIONS",
            headers: { origin: "https://unknown-site.test" },
          }),
        );
        expect(badPreflight.status).toBe(403);
        expect(badPreflight.headers.get("access-control-allow-origin")).toBeNull();

        const badPost = await POST(
          new Request("http://43.133.144.81:3001/api/widget/chat", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://unknown-site.test",
            },
            body: JSON.stringify({ question: "Halo?" }),
          }),
        );
        expect(badPost.status).toBe(403);
        expect(badPost.headers.get("access-control-allow-origin")).toBeNull();

        const goodPreflight = await OPTIONS(
          new Request("http://43.133.144.81:3001/api/widget/chat", {
            method: "OPTIONS",
            headers: { origin: "http://43.133.144.81" },
          }),
        );
        expect(goodPreflight.status).toBe(204);
        expect(goodPreflight.headers.get("access-control-allow-origin")).toBe("http://43.133.144.81");

        const tooLongRes = await POST(
          new Request("http://43.133.144.81:3001/api/widget/chat", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "http://43.133.144.81",
              "x-forwarded-for": "203.0.113.77",
            },
            body: JSON.stringify({ question: "x".repeat(501) }),
          }),
        );
        expect(tooLongRes.status).toBe(400);
        expect(tooLongRes.headers.get("access-control-allow-origin")).toBe("http://43.133.144.81");
        const json = (await tooLongRes.json()) as { error?: string };
        expect(json.error).toContain("500");
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
