// ===============================
//   src/email.js (fester Empfänger + Logging)
// ===============================
const nodemailer = require("nodemailer");

function makeTransport(env) {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE || "false") === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

async function sendAppointmentMail(transport, env, appt) {
  // Empfänger: erst TEAM_INBOX, sonst SMTP_USER, sonst feste Adresse
  const recipient =
    env.TEAM_INBOX ||
    env.SMTP_USER ||
    "otosun750@icloud.com";

  const textBody =
    `Neue Terminanfrage:\n` +
    `Name: ${appt.name}\n` +
    `Wunschzeit: ${appt.datetime}\n` +
    `Notizen: ${appt.notes || "-"}`;

  const htmlBody = `
    <h2>Neue Terminanfrage</h2>
    <p><b>Name:</b> ${appt.name}</p>
    <p><b>Wunschzeit:</b> ${appt.datetime}</p>
    <p><b>Notizen:</b> ${appt.notes || "-"}</p>
  `;

  const info = await transport.sendMail({
    from: env.FROM_ADDRESS || env.SMTP_USER || "otosun750@icloud.com",
    to: recipient,
    subject: `Terminanfrage: ${appt.name} – ${appt.datetime}`,
    text: textBody,
    html: htmlBody
  });

  // In den Vercel-Logs siehst du dann, ob iCloud die Mail akzeptiert hat
  console.log("Mail gesendet, Server-Antwort:", info);
}

module.exports = { makeTransport, sendAppointmentMail };
