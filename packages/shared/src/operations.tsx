import { useCallback, useEffect, useRef, useState } from "react";
import { api, supabase, useKK } from "./client";
import { dayOffset, uid } from "./model";
export type Duty = {
  id: string;
  block_id: string;
  starts_at: string;
  ends_at: string;
  instructions: string;
  status: "draft" | "published" | "cancelled";
  source_label: string;
  updated_at: string;
  version: number;
  approved_at?: string | null;
};
export type DutyDraft = Partial<Duty> &
  Pick<Duty, "block_id" | "instructions" | "source_label">;
export type Intelligence = {
  from: string;
  to: string;
  server_time: string;
  source: string;
  privacy: string;
  baseline_note: string;
  hourly: {
    block_id: string;
    label: string;
    hour: number;
    entries: number | null;
    baseline: number | null;
    baseline_periods: number;
  }[];
  blocks: {
    block_id: string;
    label: string;
    entries: number | null;
    denied: number | null;
  }[];
  holiday: {
    block_id: string;
    label: string;
    residents: number | null;
    stays: number | null;
    percentage: number | null;
  }[];
};
export type Insight = {
  type: string;
  block_id: string;
  title: string;
  observation: string;
  evidence: string;
  action: string;
  hour: number;
  source: string;
};
export function insights(data: Intelligence): Insight[] {
  const result: Insight[] = [];
  for (const h of data.hourly)
    if (
      h.entries !== null &&
      h.baseline !== null &&
      h.baseline > 0 &&
      h.baseline_periods >= 3 &&
      h.entries >= Math.max(10, h.baseline * 1.5)
    )
      result.push({
        type: "peak",
        block_id: h.block_id,
        title: "Peak activity · review entrance coverage",
        observation: `${h.label}: approximately ${h.entries} successful entries during ${String(h.hour).padStart(2, "0")}:00–${String(h.hour + 1).padStart(2, "0")}:00 across the selected week.`,
        evidence: `Comparable weekly-window average: approximately ${h.baseline}; ${h.baseline_periods} populated prior-week windows.`,
        action:
          "Review entrance staffing and monitoring coverage during this hour. Returning late is normal and is not suspicious.",
        hour: h.hour,
        source: data.source,
      });
  for (const b of data.blocks)
    if (b.denied !== null && b.denied >= 5)
      result.push({
        type: "denied",
        block_id: b.block_id,
        title: "Denied-attempt concentration · review exceptions",
        observation: `${b.label}: approximately ${b.denied} denied verification attempts in the selected week.`,
        evidence:
          "Rounded aggregate count; expired QR codes, wrong-block permission or scanning errors may contribute. This is a planning review, not an urgent alert.",
        action:
          "Review access exceptions and entrance support. Check existing security alerts separately; do not infer criminal intent.",
        hour: 9,
        source: "Stored verification events · Demo Data",
      });
  for (const h of data.holiday)
    if (
      h.percentage !== null &&
      h.percentage <= 30 &&
      h.residents !== null &&
      h.stays !== null
    )
      result.push({
        type: "holiday",
        block_id: h.block_id,
        title: "Lower declared stay share · review holiday support",
        observation: `${h.label}: approximately ${h.percentage}% of registered residents declared a holiday stay.`,
        evidence: `Approximately ${h.stays} declared stays among approximately ${h.residents} residents. Shares are rounded; nonresponse is not an absence declaration.`,
        action:
          "Review patrol coverage, emergency contacts and response readiness during the selected holiday. Declarations are plans, not physical occupancy.",
        hour: 18,
        source: "Submitted holiday declarations · Demo Data",
      });
  return result.slice(0, 12);
}
export function sampleDuty(): Duty {
  return {
    id: uid(990001),
    block_id: uid(1001),
    starts_at: `${dayOffset(0)}T00:00:00+08:00`,
    ends_at: `${dayOffset(0)}T23:59:00+08:00`,
    instructions:
      "Demo Data: review entrance support and emergency exit readiness. Respect 24-hour resident access.",
    status: "published",
    source_label: "Local demonstration only",
    updated_at: new Date().toISOString(),
    version: 1,
  };
}
export function useDutySchedule(from: string, to: string, guard = false) {
  const s = useKK();
  const generation = useRef(0);
  const lastSuccess = useRef(0);
  const [duties, setDuties] = useState<Duty[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [lastUpdated, setLastUpdated] = useState("");
  const reload = useCallback(async () => {
    const request = ++generation.current;
    if (!s.online) {
      setError(
        "Offline: cached instructions may be outdated. Confirm duties with the residential office.",
      );
      setLoading(false);
      return;
    }
    try {
      const result = s.connected
        ? await api("duties", { from, to })
        : {
            duties: JSON.parse(
              localStorage.getItem(
                `kk-duty-${guard ? "guard" : "management"}`,
              ) ?? "null",
            ) ?? [sampleDuty()],
            server_time: new Date().toISOString(),
          };
      if (request !== generation.current) return;
      setDuties(
        result.duties.filter(
          (d: Duty) =>
            Date.parse(d.starts_at) < Date.parse(to + "T23:59:59+08:00") &&
            Date.parse(d.ends_at) > Date.parse(from + "T00:00:00+08:00") &&
            (!guard || d.status === "published"),
        ),
      );
      setLastUpdated(result.server_time);
      lastSuccess.current = performance.now();
      setError("");
    } catch (e) {
      if (request === generation.current) setError((e as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [from, to, s.online, s.connected, s.session?.user.id, guard]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDuties([]);
    setLastUpdated("");
    const run = () => {
      if (alive) void reload();
    };
    run();
    const timer = setInterval(run, 10000);
    window.addEventListener("focus", run);
    const channel = supabase
      ?.channel("duties-" + (guard ? "guard" : "management"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "security_duties" },
        run,
      )
      .subscribe();
    return () => {
      alive = false;
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("focus", run);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [reload]);
  async function save(duty: DutyDraft, approve = false) {
    if (!s.online) throw Error("Reconnect before changing assignments.");
    if (s.connected) await api("save_duty", { duty, approve });
    else {
      const next = {
        ...duty,
        id: duty.id ?? crypto.randomUUID(),
        updated_at: new Date().toISOString(),
        version: (duty.version ?? 0) + 1,
      } as Duty;
      localStorage.setItem(
        "kk-duty-management",
        JSON.stringify([next, ...duties.filter((d) => d.id !== next.id)]),
      );
    }
    await reload();
  }
  return {
    duties,
    loading,
    error,
    lastUpdated,
    reload,
    save,
    stale:
      !!error ||
      !s.online ||
      !lastUpdated ||
      performance.now() - lastSuccess.current > 30000,
  };
}
