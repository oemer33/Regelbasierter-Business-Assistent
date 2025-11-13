const {
  intentFromText,
  matchFaq,
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

    if (intent === "faq") {
      const answer = matchFaq(message);
      return res.status(200).json({
        reply: answer,
        intent,
        state
      });
    }

    if (intent === "appointment") {
      const { slots, complete, nextPrompt } =
        collectAppointmentSlots(message, state?.slots);

      return res.status(200).json({
        reply: nextPrompt,
        intent,
        state: { slots, complete }
      });
    }

    // Fallback
    return res.status(200).json({
      reply: answerGeneral(message),
      intent,
      state
    });

  } catch (err) {
    res.status(500).json({
      reply: "Entschuldigung, da ist ein Fehler passiert.",
      error: err.message
    });
  }
};

