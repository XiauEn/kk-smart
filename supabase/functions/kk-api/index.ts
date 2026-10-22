import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const url = Deno.env.get("SUPABASE_URL")!,
  serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Public anon/publishable keys belong in frontends. The service role never leaves this function.
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cors = {
    "Access-Control-Allow-Origin": allowed.includes(origin)
      ? origin
      : allowed.length
        ? "null"
        : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (allowed.length && origin && !allowed.includes(origin))
    return respond({ error: "Origin not allowed" }, 403);
  if (req.method !== "POST") return respond({ error: "POST required" }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > 100000)
    return respond({ error: "Request too large" }, 413);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return respond({ error: "Sign in required" }, 401);
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user)
    return respond({ error: "Session invalid. Please sign in again." }, 401);
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(name, {
      p_actor: user.id,
      ...args,
    });
    if (error) throw new Error(error.message);
    return data;
  };
  try {
    const body = await req.json();
    let result: unknown = { ok: true };
    switch (body.action) {
      case "snapshot":
        result = await rpc("kk_snapshot", { p_role: body.role });
        break;
      case "issue":
        result = await rpc("kk_issue", {});
        break;
      case "verify":
        if (typeof body.token !== "string" || body.token.length > 2048)
          throw Error("Invalid QR credential");
        result = await rpc("kk_verify", { p_token: body.token });
        break;
      case "manage_residency":
        await rpc("kk_manage_residency", { p_student: body.student });
        break;
      case "alert_status":
        await rpc("kk_alert_status", { p_id: body.id, p_status: body.status });
        break;
      case "declare":
        await rpc("kk_declare", { p_declaration: body.declaration });
        break;
      case "demo_verify": {
        if (Deno.env.get("DEMO_CONTROLS_ENABLED") !== "true")
          throw Error(
            "Server demo controls are disabled. Use a real student QR.",
          );
        // Only an active terminal may request these four fictional competition scenarios.
        const { data: t } = await admin
          .from("gate_terminals")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("revoked", false)
          .maybeSingle();
        const { data: r } = await admin
          .from("account_roles")
          .select("role")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (!t || r?.role !== "terminal")
          throw Error("Authorised terminal required");
        if (!Number.isInteger(body.index) || body.index < 0 || body.index > 4)
          throw Error("Invalid demo scenario");
        let qr = "INVALID-DEMO-" + crypto.randomUUID();
        if (body.index < 4) {
          const studentId = `00000000-0000-4000-8000-${String(body.index + 1).padStart(12, "0")}`;
          qr =
            "KK1." +
            Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
              b.toString(16).padStart(2, "0"),
            ).join("");
          const hash = Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(qr),
              ),
            ),
            (b) => b.toString(16).padStart(2, "0"),
          ).join("");
          // Use database time for the same 15-second lifetime as real issuance.
          const { data: clock, error: clockError } = await admin.rpc(
            "kk_demo_issue",
            { p_actor: user.id, p_student: studentId, p_hash: hash },
          );
          if (clockError || !clock)
            throw Error("Demo credential could not be issued");
        }
        result = await rpc("kk_verify", { p_token: qr });
        break;
      }
      case "sync_demo": {
        const { data: t } = await admin
          .from("gate_terminals")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("revoked", false)
          .maybeSingle();
        const { data: r } = await admin
          .from("account_roles")
          .select("role")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (!t || r?.role !== "terminal")
          throw Error("Authorised terminal required");
        if (!Array.isArray(body.events) || body.events.length > 500)
          throw Error("Queue batch must contain at most 500 demo events");
        const rows = body.events.map(
          (e: { id: string; timestamp: string; granted: boolean }) => {
            if (
              !/^[0-9a-f-]{36}$/i.test(e.id) ||
              !Number.isFinite(Date.parse(e.timestamp)) ||
              typeof e.granted !== "boolean"
            )
              throw Error("Invalid demo telemetry");
            return {
              id: e.id,
              terminal_id: t.id,
              reported_timestamp: e.timestamp,
              reported_granted: e.granted,
              verification_method: "offline_simulation",
            };
          },
        );
        if (rows.length) {
          const { error } = await admin
            .from("offline_demo_events")
            .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
          if (error) throw Error("Demo queue upload failed");
        }
        result = {
          ok: true,
          count: rows.length,
          classification: "untrusted_offline_simulation",
        };
        break;
      }
      default:
        return respond({ error: "Unknown action" }, 400);
    }
    return respond(result ?? { ok: true });
  } catch (error) {
    console.error(
      "KK API operation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return respond(
      {
        error:
          "Operation rejected. Check your account role, supplied fields, or demo-control configuration.",
      },
      400,
    );
  }
});
