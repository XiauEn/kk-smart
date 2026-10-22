// Temporary operator bootstrap, retired immediately after use. No frontend calls this.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
Deno.serve(async (req) => {
  if (req.method !== "POST")
    return new Response("POST required", { status: 405 });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  try {
    const body = await req.json();
    if (
      typeof body.setup_token !== "string" ||
      body.setup_token.length < 40 ||
      typeof body.password !== "string" ||
      body.password.length < 20
    )
      throw Error();
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(body.setup_token),
        ),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const { data: allowed } = await admin.rpc("kk_consume_setup", {
      p_hash: hash,
    });
    if (allowed !== true)
      return new Response("Not authorised", { status: 403 });
    const email = "guard-a@kk-smart.example";
    const { data: users, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw Error();
    let user = users.users.find((u) => u.email === email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
      });
      if (error || !data.user) throw Error();
      user = data.user;
    }
    const { data: role } = await admin
      .from("account_roles")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (role && role.role !== "guard") throw Error();
    const { error: roleError } = await admin
      .from("account_roles")
      .upsert({ auth_user_id: user.id, role: "guard" });
    if (roleError) throw Error();
    const { data: block, error: blockError } = await admin
      .from("residential_blocks")
      .select("id")
      .eq("kk_name", "KK3")
      .eq("block_name", "A")
      .single();
    if (blockError) throw Error();
    const { error: scopeError } = await admin
      .from("guard_blocks")
      .upsert({ auth_user_id: user.id, block_id: block.id });
    if (scopeError) throw Error();
    return Response.json({ ok: true, account: email, scope: "KK3 Block A" });
  } catch {
    return new Response("Guard provisioning rejected", { status: 400 });
  }
});
