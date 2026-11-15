import { cors, json, plain, loadSecret, userFromAuth, planOk, linkCode, inServiceWindow, waSend, adminClient } from "./helpers.ts";
import { runReminders, handleInbound } from "./logic.ts";


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") || "";

    // Meta webhook verification (GET)
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const verify = await loadSecret("WHATSAPP_VERIFY_TOKEN");
      if (mode === "subscribe" && token && verify && token === verify && challenge) {
        return plain(challenge, 200);
      }
      // Also allow ?action= for health
      if (action === "health") return json({ ok: true, service: "whatsapp" });
      return plain("forbidden", 403);
    }

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (!action) {
        if (body && body.object === "whatsapp_business_account") action = "webhook";
        else action = String(body.action || "status");
      }
    }

    const waToken = await loadSecret("WHATSAPP_TOKEN");
    const phoneNumberId = await loadSecret("WHATSAPP_PHONE_NUMBER_ID");
    const cronSecret = await loadSecret("TELEGRAM_WEBHOOK_SECRET") || await loadSecret("WHATSAPP_VERIFY_TOKEN");
    const displayNumber = await loadSecret("WHATSAPP_DISPLAY_NUMBER");

    if (action === "webhook") {
      // Always 200 quickly for Meta
      if (!waToken || !phoneNumberId) return json({ ok: true, skipped: "not configured" });
      try {
        const entry = (body.entry as Array<Record<string, unknown>> | undefined) || [];
        for (const ent of entry) {
          const changes = (ent.changes as Array<Record<string, unknown>> | undefined) || [];
          for (const ch of changes) {
            const value = (ch.value || {}) as Record<string, unknown>;
            const messages = (value.messages as Array<Record<string, unknown>> | undefined) || [];
            const contacts = (value.contacts as Array<Record<string, unknown>> | undefined) || [];
            for (const m of messages) {
              if (m.type && m.type !== "text") {
                const from = String(m.from || "");
                await waSend(waToken, phoneNumberId, from, "Send me text for now — Mylo reads messages.");
                continue;
              }
              const textObj = m.text as { body?: string } | undefined;
              const from = String(m.from || "");
              const name = String(((contacts[0]?.profile as { name?: string } | undefined)?.name) || "");
              await handleInbound(waToken, phoneNumberId, { from, text: textObj?.body || "", name });
            }
          }
        }
      } catch (e) {
        console.error("whatsapp webhook", e);
      }
      return json({ ok: true });
    }

    if (action === "run_reminders") {
      if (!waToken || !phoneNumberId) return json({ ok: true, sent: 0, skipped: "not configured" });
      const hdr = req.headers.get("x-cron-secret") || "";
      const auth = req.headers.get("Authorization") || "";
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const okSecret = !!(cronSecret && hdr === cronSecret);
      const okService = !!(service && auth === `Bearer ${service}`);
      if (!okSecret && !okService) return json({ error: "unauthorized" }, 401);
      const result = await runReminders(waToken, phoneNumberId);
      return json({ ok: true, ...result });
    }

    const configured = !!(waToken && phoneNumberId);
    if (!configured && action !== "status") {
      return json({ error: "WhatsApp is not configured yet", configured: false }, 503);
    }

    const user = await userFromAuth(req);
    if (!user) return json({ error: "sign in required" }, 401);

    if (action === "status") {
      const sb = adminClient();
      const { data: acc } = await sb.from("whatsapp_accounts")
        .select("phone_e164, profile_name, connected_at, last_inbound_at, last_message_at, reminders_enabled, remind_minutes_before, timezone")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({
        ok: true,
        configured,
        connected: !!acc,
        plan_ok: await planOk(user.id),
        phone_e164: acc?.phone_e164 || null,
        profile_name: acc?.profile_name || null,
        reminders_enabled: acc?.reminders_enabled ?? true,
        remind_minutes_before: acc?.remind_minutes_before ?? 15,
        timezone: acc?.timezone || "Africa/Lagos",
        connected_at: acc?.connected_at || null,
        last_inbound_at: acc?.last_inbound_at || null,
        display_number: displayNumber || null,
        service_window_open: inServiceWindow(acc?.last_inbound_at),
      });
    }

    if (action === "connect") {
      if (!(await planOk(user.id))) {
        return json({ error: "WhatsApp Mylo requires Pro or Pod", plan_ok: false }, 403);
      }
      if (!configured) return json({ error: "WhatsApp is not configured yet", configured: false }, 503);
      const sb = adminClient();
      const code = linkCode();
      await sb.from("whatsapp_link_codes").delete().eq("user_id", user.id);
      await sb.from("whatsapp_link_codes").insert({
        code,
        user_id: user.id,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      const digits = String(displayNumber || "").replace(/\D/g, "");
      const prefill = encodeURIComponent(`LINK ${code}`);
      const urlWa = digits ? `https://wa.me/${digits}?text=${prefill}` : null;
      return json({
        ok: true,
        code,
        url: urlWa,
        display_number: displayNumber || null,
        expires_in_min: 15,
        instructions: urlWa
          ? "Tap Open WhatsApp, then send the prefilled LINK code."
          : `Open WhatsApp and message your Mylo business number with: LINK ${code}`,
      });
    }

    if (action === "disconnect") {
      const sb = adminClient();
      await sb.from("whatsapp_accounts").delete().eq("user_id", user.id);
      await sb.from("whatsapp_link_codes").delete().eq("user_id", user.id);
      return json({ ok: true, disconnected: true });
    }

    if (action === "set_reminders") {
      if (!(await planOk(user.id))) return json({ error: "WhatsApp Mylo requires Pro or Pod", plan_ok: false }, 403);
      const sb = adminClient();
      const { data: acc } = await sb.from("whatsapp_accounts").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!acc) return json({ error: "Connect WhatsApp first" }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof body.enabled === "boolean") patch.reminders_enabled = body.enabled;
      if (Number(body.minutes) > 0) patch.remind_minutes_before = Math.min(120, Math.max(5, Number(body.minutes)));
      if (!Object.keys(patch).length) return json({ error: "Nothing to update" }, 400);
      const { data } = await sb.from("whatsapp_accounts").update(patch).eq("user_id", user.id)
        .select("reminders_enabled, remind_minutes_before").maybeSingle();
      return json({ ok: true, ...data });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
