const { Resend } = require('resend');

// ─── Resend client ────────────────────────────────────────────────────────────
// Lazily created so missing RESEND_API_KEY doesn't crash the server at boot.
let _client = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

// The FROM address shown to recipients.
// • Without a verified domain → use the Resend sandbox address (works for testing)
// • With a verified domain    → use your own address e.g. noreply@menuqr.in
function fromAddress() {
  return process.env.EMAIL_FROM || 'MenuQR <onboarding@resend.dev>';
}

// ─── Internal send helper ─────────────────────────────────────────────────────
async function send({ to, subject, html, _devLog }) {
  const client = getClient();
  const isDev  = process.env.NODE_ENV !== 'production';

  if (!client) {
    console.warn('\n[mailer] RESEND_API_KEY not set — email not sent.');
    if (_devLog) console.log(`[mailer] Link → ${_devLog}\n`);
    return;
  }

  // ── Dev interceptor ───────────────────────────────────────────────────────
  // Resend blocks sending to any address other than your own account email
  // until you verify a domain. In development we redirect ALL emails to
  // RESEND_TEST_EMAIL so they actually arrive in your inbox for testing.
  let actualTo = to;
  if (isDev && process.env.RESEND_TEST_EMAIL) {
    actualTo = process.env.RESEND_TEST_EMAIL;
    console.log(`[mailer] DEV — redirecting email from <${to}> → <${actualTo}>`);
    if (_devLog) console.log(`[mailer] Link → ${_devLog}`);
  }

  const { error } = await client.emails.send({
    from:    fromAddress(),
    to:      [actualTo],
    subject: isDev && actualTo !== to ? `[DEV → ${to}] ${subject}` : subject,
    html,
  });

  if (error) {
    if (isDev) {
      console.warn(`\n[mailer] Resend error: ${error.message}`);
      if (_devLog) console.log(`[mailer] Link → ${_devLog}\n`);
      return;
    }
    throw new Error(`Email send error: ${error.message}`);
  }
}

// ─── Brand footer ─────────────────────────────────────────────────────────────
const footer = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;
              font-size:12px;color:#aaa;font-family:sans-serif;">
    MenuQR — Digital menus for modern restaurants
  </div>`;

// ─── Email functions ──────────────────────────────────────────────────────────
async function sendVerificationEmail(email, name, token) {
  const link = `${process.env.FRONTEND_URL}/auth?mode=verify&token=${token}`;
  await send({
    to:      email,
    subject: 'Verify your MenuQR account',
    _devLog: `Email verification link → ${link}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#C8622A;margin-bottom:8px;">Welcome to MenuQR, ${name}! 🍽</h2>
        <p style="color:#444;line-height:1.6;">
          Please verify your email address to activate your account.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#C8622A;color:#fff;padding:13px 28px;
                  border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0;">
          Verify Email Address
        </a>
        <p style="color:#aaa;font-size:12px;">
          Or copy this link:<br/>
          <span style="color:#C8622A;">${link}</span><br/>
          Expires in 24 hours.
        </p>
        ${footer}
      </div>`,
  });
}

async function sendWelcomeEmail(email, name, menuUrl) {
  await send({
    to:      email,
    subject: 'Your digital menu is live! 🎉',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#C8622A;margin-bottom:8px;">Your menu is live, ${name}! 🎉</h2>
        <p style="color:#444;line-height:1.6;">
          Your digital menu is created and ready to share with customers.
        </p>
        <a href="${menuUrl}"
           style="display:inline-block;background:#C8622A;color:#fff;padding:13px 28px;
                  border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0;">
          View Your Menu
        </a>
        <p style="color:#444;font-size:13px;line-height:1.8;">
          <strong>Next steps:</strong><br/>
          1. Open the Editor and add your items<br/>
          2. Download the QR code from the Editor<br/>
          3. Print it and place it on your tables<br/>
          4. Customers scan → menu opens instantly on their phone
        </p>
        ${footer}
      </div>`,
  });
}

async function sendPasswordResetEmail(email, token) {
  const link = `${process.env.FRONTEND_URL}/auth?mode=reset&token=${token}`;
  await send({
    to:      email,
    subject: 'Reset your MenuQR password',
    _devLog: `Password reset link → ${link}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#C8622A;margin-bottom:8px;">Reset your password</h2>
        <p style="color:#444;line-height:1.6;">
          We received a request to reset the password for your MenuQR account.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#C8622A;color:#fff;padding:13px 28px;
                  border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0;">
          Reset Password
        </a>
        <p style="color:#aaa;font-size:12px;">
          Expires in 1 hour. If you didn't request this, ignore this email.
        </p>
        ${footer}
      </div>`,
  });
}

module.exports = { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail };
