// ===============================
//   api/appointment.js (kompletter Ersatz)
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
    const { name, datetime, contact, notes } = req.body || {};
    const payload = { name, datetime, contact, notes };

    const val = validateAppointment(payload);
    if (!val.ok) {
      return res.status(400).json({ error: val.reason });
    }

    // lokal/temporär speichern
    saveAppointment(payload);

    // E-Mail senden
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

