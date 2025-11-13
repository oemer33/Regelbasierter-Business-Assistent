// ===============================
//   src/email.js (kompletter Ersatz)
//   - Schöner deutscher Text
//   - Datum / Uhrzeit formatiert
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

// Datum/Zeit schön als deutsche Strings
function formatDateTime(datetimeStr) {
  try {
    const d = new Date(datetimeStr);
    if (isNaN(d)) {
      // Fallback: einfach original zurückgeben
      return {
        dateStr: datetimeStr,
        timeStr: ""
      };
    }

    const dateFormatter = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const timeFormatter = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const dateStr = dateFormatter.format(d);       // z.B. 24.12.2025
    const timeStr = timeFormatter.format(d) + " Uhr"; // z.B. 13:00 Uhr

    return { dateStr, timeStr };
  } catch (_) {
    return { dateStr: datetimeStr, timeStr: "" };
  }
}

async function sendAppointmentMail(transport, env, appt) {
  const recipient =
    env.TEAM_INBOX ||
    env.SMTP_USER ||
    "otosun750@icloud.com";

  const { dateStr, timeStr } = formatDateTime(appt.datetime || "");

  const kontaktStr = appt.contact || "-";
  const nameStr = appt.name || "Unbekannt";

  // Klarer, menschlicher Text
  const textBody =
    `Ein Kunde hat eine Terminanfrage gemacht.\n\n` +
    `Der Kunde heißt ${nameStr} und möchte am ${dateStr}` +
    (timeStr ? ` um ${timeStr}` : "") +
    ` einen Termin.\n\n` +
    `Kontaktdaten: ${kontaktStr}\n\n` +
    `Notizen: ${appt.notes || "-"}`;

  const htmlBody = `
    <h2>Neue Terminanfrage</h2>
    <p>Ein Kunde hat eine Terminanfrage gemacht.</p>
    <p>Der Kunde heißt <b>${nameStr}</b> und möchte am <b>${dateStr}</b>${
      timeStr ? ` um <b>${timeStr}</b>` : ""
    } einen Termin.</p>
    <p><b>Kontaktdaten:</b> ${kontaktStr}</p>
    <p><b>Notizen:</b> ${appt.notes || "-"}</p>
  `;

  const subjectDatePart = dateStr || appt.datetime || "";
  const subjectTimePart = timeStr || "";

  const info = await transport.sendMail({
    from: env.FROM_ADDRESS || env.SMTP_USER || "otosun750@icloud.com",
    to: recipient,
    subject: `Terminanfrage: ${nameStr} – ${subjectDatePart} ${subjectTimePart}`,
    text: textBody,
    html: htmlBody
  });

  console.log("Mail gesendet, Server-Antwort:", info);
}

module.exports = { makeTransport, sendAppointmentMail };

