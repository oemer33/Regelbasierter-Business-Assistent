// ===============================
//   api/agent.js (1:1 Ersatz)
// ===============================

const {
  intentFromText,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  collectAppointmentSlots
} = require("../src/agent");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { message, state } = req.body || {};
    if (!message) {
      res.status(400).json({ error: "message fehlt" });
      return;
    }

    const intent = intentFromText(message);

    // 1) Begrüßung
    if (intent === "greeting") {
      const g = greetingIfHallo(message);
      return res.status(200).json({
        reply: g,
        intent: "greeting",
        state
      });
    }

    // 2) FAQ
    if (intent === "faq") {
      const answer = matchFaq(message);
      return res.status(200).json({
        reply: answer,
        intent,
        state
      });
    }

    // 3) Termin
    if (intent === "appointment") {
      const { slots, complete, nextPrompt } = collectAppointmentSlots(
        message,
        state?.slots
      );

      return res.status(200).json({
        reply: nextPrompt,
        intent,
        state: { slots, complete }
      });
    }

    // 4) fallback
    return res.status(200).json({
      reply: answerGeneral(message),
      intent,
      state
    });

  } catch (err) {
    res.status(500).json({
      reply: "Da ist ein Fehler passiert.",
      error: err.message
    });
  }
};
