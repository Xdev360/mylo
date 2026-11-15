/* Sending email. Resend is the sender: RESEND_API_KEY turns it on, once
   staymylo.com is verified in Resend. BREVO_API_KEY is the fallback (the
   domain is already authenticated there). With neither set, nothing is sent
   and every caller carries on. */
const BREVO_KEY = process.env.BREVO_API_KEY || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL || 'hello@staymylo.com';
const FROM_NAME = 'Mylo';

export const mailReady = Boolean(BREVO_KEY || RESEND_KEY);

type Mail = { to: string; subject: string; text: string; html?: string; unsubscribe?: boolean };

/* True when the provider accepted it. A failure is logged, never thrown: the
   thing the email is about has already happened. */
export async function sendMail({ to, subject, text, html, unsubscribe }: Mail): Promise<boolean> {
  const listUnsubscribe = { 'List-Unsubscribe': `<mailto:${FROM_EMAIL}?subject=Unsubscribe>` };
  try {
    const res = RESEND_KEY
      ? await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, text, ...(html ? { html } : {}),
            ...(unsubscribe ? { headers: listUnsubscribe } : {})
          })
        })
      : BREVO_KEY
        ? await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json', 'api-key': BREVO_KEY },
            body: JSON.stringify({
              sender: { name: FROM_NAME, email: FROM_EMAIL },
              to: [{ email: to }],
              subject, textContent: text, ...(html ? { htmlContent: html } : {}),
              ...(unsubscribe ? { headers: listUnsubscribe } : {})
            })
          })
        : null;
    if (!res) return false;
    if (!res.ok) console.error('mail failed', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    console.error('mail error', err);
    return false;
  }
}
