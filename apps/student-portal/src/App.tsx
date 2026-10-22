import {
  Badge,
  Brand,
  ErrorNotice,
  ModeBanner,
  SessionButton,
  blockLabel,
  dayOffset,
  useKK,
  type Credential,
} from "@kk/shared";
import "@kk/shared/styles.css";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  GraduationCap,
  LockKeyhole,
  MapPin,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
function StudentPortal() {
  const s = useKK();
  const [selected, setSelected] = useState(""),
    [credential, setCredential] = useState<Credential | null>(null),
    [remaining, setRemaining] = useState(0),
    [qrError, setQrError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const student =
    s.data.students.find((x) => x.id === selected) ?? s.data.students[0];
  const deadline = useRef(0),
    inFlight = useRef(false),
    generation = useRef(0);
  const refreshRef = useRef<() => void>(() => {});
  const onlineRef = useRef(s.online);
  const issueRef = useRef(s.issue);
  onlineRef.current = s.online;
  issueRef.current = s.issue;
  useEffect(() => {
    const version = ++generation.current;
    setCredential(null);
    setRemaining(0);
    deadline.current = 0;
    inFlight.current = false;
    async function rotate() {
      if (!student || inFlight.current) return;
      if (!onlineRef.current) {
        setQrError("Offline · new QR credentials unavailable");
        return;
      }
      inFlight.current = true;
      setBusy(true);
      setQrError("");
      const started = performance.now();
      try {
        const c = await issueRef.current(student.id);
        if (version !== generation.current) return;
        const lifetime = Date.parse(c.expires_at) - Date.parse(c.server_time);
        deadline.current =
          performance.now() +
          Math.max(0, lifetime - (performance.now() - started));
        setCredential(c);
        setRemaining(
          Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000)),
        );
      } catch (e) {
        if (version === generation.current) {
          setCredential(null);
          setQrError((e as Error).message);
        }
      } finally {
        if (version === generation.current) {
          inFlight.current = false;
          setBusy(false);
        }
      }
    }
    refreshRef.current = () => void rotate();
    void rotate();
    const tick = () => {
      const left = Math.max(0, deadline.current - performance.now());
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0 && deadline.current > 0) {
        deadline.current = 0;
        setCredential(null);
        void rotate();
      }
    };
    const timer = setInterval(tick, 100);
    const visible = () => {
      if (document.visibilityState === "visible") {
        tick();
        if (deadline.current === 0) void rotate();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [student?.id]);
  // Losing connectivity never extends or replaces the already issued QR.
  // Resume issuance on reconnection only if its original deadline has passed.
  useEffect(() => {
    if (s.online && deadline.current <= performance.now()) refreshRef.current();
  }, [s.online]);
  const holiday = s.data.holidays.find(
    (h) => h.student_id === student?.id && h.holiday_name === "Semester break",
  );
  if (!student)
    return (
      <div className="auth-shell">
        <div className="panel">
          <Brand />
          <h2>
            {s.loading ? "Loading your identity…" : "No student profile linked"}
          </h2>
          <p>
            {s.loading
              ? "Fetching your verified profile securely."
              : "Ask the project administrator to run account provisioning, then reload."}
          </p>
          <ErrorNotice />
          <SessionButton />
        </div>
      </div>
    );
  const valid = student.status === "active";
  return (
    <>
      <ModeBanner />
      <header className="student-header">
        <Brand sub="YOUR CAMPUS. YOUR IDENTITY." />
        <SessionButton />
      </header>
      <main className="student-layout">
        <section className="student-intro">
          <div className="eyebrow">ONE ID, ONE CAMPUS</div>
          <h1>
            Your home.
            <br />
            One secure identity<span>.</span>
          </h1>
          <p>
            Your residential access, always with you. Verified entry at any
            hour, with privacy built in.
          </p>
          <div className="intro-points">
            <span>
              <ShieldCheck size={18} /> Verified residential access
            </span>
            <span>
              <LockKeyhole size={18} /> Short-lived, single-use credentials
            </span>
            <span>
              <Check size={18} /> 24-hour access. No curfew.
            </span>
          </div>
          <div className="demo-profile panel">
            <div className="eyebrow">
              {s.connected ? "YOUR VERIFIED PROFILE" : "DEMO PROFILE SWITCHER"}
            </div>
            {!s.connected ? (
              <>
                <label htmlFor="profile">Explore a fictional identity</label>
                <select
                  id="profile"
                  value={student.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {s.data.students.slice(0, 4).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.student_id}
                    </option>
                  ))}
                </select>
                <p className="fine">
                  Each profile demonstrates a different residential permission.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    s.reset();
                    setNotice("Demo data restored.");
                  }}
                >
                  <RefreshCw size={13} /> Reset this app
                </button>
              </>
            ) : (
              <p>
                {student.name} · {student.student_id}
              </p>
            )}
          </div>
          <div className="trust-foot">
            <ShieldCheck size={18} />
            <span>
              Built for trust, designed for students.
              <small>TEF 2026 · University of Malaya concept prototype</small>
            </span>
          </div>
        </section>
        <section className="student-card-column">
          <div className="id-card">
            <div className="id-card-top">
              <div>
                <span className="eyebrow light">UNIVERSITY OF MALAYA</span>
                <h2>Residential identity</h2>
              </div>
              <ShieldCheck size={30} />
            </div>
            <div className="identity-row">
              <div className="avatar">
                {student.name
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <h2>{student.name}</h2>
                <span className="mono">{student.student_id}</span>
              </div>
              <Badge
                tone={
                  valid
                    ? "success"
                    : student.status === "expired"
                      ? "danger"
                      : "warning"
                }
              >
                {valid
                  ? "Active"
                  : student.status === "expired"
                    ? "Expired"
                    : "No permission"}
              </Badge>
            </div>
            <div className="identity-details">
              <div>
                <span>
                  <GraduationCap size={14} />
                  Faculty
                </span>
                <strong>
                  {student.faculty} · Year {student.year_of_study}
                </strong>
              </div>
              <div>
                <span>
                  <MapPin size={14} />
                  Residential allocation
                </span>
                <strong>
                  {blockLabel(s.data.blocks, student.block_id)}
                  {student.room_number ? ` · ${student.room_number}` : ""}
                </strong>
              </div>
            </div>
            <div className="qr-section">
              <div className="qr-heading">
                <span>YOUR ENTRY CREDENTIAL</span>
                <Badge
                  tone={credential && remaining > 0 ? "success" : "warning"}
                >
                  {credential && remaining > 0
                    ? "Ready to scan"
                    : busy
                      ? "Refreshing"
                      : "Unavailable"}
                </Badge>
              </div>
              <div className={`qr-frame ${!credential ? "empty" : ""}`}>
                {credential && remaining > 0 ? (
                  <QRCodeSVG
                    value={credential.token}
                    size={224}
                    level="M"
                    marginSize={4}
                    title="Short-lived residential QR credential"
                  />
                ) : (
                  <div className="qr-placeholder">
                    {s.online ? (
                      <RefreshCw size={34} className={busy ? "spin" : ""} />
                    ) : (
                      <WifiOff size={34} />
                    )}
                    <strong>
                      {busy
                        ? "Refreshing credential…"
                        : s.online
                          ? "Credential unavailable"
                          : "You are offline"}
                    </strong>
                    <span>
                      {qrError || "A fresh credential will appear shortly."}
                    </span>
                  </div>
                )}
              </div>
              <div className="countdown-row">
                <div
                  className="countdown"
                  aria-label={`${remaining} seconds remaining`}
                >
                  <svg viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      style={{
                        strokeDasharray: 113.1,
                        strokeDashoffset: 113.1 * (1 - remaining / 15),
                      }}
                    />
                  </svg>
                  <strong>{remaining}</strong>
                </div>
                <div>
                  <strong>Refreshes every 15 seconds</strong>
                  <small>
                    {s.connected
                      ? "Server issued · consumed once at entry"
                      : "Simulation credential · local clock only"}
                  </small>
                </div>
                <button
                  aria-label="Retry credential"
                  title="Retry credential"
                  className="icon-button"
                  disabled={busy || !s.online}
                  onClick={() => refreshRef.current()}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              {qrError && !busy && (
                <p className="error-text" role="alert">
                  {qrError}
                </p>
              )}
              <p className="fine centered">
                {s.connected
                  ? "Present this code at your authorised block. Live code sharing remains possible; keep it private."
                  : "Demo Data · unsigned QR simulation. Connected mode adds trusted issuance and replay prevention."}
              </p>
            </div>
            <div className="id-card-bottom">
              <ShieldCheck size={15} /> Your identity stays yours. Your access
              stays open.
            </div>
          </div>
          <div className="panel holiday-card">
            <CalendarDays size={23} />
            <div>
              <h3>Staying over the semester break?</h3>
              <p>Help your college plan security and emergency support.</p>
              <div className="fine">
                {dayOffset(0)} — {dayOffset(14)} · Demo holiday
              </div>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await s.declare({
                      id: crypto.randomUUID(),
                      student_id: student.id,
                      holiday_name: "Semester break",
                      start_date: dayOffset(0),
                      end_date: dayOffset(14),
                      staying: !holiday?.staying,
                    });
                    setNotice(
                      holiday?.staying
                        ? "Declaration withdrawn."
                        : "Holiday stay declared.",
                    );
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                {holiday?.staying
                  ? "Withdraw stay declaration"
                  : "Declare a holiday stay"}
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <ErrorNotice />
        </section>
      </main>
      <footer className="page-footer">
        KK Smart · Trust — One Identity, Safer Campus{" "}
        <span>DEMO DATA ONLY</span>
      </footer>
    </>
  );
}
export default StudentPortal;
