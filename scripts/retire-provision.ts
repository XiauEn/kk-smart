// Deploy this as kk-provision-once immediately after successful provisioning.
Deno.serve(
  () =>
    new Response(JSON.stringify({ error: "Setup endpoint retired" }), {
      status: 410,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }),
);
