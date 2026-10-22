import { useState } from "react";
import {
  Badge,
  Metric,
  analytics,
  dayOffset,
  useKK,
  type Filters,
  type HolidayPeriod,
} from "@kk/shared";
import { CalendarDays, Users, ClipboardList } from "lucide-react";
export default function HolidayPlanning({ filters }: { filters: Filters }) {
  const s = useKK();
  const [selected, setSelected] = useState(""),
    [showForm, setShowForm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    start_date: dayOffset(7),
    end_date: dayOffset(21),
    declaration_deadline: dayOffset(6),
  });
  const periods = s.data.holiday_periods ?? [];
  const p = periods.find((p) => p.id === selected) ?? periods[0];
  const a = analytics(s.data, {
    ...filters,
    from: p?.start_date ?? filters.from,
    to: p?.end_date ?? filters.to,
  });
  const responses = s.data.holidays.filter(
    (h) =>
      (h.period_id === p?.id || h.holiday_name === p?.name) &&
      a.residents.some((st) => st.id === h.student_id),
  );
  const staying = new Set(
    responses.filter((h) => h.staying).map((h) => h.student_id),
  );
  const answered = new Set(responses.map((h) => h.student_id));
  const rows = a.blocks.map((b) => {
    const residents = a.residents.filter((st) => st.block_id === b.id);
    return {
      b,
      residents,
      stays: residents.filter((st) => staying.has(st.id)).length,
      unsure: residents.filter((st) =>
        responses.some(
          (h) => h.student_id === st.id && h.response === "unsure",
        ),
      ).length,
      missing: residents.filter((st) => !answered.has(st.id)).length,
    };
  });
  const [planningDate, setPlanningDate] = useState("");
  const date =
    planningDate >= (p?.start_date ?? "") && planningDate <= (p?.end_date ?? "")
      ? planningDate
      : p?.start_date;
  return (
    <>
      <div className="notice">
        Plan patrols and emergency support from declared plans. These figures do
        not show who is physically inside. College and block filters apply;
        holiday dates replace the activity date filter below.
      </div>
      <section className="panel holiday-form">
        <div className="panel-heading">
          <div>
            <h2>Choose a holiday</h2>
            <p>
              Published periods are shared with the Student Portal. All periods
              are fictional demo data.
            </p>
          </div>
          <button className="button" onClick={() => setShowForm((x) => !x)}>
            {showForm ? "Cancel" : "Publish holiday"}
          </button>
        </div>
        <label>
          Holiday period
          <select
            aria-label="Planning holiday"
            value={p?.id ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setPlanningDate("");
            }}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.start_date} — {p.end_date}
              </option>
            ))}
          </select>
        </label>
        {p && (
          <p>
            Holiday:{" "}
            <strong>
              {p.start_date} — {p.end_date}
            </strong>{" "}
            · Declaration deadline: <strong>{p.declaration_deadline}</strong>{" "}
            (MYT)
          </p>
        )}
        {showForm && (
          <form
            className="publish-holiday"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const period: HolidayPeriod = {
                  id: crypto.randomUUID(),
                  ...draft,
                };
                await s.saveHolidayPeriod(period);
                setShowForm(false);
                setMessage("Holiday published to the Student Portal.");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Holiday name
              <input
                aria-label="Holiday name"
                required
                minLength={3}
                maxLength={100}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Semester Break 2026 · Demo"
              />
            </label>
            <div className="form-row">
              <label>
                Holiday starts
                <input
                  aria-label="Holiday starts"
                  type="date"
                  required
                  value={draft.start_date}
                  onChange={(e) =>
                    setDraft({ ...draft, start_date: e.target.value })
                  }
                />
              </label>
              <label>
                Holiday ends
                <input
                  aria-label="Holiday ends"
                  type="date"
                  required
                  min={draft.start_date}
                  value={draft.end_date}
                  onChange={(e) =>
                    setDraft({ ...draft, end_date: e.target.value })
                  }
                />
              </label>
              <label>
                Declaration deadline
                <input
                  aria-label="Declaration deadline"
                  type="date"
                  required
                  max={draft.end_date}
                  value={draft.declaration_deadline}
                  onChange={(e) =>
                    setDraft({ ...draft, declaration_deadline: e.target.value })
                  }
                />
              </label>
            </div>
            <button className="button primary" disabled={busy || !s.online}>
              {busy ? "Publishing…" : "Publish holiday period"}
            </button>
          </form>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </section>
      <div className="metric-grid three">
        <Metric
          label="Registered residents"
          value={a.residents.length}
          icon={<Users size={18} />}
          detail="Active permissions in selected blocks"
        />
        <Metric
          label="Declared stays"
          value={staying.size}
          icon={<CalendarDays size={18} />}
          detail="At least one declared day in this holiday"
        />
        <Metric
          label="No response yet"
          value={a.residents.length - answered.size}
          icon={<ClipboardList size={18} />}
          detail="No declaration for this holiday"
        />
      </div>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Holiday support by block</h2>
            <p>
              “Unsure” counts as a response, but does not count as a declared
              stay.
            </p>
          </div>
          <Badge>Declared plans</Badge>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Residents</th>
                <th>Declared stays</th>
                <th>% declaring stay</th>
                <th>Unsure</th>
                <th>No response</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, residents, stays, unsure, missing }) => (
                <tr key={b.id}>
                  <td>
                    {b.kk_name} · Block {b.block_name}
                  </td>
                  <td>{residents.length}</td>
                  <td>{stays}</td>
                  <td>
                    {residents.length
                      ? Math.round((stays / residents.length) * 100)
                      : 0}
                    %
                  </td>
                  <td>{unsure}</td>
                  <td>{missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {p && (
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <h2>Plan support for a specific day</h2>
              <p>
                Only declarations whose stay dates include this day are counted.
              </p>
            </div>
            <input
              aria-label="Holiday planning day"
              type="date"
              min={p.start_date}
              max={p.end_date}
              value={date}
              onChange={(e) => setPlanningDate(e.target.value)}
            />
          </div>
          <div className="inline-stats">
            {rows.map(({ b, residents }) => (
              <div key={b.id}>
                <span>
                  {b.kk_name} · Block {b.block_name}
                </span>
                <strong>
                  {
                    new Set(
                      responses
                        .filter(
                          (h) =>
                            h.staying &&
                            h.start_date <= date! &&
                            h.end_date >= date! &&
                            residents.some((st) => st.id === h.student_id),
                        )
                        .map((h) => h.student_id),
                    ).size
                  }{" "}
                  declared stays
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
