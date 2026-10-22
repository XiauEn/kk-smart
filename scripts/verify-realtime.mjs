import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key,
  DEMO_PASSWORD: password,
} = process.env;
if (!url || !key || !password)
  throw Error("Load the private operator environment first.");
const clients = [];
async function login(email) {
  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw Error("Fictional account login failed");
  clients.push(c);
  return c;
}
async function call(c, action, fields = {}) {
  const { data, error } = await c.functions.invoke("kk-api", {
    body: { action, ...fields },
  });
  if (error || data?.error) throw Error(`API action failed: ${action}`);
  return data;
}
let channel;
try {
  const manager = await login("management@kk-smart.example");
  const alex = await login("alex@kk-smart.example");
  const gate = await login("gate-a@kk-smart.example");
  const observed = new Set();
  let onInsert = () => {};
  channel = manager
    .channel("kk-smart-rehearsal-" + crypto.randomUUID())
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "access_events" },
      (payload) => {
        observed.add(payload.new.id);
        onInsert();
      },
    );
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(Error("Realtime subscription timed out")),
      20000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(t);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(t);
        reject(Error("Realtime subscription failed"));
      }
    });
  });
  const qr = await call(alex, "issue");
  const decision = await call(gate, "verify", { token: qr.token });
  assert.equal(decision.granted, true);
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () =>
        reject(
          Error("The committed gate event did not reach management Realtime"),
        ),
      20000,
    );
    onInsert = () => {
      if (observed.has(decision.event.id)) {
        clearTimeout(t);
        resolve();
      }
    };
    onInsert();
  });
  console.log(
    "PASS: the authenticated management Realtime subscription received the actual committed gate event.",
  );
  const demo = await call(gate, "demo_verify", { index: 1 });
  assert.equal(demo.granted, false);
  console.log(
    "PASS: server-controlled terminal demo scenario works without a frontend administrative key.",
  );
  const retired = await fetch(url + "/functions/v1/kk-provision-once", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(retired.status, 410);
  console.log("PASS: temporary provisioning endpoint is retired (HTTP 410).");
} finally {
  if (channel) await clients[0]?.removeChannel(channel);
  await Promise.all(clients.map((c) => c.auth.signOut()));
}
