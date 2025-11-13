const {
  intentFromText,
  matchFaq,
  answerGeneral,
  collectAppointmentSlots
} = require("../src/agent");

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = await parseJsonBody(req);
    const { message, state } = body || {};
    if (!message) return res.status(400).json({ error: "message fehlt" });

    const intent = intentFromText(message);

    if (intent === "faq") {
      const answer = matchFaq(message);
      return res.json({ reply: answer, intent, state });
    }

    if (intent === "appointment") {
      const { slots, complete, nextPrompt } = collectAppointmentSlots(
        message,
        state?.slots
      );
      return res.json({ reply: nextPrompt, intent, state: { slots, complete } });
    }

    return res.json({ reply: answerGeneral(message), intent, state });
  } catch (e) {
    res
      .status(500)
      .json({ reply: "Agent Fehler: " + e.message, intent: "error" });
  }
};
