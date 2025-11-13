const nodemailer = require("nodemailer");

function makeTransport(env) {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE || "false") === "true",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
}

async function sendAppointmentMail(transport, env, appt) {
  const html = `
    <h2>Neue Terminanfrage</h2>
    <p><b>Name:</b> ${appt.name}</p>
    <p><b>Service:</b> ${appt.service}</p>
    <p><b>Wunschzeit:</b> ${appt.datetime}</p>
    <p><b>Kontakt:</b> ${appt.contact}</p>
    <p><b>Anmerkungen:</b> ${appt.notes || "-"}</p>
  `;
  await transport.sendMail({
    from: env.FROM_ADDRESS || env.SMTP_USER,
    to: env.TEAM_INBOX,
    subject: `Terminanfrage: ${appt.name} – ${appt.service} – ${appt.datetime}`,
    html
  });
}

module.exports = { makeTransport, sendAppointmentMail };
