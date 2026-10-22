import { useEffect, useState } from "react";
import {
  api,
  dayOffset,
  insights,
  useKK,
  type DutyDraft,
  type Intelligence,
} from "@kk/shared";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export default function SecurityIntelligence({
  onDraft,
}: {
  onDraft: (draft: DutyDraft) => void;
}) {
  const s = useKK();
  const [to, setTo] = useState(dayOffset(-1)),
    [period, setPeriod] = useState(""),
    [demo, setDemo] = useState(false),
    [data, setData] = useState<Intelligence | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [block, setBlock] = useState("");
  const selected =
    s.data.holiday_periods?.find((p) => p.id === period) ??
    s.data.holiday_periods?.[0];
  const from = dayOffset(-6, Date.parse(to + "T12:00:00+08:00"));
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    setData(null);
    if (!s.online) {
      setError("Reconnect to retrieve trusted aggregate insights.");
      setBusy(false);
      return;
    }
    if (!s.connected) {
      const b = s.data.blocks[0];
      setData({
        from,
        to,
        source: "Synthetic planning scenario · Local Demo Mode",
        server_time: new Date().toISOString(),
        privacy:
          "Fictional aggregate demonstration; no individual identifiers.",
        baseline_note: "Four fictional matched weekday/hour windows.",
        hourly: [
          {
            block_id: b.id,
            label: `${b.kk_name} · Block ${b.block_name}`,
            hour: 3,
            entries: 30,
            baseline: 10,
            baseline_periods: 4,
          },
        ],
        blocks: [
          {
            block_id: b.id,
            label: `${b.kk_name} · Block ${b.block_name}`,
            entries: 120,
            denied: 10,
          },
        ],
        holiday: [],
      });
      setBusy(false);
      return;
    }
    api("intelligence", { from, to, period_id: selected?.id ?? null, demo })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [from, to, selected?.id, demo, s.online, s.connected]);
  const selectedBlock = block || data?.hourly[0]?.block_id || "";
  const hourly =
    data?.hourly
      .filter((h) => h.block_id === selectedBlock)
      .map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` })) ??
    [];
  return (
    <>
      <div className="notice">
        Planning recommendations are separate from urgent alerts. Late-night
        arrivals are normal. No risk scores, housing eligibility decisions or
        physical occupancy estimates.
      </div>
      <div className="panel operational-form">
        <div className="form-row">
          <label>
            Seven-day period ending
            <input
              aria-label="Intelligence period ending"
              type="date"
              required
              max={dayOffset(0)}
              value={to}
              onChange={(e) => {
                if (e.target.value) setTo(e.target.value);
              }}
            />
          </label>
          <label>
            Holiday declaration period
            <select
              aria-label="Intelligence holiday"
              value={selected?.id ?? ""}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {s.data.holiday_periods?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.start_date} — {p.end_date}
                </option>
              ))}
            </select>
          </label>
          <label>
            Activity source
            <select
              aria-label="Intelligence source"
              value={demo ? "scenario" : "stored"}
              onChange={(e) => setDemo(e.target.value === "scenario")}
            >
              <option value="stored">Stored fictional access records</option>
              <option value="scenario">
                Synthetic peak scenario (no log insertion)
              </option>
            </select>
          </label>
        </div>
        <p className="fine">
          {from} — {to} (MYT). Compare the same weekday/hour windows in the
          previous four weeks. The default excludes today's incomplete activity.
        </p>
      </div>
      {busy && (
        <p className="empty-state">Calculating privacy-protected aggregates…</p>
      )}
      {error && (
        <p className="notice danger" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="notice">
            {data.source}.{" "}
            {demo
              ? "Only the hourly peak illustration is synthetic; block and holiday tables still use stored fictional records."
              : "All stored records in this competition project are fictional."}
          </p>
          <p className="fine">
            {data.privacy} {data.baseline_note}
          </p>
          <section className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h2>Hourly Entry Activity</h2>
                <p>
                  Successful entries by hour, aggregated across the selected
                  week. Missing bars mean suppressed data, not zero.
                </p>
              </div>
              <select
                aria-label="Hourly activity block"
                value={selectedBlock}
                onChange={(e) => setBlock(e.target.value)}
              >
                {s.data.blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.kk_name} · Block {b.block_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly}>
                  <CartesianGrid vertical={false} strokeDasharray="3 5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="entries"
                    name="Approx. successful entries"
                    fill="#158d7d"
                  />
                  <Bar
                    dataKey="baseline"
                    name="Approx. matched-window average"
                    fill="#99c6d1"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel table-panel">
            <div className="panel-heading">
              <h2>Block Activity Overview</h2>
              <span className="fine">
                Rounded aggregate counts · {from} — {to}
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Successful entries</th>
                    <th>Denied attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.blocks.map((b) => (
                    <tr key={b.block_id}>
                      <td>{b.label}</td>
                      <td>
                        {b.entries === null ? "Suppressed" : `≈ ${b.entries}`}
                      </td>
                      <td>
                        {b.denied === null ? "Suppressed" : `≈ ${b.denied}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel table-panel">
            <div className="panel-heading">
              <div>
                <h2>Holiday Security Planning</h2>
                <p>
                  {selected?.name ?? "No holiday selected"} · Declarations are
                  plans, not physical occupancy.
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Registered residents</th>
                    <th>Declared stays</th>
                    <th>Approx. declared stay share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holiday.map((h) => (
                    <tr key={h.block_id}>
                      <td>{h.label}</td>
                      <td>
                        {h.residents === null
                          ? "Suppressed"
                          : `≈ ${h.residents}`}
                      </td>
                      <td>
                        {h.stays === null ? "Suppressed" : `≈ ${h.stays}`}
                      </td>
                      <td>
                        {h.percentage === null
                          ? "Insufficient group size"
                          : `≈ ${h.percentage}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!selected && (
              <p className="empty-state">
                Publish a holiday period and collect declarations first.
              </p>
            )}
          </section>
          <section className="insight-list">
            <h2>Security Insights</h2>
            <p>
              Rules suggest reviews. Management decides whether to deploy a
              duty.
            </p>
            {insights(data).length === 0 && (
              <p className="panel empty-state">
                No supported recommendation for this period. Sparse or
                suppressed data does not support a peak conclusion. Use the
                explicitly labelled synthetic peak scenario to rehearse the
                workflow.
              </p>
            )}
            {insights(data).map((i, n) => (
              <article
                className="panel insight-card"
                key={i.type + i.block_id + n}
              >
                <div className="eyebrow">{i.type} · PLANNING REVIEW</div>
                <h3>{i.title}</h3>
                <p>
                  <strong>Observation:</strong> {i.observation}
                </p>
                <p>
                  <strong>Supporting data:</strong> {i.evidence}
                </p>
                <p>
                  <strong>Period:</strong>{" "}
                  {i.type === "holiday"
                    ? `${selected?.start_date} — ${selected?.end_date}`
                    : `${from} — ${to}, MYT`}
                </p>
                <p>
                  <strong>Suggested action:</strong> {i.action}
                </p>
                <small>{i.source}</small>
                <button
                  className="button"
                  onClick={() =>
                    onDraft({
                      block_id: i.block_id,
                      starts_at: `${i.type === "holiday" && selected && selected.start_date >= dayOffset(0) ? selected.start_date : dayOffset(0)}T${String(i.hour).padStart(2, "0")}:00:00+08:00`,
                      ends_at: `${i.type === "holiday" && selected && selected.start_date >= dayOffset(0) ? selected.start_date : dayOffset(0)}T${String(i.hour + 1).padStart(2, "0")}:00:00+08:00`,
                      instructions: i.action,
                      source_label: i.source,
                    })
                  }
                >
                  Create draft duty assignment
                </button>
              </article>
            ))}
          </section>
          <blockquote className="principle-strip">
            We are not tracking when students come home to question their
            freedom. We are understanding when they come home so that we can
            better protect it.
          </blockquote>
        </>
      )}
    </>
  );
}
