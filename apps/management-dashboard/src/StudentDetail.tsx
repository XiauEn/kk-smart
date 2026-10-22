import { Pagination } from "@kk/shared";
import { useEffect, useState } from "react";
import {
  Badge,
  blockLabel,
  dayKey,
  timeLabel,
  useKK,
  type EntryHistory,
  type Student,
} from "@kk/shared";
import { ArrowLeft, RefreshCw } from "lucide-react";
export default function StudentDetail({
  student,
  onBack,
  onEdit,
}: {
  student: Student;
  onBack: () => void;
  onEdit: () => void;
}) {
  const s = useKK();
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [history, setHistory] = useState<EntryHistory | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = s.entryHistory;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setHistory(null);
    load(student.id, from, to, offset)
      .then((h) => {
        if (active) setHistory(h);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [student.id, from, to, offset, revision, s.online]);
  const declarations = s.data.holidays.filter(
    (h) => h.student_id === student.id,
  );
  return (
    <section className="student-detail">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to residential records
      </button>
      <div className="panel detail-profile">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">STUDENT DETAILS · DEMO DATA</div>
            <h1>{student.name}</h1>
            <p>
              {student.student_id} · {student.faculty} · Year{" "}
              {student.year_of_study}
            </p>
          </div>
          <button className="button" onClick={onEdit}>
            Edit permission
          </button>
        </div>
        <div className="inline-stats">
          <div>
            <span>Residential allocation</span>
            <strong>{blockLabel(s.data.blocks, student.block_id)}</strong>
          </div>
          <div>
            <span>Room</span>
            <strong>{student.room_number ?? "—"}</strong>
          </div>
          <div>
            <span>Permission</span>
            <Badge tone={student.status === "active" ? "success" : "danger"}>
              {student.status}
            </Badge>
          </div>
          <div>
            <span>Permission ends</span>
            <strong>{student.end_date ?? "—"}</strong>
          </div>
        </div>
      </div>
      <div className="notice">
        Restricted management view. Individual history requests are audited in
        connected mode. Entry records do not establish occupancy, time inside,
        or nights stayed.
      </div>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Recorded entry history</h2>
            <p>
              Successful entries and denied entry attempts · all available dates
              by default · MYT (UTC+8)
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh entry history"
            onClick={() => setRevision((x) => x + 1)}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="history-filters">
          <label>
            From
            <input
              aria-label="History from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            Until
            <input
              aria-label="History until"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <button
            className="text-button"
            onClick={() => {
              setFrom("");
              setTo("");
              setOffset(0);
            }}
          >
            All dates
          </button>
        </div>
        {error && (
          <p className="notice danger" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="empty-state">Loading entry history…</p>
        ) : (
          history && (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Entry outcome</th>
                      <th>Date & time (MYT)</th>
                      <th>Gate / block</th>
                      <th>Verification note</th>
                      <th>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Badge tone={e.granted ? "success" : "danger"}>
                            {e.granted ? "Entry granted" : "Entry denied"}
                          </Badge>
                        </td>
                        <td>
                          {dayKey(e.timestamp)} {timeLabel(e.timestamp)}
                        </td>
                        <td>{blockLabel(s.data.blocks, e.block_id)}</td>
                        <td>
                          {e.denial_reason ?? "Active residential permission"}
                        </td>
                        <td>{e.verification_method.replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!history.total && (
                <p className="empty-state">
                  No recorded entry attempts for these dates.
                </p>
              )}
              <Pagination
                total={history.total}
                page={Math.floor(offset / 50)}
                pageSize={50}
                onPageChange={(page) => setOffset(page * 50)}
                unit="attempts"
              />
            </>
          )
        )}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Holiday declarations</h2>
        </div>
        {!declarations.length ? (
          <p className="empty-state">No holiday declarations submitted.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Holiday</th>
                  <th>Plan</th>
                  <th>Declared stay dates</th>
                </tr>
              </thead>
              <tbody>
                {declarations.map((h) => (
                  <tr key={h.id}>
                    <td>{h.holiday_name}</td>
                    <td>
                      {h.response === "unsure"
                        ? "Not sure yet"
                        : h.staying
                          ? "Staying"
                          : "Not staying"}
                    </td>
                    <td>
                      {h.staying ? `${h.start_date} — ${h.end_date}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
