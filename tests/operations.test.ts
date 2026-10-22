import { describe, it, expect } from "vitest";
import { insights, type Intelligence } from "../packages/shared/src/operations";
const base: Intelligence = {
  from: "2026-10-01",
  to: "2026-10-07",
  source: "Synthetic test aggregates",
  server_time: "2026-10-08T00:00:00Z",
  privacy: "Test",
  baseline_note: "Test",
  hourly: [],
  blocks: [],
  holiday: [],
};
describe("explainable security planning rules", () => {
  it("requires a meaningful matched baseline and never treats the hour as suspicious", () => {
    const hourly = {
      block_id: "A",
      label: "Demo Block A",
      hour: 3,
      entries: 30,
      baseline: 10,
      baseline_periods: 4,
    };
    const found = insights({ ...base, hourly: [hourly] });
    expect(found).toHaveLength(1);
    expect(found[0].action).toContain("not suspicious");
    expect(found[0].source).toContain("Synthetic");
    expect(
      insights({ ...base, hourly: [{ ...hourly, baseline: null }] }),
    ).toHaveLength(0);
    expect(
      insights({ ...base, hourly: [{ ...hourly, baseline: 0 }] }),
    ).toHaveLength(0);
    expect(
      insights({ ...base, hourly: [{ ...hourly, baseline_periods: 2 }] }),
    ).toHaveLength(0);
  });
  it("keeps denied-attempt review and holiday plans distinct from accusations and occupancy", () => {
    const found = insights({
      ...base,
      blocks: [{ block_id: "A", label: "Block A", entries: 30, denied: 10 }],
      holiday: [
        {
          block_id: "A",
          label: "Block A",
          residents: 30,
          stays: 5,
          percentage: 20,
        },
      ],
    });
    expect(found).toHaveLength(2);
    expect(found[0].evidence).toContain("not an urgent alert");
    expect(found[1].action).toContain("not physical occupancy");
    expect(
      insights({
        ...base,
        holiday: [
          {
            block_id: "A",
            label: "Block A",
            residents: 30,
            stays: null,
            percentage: null,
          },
        ],
      }),
    ).toHaveLength(0);
  });
});
