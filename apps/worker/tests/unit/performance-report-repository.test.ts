import { describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("../../src/adapters/persistence/db.js", () => ({ db: { query } }));
vi.mock("../../src/config/runtime.js", () => ({ telegramEnv: {} }));
import { performanceReportRepository } from "../../src/adapters/persistence/performance-report-repository.js";
import { getReportPeriod } from "../../src/domain/performance-report.js";

describe("bot report period and counts", () => {
  it("passes the closed Sao Paulo period to the database and maps bigint counts", async () => {
    query.mockResolvedValueOnce([
      {
        new_users: "4",
        watches_created: "7",
        notifications_sent: "3",
        notifications_unknown: "2",
      },
    ]);
    const result = await performanceReportRepository.botActivity(
      getReportPeriod("weekly", new Date("2026-10-09T12:00:00Z")),
    );
    expect(result).toEqual({
      newUsers: 4,
      watchesCreated: 7,
      notificationsSent: 3,
      notificationsUnknown: 2,
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      "2026-09-28T03:00:00.000Z",
      "2026-10-05T03:00:00.000Z",
    ]);
  });
  it("rejects missing database results instead of inventing zero activity", async () => {
    query.mockResolvedValueOnce([]);
    await expect(
      performanceReportRepository.botActivity(getReportPeriod("weekly")),
    ).rejects.toThrow("no result");
  });
});
