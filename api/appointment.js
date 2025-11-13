// ===============================
//   api/appointment.js (1:1 Ersatz)
// ===============================

const { validateAppointment } = require("../src/validate");
const { saveAppointment } = require("../src/agent");
const { makeTransport, sendAppointmentMail } = require("../src/email");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Frontend schickt: name, datetime, optional notes
    const { name, datetime, notes } = req.body || {};
    const payload = { name, datetime, notes };

    // Nur Name + datetime prüfen
    const val = validateAppointment(payload);
    if (!val.ok) {
      return res.status(400).json({ error: val.reason });
    }

    // Versuchen, lokal zu speichern (funktioniert lokal, auf Vercel ggf. nur temporär)
    saveAppointment(payload);

    // E-Mail versenden
    const transport = makeTransport(process.env);
    await sendAppointmentMail(transport, process.env, payload);

    return res.json({
      ok: true,
      message: "Der Termin wurde an das Team gesendet!"
    });

  } catch (e) {
    console.error("Fehler beim Versenden der E-Mail:", e);
    return res.status(500).json({
      error: "E-Mail Versand fehlgeschlagen",
      detail: e.message
    });
  }
};
