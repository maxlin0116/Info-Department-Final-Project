const nodemailer = require("nodemailer");

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

exports.assertMailConfigured = () => {
  getRequiredEnv("SMTP_HOST");
  getRequiredEnv("EMAIL_FROM");
};

exports.sendPasswordResetEmail = async ({ to, name, resetUrl, expiresMinutes }) => {
  const transporter = createTransporter();
  const from = getRequiredEnv("EMAIL_FROM");

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your MakerSpace password",
    text: getResetMailText(name, resetUrl, expiresMinutes),
    html: getResetMailHtml(name, resetUrl, expiresMinutes),
  });
};
