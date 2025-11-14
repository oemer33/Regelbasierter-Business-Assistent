// =======================================
// api/feedback.js
// - Feedback vom Formular per E-Mail an Team senden
// =======================================

const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const { email, text } = req.body || {};
    if (!text) {
      res.status(400).json({ ok: false, error: "Leeres Feedback" });
      return;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
      String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromAddress =
      process.env.FROM_ADDRESS || process.env.SMTP_USER || email || user;
    const teamInbox =
      process.env.TEAM_INBOX || process.env.FROM_ADDRESS || process.env.SMTP_USER;

    if (!host || !user || !pass || !teamInbox) {
      res.status(500).json({
        ok: false,
        error: "E-Mail Versand fehlgeschlagen",
        detail: "SMTP-Konfiguration unvollständig."
      });
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      }
    });

    const subject = "Neues Feedback aus dem Salon-Assistenten";
    const lines = [
      "Ein Kunde hat folgendes Feedback hinterlassen:",
      "",
      text,
      "",
      `Absender-E-Mail (falls angegeben): ${email || "-"}`
    ];

    await transporter.sendMail({
      from: fromAddress,
      to: teamInbox,
      subject,
      text: lines.join("\n")
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({
      ok: false,
      error: "E-Mail Versand fehlgeschlagen",
      detail: err.message
    });
  }
};
