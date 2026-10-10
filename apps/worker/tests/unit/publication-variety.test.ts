import { describe, expect, it } from "vitest";
import { selectPublicationCandidate } from "../../src/domain/publication-variety.js";

describe("publication variety", () => {
  it("prioritizes a channel that has not received offers", () => {
    expect(
      selectPublicationCandidate(
        [
          {
            id: "fashion",
            niche: "fashion",
            score: 90,
            createdAt: "2026-10-10T10:00:00Z",
          },
          {
            id: "kitchen",
            niche: "home_kitchen",
            score: 70,
            createdAt: "2026-10-10T10:05:00Z",
          },
        ],
        { fashion: "2026-10-10T10:10:00Z" },
      )?.id,
    ).toBe("kitchen");
  });
  it("prefers a stronger offer inside the same channel", () => {
    expect(
      selectPublicationCandidate(
        [
          {
            id: "weak",
            niche: "hardware",
            score: 30,
            createdAt: "2026-10-10T10:00:00Z",
          },
          {
            id: "strong",
            niche: "hardware",
            score: 80,
            createdAt: "2026-10-10T10:05:00Z",
          },
        ],
        {},
      )?.id,
    ).toBe("strong");
  });
  it("returns null for an empty queue", () => {
    expect(selectPublicationCandidate([], {})).toBeNull();
  });
  it("uses the oldest waiting niche to break equal activity, regardless of input order", () => {
    expect(
      selectPublicationCandidate(
        [
          {
            id: "fashion-new",
            niche: "fashion",
            score: 95,
            createdAt: "2026-10-10T10:09:00Z",
          },
          {
            id: "kitchen",
            niche: "home_kitchen",
            score: 70,
            createdAt: "2026-10-10T10:05:00Z",
          },
          {
            id: "fashion-old",
            niche: "fashion",
            score: 30,
            createdAt: "2026-10-10T10:00:00Z",
          },
        ],
        {},
      )?.id,
    ).toBe("fashion-new");
  });
});
