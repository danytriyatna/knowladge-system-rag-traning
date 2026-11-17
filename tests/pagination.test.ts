import { describe, it, expect } from "vitest";

function getPaginationItems(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", total];
  }
  if (current >= total - 3) {
    return [
      1,
      "ellipsis-start",
      total - 4,
      total - 3,
      total - 2,
      total - 1,
      total,
    ];
  }
  return [1, "ellipsis-start", current - 1, current, current + 1, "ellipsis-end", total];
}

describe("Dokumen Shadcn Pagination Logic", () => {
  it("should show all pages when total pages is 7 or fewer", () => {
    expect(getPaginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("should format start window with trailing ellipsis when current <= 4", () => {
    const items = getPaginationItems(2, 23);
    expect(items).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 23]);
  });

  it("should format middle window with both ellipses when in middle", () => {
    const items = getPaginationItems(10, 23);
    expect(items).toEqual([1, "ellipsis-start", 9, 10, 11, "ellipsis-end", 23]);
  });

  it("should format end window with leading ellipsis when current >= total - 3", () => {
    const items = getPaginationItems(21, 23);
    expect(items).toEqual([1, "ellipsis-start", 19, 20, 21, 22, 23]);
  });

  it("should correctly slice documents by page and page size", () => {
    const sampleDocs = Array.from({ length: 225 }, (_, i) => ({ id: `doc-${i + 1}` }));
    const pageSize = 10;
    const page = 3;

    const start = (page - 1) * pageSize;
    const paginated = sampleDocs.slice(start, start + pageSize);

    expect(paginated.length).toBe(10);
    expect(paginated[0].id).toBe("doc-21");
    expect(paginated[9].id).toBe("doc-30");

    const totalPages = Math.ceil(sampleDocs.length / pageSize);
    expect(totalPages).toBe(23);

    const lastPageStart = (23 - 1) * pageSize;
    const lastPageDocs = sampleDocs.slice(lastPageStart, lastPageStart + pageSize);
    expect(lastPageDocs.length).toBe(5);
    expect(lastPageDocs[4].id).toBe("doc-225");
  });
});
