// =======================================
// api/appointment.js
// - Nimmt Termindaten entgegen
// - Verschickt E-Mail direkt mit nodemailer
// - KEIN saveAppointment mehr (Fehlerquelle entfernt)
// =======================================

const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const { name, datetime, contact, notes } = req.body || {};

    // Simple Validierung
    if (!name || !datetime || !contact) {
      res.status(400).json({
        ok: false,
        error: "Ungültige oder unvollständige Termindaten",
        detail:
          "Es werden Name, Datum/Uhrzeit (datetime) und Kontakt benötigt."
      });
      return;
    }

    // SMTP-Umgebungsvariablen laden
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
      String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromAddress =
      process.env.FROM_ADDRESS || process.env.SMTP_USER || contact;
    const teamInbox =
      process.env.TEAM_INBOX || process.env.FROM_ADDRESS || process.env.SMTP_USER;

    if (!host || !user || !pass || !teamInbox) {
      res.status(500).json({
        ok: false,
        error: "E-Mail Versand fehlgeschlagen",
        detail:
          "SMTP-Konfiguration unvollständig (HOST/USER/PASS/TEAM_INBOX/FROM_ADDRESS)."
      });
      return;
    }

    // Transporter einrichten
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      }
    });

    // E-Mail-Inhalt
    const subject = "Neue Terminanfrage aus dem Salon-Assistenten";
    const textLines = [
      "Es ist eine neue Terminanfrage eingegangen:",
      "",
      `Name: ${name}`,
      `Wunschtermin: ${datetime}`,
      `Kontakt: ${contact}`,
      "",
      `Notizen: ${notes || "-"}`,
      "",
      "Bitte meldet euch beim Kunden, um den Termin zu bestätigen, zu verschieben oder abzusagen."
    ];

    const mailOptions = {
      from: fromAddress,
      to: teamInbox,
      subject,
      text: textLines.join("\n")
    };

    // E-Mail senden
    await transporter.sendMail(mailOptions);

    // Erfolgsantwort an Frontend
    res.status(200).json({
      ok: true,
      message:
        "Der Termin wurde an das Team gesendet! Wenn der Termin abgesagt oder verschoben wird, melden wir uns bei Ihnen."
    });
  } catch (err) {
    console.error("Appointment error:", err);
    res.status(500).json({
      ok: false,
      error: "E-Mail Versand fehlgeschlagen",
      detail: err.message
    });
  }
};
