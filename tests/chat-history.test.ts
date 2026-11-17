import { describe, it, expect } from "vitest";
import {
  groupChatHistoryByDate,
  formatHistoryTimestamp,
  ChatHistoryRecord,
} from "../components/ui/chat-history";

describe("ChatHistory Centralized Component Tests", () => {
  it("should group chat history into chronological buckets correctly", () => {
    const now = new Date();

    const todayItem: ChatHistoryRecord = {
      id: "1",
      question: "Pertanyaan hari ini",
      created_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      mode: "chat",
    };

    const yesterdayItem: ChatHistoryRecord = {
      id: "2",
      question: "Pertanyaan kemarin",
      created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      mode: "kajian",
    };

    const fiveDaysAgoItem: ChatHistoryRecord = {
      id: "3",
      question: "Pertanyaan 5 hari lalu",
      created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "chat",
    };

    const twentyDaysAgoItem: ChatHistoryRecord = {
      id: "4",
      question: "Pertanyaan 20 hari lalu",
      created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "kajian",
    };

    const twoMonthsAgoItem: ChatHistoryRecord = {
      id: "5",
      question: "Pertanyaan lama",
      created_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      mode: "chat",
    };

    const groups = groupChatHistoryByDate([
      todayItem,
      yesterdayItem,
      fiveDaysAgoItem,
      twentyDaysAgoItem,
      twoMonthsAgoItem,
    ]);

    expect(groups.length).toBeGreaterThan(0);
    const labels = groups.map((g) => g.label);

    expect(labels).toContain("Hari Ini");
    const todayGroup = groups.find((g) => g.label === "Hari Ini");
    expect(todayGroup?.items.some((i) => i.id === "1")).toBe(true);

    const oldGroup = groups.find((g) => g.label === "Lebih Lama");
    expect(oldGroup?.items.some((i) => i.id === "5")).toBe(true);
  });

  it("should handle empty or invalid history records without throwing", () => {
    expect(groupChatHistoryByDate([])).toEqual([]);

    const invalidItem: ChatHistoryRecord = {
      id: "invalid",
      question: "Invalid date item",
      created_at: "not-a-valid-date",
    };

    const result = groupChatHistoryByDate([invalidItem]);
    expect(result.length).toBe(1);
    expect(result[0].label).toBe("Lebih Lama");
    expect(result[0].items[0].id).toBe("invalid");
  });

  it("should format timestamps gracefully", () => {
    const nowIso = new Date().toISOString();
    const formatted = formatHistoryTimestamp(nowIso);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);

    const invalidFormatted = formatHistoryTimestamp("invalid-iso");
    expect(invalidFormatted).toBe("");
  });
});
