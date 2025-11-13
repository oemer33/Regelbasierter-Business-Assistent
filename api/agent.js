// =======================================
//  api/agent.js – INTELLIGENTER MISCHMODUS
// =======================================

const {
  intentFromText,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  collectAppointmentSlots
} = require("../src/agent");

// Ja/Nein Erkennung
function isYes(msg) {
  const t = msg.toLowerCase().trim();
  return ["ja", "ja bitte", "okay", "ok", "mach das", "passt"].includes(t);
}

function isNo(msg) {
  const t = msg.toLowerCase().trim();
  return ["nein", "nee", "lieber nicht", "nicht senden", "abbrechen"].includes(t);
}

module.exports = async (req, res) => {
  try {
    const { message, state } = req.body || {};
    const msg = message || "";
    const lower = msg.toLowerCase();
    let currentState = state || {};
    const hasSlots = currentState.slots && typeof currentState.slots === "object";
    const complete = currentState.complete;

    // ===================================================
    // 1) IMMER zuerst Begrüßung (auch mitten im Termin)
    // ===================================================
    const greeting = greetingIfHallo(msg);
    if (greeting) {
      return res.status(200).json({
        reply: greeting,
        state: currentState,
        intent: "greeting"
      });
    }

    // ===================================================
    // 2) IMMER zuerst FAQs behandeln (auch während Termin)
    // ===================================================
    const faq = matchFaq(msg);
    if (faq) {
      return res.status(200).json({
        reply: faq,
        state: currentState,
        intent: "faq"
      });
    }

    // ===================================================
    // 3) Wenn Termin bereits vollständig → JA/NEIN prüfen
    // ===================================================
    if (hasSlots && complete) {
      if (isYes(msg)) {
        return res.status(200).json({
          reply: "Alles klar, ich sende den Termin jetzt an unser Team.",
          auto_send: true,
          state: currentState
        });
      }

      if (isNo(msg)) {
        return res.status(200).json({
          reply: "Alles klar, ich sende den Termin nicht. Wenn du etwas anderes brauchst, sag einfach Bescheid!",
          state: {}
        });
      }

      // sonst einfach Erinnerung:
      return res.status(200).json({
        reply: "Sag 'ja', wenn ich den Termin senden soll, oder 'nein', um abzubrechen.",
        state: currentState
      });
    }

    // ===================================================
    // 4) Termin-Erkennung (auch mitten in Fragen)
    // ===================================================
    const intent = intentFromText(msg);

    // Wenn er "Termin" erwähnt → direkt Termin-Modus aktivieren
    if (intent === "appointment" || hasSlots) {
      const prev = (currentState.slots || {});
      const { slots, complete, nextPrompt } = collectAppointmentSlots(msg, prev);

      return res.status(200).json({
        reply: nextPrompt,
        state: { slots, complete },
        intent: "appointment"
      });
    }

    // ===================================================
    // 5) Fallback – normale Antwort, inkl. Telefonnummer/Email
    // ===================================================
    return res.status(200).json({
      reply: answerGeneral(msg),
      state: currentState,
      intent: "fallback"
    });

  } catch (err) {
    console.error("Agent error:", err);
    return res.status(500).json({
      reply: "Es ist ein Fehler passiert.",
      error: err.message
    });
  }
};
