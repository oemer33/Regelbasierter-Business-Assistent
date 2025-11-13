const { validateAppointment } = require("../src/validate");
const { saveAppointment } = require("../src/agent");
const { makeTransport, sendAppointmentMail } = require("../src/email");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { name, service, datetime, contact, notes } = req.body || {};
    const payload = { name, service, datetime, contact, notes };
    const val = validateAppointment(payload);
    if (!val.ok) return res.status(400).json({ error: val.reason });

    // Speichern (lokal/ephemer) & E-Mail
    saveAppointment(payload);
    const transport = makeTransport(process.env);
    await sendAppointmentMail(transport, process.env, payload);

    res.json({ ok: true, message: "Anfrage wurde an das Team gesendet. Wir melden uns!" });
  } catch (e) {
    res.status(500).json({ error: "E-Mail Versand fehlgeschlagen", detail: e.message });
  }
};
