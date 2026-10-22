export type Student = {
  id: string;
  student_id: string;
  name: string;
  year_of_study: number;
  faculty: string;
  block_id: string | null;
  room_number: string | null;
  status: "active" | "expired" | "none";
  end_date: string | null;
};
export type Block = {
  id: string;
  kk_name: string;
  block_name: string;
  capacity: number;
};
export type AccessEvent = {
  id: string;
  student_id: string | null;
  block_id: string;
  timestamp: string;
  granted: boolean;
  denial_reason: string | null;
  verification_method: string;
  synced_at?: string | null;
};
export type Alert = {
  id: string;
  block_id: string;
  timestamp: string;
  alert_type: string;
  status: "new" | "under_review" | "resolved";
  description: string;
};
export type Holiday = {
  id: string;
  student_id: string;
  holiday_name: string;
  start_date: string;
  end_date: string;
  staying: boolean;
  period_id?: string;
  response?: "entire" | "dates" | "away" | "unsure";
};
export type HolidayPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  declaration_deadline: string;
};
export type EntryHistory = { events: AccessEvent[]; total: number };
export type Snapshot = {
  students: Student[];
  blocks: Block[];
  events: AccessEvent[];
  alerts: Alert[];
  holidays: Holiday[];
  holiday_periods?: HolidayPeriod[];
  terminal_block_id?: string;
  server_time?: string;
};
export type Credential = {
  token: string;
  issued_at: string;
  expires_at: string;
  server_time: string;
};
export type Decision = {
  granted: boolean;
  reason: string;
  name?: string;
  block?: string;
  event: AccessEvent;
  alert?: Alert | null;
};
export const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayKey = (d: string | number | Date) =>
  dayFormatter.format(new Date(d));
export const dayOffset = (days: number, now = Date.now()) =>
  dayKey(now + days * 86400000);
export const timeLabel = (s: string | number | Date) =>
  new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(s));
export const blockLabel = (blocks: Block[], id: string | null) => {
  const b = blocks.find((x) => x.id === id);
  return b ? `${b.kk_name} · Block ${b.block_name}` : "No allocation";
};
export function demoPeriods(now = Date.now()): HolidayPeriod[] {
  return [
    {
      id: uid(700001),
      name: "Semester break · Demo",
      start_date: dayOffset(0, now),
      end_date: dayOffset(14, now),
      declaration_deadline: dayOffset(14, now),
    },
    {
      id: uid(700002),
      name: "Year-end break · Demo",
      start_date: dayOffset(40, now),
      end_date: dayOffset(54, now),
      declaration_deadline: dayOffset(35, now),
    },
  ];
}
export function validateDeclaration(h: Holiday, p: HolidayPeriod) {
  if (!["entire", "dates", "away", "unsure"].includes(h.response ?? ""))
    throw Error("Choose your stay plan.");
  if (
    h.start_date < p.start_date ||
    h.end_date > p.end_date ||
    h.end_date < h.start_date
  )
    throw Error("Stay dates must be within the selected holiday.");
  if (
    h.response === "entire" &&
    (h.start_date !== p.start_date || h.end_date !== p.end_date)
  )
    throw Error("Entire-period stays must cover the holiday dates.");
  if (h.staying !== (h.response === "entire" || h.response === "dates"))
    throw Error("Invalid stay plan.");
}
export function seed(now = Date.now()): Snapshot {
  const blocks: Block[] = Array.from({ length: 6 }, (_, i) => ({
    id: uid(1001 + i),
    kk_name: i < 3 ? "KK3" : "KK8",
    block_name: ["A", "B", "C"][i % 3],
    capacity: 40,
  }));
  const first = ["Alex Tan", "Sarah Lim", "Daniel Wong", "Emily Lee"];
  const given = [
    "Aiman",
    "Mei",
    "Farah",
    "Arun",
    "Hana",
    "Ravi",
    "Nadia",
    "Jun",
    "Irfan",
    "Sofia",
    "Kai",
    "Aisha",
  ];
  const surnames = [
    "Rahman",
    "Chen",
    "Kumar",
    "Aziz",
    "Tan",
    "Lim",
    "Wong",
    "Lee",
    "Hassan",
    "Devi",
    "Ng",
    "Omar",
    "Yap",
    "Ismail",
    "Low",
    "Teoh",
    "Chong",
  ];
  const students: Student[] = Array.from({ length: 200 }, (_, i) => ({
    id: uid(i + 1),
    student_id: `DEMO${String(i + 1).padStart(3, "0")}`,
    name:
      first[i] ??
      `${given[i % 12]} ${surnames[Math.floor(i / 12) % 17]} ${String(i + 1).padStart(3, "0")}`,
    year_of_study: i < 4 ? [1, 2, 1, 3][i] : (i % 4) + 1,
    faculty: [
      "Engineering",
      "Science",
      "Arts & Social Sciences",
      "Business & Economics",
    ][i % 4],
    block_id:
      i === 2 ? null : blocks[i === 0 || i === 3 ? 0 : i === 1 ? 1 : i % 6].id,
    room_number:
      i === 2
        ? null
        : i === 0
          ? "A-201"
          : i === 1
            ? "B-105"
            : `${blocks[i === 3 ? 0 : i % 6].block_name}-${101 + i}`,
    status:
      i === 2
        ? "none"
        : i === 3 || (i % 19 === 0 && i > 3)
          ? "expired"
          : "active",
    end_date:
      i === 3 || (i % 19 === 0 && i > 3)
        ? dayOffset(-1, now)
        : dayOffset(180, now),
  }));
  const events: AccessEvent[] = [];
  for (let d = 59; d >= 0; d--)
    for (let i = 0; i < 200; i++) {
      const s = students[i];
      if (!s.block_id || (i * 13 + d * 7) % 31 > (i % 5) * 5 + 2) continue;
      const granted = s.status === "active" && (i + d) % 17 !== 0;
      const timestamp = new Date(
        `${dayOffset(-d, now)}T${String(8 + ((i * 7 + d) % 15)).padStart(2, "0")}:${String((i * 11 + d) % 60).padStart(2, "0")}:00+08:00`,
      ).toISOString();
      if (Date.parse(timestamp) > now) continue;
      events.push({
        id: uid(10000 + d * 200 + i),
        student_id: s.id,
        block_id: s.block_id,
        timestamp,
        granted,
        denial_reason: granted
          ? null
          : s.status === "expired"
            ? "Residential permission expired"
            : "No active block permission",
        verification_method: "demo_seed",
      });
    }
  const alerts: Alert[] = [
    {
      id: uid(900001),
      block_id: blocks[1].id,
      timestamp: new Date(now - 7200000).toISOString(),
      alert_type: "five_failures",
      status: "new",
      description:
        "Five denied attempts within two minutes. Human review required.",
    },
    {
      id: uid(900002),
      block_id: blocks[0].id,
      timestamp: new Date(now - 86400000).toISOString(),
      alert_type: "five_failures",
      status: "resolved",
      description: "Demo event reviewed by residential security.",
    },
  ];
  const holidays = students
    .filter(
      (s, i) =>
        s.status === "active" && (i * 7 + Math.floor(i / 6)) % 10 < 2 + (i % 6),
    )
    .map((s, i) => ({
      id: uid(800000 + i),
      student_id: s.id,
      holiday_name: "Semester break",
      start_date: dayOffset(0, now),
      end_date: dayOffset(14, now),
      staying: true,
      period_id: uid(700001),
      response: "entire" as const,
    }));
  return {
    students,
    blocks,
    events: events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    alerts,
    holidays,
    holiday_periods: demoPeriods(now),
  };
}
type DemoPayload = {
  student: string;
  expires: number;
  issued: number;
  nonce: string;
};
export function demoCredential(student: string, now = Date.now()): Credential {
  const p: DemoPayload = {
    student,
    issued: now,
    expires: now + 15000,
    nonce: crypto.randomUUID(),
  };
  return {
    token: `KKDEMO.${btoa(JSON.stringify(p))}`,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + 15000).toISOString(),
    server_time: new Date(now).toISOString(),
  };
}
export function verifyDemo(
  state: Snapshot,
  token: string,
  blockId: string,
  used: Set<string>,
  now = Date.now(),
): Decision {
  let s: Student | undefined,
    reason = "Invalid QR credential";
  try {
    if (!token.startsWith("KKDEMO.")) throw Error();
    const p = JSON.parse(atob(token.slice(7))) as DemoPayload;
    if (
      !p.nonce ||
      !Number.isFinite(p.expires) ||
      !Number.isFinite(p.issued) ||
      p.expires - p.issued !== 15000 ||
      p.issued > now
    )
      throw Error();
    s = state.students.find((s) => s.id === p.student);
    if (p.expires <= now) reason = "QR credential expired";
    else if (used.has(p.nonce)) reason = "QR credential already used";
    else {
      used.add(p.nonce);
      reason = !s
        ? "Unknown demo identity"
        : s.status === "expired" || (!!s.end_date && s.end_date < dayKey(now))
          ? "Residential permission expired"
          : s.status !== "active" || s.block_id !== blockId
            ? "No active block permission"
            : "";
    }
  } catch {
    /* Malformed public input is denied without exposing internals. */
  }
  const event: AccessEvent = {
    id: crypto.randomUUID(),
    student_id: s?.id ?? null,
    block_id: blockId,
    timestamp: new Date(now).toISOString(),
    granted: reason === "",
    denial_reason: reason || null,
    verification_method: "local_simulation",
  };
  state.events.unshift(event);
  const failures = state.events.filter(
    (e) =>
      e.block_id === blockId &&
      !e.granted &&
      now - Date.parse(e.timestamp) >= 0 &&
      now - Date.parse(e.timestamp) <= 120000,
  ).length;
  let alert: Alert | undefined;
  if (
    !event.granted &&
    failures >= 5 &&
    !state.alerts.some(
      (a) => a.block_id === blockId && now - Date.parse(a.timestamp) < 120000,
    )
  ) {
    alert = {
      id: crypto.randomUUID(),
      block_id: blockId,
      timestamp: event.timestamp,
      status: "new",
      alert_type: "five_failures",
      description:
        "Five denied attempts in two minutes. Human review required.",
    };
    state.alerts.unshift(alert);
  }
  return {
    granted: event.granted,
    reason: reason || "Active residential permission",
    name: s?.name,
    block: blockLabel(state.blocks, blockId),
    event,
    alert,
  };
}
export type Filters = { kk: string; block: string; from: string; to: string };
export function analytics(data: Snapshot, f: Filters) {
  const blocks = data.blocks.filter(
    (b) => (!f.kk || b.kk_name === f.kk) && (!f.block || b.id === f.block),
  );
  const ids = new Set(blocks.map((b) => b.id));
  const residents = data.students.filter(
    (s) => s.status === "active" && s.block_id && ids.has(s.block_id),
  );
  const events = data.events.filter(
    (e) =>
      ids.has(e.block_id) &&
      dayKey(e.timestamp) >= f.from &&
      dayKey(e.timestamp) <= f.to,
  );
  const granted = events.filter((e) => e.granted);
  const unique = new Set(granted.map((e) => e.student_id).filter(Boolean)).size;
  const days: {
    date: string;
    label: string;
    granted: number;
    denied: number;
    unique: number;
  }[] = [];
  for (
    let t = Date.parse(`${f.from}T00:00:00+08:00`);
    t <= Date.parse(`${f.to}T00:00:00+08:00`);
    t += 86400000
  ) {
    const date = dayKey(t);
    const es = events.filter((e) => dayKey(e.timestamp) === date);
    days.push({
      date,
      label: date.slice(5),
      granted: es.filter((e) => e.granted).length,
      denied: es.filter((e) => !e.granted).length,
      unique: new Set(
        es
          .filter((e) => e.granted)
          .map((e) => e.student_id)
          .filter(Boolean),
      ).size,
    });
  }
  const daySets = new Map<string, Set<string>>();
  granted.forEach((e) => {
    if (!e.student_id) return;
    const set = daySets.get(e.student_id) ?? new Set();
    set.add(dayKey(e.timestamp));
    daySets.set(e.student_id, set);
  });
  const ranges = [
    [0, 0],
    [1, 5],
    [6, 15],
    [16, 25],
    [26, 30],
    [31, Math.max(31, days.length)],
  ];
  const entryCounts = new Map<string, number>();
  granted.forEach((e) => {
    if (e.student_id)
      entryCounts.set(e.student_id, (entryCounts.get(e.student_id) ?? 0) + 1);
  });
  const residentActivity = residents.map((student) => ({
    student,
    entryDays: daySets.get(student.id)?.size ?? 0,
    entries: entryCounts.get(student.id) ?? 0,
  }));
  const averageEntryDays = residents.length
    ? residentActivity.reduce((sum, row) => sum + row.entryDays, 0) /
      residents.length
    : 0;
  const frequency = ranges
    .filter(([low]) => low <= days.length)
    .map(([low, high]) => ({
      label:
        low === 0 ? "0 days" : `${low}–${Math.min(high, days.length)} days`,
      value: residents.filter((s) => {
        const n = daySets.get(s.id)?.size ?? 0;
        return n >= low && n <= high;
      }).length,
    }));
  const holidays = data.holidays.filter(
    (h) =>
      h.staying &&
      h.start_date <= f.to &&
      h.end_date >= f.from &&
      residents.some((s) => s.id === h.student_id),
  );
  const comparison = blocks.map((b) => {
    const rs = residents.filter((s) => s.block_id === b.id);
    const stays = new Set(
      holidays
        .filter((h) => rs.some((s) => s.id === h.student_id))
        .map((h) => h.student_id),
    ).size;
    return {
      id: b.id,
      label: `${b.kk_name} ${b.block_name}`,
      residents: rs.length,
      granted: granted.filter((e) => e.block_id === b.id).length,
      denied: events.filter((e) => e.block_id === b.id && !e.granted).length,
      entrants: new Set(
        granted
          .filter((e) => e.block_id === b.id)
          .map((e) => e.student_id)
          .filter(Boolean),
      ).size,
      stays,
      percentage: rs.length ? Math.round((stays / rs.length) * 100) : 0,
    };
  });
  const alerts = data.alerts.filter(
    (a) =>
      ids.has(a.block_id) &&
      dayKey(a.timestamp) >= f.from &&
      dayKey(a.timestamp) <= f.to,
  );
  const aggregate = (period: "week" | "month") => {
    const groups = new Map<string, number>();
    days.forEach((d) => {
      const dt = new Date(`${d.date}T00:00:00Z`);
      if (period === "week")
        dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
      const key =
        period === "month" ? d.date.slice(0, 7) : dt.toISOString().slice(0, 10);
      groups.set(key, (groups.get(key) ?? 0) + d.granted);
    });
    return [...groups].map(([label, value]) => ({ label, value }));
  };
  return {
    blocks,
    residents,
    events,
    granted,
    unique,
    days,
    frequency,
    residentActivity,
    averageEntryDays,
    comparison,
    alerts,
    holidayCount: new Set(holidays.map((h) => h.student_id)).size,
    distinctDays: days.filter((d) => d.granted > 0).length,
    weekly: aggregate("week"),
    monthly: aggregate("month"),
  };
}
