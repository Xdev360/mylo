import {
  adminClient, loadSecret, planOk, linkCode, todayIso, parseTimeToMinutes, nowInTimezone, formatMins, inServiceWindow, waSend, primaryRoomId, loadTodayGoals, buildContext, spendCredit, chatWithGemini, localReply, markDone
} from "./helpers.ts";

export async function createGoals(userId: string, drafts: Array<Record<string, unknown>>) {
  const roomId = await primaryRoomId(userId);
  if (!roomId) return [];
  const sb = adminClient();
  const created: string[] = [];
  for (const g of drafts.slice(0, 5)) {
    const title = String(g.title || "Goal").slice(0, 80);
    const due = String(g.due_date || todayIso()).slice(0, 10);
    const start = g.start_time ? String(g.start_time).slice(0, 5) : "08:00";
    const duration = Number(g.duration_min) > 0 ? Number(g.duration_min) : 30;
    const { error } = await sb.from("goals").insert({
      room_id: roomId,
      owner_id: userId,
      title,
      scope: "day",
      due_date: due,
      start_time: start,
      duration_min: duration,
      done: false,
      is_shared: false,
    });
    if (!error) created.push(title);
  }
  return created;
}

export function parseAdhocReminder(text: string, tz = "Africa/Lagos"): { body: string; fireAt: Date; whenLabel: string } | null {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  if (!/\bremind(?:\s+me)?\b/.test(lower)) return null;
  if (/\breminders?\s+(on|off|enable|disable)\b/.test(lower)) return null;

  const rel = lower.match(/\bin\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/);
  if (!rel) return null;
  const n = Number(rel[1]);
  if (!(n > 0)) return null;
  const unit = rel[2];
  let delayMs = 0;
  let whenLabel = "";
  if (/^h/.test(unit)) {
    if (n > 72) return null;
    delayMs = n * 60 * 60 * 1000;
    whenLabel = `in ${n} hour${n === 1 ? "" : "s"}`;
  } else {
    if (n > 24 * 60) return null;
    delayMs = n * 60 * 1000;
    whenLabel = `in ${n} min`;
  }
  const fireAt = new Date(Date.now() + delayMs);
  let body = raw
    .replace(/\bremind(?:\s+me)?(?:\s+to|\s+about)?\s*/i, "")
    .replace(/\bin\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h)\b/i, "")
    .replace(/^(to|about)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim() || "your thing";
  body = body.replace(/^(to|about)\s+/i, "").trim() || "your thing";
  return { body: body.slice(0, 280), fireAt, whenLabel };
}

export async function runReminders(token: string, phoneNumberId: string) {
  const sb = adminClient();
  let sent = 0;
  const errors: string[] = [];

  // Ad-hoc reminders (only inside 24h free service window)
  const { data: due } = await sb
    .from("mylo_reminders")
    .select("id, user_id, body, fire_at")
    .is("sent_at", null)
    .lte("fire_at", new Date().toISOString())
    .eq("channel", "whatsapp")
    .order("fire_at")
    .limit(50);

  for (const rem of due || []) {
    const { data: acc } = await sb.from("whatsapp_accounts").select("*").eq("user_id", rem.user_id).maybeSingle();
    if (!acc?.wa_id || acc.reminders_enabled === false || !inServiceWindow(acc.last_inbound_at)) {
      // Outside free window — drop so we don't keep retrying forever
      if (acc && !inServiceWindow(acc.last_inbound_at)) {
        await sb.from("mylo_reminders").update({ sent_at: new Date().toISOString() }).eq("id", rem.id);
      }
      continue;
    }
    const result = await waSend(token, phoneNumberId, acc.wa_id, `⏰ Reminder: ${rem.body}`);
    if (!result.ok) {
      errors.push(String((result.data as { error?: { message?: string } })?.error?.message || "adhoc send failed"));
      continue;
    }
    await sb.from("mylo_reminders").update({ sent_at: new Date().toISOString() }).eq("id", rem.id);
    sent += 1;
  }

  // Timed Today goals (same 24h window rule)
  const { data: accounts } = await sb
    .from("whatsapp_accounts")
    .select("*")
    .eq("reminders_enabled", true);

  for (const acc of accounts || []) {
    if (!inServiceWindow(acc.last_inbound_at)) continue;
    if (!(await planOk(acc.user_id))) continue;
    const lead = Math.min(120, Math.max(5, Number(acc.remind_minutes_before) || 15));
    const now = nowInTimezone(acc.timezone || "Africa/Lagos");
    const { data: goals } = await sb
      .from("goals")
      .select("id, title, done, start_time, due_date")
      .eq("owner_id", acc.user_id)
      .eq("scope", "day")
      .eq("due_date", now.date)
      .eq("done", false);

    for (const g of goals || []) {
      const startMins = parseTimeToMinutes(g.start_time);
      if (startMins == null) continue;
      const minsUntil = startMins - now.minutes;
      let kind: string | null = null;
      let text = "";
      if (minsUntil >= 1 && minsUntil <= lead + 4) {
        kind = "upcoming";
        text = minsUntil <= 1
          ? `⏰ Starting now: ${g.title}`
          : `⏰ Reminder: “${g.title}” in ${minsUntil} min (${formatMins(startMins)}). You’ve got this.`;
      } else if (minsUntil <= 0 && minsUntil >= -4) {
        kind = "starting";
        text = `⏰ Time for “${g.title}”. Lock in.`;
      }
      if (!kind) continue;
      const { data: existing } = await sb
        .from("whatsapp_reminder_log")
        .select("goal_id")
        .eq("goal_id", g.id)
        .eq("kind", kind)
        .maybeSingle();
      if (existing) continue;
      const result = await waSend(token, phoneNumberId, acc.wa_id, text);
      if (!result.ok) {
        errors.push(String((result.data as { error?: { message?: string } })?.error?.message || "send failed"));
        continue;
      }
      await sb.from("whatsapp_reminder_log").upsert({ goal_id: g.id, kind, sent_at: new Date().toISOString() });
      sent += 1;
    }
  }

  return { sent, checked: (accounts || []).length, errors: errors.slice(0, 5) };
}

export async function handleInbound(
  token: string,
  phoneNumberId: string,
  msg: { from: string; text: string; name?: string },
) {
  const sb = adminClient();
  const waId = String(msg.from || "").replace(/\D/g, "");
  const text = String(msg.text || "").trim();
  if (!waId || !text) return;

  // LINK CODE / just CODE (8-char from our alphabet)
  const prefixed = text.trim().match(/^(?:link|connect|start)\s+([A-Z0-9]{6,10})$/i);
  const bare = text.trim().match(/^([A-HJ-NP-Z2-9]{8})$/i);
  const linkMatch = prefixed || bare;
  if (linkMatch) {
    const code = String(linkMatch[1] || "").trim().toUpperCase();
    const { data: row } = await sb.from("whatsapp_link_codes").select("*").eq("code", code).maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      await waSend(token, phoneNumberId, waId, "That link code expired. Open Mylo → You → Integrations → Connect WhatsApp for a fresh one.");
      return;
    }
    if (!(await planOk(row.user_id))) {
      await waSend(token, phoneNumberId, waId, "WhatsApp Mylo is on Pro/Pod. Upgrade in the app, then connect again.");
      return;
    }
    await sb.from("whatsapp_accounts").delete().eq("wa_id", waId);
    await sb.from("whatsapp_accounts").delete().eq("user_id", row.user_id);
    await sb.from("whatsapp_accounts").upsert({
      user_id: row.user_id,
      wa_id: waId,
      phone_e164: `+${waId}`,
      profile_name: msg.name || null,
      connected_at: new Date().toISOString(),
      last_inbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      reminders_enabled: true,
    });
    await sb.from("whatsapp_link_codes").delete().eq("code", code);
    const { data: profile } = await sb.from("profiles").select("username").eq("id", row.user_id).maybeSingle();
    await waSend(
      token,
      phoneNumberId,
      waId,
      `Linked to @${profile?.username || "you"}. You’re talking to Mylo on WhatsApp.\n\nTry: What’s left today?\nOr: Remind me in 5 min to stretch`,
    );
    return;
  }

  if (/^unlink$/i.test(text)) {
    await sb.from("whatsapp_accounts").delete().eq("wa_id", waId);
    await waSend(token, phoneNumberId, waId, "Unlinked. Connect again anytime from Mylo → You → Integrations.");
    return;
  }

  const { data: acc } = await sb.from("whatsapp_accounts").select("*").eq("wa_id", waId).maybeSingle();
  if (!acc?.user_id) {
    await waSend(
      token,
      phoneNumberId,
      waId,
      "You’re not linked yet.\nOpen Mylo → You → Integrations → Connect WhatsApp, then send the code here.",
    );
    return;
  }

  await sb.from("whatsapp_accounts").update({
    last_inbound_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    profile_name: msg.name || acc.profile_name,
  }).eq("user_id", acc.user_id);

  if (!(await planOk(acc.user_id))) {
    await waSend(token, phoneNumberId, waId, "WhatsApp Mylo needs Pro/Pod. Upgrade in the app.");
    return;
  }

  if (/^reminders?\s+(on|off)$/i.test(text) || /^reminders?$/i.test(text)) {
    const lower = text.toLowerCase();
    let enabled = acc.reminders_enabled;
    if (/\bon\b/.test(lower)) enabled = true;
    else if (/\boff\b/.test(lower)) enabled = false;
    else enabled = !enabled;
    await sb.from("whatsapp_accounts").update({ reminders_enabled: enabled }).eq("user_id", acc.user_id);
    await waSend(
      token,
      phoneNumberId,
      waId,
      enabled
        ? "Reminders on (free while you keep chatting within 24h)."
        : "Reminders off.",
    );
    return;
  }

  const context = await buildContext(acc.user_id);

  const adhoc = parseAdhocReminder(text, acc.timezone || "Africa/Lagos");
  if (adhoc) {
    if (acc.reminders_enabled === false) {
      await waSend(token, phoneNumberId, waId, "Reminders are off. Send “reminders on”, then ask again.");
      return;
    }
    const { error } = await sb.from("mylo_reminders").insert({
      user_id: acc.user_id,
      channel: "whatsapp",
      chat_id: null,
      body: adhoc.body,
      fire_at: adhoc.fireAt.toISOString(),
    });
    if (error) {
      await waSend(token, phoneNumberId, waId, "Couldn’t set that reminder — try again.");
      return;
    }
    await waSend(token, phoneNumberId, waId, `Got it — I’ll remind you ${adhoc.whenLabel}: ${adhoc.body}\n(Works free while our chat window is open.)`);
    return;
  }

  const doneMatch = text.match(/\b(?:mark|set)?\s*(.+?)\s+(?:as\s+)?(?:done|complete|finished)\b/i)
    || text.match(/\b(?:done|finished|complete[sd]?)\s+(.+)/i);
  if (doneMatch) {
    const title = await markDone(acc.user_id, doneMatch[1].replace(/^["']|["']$/g, "").trim());
    if (title) {
      await waSend(token, phoneNumberId, waId, `Marked “${title}” done. Nice.`);
      return;
    }
  }

  const local = localReply(text, context);
  if (local && !/\b(add|create|lock|schedule|remind)\b/i.test(text)) {
    await waSend(token, phoneNumberId, waId, local);
    return;
  }

  const spent = await spendCredit(acc.user_id);
  if (!spent.ok) {
    await waSend(token, phoneNumberId, waId, `You’re out of Mylo credits (${spent.credits} left). Top up in the app → You → Plan.`);
    return;
  }

  const key = await loadSecret("GEMINI_API_KEY");
  let result = key ? await chatWithGemini(text, context, key) : null;
  if (!result) {
    result = {
      reply: local || "I’m with you — try “What’s left today?” or “Add study today at 5 for 30 mins”.",
      goals: [],
    };
  }
  const created = result.goals?.length ? await createGoals(acc.user_id, result.goals) : [];
  let replyText = result.reply;
  if (created.length) replyText += `\n\nAdded to Today:\n${created.map((t) => `• ${t}`).join("\n")}`;
  await waSend(token, phoneNumberId, waId, replyText);
}
