const nodemailer = require("nodemailer");

const RESEND_API_URL = "https://api.resend.com/emails";

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw createError(500, `${name} environment variable is not configured`);
  }

  return value;
}

function getSmtpPort() {
  const parsed = Number.parseInt(process.env.SMTP_PORT ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 587;
}

function getTimeoutEnv(name, fallbackMs) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function shouldUseResend() {
  const provider = process.env.MAIL_PROVIDER?.trim().toLowerCase();
  return provider === "resend" || Boolean(process.env.RESEND_API_KEY?.trim());
}

function getSecureFlag(port) {
  if (process.env.SMTP_SECURE !== undefined) {
    return process.env.SMTP_SECURE === "true";
  }

  return port === 465;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createTransporter() {
  const host = getRequiredEnv("SMTP_HOST");
  const port = getSmtpPort();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure: getSecureFlag(port),
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: getTimeoutEnv("SMTP_CONNECTION_TIMEOUT_MS", 15000),
    greetingTimeout: getTimeoutEnv("SMTP_GREETING_TIMEOUT_MS", 10000),
    socketTimeout: getTimeoutEnv("SMTP_SOCKET_TIMEOUT_MS", 20000),
  });
}

function getResetMailText(name, resetUrl, expiresMinutes) {
  return [
    `Hi ${name},`,
    "",
    "We received a request to reset your MakerSpace reservation account password.",
    `Open this link within ${expiresMinutes} minutes to set a new password:`,
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
}

function getResetMailHtml(name, resetUrl, expiresMinutes) {
  const escapedName = escapeHtml(name);
  const escapedResetUrl = escapeHtml(resetUrl);

  return `
    <p>Hi ${escapedName},</p>
    <p>We received a request to reset your MakerSpace reservation account password.</p>
    <p>
      <a href="${escapedResetUrl}" target="_blank" rel="noreferrer">
        Reset your password
      </a>
    </p>
    <p>This link expires in ${expiresMinutes} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  if (typeof fetch !== "function") {
    throw createError(500, "Fetch API is not available in this Node.js runtime");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw createError(504, "Email provider request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readResendError(response) {
  const text = await response.text();
  if (!text) {
    return `Resend email API failed with status ${response.status}`;
  }

  try {
    const payload = JSON.parse(text);
    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (payload.error && typeof payload.error === "string") {
      return payload.error;
    }
  } catch (_error) {
    return text;
  }

  return `Resend email API failed with status ${response.status}`;
}

async function sendWithResend({ to, subject, text, html }) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("EMAIL_FROM");
  const response = await fetchWithTimeout(
    RESEND_API_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
    },
    getTimeoutEnv("EMAIL_API_TIMEOUT_MS", 15000)
  );

  if (!response.ok) {
    throw createError(response.status >= 500 ? 502 : 400, await readResendError(response));
  }
}

async function sendWithSmtp({ to, subject, text, html }) {
  const transporter = createTransporter();
  const from = getRequiredEnv("EMAIL_FROM");

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

exports.assertMailConfigured = () => {
  if (shouldUseResend()) {
    getRequiredEnv("RESEND_API_KEY");
  } else {
    getRequiredEnv("SMTP_HOST");
  }

  getRequiredEnv("EMAIL_FROM");
};

exports.sendPasswordResetEmail = async ({ to, name, resetUrl, expiresMinutes }) => {
  const subject = "Reset your MakerSpace password";
  const text = getResetMailText(name, resetUrl, expiresMinutes);
  const html = getResetMailHtml(name, resetUrl, expiresMinutes);

  const payload = {
    to,
    subject,
    text,
    html,
  };

  if (shouldUseResend()) {
    await sendWithResend(payload);
    return;
  }

  await sendWithSmtp(payload);
};
