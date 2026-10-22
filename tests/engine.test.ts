import { describe, expect, it } from "vitest";
import {
  analytics,
  dayOffset,
  demoCredential,
  seed,
  uid,
  verifyDemo,
} from "../packages/shared/src/model";
const now = Date.parse("2026-10-22T12:00:00+08:00");
const verify = (index: number, block = uid(1001)) => {
  const data = seed(now);
  return verifyDemo(
    data,
    demoCredential(data.students[index].id, now).token,
    block,
    new Set(),
    now,
  );
};
describe("residential verification", () => {
  it("grants Alex at Block A", () => expect(verify(0).granted).toBe(true));
  it("denies Alex at the wrong block", () =>
    expect(verify(0, uid(1002)).granted).toBe(false));
  it("denies Sarah at Block A", () =>
    expect(verify(1).reason).toBe("No active block permission"));
  it("denies a non-resident", () => expect(verify(2).granted).toBe(false));
  it("denies expired residency", () =>
    expect(verify(3).reason).toBe("Residential permission expired"));
  it("rejects malformed and unknown credentials", () => {
    const data = seed(now);
    expect(verifyDemo(data, "hello", uid(1001), new Set(), now).granted).toBe(
      false,
    );
    expect(
      verifyDemo(
        data,
        demoCredential(uid(9999), now).token,
        uid(1001),
        new Set(),
        now,
      ).granted,
    ).toBe(false);
  });
  it("rotates unpredictable 15-second credentials", () => {
    const a = demoCredential(uid(1), now),
      b = demoCredential(uid(1), now);
    expect(a.token).not.toBe(b.token);
    expect(Date.parse(a.expires_at) - Date.parse(a.issued_at)).toBe(15000);
  });
  it("rejects a credential at the exact expiry boundary", () => {
    const data = seed(now),
      c = demoCredential(uid(1), now);
    expect(
      verifyDemo(data, c.token, uid(1001), new Set(), now + 15000).reason,
    ).toBe("QR credential expired");
  });
  it("consumes a credential only once", () => {
    const data = seed(now),
      c = demoCredential(uid(1), now),
      used = new Set<string>();
    expect(verifyDemo(data, c.token, uid(1001), used, now).granted).toBe(true);
    expect(verifyDemo(data, c.token, uid(1001), used, now + 1).reason).toBe(
      "QR credential already used",
    );
  });
  it("keeps an earlier unexpired credential valid when a new one issues", () => {
    const data = seed(now),
      old = demoCredential(uid(1), now);
    demoCredential(uid(1), now + 1000);
    expect(
      verifyDemo(data, old.token, uid(1001), new Set(), now + 2000).granted,
    ).toBe(true);
  });
  it("uses permission changes on subsequent scans", () => {
    const data = seed(now);
    data.students[0].block_id = uid(1002);
    expect(
      verifyDemo(
        data,
        demoCredential(uid(1), now).token,
        uid(1001),
        new Set(),
        now,
      ).granted,
    ).toBe(false);
    data.students[0].block_id = uid(1001);
    data.students[0].status = "expired";
    expect(
      verifyDemo(
        data,
        demoCredential(uid(1), now).token,
        uid(1001),
        new Set(),
        now,
      ).granted,
    ).toBe(false);
  });
});
describe("rolling failure alerts", () => {
  it("denies immediately, alerts on the fifth, deduplicates and isolates gates", () => {
    const data = seed(now);
    data.events = [];
    data.alerts = [];
    const used = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const r = verifyDemo(data, `bad-${i}`, uid(1001), used, now + i * 1000);
      expect(r.granted).toBe(false);
      expect(Boolean(r.alert)).toBe(i === 4);
    }
    expect(
      verifyDemo(data, "bad", uid(1001), used, now + 6000).alert,
    ).toBeUndefined();
    expect(
      verifyDemo(data, "bad", uid(1002), used, now + 7000).alert,
    ).toBeUndefined();
    expect(data.alerts.length).toBe(1);
  });
  it("does not count attempts outside the rolling two-minute window", () => {
    const data = seed(now);
    data.events = [];
    data.alerts = [];
    for (let i = 0; i < 4; i++)
      verifyDemo(data, "bad", uid(1001), new Set(), now + i);
    expect(
      verifyDemo(data, "bad", uid(1001), new Set(), now + 120005).alert,
    ).toBeUndefined();
  });
});
describe("consistent aggregate analytics", () => {
  it("generates 200 deterministic students and varied activity", () => {
    expect(seed(now)).toEqual(seed(now));
    expect(seed(now).students).toHaveLength(200);
    expect(seed(now).events.length).toBeGreaterThan(3000);
  });
  it("reconciles attempts, chart totals, frequency cohort, and block totals", () => {
    const a = analytics(seed(now), {
      kk: "KK3",
      block: "",
      from: dayOffset(-29, now),
      to: dayOffset(0, now),
    });
    expect(a.days.reduce((n, d) => n + d.granted + d.denied, 0)).toBe(
      a.events.length,
    );
    expect(a.comparison.reduce((n, b) => n + b.granted, 0)).toBe(
      a.granted.length,
    );
    expect(a.frequency.reduce((n, f) => n + f.value, 0)).toBe(
      a.residents.length,
    );
    expect(a.weekly.reduce((n, w) => n + w.value, 0)).toBe(a.granted.length);
    expect(a.monthly.reduce((n, w) => n + w.value, 0)).toBe(a.granted.length);
  });
  it("isolates selected blocks and includes zero-activity residents", () => {
    const data = seed(now);
    data.events = [];
    const a = analytics(data, {
      kk: "KK3",
      block: uid(1001),
      from: dayOffset(-6, now),
      to: dayOffset(0, now),
    });
    expect(a.blocks.length).toBe(1);
    expect(a.averageEntryDays).toBe(0);
    expect(
      a.residentActivity.every(
        (row) => row.entryDays === 0 && row.entries === 0,
      ),
    ).toBe(true);
    expect(a.frequency[0].value).toBe(a.residents.length);
    expect(a.frequency.map((f) => f.label)).toEqual([
      "0 days",
      "1–5 days",
      "6–7 days",
    ]);
  });
  it("averages distinct MYT entry days across the full resident cohort, including zeros", () => {
    const data = seed(now);
    data.students = data.students
      .slice(0, 2)
      .map((s) => ({ ...s, block_id: uid(1001), status: "active" }));
    const base = {
      id: "one",
      student_id: data.students[0].id,
      block_id: uid(1001),
      granted: true,
      denial_reason: null,
      verification_method: "test",
    };
    data.events = [
      { ...base, timestamp: "2026-10-01T15:59:00Z" },
      { ...base, id: "two", timestamp: "2026-10-01T16:01:00Z" },
      { ...base, id: "repeat", timestamp: "2026-10-02T01:00:00Z" },
      {
        ...base,
        id: "denied",
        student_id: data.students[1].id,
        granted: false,
        timestamp: "2026-10-02T03:00:00Z",
      },
      {
        ...base,
        id: "wrong-block",
        student_id: data.students[1].id,
        block_id: uid(1002),
        timestamp: "2026-10-02T03:00:00Z",
      },
    ];
    const f = {
      kk: "KK3",
      block: uid(1001),
      from: "2026-10-01",
      to: "2026-10-02",
    };
    const a = analytics(data, f);
    expect(a.residentActivity.map((r) => [r.entryDays, r.entries])).toEqual([
      [2, 3],
      [0, 0],
    ]);
    expect(a.averageEntryDays).toBe(1);
    expect(
      analytics(data, { ...f, from: "2026-10-02" }).residentActivity[0]
        .entryDays,
    ).toBe(1);
    expect(analytics(data, { ...f, block: uid(1003) }).averageEntryDays).toBe(
      0,
    );
  });
});
