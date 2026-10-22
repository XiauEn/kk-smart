import { useState } from "react";
import {
  Badge,
  blockLabel,
  dayOffset,
  timeLabel,
  useDutySchedule,
  useKK,
  type Duty,
  type DutyDraft,
} from "@kk/shared";
const localInput = (iso?: string) =>
  iso ? new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 16) : "";
export default function DutyPlanning({
  initial,
  onClear,
}: {
  initial: DutyDraft | null;
  onClear: () => void;
}) {
  const s = useKK();
  const [showCancelled, setShowCancelled] = useState(false);
  const [date, setDate] = useState(dayOffset(0));
  const ops = useDutySchedule(date, date);
  const visibleDuties = ops.duties.filter(
    (d) => showCancelled || d.status !== "cancelled",
  );
  const [edit, setEdit] = useState<DutyDraft | null>(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [start, setStart] = useState(
      localInput(initial?.starts_at) || `${dayOffset(0)}T09:00`,
    ),
    [end, setEnd] = useState(
      localInput(initial?.ends_at) || `${dayOffset(0)}T10:00`,
    );
  function open(d?: Duty) {
    setEdit(
      d
        ? { ...d }
        : {
            block_id: s.data.blocks[0]?.id ?? "",
            instructions: "",
            source_label: "Management decision · Demo Data",
          },
    );
    setStart(localInput(d?.starts_at) || `${date}T09:00`);
    setEnd(localInput(d?.ends_at) || `${date}T10:00`);
    setMessage("");
  }
  async function save(status: Duty["status"]) {
    if (!edit) return;
    setBusy(true);
    setMessage("");
    try {
      await ops.save(
        {
          ...edit,
          starts_at: new Date(start + ":00+08:00").toISOString(),
          ends_at: new Date(end + ":00+08:00").toISOString(),
          status,
        },
        status === "published",
      );
      setEdit(null);
      onClear();
      setDate(start.slice(0, 10));
      setMessage(
        status === "published"
          ? "Assignment approved and published. Scoped guards receive the latest instructions."
          : "Assignment saved as a draft. Guards cannot see it.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        Only management can change duties. “Approve & publish” records your
        explicit approval. Insights never publish or change a duty
        automatically.
      </div>
      <div className="panel operational-form">
        <div className="panel-heading">
          <label>
            Duty date
            <input
              aria-label="Duty date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <button className="button primary" onClick={() => open()}>
            Create duty assignment
          </button>
          <button className="button" onClick={() => void ops.reload()}>
            Refresh duties
          </button>
        </div>
        <p className="fine">
          Block-based duties; no invented individual guard personnel. All times
          are MYT (UTC+8).
        </p>
        <label>
          Schedule history
          <select
            aria-label="Schedule status filter"
            value={showCancelled ? "all" : "active"}
            onChange={(e) => setShowCancelled(e.target.value === "all")}
          >
            <option value="active">Draft and published duties</option>
            <option value="all">All duties, including cancelled</option>
          </select>
        </label>
        {ops.lastUpdated && (
          <p className="fine">
            Last checked {timeLabel(ops.lastUpdated)} MYT · Realtime with
            10-second refresh fallback
          </p>
        )}
      </div>
      {ops.stale && (
        <p className="notice warning">
          Schedule unavailable or stale. {ops.error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {edit && (
        <section className="panel operational-form">
          <h2>
            {edit.id ? "Edit duty assignment" : "Review draft duty assignment"}
          </h2>
          <p>{edit.source_label}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save("draft");
            }}
          >
            <label>
              Residential block
              <select
                aria-label="Duty block"
                required
                value={edit.block_id}
                onChange={(e) => setEdit({ ...edit, block_id: e.target.value })}
              >
                {s.data.blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {blockLabel(s.data.blocks, b.id)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Start date and time (MYT)
                <input
                  aria-label="Duty starts"
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                End date and time (MYT)
                <input
                  aria-label="Duty ends"
                  type="datetime-local"
                  required
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <label>
              Operational instructions
              <textarea
                aria-label="Duty instructions"
                minLength={5}
                maxLength={1000}
                required
                rows={3}
                value={edit.instructions}
                onChange={(e) =>
                  setEdit({ ...edit, instructions: e.target.value })
                }
              />
            </label>
            <div className="action-row">
              <button className="button" disabled={busy}>
                Save draft
              </button>
              <button
                className="button primary"
                type="button"
                disabled={
                  busy ||
                  !start ||
                  !end ||
                  end <= start ||
                  edit.instructions.trim().length < 5
                }
                onClick={() => void save("published")}
              >
                Approve & publish
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEdit(null);
                  onClear();
                }}
              >
                Close editor
              </button>
            </div>
            <p className="fine">
              Saving a published duty as a draft withdraws it from guard view. A
              changed version requires fresh approval to publish.
            </p>
          </form>
        </section>
      )}
      {ops.loading ? (
        <p className="empty-state">Loading assignments…</p>
      ) : !visibleDuties.length ? (
        <p className="panel empty-state">
          No duties on this date. Create a draft or start from a security
          insight.
        </p>
      ) : (
        <section className="duty-list">
          {visibleDuties.map((d) => (
            <article key={d.id} className="panel duty-card">
              <div className="panel-heading">
                <h2>{blockLabel(s.data.blocks, d.block_id)}</h2>
                <Badge
                  tone={
                    d.status === "published"
                      ? "success"
                      : d.status === "cancelled"
                        ? "danger"
                        : "warning"
                  }
                >
                  {d.status}
                </Badge>
              </div>
              <strong>
                {localInput(d.starts_at).replace("T", " ")} —{" "}
                {localInput(d.ends_at).replace("T", " ")} MYT
              </strong>
              <p>{d.instructions}</p>
              <p className="fine">
                {d.source_label} · Version {d.version} · Updated{" "}
                {localInput(d.updated_at).replace("T", " ")} MYT
              </p>
              <div className="action-row">
                <button className="button" onClick={() => open(d)}>
                  Edit / review
                </button>
                {d.status !== "cancelled" && (
                  <button
                    className="text-button"
                    disabled={busy || ops.stale}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await ops.save({ ...d, status: "cancelled" });
                        setMessage(
                          "Assignment cancelled and withdrawn from guard view.",
                        );
                      } catch (e) {
                        setMessage((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancel assignment
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
