import {
  ArrowUpRight,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import React, { useState } from "react";
import { useKK } from "./client";
export function Brand({ sub = "RESIDENTIAL INTELLIGENCE" }: { sub?: string }) {
  return (
    <div className="brand">
      <div className="brand-icon">
        <ShieldCheck size={25} />
      </div>
      <div>
        <strong>
          KK<span> Smart</span>
          <sup>®</sup>
        </strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function ModeBanner() {
  const s = useKK();
  return (
    <div className={`mode-banner ${!s.online ? "offline" : ""}`}>
      <span>
        {s.online ? <Wifi size={13} /> : <WifiOff size={13} />}{" "}
        {s.connected
          ? s.stale
            ? "Connected · data may be stale"
            : "Supabase connected"
          : "Local Demo Mode · Demo Data"}
        {!s.online ? " · OFFLINE MODE" : ""}
      </span>
      <span>
        {s.connected
          ? "Fictional records only"
          : "Standalone app · changes stay in this browser origin"}
      </span>
    </div>
  );
}
export function AuthBoundary({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const s = useKK();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!s.connected) return <>{children}</>;
  if (s.loading)
    return (
      <div className="auth-shell">
        <LoaderCircle className="spin" /> Loading secure session…
      </div>
    );
  if (s.session) return <>{children}</>;
  return (
    <div className="auth-shell">
      <div className="panel auth-card">
        <Brand />
        <div className="eyebrow">CONNECTED DEMONSTRATION</div>
        <h1>{title}</h1>
        <p>
          Sign in with the fictional account provisioned for this application.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await s.signIn(email, password);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowUpRight size={16} />
          </button>
        </form>
        {(error || s.error) && (
          <p role="alert" className="error-text">
            {error || s.error}
          </p>
        )}
        <p className="fine">
          Management and gate accounts require their assigned server-side role.
        </p>
      </div>
    </div>
  );
}
export function SessionButton() {
  const s = useKK();
  return s.connected ? (
    <button className="button small ghost" onClick={s.signOut}>
      <LogOut size={14} />
      Sign out
    </button>
  ) : null;
}
export function ErrorNotice() {
  const { error } = useKK();
  return error ? (
    <div className="notice danger" role="alert">
      {error}
    </div>
  ) : null;
}
export function Metric({
  label,
  value,
  icon,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="metric panel">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail ?? "Within selected filters"}</small>
    </div>
  );
}
