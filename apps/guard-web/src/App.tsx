import { useState } from "react";
import {
  Badge,
  Brand,
  ErrorNotice,
  ModeBanner,
  SessionButton,
  api,
  blockLabel,
  dayKey,
  dayOffset,
  timeLabel,
  useDutySchedule,
  useKK,
} from "@kk/shared";
import "@kk/shared/styles.css";
import { CalendarDays, ShieldAlert, RefreshCw } from "lucide-react";
export default function Guard() {
  const s = useKK();
  const [page, setPage] = useState("duties"),
    [message, setMessage] = useState("");
  const today = dayKey(s.data.server_time ?? Date.now());
  const ops = useDutySchedule(
    today,
    dayOffset(7, Date.parse(today + "T12:00:00+08:00")),
    true,
  );
  const active = s.data.alerts.filter((a) => a.status !== "resolved");
  return (
    <>
      <header className="student-header">
        <Brand sub="GUARD OPERATIONS" />
        <SessionButton />
      </header>
      <ModeBanner />
      <main className="guard-main">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">
              SCOPED SECURITY OPERATIONS · DEMO DATA
            </div>
            <h1>Guard workspace</h1>
            <p>
              Authorised blocks:{" "}
              {s.data.blocks
                .map((b) => blockLabel(s.data.blocks, b.id))
                .join(", ") || "No authorised blocks loaded"}
            </p>
          </div>
          <button
            className="button"
            onClick={() => {
              void s.refresh();
              void ops.reload();
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
        <nav className="guard-tabs">
          <button
            className={`button ${page === "duties" ? "primary" : ""}`}
            onClick={() => setPage("duties")}
          >
            <CalendarDays size={16} />
            My Duty Schedule
          </button>
          <button
            className={`button ${page === "alerts" ? "primary" : ""}`}
            onClick={() => setPage("alerts")}
          >
            <ShieldAlert size={16} />
            Security alerts ({active.length})
          </button>
        </nav>
        <ErrorNotice />
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {!s.connected && (
          <p className="notice warning">
            Local Demo Mode. Standalone fictional duties; management changes on
            another origin are not synchronised.
          </p>
        )}
        {page === "duties" && (
          <>
            <h2>My Duty Schedule</h2>
            <p>
              Published instructions for your authorised blocks. Read-only
              duties; contact management for changes.
            </p>
            {ops.stale && (
              <p className="notice danger" role="alert">
                Instructions may be outdated or unavailable. {ops.error} Confirm
                with management before acting.
              </p>
            )}
            <p className="fine">
              Last successful check:{" "}
              {ops.lastUpdated
                ? `${dayKey(ops.lastUpdated)} ${timeLabel(ops.lastUpdated)} MYT`
                : "Not available"}
              . Realtime updates with a 10-second refresh fallback. Cancelled or
              withdrawn duties disappear after refresh.
            </p>
            {ops.loading ? (
              <p className="empty-state">Loading published duties…</p>
            ) : (
              <>
                {[false, true].map((upcoming) => (
                  <section key={String(upcoming)}>
                    <h2>
                      {upcoming
                        ? "Upcoming duties · next 7 days"
                        : "Today's duties"}
                    </h2>
                    {ops.duties
                      .filter((d) =>
                        upcoming
                          ? dayKey(d.starts_at) > today
                          : dayKey(d.starts_at) <= today &&
                            dayKey(d.ends_at) >= today,
                      )
                      .map((d) => (
                        <article className="panel duty-card" key={d.id}>
                          <div className="panel-heading">
                            <h3>{blockLabel(s.data.blocks, d.block_id)}</h3>
                            <Badge tone={ops.stale ? "warning" : "success"}>
                              {ops.stale ? "Cached · verify" : "Published"}
                            </Badge>
                          </div>
                          <strong>
                            {dayKey(d.starts_at)} {timeLabel(d.starts_at)} —{" "}
                            {dayKey(d.ends_at)} {timeLabel(d.ends_at)} MYT
                          </strong>
                          <p>{d.instructions}</p>
                          <small>
                            {d.source_label} · Version {d.version} · Last
                            updated {dayKey(d.updated_at)}{" "}
                            {timeLabel(d.updated_at)} MYT
                          </small>
                        </article>
                      ))}
                    {!ops.duties.some((d) =>
                      upcoming
                        ? dayKey(d.starts_at) > today
                        : dayKey(d.starts_at) <= today &&
                          dayKey(d.ends_at) >= today,
                    ) && (
                      <p className="panel empty-state">
                        No published {upcoming ? "upcoming" : "today's"}{" "}
                        assignments in your authorised scope.
                      </p>
                    )}
                  </section>
                ))}
              </>
            )}
          </>
        )}
        {page === "alerts" && (
          <>
            <h2>Security monitoring</h2>
            <p className="notice">
              Five denied attempts within two minutes request human review; this
              is not proof of wrongdoing. Entry histories and student identities
              are not shown here.
            </p>
            {s.stale && (
              <p className="notice warning">
                Alert data may be stale. Refresh or contact management.
              </p>
            )}
            {!s.data.alerts.length && (
              <p className="panel empty-state">
                No security alerts in your authorised blocks.
              </p>
            )}
            {s.data.alerts.map((a) => (
              <article className="panel duty-card" key={a.id}>
                <div className="panel-heading">
                  <h3>{blockLabel(s.data.blocks, a.block_id)}</h3>
                  <Badge tone={a.status === "resolved" ? "success" : "danger"}>
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
                <p>{a.description}</p>
                <p>
                  {dayKey(a.timestamp)} {timeLabel(a.timestamp)} MYT
                </p>
                <label>
                  Review status
                  <select
                    aria-label={`Guard alert status ${a.id}`}
                    value={a.status}
                    disabled={!s.online}
                    onChange={async (e) => {
                      try {
                        if (s.connected) {
                          await api("guard_alert_status", {
                            id: a.id,
                            status: e.target.value,
                          });
                          await s.refresh();
                        } else
                          await s.updateAlert(
                            a.id,
                            e.target.value as typeof a.status,
                          );
                        setMessage("Alert status updated for human review.");
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    <option value="new">New</option>
                    <option value="under_review">Under Review</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
              </article>
            ))}
          </>
        )}
        <footer className="page-footer">
          KK Smart · 24-hour resident access · Emergency exit remains free ·
          Fictional demo records
        </footer>
      </main>
    </>
  );
}
