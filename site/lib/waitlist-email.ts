/* ──────────────────────────────────────────────────────────────────────────
   "Email · Waitlist confirmation" (Figma 1108:641), as an email client
   wants it: tables, inline styles, 600 wide, light only. 24 of page on each
   side of a 560 white card, radius 24, padding 40, rows 24 apart.

   Figtree is named first for the clients that can load it; everything else
   falls back to the system sans. Images are absolute, served by the site.
   ────────────────────────────────────────────────────────────────────────── */

const SITE = 'https://www.staymylo.com';
const FONT = "Figtree, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const EMAIL_SUBJECT = 'You are on the list.';

export function referralLink(code: string) {
  return `${SITE}/?ref=${encodeURIComponent(code)}`;
}

export function waitlistEmailHtml(code: string) {
  const link = referralLink(code);
  const shown = link.replace(/^https:\/\//, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${EMAIL_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F5F7;">
<tr><td align="center" style="padding:48px 24px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#FFFFFF;border-radius:24px;">
  <tr><td style="padding:40px;font-family:${FONT};">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;"><img src="${SITE}/email/mylo-logo.png" width="27" height="32" alt="" style="display:block;border:0;"></td>
      <td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:22px;font-weight:600;line-height:33px;color:#0F0F12;">mylo</td>
    </tr></table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr>
      <td width="160" height="160" align="center" valign="middle" style="width:160px;height:160px;background:#F5F5F7;border-radius:80px;">
        <img src="${SITE}/email/mylo-hero.png" width="100" height="120" alt="Mylo" style="display:block;border:0;margin:0 auto;">
      </td>
    </tr></table>

    <h1 style="margin:24px 0 0;font-family:${FONT};font-size:34px;font-weight:600;line-height:39px;color:#0F0F12;">You are on the list.</h1>
    <p style="margin:24px 0 0;font-family:${FONT};font-size:17px;font-weight:500;line-height:26px;color:#4A4A52;">Thanks for joining the Mylo waitlist. Testers get the app first, then everyone else in the order they joined. We will email you once, when it is your turn.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:#F5F5F7;border-radius:16px;">
    <tr><td style="padding:20px;font-family:${FONT};">
      <p style="margin:0;font-size:17px;font-weight:600;line-height:26px;color:#0F0F12;">Bring your people</p>
      <p style="margin:10px 0 0;font-size:15px;font-weight:500;line-height:23px;color:#6B6B73;">Mylo is better with the people who keep you going. Share your link and you move up the list.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>
        <td style="padding:12px 16px;background:#FFFFFF;border-radius:12px;font-family:${FONT};font-size:15px;font-weight:500;line-height:23px;color:#0F0F12;">${shown}</td>
      </tr></table>
    </td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr>
      <td style="background:#0F0F12;border-radius:999px;">
        <a href="${link}" style="display:inline-block;padding:14px 25px;font-family:${FONT};font-size:17px;font-weight:500;line-height:26px;color:#FFFFFF;text-decoration:none;">Share your link</a>
      </td>
    </tr></table>

  </td></tr>
  </table>
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;">
  <tr><td align="center" style="padding-top:24px;font-family:${FONT};font-size:13px;font-weight:500;line-height:20px;color:#A3A3AB;">You got this email because you joined the waitlist at staymylo.com.</td></tr>
  <tr><td align="center" style="padding-top:6px;font-family:${FONT};font-size:13px;font-weight:500;line-height:20px;color:#6B6B73;">
    <a href="mailto:hello@staymylo.com?subject=Unsubscribe" style="color:#6B6B73;text-decoration:none;">Unsubscribe</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${SITE}/privacy" style="color:#6B6B73;text-decoration:none;">Privacy</a>&nbsp;&nbsp;·&nbsp;&nbsp;Made by Wintech Studio
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function waitlistEmailText(code: string) {
  return [
    'You are on the list.',
    '',
    'Thanks for joining the Mylo waitlist. Testers get the app first, then everyone else in the order they joined. We will email you once, when it is your turn.',
    '',
    'Bring your people',
    'Mylo is better with the people who keep you going. Share your link and you move up the list.',
    referralLink(code),
    '',
    'You got this email because you joined the waitlist at staymylo.com.',
    'Unsubscribe: reply to hello@staymylo.com'
  ].join('\n');
}
