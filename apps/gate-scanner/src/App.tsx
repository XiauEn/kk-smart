import {
  Badge,
  Brand,
  ErrorNotice,
  ModeBanner,
  SessionButton,
  blockLabel,
  timeLabel,
  uid,
  useKK,
  type Decision,
} from "@kk/shared";
import "@kk/shared/styles.css";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  LockKeyhole,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GateAudio, type GateSound } from "./audio";
type GateState =
  | "CLOSED"
  | "VERIFYING"
  | "ACCESS GRANTED"
  | "OPENING"
  | "OPEN"
  | "CLOSING"
  | "ACCESS DENIED"
  | "SECURITY ALERT";
function GateScanner() {
  const s = useKK();
  const [block, setBlock] = useState(uid(1001)),
    [status, setStatus] = useState<GateState>("CLOSED"),
    [result, setResult] = useState<Decision | null>(null),
    [now, setNow] = useState(Date.now()),
    [camera, setCamera] = useState(false),
    [cameraError, setCameraError] = useState(""),
    [manual, setManual] = useState(""),
    [muted, setMuted] = useState(false),
    [soundReady, setSoundReady] = useState(false),
    [offline, setOffline] = useState(false),
    [message, setMessage] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    busy = useRef(false),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    last = useRef({ token: "", time: 0 }),
    audio = useRef<GateAudio | null>(null),
    mounted = useRef(true);
  const configuredBlock =
    s.connected && s.online ? (s.data.terminal_block_id ?? block) : block;
  const scanRef = useRef<(token: string) => void>(() => {});
  useEffect(() => {
    mounted.current = true;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(id);
      timers.current.forEach(clearTimeout);
      controls.current?.stop();
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  function enableSound() {
    audio.current ??= new GateAudio();
    void audio.current.unlock().then((ready) => {
      if (mounted.current) setSoundReady(ready);
    });
  }
  function sound(kind: GateSound) {
    audio.current?.play(kind);
  }
  function later(fn: () => void, ms: number) {
    timers.current.push(
      setTimeout(() => {
        if (mounted.current) fn();
      }, ms),
    );
  }
  async function perform(task: () => Promise<Decision>) {
    if (busy.current) return;
    enableSound();
    busy.current = true;
    timers.current.forEach(clearTimeout);
    setStatus("VERIFYING");
    setResult(null);
    setMessage("");
    try {
      const [r] = await Promise.all([
        task(),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      if (!mounted.current) return;
      setResult(r);
      if (r.alert) {
        setStatus("SECURITY ALERT");
        sound("alarm");
        later(() => {
          setStatus("CLOSED");
          busy.current = false;
        }, 7000);
      } else if (r.granted) {
        setStatus("ACCESS GRANTED");
        sound("success");
        later(() => setStatus("OPENING"), 400);
        later(() => setStatus("OPEN"), 1200);
        later(() => setStatus("CLOSING"), 3300);
        later(() => {
          setStatus("CLOSED");
          busy.current = false;
        }, 4200);
      } else {
        setStatus("ACCESS DENIED");
        sound("denied");
        later(() => {
          setStatus("CLOSED");
          busy.current = false;
        }, 3500);
      }
      if (s.connected && s.online) void s.refresh();
    } catch {
      setStatus("ACCESS DENIED");
      sound("denied");
      setMessage(
        "Verification unavailable. Entry remains closed. Retry or contact residential security.",
      );
      later(() => {
        setStatus("CLOSED");
        busy.current = false;
      }, 3500);
    }
  }
  async function scanToken(token: string) {
    const time = Date.now();
    if (last.current.token === token && time - last.current.time < 18000)
      return;
    last.current = { token, time };
    await perform(() => s.scan(token, configuredBlock));
  }
  scanRef.current = (token) => void scanToken(token);
  async function startCamera() {
    enableSound();
    setCameraError("");
    setCamera(true);
    try {
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromVideoDevice(
        undefined,
        video.current!,
        (result) => {
          if (result) scanRef.current(result.getText());
        },
      );
      if (!mounted.current) {
        scanner.stop();
        return;
      }
      controls.current = scanner;
    } catch {
      setCamera(false);
      setCameraError(
        "Camera unavailable. Allow camera access over HTTPS (or localhost), or use the demo controls below.",
      );
    }
  }
  function stopCamera() {
    controls.current?.stop();
    controls.current = null;
    setCamera(false);
  }
  async function fiveFailures() {
    if (busy.current) return;
    enableSound();
    busy.current = true;
    setResult(null);
    setStatus("VERIFYING");
    setMessage("Running five distinct denied attempts…");
    try {
      let r: Decision | undefined;
      let alertCreated = false;
      for (let i = 0; i < 5; i++) {
        r = await s.scenario(4, configuredBlock);
        if (r.alert && !alertCreated) sound("alarm");
        else if (!alertCreated) sound("denied");
        alertCreated ||= Boolean(r.alert);
        await new Promise((resolve) => setTimeout(resolve, 220));
      }
      if (r) {
        setResult(r);
        setStatus(alertCreated ? "SECURITY ALERT" : "ACCESS DENIED");
        setMessage(
          alertCreated
            ? "Five denied attempts submitted. Security alert created for human review."
            : "Five attempts denied. An alert was recently created for this gate; duplicate alerts are suppressed for two minutes.",
        );
      }
      if (s.connected && s.online) void s.refresh();
    } catch {
      setStatus("ACCESS DENIED");
      sound("denied");
      setMessage(
        "Demo requests failed. Check connection and server demo-control setting.",
      );
    } finally {
      later(() => {
        setStatus("CLOSED");
        busy.current = false;
      }, 7000);
    }
  }
  const recent = s.data.events
    .filter((e) => e.block_id === configuredBlock)
    .slice(0, 5);
  const open = status === "OPENING" || status === "OPEN";
  const denied = status === "ACCESS DENIED" || status === "SECURITY ALERT";
  return (
    <>
      <ModeBanner />
      <header className="gate-header">
        <Brand sub="ACCESS CONTROL TERMINAL" />
        <div className="header-actions">
          <Badge tone={s.online ? "success" : "warning"}>
            {s.online ? <Wifi size={12} /> : <WifiOff size={12} />}{" "}
            {s.online ? "Terminal online" : "Offline simulation"}
          </Badge>
          <button
            className="button secondary"
            aria-label={muted || !soundReady ? "Enable sound" : "Mute sound"}
            onClick={() => {
              if (muted || !soundReady) {
                setMuted(false);
                audio.current?.setMuted(false);
                enableSound();
              } else {
                setMuted(true);
                audio.current?.setMuted(true);
              }
            }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            {muted || !soundReady ? "Enable sound" : "Sound on"}
          </button>
          <SessionButton />
        </div>
      </header>
      <main className="gate-layout">
        <div className="gate-heading">
          <div>
            <div className="eyebrow">RESIDENTIAL SECURITY / ENTRY TERMINAL</div>
            <h1>{blockLabel(s.data.blocks, configuredBlock)}</h1>
            <p>Verified access. Around the clock.</p>
          </div>
          <div className="clock">
            <Clock3 size={17} />
            <strong className="mono">{timeLabel(now)}</strong>
            <small>MYT · 24-hour access</small>
          </div>
        </div>
        <div
          className={`gate-main panel ${denied ? "denied" : open ? "granted" : ""}`}
        >
          <section className="scan-area">
            <div className="section-label">
              <ScanLine size={16} />
              QR VERIFICATION <span className="live-dot" />
            </div>
            <div className={`camera-frame ${camera ? "camera-active" : ""}`}>
              <video ref={video} muted playsInline />
              <div className="scan-corners">
                <i />
                <i />
                <i />
                <i />
              </div>
              {!camera && (
                <div className="camera-placeholder">
                  <div className="camera-icon">
                    <ScanLine size={52} strokeWidth={1} />
                  </div>
                  <h2>Present your QR code</h2>
                  <p>
                    Open your KK Smart student identity
                    <br />
                    and hold the code inside the frame.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => void startCamera()}
                  >
                    <Camera size={16} />
                    Enable camera
                  </button>
                </div>
              )}
              {camera && <div className="scan-beam" />}
              <div className="camera-caption">
                {camera
                  ? "Camera active · scanning for a credential"
                  : "Camera access required for live scanning"}
              </div>
            </div>
            {camera && (
              <button className="text-button" onClick={stopCamera}>
                Stop camera
              </button>
            )}
            {cameraError && <p className="error-text">{cameraError}</p>}
            <div className="scan-help">
              <ShieldCheck size={16} />
              <span>
                {s.connected && s.online
                  ? "Verified by trusted backend · terminal-bound permission"
                  : "Fictional QR verification · simulation only"}
              </span>
            </div>
          </section>
          <section
            className={`gate-stage ${denied ? "denied" : open ? "granted" : ""}`}
            aria-live="polite"
          >
            <div className="section-label">
              GATE STATUS
              <Badge tone={denied ? "danger" : open ? "success" : "neutral"}>
                {status}
              </Badge>
            </div>
            <div className="gate-visual">
              <div className="gate-ground" />
              <div className="gate-post left">
                <i />
              </div>
              <div className="gate-post right">
                <i />
              </div>
              <div className={`gate-leaf left ${open ? "open" : ""}`}>
                <div />
              </div>
              <div className={`gate-leaf right ${open ? "open" : ""}`}>
                <div />
              </div>
              <div
                className={`gate-status-icon ${denied ? "danger" : open ? "success" : ""}`}
              >
                {denied ? (
                  <ShieldAlert size={28} />
                ) : open ? (
                  <Check size={28} />
                ) : (
                  <LockKeyhole size={26} />
                )}
              </div>
              <div className="gate-path">
                <ArrowRight size={24} />
                <ArrowRight size={24} />
              </div>
            </div>
            <div className="gate-result">
              {status === "CLOSED" ? (
                <>
                  <h2>Ready for your arrival</h2>
                  <p>Scan to verify residential permission.</p>
                </>
              ) : status === "VERIFYING" ? (
                <>
                  <h2>
                    Verifying credential<span className="loading-dots">…</span>
                  </h2>
                  <p>Checking identity and block permission</p>
                </>
              ) : (
                <>
                  <h2>{denied ? "ACCESS DENIED" : "ACCESS GRANTED"}</h2>
                  <p>{result?.name ?? "Credential verification"}</p>
                  <strong>{result?.reason}</strong>
                </>
              )}
              {status === "SECURITY ALERT" && (
                <div className="notice danger">
                  <ShieldAlert size={17} />
                  Security alert · human review required
                </div>
              )}
              {message && <p className="fine">{message}</p>}
            </div>
            <div className="gate-safety">
              <ShieldCheck size={14} />
              Emergency exit remains freely accessible.
            </div>
          </section>
        </div>
        <div className="gate-bottom">
          <section className="panel demo-controls">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">PRESENTATION TOOLKIT</div>
                <h2>Demo controls</h2>
              </div>
              <Badge tone="warning">Demo Data</Badge>
            </div>
            <p className="fine">
              {s.connected
                ? "Fictional scenarios require server-enabled demo controls."
                : "Standalone simulation. Other apps do not receive these events."}
            </p>
            <div className="demo-button-grid">
              {[
                "Valid resident",
                "Wrong-block student",
                "Non-resident",
                "Expired resident",
                "Invalid QR",
              ].map((name, i) => (
                <button
                  key={name}
                  className="button scenario"
                  disabled={status !== "CLOSED"}
                  onClick={() =>
                    void perform(() => s.scenario(i, configuredBlock))
                  }
                >
                  <span
                    className={`scenario-dot ${i === 0 ? "success" : "danger"}`}
                  />
                  <span>Scan {name.toLowerCase()}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
              <button
                className="button scenario alarm-button"
                disabled={status !== "CLOSED"}
                onClick={() => void fiveFailures()}
              >
                <ShieldAlert size={16} />
                Trigger five failed attempts
                <ArrowRight size={14} />
              </button>
            </div>
            <details>
              <summary>
                Test sounds <Volume2 size={14} />
              </summary>
              <p className="fine">
                Preview only · no access events or security alerts are created.
              </p>
              <div className="demo-button-grid">
                {(["success", "denied", "alarm"] as const).map((kind) => (
                  <button
                    key={kind}
                    className="button"
                    disabled={status !== "CLOSED"}
                    onClick={() => {
                      setMuted(false);
                      audio.current ??= new GateAudio();
                      audio.current.setMuted(false);
                      void audio.current.unlock().then((ready) => {
                        if (!mounted.current) return;
                        setSoundReady(ready);
                        if (ready) sound(kind);
                      });
                    }}
                  >
                    {kind === "success"
                      ? "Success ding"
                      : kind === "denied"
                        ? "Denied beep"
                        : "Alarm siren"}
                  </button>
                ))}
              </div>
            </details>
            <details>
              <summary>
                Manual QR input & terminal settings
                <ChevronDown size={14} />
              </summary>
              <form
                className="manual-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const token = manual.trim();
                  void perform(() => s.scan(token, configuredBlock));
                  setManual("");
                }}
              >
                <input
                  aria-label="QR credential"
                  placeholder="Paste a QR credential"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  required
                />
                <button
                  className="button primary"
                  disabled={status !== "CLOSED"}
                >
                  Verify
                </button>
              </form>
              {(!s.connected || !s.online) && (
                <label>
                  Fictional gate block
                  <select
                    value={block}
                    disabled={status !== "CLOSED"}
                    onChange={(e) => setBlock(e.target.value)}
                  >
                    {s.data.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {blockLabel(s.data.blocks, b.id)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </details>
            <div className="offline-controls">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={offline}
                  disabled={status !== "CLOSED"}
                  onChange={(e) => {
                    setOffline(e.target.checked);
                    s.setOffline(e.target.checked);
                  }}
                />
                Simulate connection loss
              </label>
              <span className="fine">
                {s.pending.length} pending synthetic events
              </span>
              {s.pending.length > 0 && (
                <button
                  className="text-button"
                  onClick={() =>
                    void s.sync().catch((e) => setMessage(e.message))
                  }
                >
                  Sync demo queue
                </button>
              )}
            </div>
            {!s.online && (
              <div className="notice warning">
                OFFLINE MODE · preloaded fictional permissions only. This
                simulates verification, not a secure offline controller. Queued
                events never become verified entries.
              </div>
            )}
            {!s.connected && (
              <button
                className="text-button"
                disabled={status !== "CLOSED"}
                onClick={() => {
                  s.reset();
                  setResult(null);
                  setMessage("Demo restored.");
                }}
              >
                <RefreshCw size={13} />
                Reset this gate demo
              </button>
            )}
          </section>
          <section className="panel recent-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">THIS TERMINAL</div>
                <h2>Recent access results</h2>
              </div>
              <span className="live-dot" />
            </div>
            {recent.length === 0 ? (
              <div className="empty-state">
                Access results will appear here.
              </div>
            ) : (
              recent.map((e) => (
                <div key={e.id} className="recent-event">
                  <div
                    className={`event-icon ${e.granted ? "success" : "danger"}`}
                  >
                    {e.granted ? (
                      <Check size={17} />
                    ) : (
                      <ShieldAlert size={17} />
                    )}
                  </div>
                  <div>
                    <strong>
                      {e.granted ? "Access granted" : "Access denied"}
                    </strong>
                    <small>
                      {e.denial_reason ?? "Active block permission"}
                    </small>
                  </div>
                  <time className="mono">{timeLabel(e.timestamp)}</time>
                </div>
              ))
            )}
            <div className="fine recent-note">
              Personal histories are not displayed at the terminal.
            </div>
          </section>
        </div>
        <ErrorNotice />
      </main>
      <footer className="page-footer">
        KK Smart · Trust — One Identity, Safer Campus{" "}
        <span>TEF 2026 / CONCEPT PROTOTYPE</span>
      </footer>
    </>
  );
}
export default GateScanner;
