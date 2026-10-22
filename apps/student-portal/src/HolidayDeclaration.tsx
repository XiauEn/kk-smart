import { useEffect, useState } from "react";
import { dayKey, useKK, type Holiday, type Student } from "@kk/shared";
import { CalendarDays } from "lucide-react";

export default function HolidayDeclaration({ student }: { student: Student }) {
  const s = useKK();
  const periods = s.data.holiday_periods ?? [];
  const [selected, setSelected] = useState("");
  const period = periods.find((p) => p.id === selected) ?? periods[0];
  const saved = s.data.holidays.find(
    (h) =>
      h.student_id === student.id &&
      (h.period_id === period?.id || h.holiday_name === period?.name),
  );
  const [response, setResponse] =
    useState<NonNullable<Holiday["response"]>>("unsure");
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setResponse(saved?.response ?? (saved?.staying ? "entire" : "unsure"));
    setFrom(saved?.start_date ?? period?.start_date ?? "");
    setTo(saved?.end_date ?? period?.end_date ?? "");
  }, [
    student.id,
    period?.id,
    saved?.id,
    saved?.response,
    saved?.start_date,
    saved?.end_date,
  ]);
  useEffect(() => setMessage(""), [student.id, period?.id]);
  const closed =
    !!period &&
    period.declaration_deadline < dayKey(s.data.server_time ?? Date.now());
  return (
    <section className="panel holiday-form">
      <div className="panel-heading">
        <div>
          <h2>
            <CalendarDays size={20} /> Holiday stay declaration
          </h2>
          <p>Tell your college when to plan security and emergency support.</p>
        </div>
      </div>
      {!period ? (
        <p>No holiday periods have been published yet.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              await s.declare({
                id: saved?.id ?? crypto.randomUUID(),
                student_id: student.id,
                period_id: period.id,
                holiday_name: period.name,
                response,
                staying: response === "entire" || response === "dates",
                start_date: response === "dates" ? from : period.start_date,
                end_date: response === "dates" ? to : period.end_date,
              });
              setMessage(
                "Declaration saved. You can update your plan before the deadline.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Holiday
            <select
              aria-label="Holiday"
              value={period.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="holiday-dates">
            <strong>
              {period.start_date} — {period.end_date}
            </strong>
            <small>
              Declaration deadline: {period.declaration_deadline} · MYT · Demo
              Data
            </small>
          </div>
          {saved && (
            <p className="notice">
              Saved plan:{" "}
              {saved.staying
                ? `${saved.start_date} — ${saved.end_date}`
                : saved.response === "unsure"
                  ? "Not sure yet"
                  : "Not staying"}
            </p>
          )}
          <label>
            Your plan
            <select
              aria-label="Your holiday plan"
              value={response}
              onChange={(e) => setResponse(e.target.value as typeof response)}
            >
              <option value="unsure">Not sure yet</option>
              <option value="entire">Staying for the entire holiday</option>
              <option value="dates">Staying for selected dates</option>
              <option value="away">Not staying / withdraw stay</option>
            </select>
          </label>
          {response === "dates" && (
            <div className="form-row">
              <label>
                Stay from
                <input
                  aria-label="Stay from"
                  required
                  type="date"
                  min={period.start_date}
                  max={period.end_date}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Stay until
                <input
                  aria-label="Stay until"
                  required
                  type="date"
                  min={from || period.start_date}
                  max={period.end_date}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
          )}
          <button
            className="button primary"
            disabled={busy || closed || !s.online}
          >
            {busy
              ? "Saving…"
              : closed
                ? "Declaration closed"
                : "Save declaration"}
          </button>
          <p className="fine">
            These are your declared plans, not a record of who is inside. Choose
            “Not staying” to withdraw a previously declared stay.
          </p>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
