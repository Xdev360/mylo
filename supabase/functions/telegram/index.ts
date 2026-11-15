import {
  cors, json, adminClient, loadSecret, userFromAuth, planOk,
  todayIso, parseAdhocReminder, schedulePreciseAdhoc, runReminders,
  linkCode, tgApi, reply, buildContext, spendCredit, chatWithGemini, localReply, markDone, createGoals,
  parseLocalGoals, transcribeVoiceNote, runNotionActions, runCalendarActions, BOT_USERNAME
} from "./helpers.ts";

type TgFrom = { id?: number; username?: string; first_name?: string };
type TgVoice = { file_id: string; duration?: number; mime_type?: string };
type TgAudio = { file_id: string; duration?: number; mime_type?: string };

async function completeLink(
  token: string,
  chatId: number,
  codeRaw: string,
  from?: TgFrom,
): Promise<boolean> {
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) return false;
  const sb = adminClient();
  const { data: row } = await sb.from("telegram_link_codes").select("*").eq("code", code).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    await reply(token, chatId, "That link code expired. Open Mylo → You → Integrations → Connect Telegram for a fresh one.");
    return true;
  }
  if (!(await planOk(row.user_id))) {
    await reply(token, chatId, "Telegram Mylo is on Pro/Pod. Upgrade in the app, then connect again.");
    return true;
  }
  await sb.from("telegram_accounts").delete().eq("chat_id", chatId);
  await sb.from("telegram_accounts").delete().eq("user_id", row.user_id);
  await sb.from("telegram_accounts").upsert({
    user_id: row.user_id,
    chat_id: chatId,
    telegram_user_id: from?.id || null,
    telegram_username: from?.username || null,
    connected_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    reminders_enabled: true,
  });
  await sb.from("telegram_link_codes").delete().eq("code", code);
  const { data: profile } = await sb.from("profiles").select("username").eq("id", row.user_id).maybeSingle();
  await reply(
    token,
    chatId,
    `Linked to @${profile?.username || "you"}. You’re talking to Mylo now.\n\nTry: What’s left today?\nOr: Add gym today at 7 for 1 hour`,
  );
  return true;
}

async function handleUpdate(token: string, update: Record<string, unknown>) {
  const message = update.message as {
    text?: string;
    caption?: string;
    voice?: TgVoice;
    audio?: TgAudio;
    chat?: { id: number; type?: string };
    from?: TgFrom;
  } | undefined;
  if (!message?.chat?.id) return;
  const chatId = message.chat.id;
  let text = String(message.text || message.caption || "").trim();
  const voiceOrAudio = message.voice || message.audio;
  const sb = adminClient();

  // /start CODE (deep link) — bare /start has no code and cannot link
  if (text && /^\/start(?:@\w+)?(?:\s+|$)/i.test(text)) {
    const code = text.replace(/^\/start(?:@\w+)?\s*/i, "").trim().toUpperCase();
    if (!code) {
      await reply(
        token,
        chatId,
        `Hey — I’m Mylo.\n\nTo link: open Mylo → You → Integrations → Connect Telegram, then tap the blue Open Telegram button (or send the 8-character code here).\n\nTapping Start alone won’t link your account.`,
      );
      return;
    }
    await completeLink(token, chatId, code, message.from);
    return;
  }

  if (text && /^\/unlink(?:@\w+)?$/i.test(text)) {
    await sb.from("telegram_accounts").delete().eq("chat_id", chatId);
    await reply(token, chatId, "Unlinked. Connect again anytime from Mylo → You → Integrations.");
    return;
  }

  if (text && (/^\/reminders(?:@\w+)?(?:\s+|$)/i.test(text) || /\breminders?\s+(on|off|enable|disable)\b/i.test(text))) {
    const { data: acc0 } = await sb.from("telegram_accounts").select("*").eq("chat_id", chatId).maybeSingle();
    if (!acc0?.user_id) {
      await reply(token, chatId, `Link first from Mylo → You → Integrations → Connect Telegram`);
      return;
    }
    const lower = text.toLowerCase();
    let enabled = acc0.reminders_enabled;
    if (/\b(on|enable|true)\b/.test(lower)) enabled = true;
    else if (/\b(off|disable|false)\b/.test(lower)) enabled = false;
    else enabled = !enabled;
    const leadMatch = lower.match(/\b(\d{1,3})\s*(?:min|mins|minutes?)\b/);
    const patch: Record<string, unknown> = { reminders_enabled: enabled };
    if (leadMatch) patch.remind_minutes_before = Math.min(120, Math.max(5, Number(leadMatch[1])));
    await sb.from("telegram_accounts").update(patch).eq("user_id", acc0.user_id);
    const { data: refreshed } = await sb.from("telegram_accounts").select("reminders_enabled, remind_minutes_before").eq("user_id", acc0.user_id).maybeSingle();
    await reply(
      token,
      chatId,
      refreshed?.reminders_enabled
        ? `Reminders on — I’ll ping you ~${refreshed.remind_minutes_before || 15} min before timed goals.`
        : "Reminders off. Say /reminders on anytime.",
    );
    return;
  }

  const { data: acc } = await sb.from("telegram_accounts").select("*").eq("chat_id", chatId).maybeSingle();
  if (!acc?.user_id) {
    if (text && /^[A-Z0-9]{8}$/i.test(text)) {
      await completeLink(token, chatId, text, message.from);
      return;
    }
    await reply(
      token,
      chatId,
      `You’re not linked yet.\n\n1) Mylo → You → Integrations → Connect Telegram\n2) Tap Open Telegram (or send the code here)\n\nhttps://t.me/${BOT_USERNAME}`,
    );
    return;
  }

  await sb.from("telegram_accounts").update({ last_message_at: new Date().toISOString() }).eq("user_id", acc.user_id);

  if (!(await planOk(acc.user_id))) {
    await reply(token, chatId, "Telegram Mylo needs Pro/Pod. Upgrade in the app.");
    return;
  }

  // Voice / audio notes → transcribe, then run the normal text pipeline
  if (!text && voiceOrAudio?.file_id) {
    await tgApi(token, "sendChatAction", { chat_id: chatId, action: "typing" });
    const key = await loadSecret("GEMINI_API_KEY");
    const heard = await transcribeVoiceNote(
      token,
      voiceOrAudio.file_id,
      key,
      Number(voiceOrAudio.duration) || undefined,
    );
    text = String(heard || "").trim();
    if (!text) {
      await reply(token, chatId, "Couldn’t catch that voice note — try again or type it out.");
      return;
    }
  }

  if (!text) return;

  const context = await buildContext(acc.user_id);

  // One-shot: “remind me in 5 min to …” (always honor explicit asks; goal toggle is separate)
  const adhoc = parseAdhocReminder(text, acc.timezone || "Africa/Lagos");
  if (adhoc) {
    const { data: row, error } = await sb.from("mylo_reminders").insert({
      user_id: acc.user_id,
      channel: "telegram",
      chat_id: chatId,
      body: adhoc.body,
      fire_at: adhoc.fireAt.toISOString(),
    }).select("id").maybeSingle();
    if (error || !row?.id) {
      await reply(token, chatId, "Couldn’t set that reminder — try again.");
      return;
    }
    // Exact timer for short delays; cron covers anything longer
    schedulePreciseAdhoc(token, row.id, chatId, adhoc.body, adhoc.fireAt);
    if (acc.reminders_enabled === false) {
      await sb.from("telegram_accounts").update({ reminders_enabled: true }).eq("user_id", acc.user_id);
    }
    await reply(token, chatId, `Got it — I’ll remind you ${adhoc.whenLabel}: ${adhoc.body}`);
    return;
  }

  // Quick mark-done
  const doneMatch = text.match(/\b(?:mark|set)?\s*(.+?)\s+(?:as\s+)?(?:done|complete|finished)\b/i)
    || text.match(/\b(?:done|finished|complete[sd]?)\s+(.+)/i);
  if (doneMatch) {
    const title = await markDone(acc.user_id, doneMatch[1].replace(/^[\"']|[\"']$/g, "").trim());
    if (title) {
      await reply(token, chatId, `Marked “${title}” done. Nice.`);
      return;
    }
  }

  const local = localReply(text, context);
  if (local && !/\b(add|create|lock|schedule|remind|notion|calendar|google|push)\b/i.test(text)) {
    await reply(token, chatId, local);
    return;
  }

  const spent = await spendCredit(acc.user_id);
  if (!spent.ok) {
    await reply(token, chatId, `You’re out of Mylo credits (${spent.credits} left). Top up in the app → You → Plan.`);
    return;
  }

  const key = await loadSecret("GEMINI_API_KEY");
  let result = key ? await chatWithGemini(text, context, key) : null;
  if (!result) {
    result = {
      reply: local || "I’m with you — try “What’s left today?”, “What’s on my calendar?”, or “Push today to Notion”.",
      goals: [],
      calendar_actions: [],
      notion_actions: [],
    };
  }

  // If model said ok but forgot goals[], parse locally
  let drafts = Array.isArray(result.goals) ? result.goals : [];
  if (!drafts.length) {
    const localGoals = parseLocalGoals(text, todayIso());
    if (localGoals.length) drafts = localGoals;
  }

  const goalResult = drafts.length ? await createGoals(acc.user_id, drafts) : { created: [] as string[] };
  const created = goalResult.created || [];
  let replyText = result.reply;

  const notionBits = result.notion_actions?.length
    ? await runNotionActions(acc.user_id, result.notion_actions)
    : "";
  const calBits = result.calendar_actions?.length
    ? await runCalendarActions(acc.user_id, result.calendar_actions)
    : "";

  if (created.length) {
    replyText = `Added to Today:\n${created.map((t) => `• ${t}`).join("\n")}`;
  } else if (drafts.length && goalResult.error) {
    replyText = `Couldn’t add that to Today — ${goalResult.error}`;
  } else if (/\b(add|create|lock|schedule)\b/i.test(text) && !created.length && !calBits && !notionBits) {
    // Model claimed success without creating anything
    if (/\b(added|got it|done|locked)\b/i.test(replyText)) {
      replyText = "I couldn’t save that to your Today list. Try: “Add gym today at 7 for 1 hour”.";
    }
  }
  if (calBits) replyText += `\n\n${calBits}`;
  if (notionBits) replyText += `\n\n${notionBits}`;
  await reply(token, chatId, replyText);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") || "";
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (!action) {
        // Telegram webhook posts Update objects (have update_id)
        if (body && ("update_id" in body || "message" in body || "edited_message" in body)) {
          action = "webhook";
        } else {
          action = String(body.action || "status");
        }
      }
    }

    const token = await loadSecret("TELEGRAM_BOT_TOKEN");
    const webhookSecret = await loadSecret("TELEGRAM_WEBHOOK_SECRET");

    if (action === "webhook") {
      if (!token) return json({ error: "bot not configured" }, 503);
      if (webhookSecret) {
        const hdr = req.headers.get("x-telegram-bot-api-secret-token") || "";
        if (hdr !== webhookSecret) return json({ error: "unauthorized" }, 401);
      }
      // Telegram may send edited_message
      const update = body.edited_message && !body.message
        ? { ...body, message: body.edited_message }
        : body;
      try {
        await handleUpdate(token, update as Record<string, unknown>);
      } catch (e) {
        console.error("telegram handleUpdate", e);
      }
      return json({ ok: true });
    }

    if (action === "run_reminders") {
      if (!token) return json({ error: "bot not configured" }, 503);
      const cronHdr = req.headers.get("x-cron-secret") || req.headers.get("x-telegram-bot-api-secret-token") || "";
      const auth = req.headers.get("Authorization") || "";
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const okSecret = !!(webhookSecret && cronHdr === webhookSecret);
      const okService = !!(service && auth === `Bearer ${service}`);
      if (!okSecret && !okService) return json({ error: "unauthorized" }, 401);
      const result = await runReminders(token);
      return json({ ok: true, ...result });
    }

    if (!token) return json({ error: "Telegram is not configured yet", configured: false }, 503);

    if (action === "setup_webhook") {
      // Protect with service-style: require authenticated admin
      const user = await userFromAuth(req);
      if (!user) return json({ error: "sign in required" }, 401);
      const sb = adminClient();
      const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!profile?.is_admin) return json({ error: "admin only" }, 403);
      const hookUrl = `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")}/functions/v1/telegram?action=webhook`;
      const setup: Record<string, unknown> = {
        url: hookUrl,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      };
      if (webhookSecret) setup.secret_token = webhookSecret;
      const result = await tgApi(token, "setWebhook", setup);
      return json({ ok: result.ok, hookUrl, detail: result.data });
    }

    const user = await userFromAuth(req);
    if (!user) return json({ error: "sign in required" }, 401);

    if (action === "status") {
      const sb = adminClient();
      const { data: acc } = await sb.from("telegram_accounts")
        .select("telegram_username, connected_at, last_message_at, reminders_enabled, remind_minutes_before, timezone")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({
        ok: true,
        configured: true,
        connected: !!acc,
        plan_ok: await planOk(user.id),
        bot_username: BOT_USERNAME,
        telegram_username: acc?.telegram_username || null,
        reminders_enabled: acc?.reminders_enabled ?? true,
        remind_minutes_before: acc?.remind_minutes_before ?? 15,
        timezone: acc?.timezone || "Africa/Lagos",
        connected_at: acc?.connected_at || null,
        last_message_at: acc?.last_message_at || null,
      });
    }

    if (action === "set_reminders") {
      if (!(await planOk(user.id))) {
        return json({ error: "Telegram Mylo requires Pro or Pod", plan_ok: false }, 403);
      }
      const sb = adminClient();
      const { data: acc } = await sb.from("telegram_accounts").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!acc) return json({ error: "Connect Telegram first" }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof body.enabled === "boolean") patch.reminders_enabled = body.enabled;
      if (Number(body.minutes) > 0) patch.remind_minutes_before = Math.min(120, Math.max(5, Number(body.minutes)));
      if (body.timezone) patch.timezone = String(body.timezone).slice(0, 64);
      if (!Object.keys(patch).length) return json({ error: "Nothing to update" }, 400);
      const { data } = await sb.from("telegram_accounts").update(patch).eq("user_id", user.id).select("reminders_enabled, remind_minutes_before, timezone").maybeSingle();
      return json({ ok: true, ...data });
    }

    if (action === "connect") {
      if (!(await planOk(user.id))) {
        return json({ error: "Telegram Mylo requires Pro or Pod", plan_ok: false }, 403);
      }
      const sb = adminClient();
      const code = linkCode();
      await sb.from("telegram_link_codes").delete().eq("user_id", user.id);
      await sb.from("telegram_link_codes").insert({
        code,
        user_id: user.id,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      const deepLink = `https://t.me/${BOT_USERNAME}?start=${code}`;
      return json({
        ok: true,
        code,
        url: deepLink,
        bot_username: BOT_USERNAME,
        expires_in_min: 15,
      });
    }

    if (action === "disconnect") {
      const sb = adminClient();
      await sb.from("telegram_accounts").delete().eq("user_id", user.id);
      await sb.from("telegram_link_codes").delete().eq("user_id", user.id);
      return json({ ok: true, disconnected: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
