const nodemailer = require("nodemailer");
const crypto = require("crypto");

const RESEND_API_URL = "https://api.resend.com/emails";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

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

function getMailProvider() {
  const provider = process.env.MAIL_PROVIDER?.trim().toLowerCase();
  if (provider === "gmail" || provider === "gmail-api") {
    return "gmail_api";
  }

  if (provider) {
    return provider;
  }

  if (process.env.GMAIL_REFRESH_TOKEN?.trim()) {
    return "gmail_api";
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    return "resend";
  }

  return "smtp";
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

function sanitizeHeader(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value) {
  const sanitized = sanitizeHeader(value);
  return /^[\x00-\x7F]*$/.test(sanitized)
    ? sanitized
    : `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`;
}

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeMimeBody(value) {
  return String(value ?? "").replace(/\r?\n/g, "\r\n");
}

function createBoundary() {
  if (typeof crypto.randomUUID === "function") {
    return `mks-${crypto.randomUUID()}`;
  }

  return `mks-${crypto.randomBytes(16).toString("hex")}`;
}

function createMimeMessage({ from, to, subject, text, html }) {
  const boundary = createBoundary();

  return [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeMimeBody(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeMimeBody(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
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

async function readApiError(response, fallback) {
  const text = await response.text();
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text);
    if (payload.error && typeof payload.error.message === "string") {
      return payload.error.message;
    }

    if (typeof payload.error_description === "string") {
      return payload.error_description;
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }

    if (typeof payload.message === "string") {
      return payload.message;
    }
  } catch (_error) {
    return text;
  }

  return fallback;
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

async function getGmailAccessToken() {
  const params = new URLSearchParams({
    client_id: getRequiredEnv("GMAIL_CLIENT_ID"),
    client_secret: getRequiredEnv("GMAIL_CLIENT_SECRET"),
    refresh_token: getRequiredEnv("GMAIL_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });

  const response = await fetchWithTimeout(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
    getTimeoutEnv("EMAIL_API_TIMEOUT_MS", 15000)
  );

  if (!response.ok) {
    throw createError(
      response.status >= 500 ? 502 : 400,
      await readApiError(response, `Google OAuth token request failed with status ${response.status}`)
    );
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw createError(502, "Google OAuth token response did not include an access token");
  }

  return payload.access_token;
}

function getGmailFromHeader() {
  return process.env.EMAIL_FROM?.trim() || getRequiredEnv("GMAIL_SENDER_EMAIL");
}

async function sendWithGmailApi({ to, subject, text, html }) {
  const accessToken = await getGmailAccessToken();
  const raw = encodeBase64Url(
    createMimeMessage({
      from: getGmailFromHeader(),
      to,
      subject,
      text,
      html,
    })
  );

  const response = await fetchWithTimeout(
    GMAIL_SEND_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
    getTimeoutEnv("EMAIL_API_TIMEOUT_MS", 15000)
  );

  if (!response.ok) {
    throw createError(
      response.status >= 500 ? 502 : 400,
      await readApiError(response, `Gmail API send request failed with status ${response.status}`)
    );
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
  const provider = getMailProvider();

  if (provider === "resend") {
    getRequiredEnv("RESEND_API_KEY");
    getRequiredEnv("EMAIL_FROM");
    return;
  }

  if (provider === "gmail_api") {
    getRequiredEnv("GMAIL_CLIENT_ID");
    getRequiredEnv("GMAIL_CLIENT_SECRET");
    getRequiredEnv("GMAIL_REFRESH_TOKEN");
    getRequiredEnv("GMAIL_SENDER_EMAIL");
    return;
  }

  if (provider === "smtp") {
    getRequiredEnv("SMTP_HOST");
    getRequiredEnv("EMAIL_FROM");
    return;
  }

  throw createError(500, `Unsupported MAIL_PROVIDER: ${provider}`);
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

  const provider = getMailProvider();

  if (provider === "resend") {
    await sendWithResend(payload);
    return;
  }

  if (provider === "gmail_api") {
    await sendWithGmailApi(payload);
    return;
  }

  if (provider === "smtp") {
    await sendWithSmtp(payload);
    return;
  }

  throw createError(500, `Unsupported MAIL_PROVIDER: ${provider}`);
};
