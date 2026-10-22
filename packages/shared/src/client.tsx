import { createClient, type Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  demoCredential,
  seed,
  verifyDemo,
  type AccessEvent,
  type Alert,
  type Credential,
  type Decision,
  type Holiday,
  type Snapshot,
  type Student,
} from "./model";
const connected = import.meta.env.VITE_MODE === "connected";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = connected && url && key ? createClient(url, key) : null;
const empty: Snapshot = {
  students: [],
  blocks: [],
  events: [],
  alerts: [],
  holidays: [],
};
type Role = "student" | "terminal" | "management";
type Store = {
  data: Snapshot;
  connected: boolean;
  online: boolean;
  stale: boolean;
  error: string;
  loading: boolean;
  session: Session | null;
  pending: AccessEvent[];
  signIn: (e: string, p: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  issue: (id: string) => Promise<Credential>;
  scan: (token: string, block: string) => Promise<Decision>;
  scenario: (index: number, block: string) => Promise<Decision>;
  updateStudent: (s: Student) => Promise<void>;
  updateAlert: (id: string, status: Alert["status"]) => Promise<void>;
  declare: (h: Holiday) => Promise<void>;
  setOffline: (v: boolean) => void;
  sync: () => Promise<void>;
  reset: () => void;
};
const Context = createContext<Store | null>(null);
export const useKK = () => {
  const s = useContext(Context);
  if (!s) throw Error("Missing provider");
  return s;
};
export async function api(
  action: string,
  payload: Record<string, unknown> = {},
) {
  if (!supabase)
    throw Error(
      "Supabase configuration is missing. Check app environment variables.",
    );
  const { data, error } = await supabase.functions.invoke("kk-api", {
    body: { action, ...payload },
  });
  if (error)
    throw Error(
      "Server request failed. Check your connection, account role, and function deployment.",
    );
  if (data.error) throw Error(data.error);
  return data;
}
export function KKProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const storageKey = `kk-smart-v1-${role}-${connected ? "connected" : "local"}`;
  const load = (): Snapshot => {
    if (connected) return empty;
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "null") ?? seed();
    } catch {
      return seed();
    }
  };
  const [data, setData] = useState<Snapshot>(load),
    state = useRef(data);
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(connected),
    [error, setError] = useState("");
  const currentActor = useRef<string | null>(null);
  const [network, setNetwork] = useState(navigator.onLine),
    [offline, setOffline] = useState(false),
    [stale, setStale] = useState(connected);
  const pendingKey = `${storageKey}-pending`;
  const [pending, setPending] = useState<AccessEvent[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(pendingKey) ?? "[]");
    } catch {
      return [];
    }
  });
  const used = useRef(new Set<string>()),
    online = network && !offline;
  const offlineSimulation = useRef<Snapshot | null>(null);
  function save(next: Snapshot) {
    state.current = next;
    setData(next);
    if (!connected) localStorage.setItem(storageKey, JSON.stringify(next));
  }
  useEffect(() => {
    localStorage.setItem(pendingKey, JSON.stringify(pending));
  }, [pending, pendingKey]);
  async function refresh() {
    if (!connected || !online) return;
    const actor = currentActor.current;
    setError("");
    try {
      const next = await api("snapshot", { role });
      if (currentActor.current !== actor) return;
      save(next);
      setStale(false);
    } catch (e) {
      if (currentActor.current === actor) {
        setError((e as Error).message);
        setStale(true);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const on = () => setNetwork(true),
      off = () => {
        setNetwork(false);
        setStale(true);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (!connected) return;
    if (!supabase) {
      setError(
        "Connected mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      );
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      currentActor.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      const actor = s?.user.id ?? null;
      if (currentActor.current !== actor) {
        state.current = empty;
        setData(empty);
        setStale(true);
      }
      currentActor.current = actor;
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!connected || !session || !online) {
      if (connected) setStale(true);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const ch = supabase!.channel(`kk-${role}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table:
          role === "management"
            ? "access_events"
            : role === "student"
              ? "residencies"
              : "gate_terminals",
      },
      () => void refresh(),
    );
    if (role === "management")
      for (const table of [
        "security_alerts",
        "residencies",
        "holiday_declarations",
      ])
        ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => void refresh(),
        );
    ch.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStale(true);
    });
    return () => {
      clearInterval(timer);
      void supabase!.removeChannel(ch);
    };
  }, [session?.user.id, online]);
  async function issue(id: string) {
    if (!online)
      throw Error(
        "Offline: new credentials are unavailable. Reconnect to refresh.",
      );
    return connected
      ? await api("issue", { student_id: id })
      : demoCredential(id);
  }
  async function scan(token: string, block: string): Promise<Decision> {
    if (connected && online) return await api("verify", { token });
    // Connected outages use only preloaded fictional data, never cached production permissions.
    const next = structuredClone(
      connected ? (offlineSimulation.current ?? seed()) : state.current,
    );
    const result = verifyDemo(next, token, block, used.current);
    if (connected) {
      offlineSimulation.current = next;
      const old = state.current;
      save({
        ...old,
        events: [result.event, ...old.events],
        alerts: result.alert ? [result.alert, ...old.alerts] : old.alerts,
      });
    } else save(next);
    if (!online)
      setPending((p) => [
        ...p,
        { ...result.event, verification_method: "offline_simulation" },
      ]);
    return result;
  }
  async function scenario(index: number, block: string) {
    if (connected && online) return await api("demo_verify", { index });
    return scan(
      index === 4
        ? "INVALID-QR"
        : demoCredential(seed().students[index].id).token,
      block,
    );
  }
  async function updateStudent(s: Student) {
    if (connected) {
      if (!online) throw Error("Reconnect to change permissions.");
      await api("manage_residency", { student: s });
      await refresh();
    } else {
      const next = structuredClone(state.current);
      next.students = next.students.map((x) => (x.id === s.id ? s : x));
      save(next);
    }
  }
  async function updateAlert(id: string, status: Alert["status"]) {
    if (connected) {
      if (!online) throw Error("Reconnect to review alerts.");
      await api("alert_status", { id, status });
      await refresh();
    } else
      save({
        ...state.current,
        alerts: state.current.alerts.map((a) =>
          a.id === id ? { ...a, status } : a,
        ),
      });
  }
  async function declare(h: Holiday) {
    if (connected) {
      if (!online) throw Error("Reconnect to save your declaration.");
      await api("declare", { declaration: h });
      await refresh();
    } else
      save({
        ...state.current,
        holidays: [
          ...state.current.holidays.filter(
            (x) =>
              !(
                x.student_id === h.student_id &&
                x.holiday_name === h.holiday_name
              ),
          ),
          h,
        ],
      });
  }
  async function sync() {
    if (!online) throw Error("Reconnect before synchronising.");
    if (connected) {
      for (let i = 0; i < pending.length; i += 100) {
        const batch = pending.slice(i, i + 100);
        await api("sync_demo", { events: batch });
        const ids = new Set(batch.map((e) => e.id));
        setPending((p) => p.filter((e) => !ids.has(e.id)));
      }
      await refresh();
    } else
      setError(
        "Local Demo Mode: these events remain on this app only. There is no cross-app sync.",
      );
  }
  const value: Store = {
    data,
    connected,
    online,
    stale: stale || !online,
    error,
    loading,
    session,
    pending,
    refresh,
    issue,
    scan,
    scenario,
    updateStudent,
    updateAlert,
    declare,
    setOffline: (v) => {
      setOffline(v);
      if (v) setStale(true);
    },
    sync,
    reset: () => {
      if (connected) {
        setError(
          "Connected data reset is restricted to the documented server seed procedure.",
        );
        return;
      }
      used.current.clear();
      offlineSimulation.current = null;
      setPending([]);
      save(seed());
      setError("");
    },
    signIn: async (email, password) => {
      if (!supabase) throw Error("Missing Supabase configuration");
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    signOut: () => {
      void supabase?.auth.signOut();
      save(empty);
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
