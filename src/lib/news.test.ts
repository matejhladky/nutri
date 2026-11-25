import { describe, expect, it } from "vitest";
import { pendingNews, NEWS, type NewsItem } from "./news";

const item = (id: string, date: string): NewsItem => ({ id, date, title: id, body: "", button: "ok" });
const list = [item("a", "2026-11-20"), item("b", "2026-11-25")];

describe("news notices", () => {
  it("shows the newest one she hasn't dismissed", () => {
    expect(pendingNews(list, [], "2026-11-01T10:00:00Z")?.id).toBe("b");
    expect(pendingNews(list, ["b"], "2026-11-01T10:00:00Z")?.id).toBe("a");
    expect(pendingNews(list, ["a", "b"], "2026-11-01T10:00:00Z")).toBeNull();
  });

  it("skips notices about changes from before she started, and shows nothing to someone who hasn't started", () => {
    expect(pendingNews(list, [], "2026-11-22T10:00:00Z")?.id).toBe("b");
    expect(pendingNews(list, ["b"], "2026-11-22T10:00:00Z")).toBeNull(); // "a" predates her start
    expect(pendingNews(list, [], "2026-11-26T08:00:00Z")).toBeNull();
    expect(pendingNews(list, [], null)).toBeNull();
  });

  it("has unique ids and real dates", () => {
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    for (const n of NEWS) expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
