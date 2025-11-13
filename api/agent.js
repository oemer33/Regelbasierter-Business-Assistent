// =======================================
//  api/agent.js – FAQ + Termin clever
// =======================================

const {
  intentFromText,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  collectAppointmentSlots,
  looksLikeSlotUpdate
} = require("../src/agent");

// Ja/Nein Erkennung für Terminbestätigung
function isYes(msg) {
  const t = msg.toLowerCase().trim();
  const words = [
    "ja",
    "ja bitte",
    "okay",
    "ok",
    "mach das",
    "passt",
    "in ordnung",
    "alles klar"
  ];
  return words.some(
    (w) => t === w || t.startsWith(w + " ") || t.endsWith(" " + w)
  );
}

function isNo(msg) {
  const t = msg.toLowerCase().trim();
  const words = [
    "nein",
    "nee",
    "lieber nicht",
    "nicht senden",
    "abbrechen",
    "stopp"
  ];
  return words.some(
    (w) => t === w || t.startsWith(w + " ") || t.endsWith(" " + w)
  );
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { message, state } = req.body || {};
    const msg = message || "";
    const currentState = state || {};
    const hasSlots = currentState.slots && typeof currentState.slots === "object";
    const appointmentComplete = hasSlots && currentState.complete;

    // 1) Begrüßung (immer möglich)
    const greeting = greetingIfHallo(msg);
    if (greeting && !hasSlots) {
      return res.status(200).json({
        reply: greeting,
        state: currentState,
        intent: "greeting"
      });
    }

    // 2) Wenn Termin vollständig: auf JA/NEIN warten
    if (appointmentComplete) {
      if (isYes(msg)) {
        return res.status(200).json({
          reply: "Alles klar, ich sende den Termin jetzt an unser Team.",
          auto_send: true,
          state: currentState
        });
      }
      if (isNo(msg)) {
        return res.status(200).json({
          reply:
            "Alles klar, ich sende den Termin nicht. Wenn du etwas anderes brauchst, sag einfach Bescheid!",
          state: {}
        });
      }
      // weder Ja noch Nein → Erinnerung
      return res.status(200).json({
        reply: "Sag 'ja', wenn ich den Termin senden soll, oder 'nein', um abzubrechen.",
        state: currentState
      });
    }

    // 3) Prüfen, ob Nachricht wie Termin-Detail aussieht
    const slotLike = looksLikeSlotUpdate(msg);
    const intent = intentFromText(msg); // erkennt nur 'appointment' / 'fallback'

    if (intent === "appointment" || slotLike || hasSlots) {
      // Termin-Slots aktualisieren
      const prevSlots = currentState.slots || {};
      const { slots, complete, nextPrompt } = collectAppointmentSlots(
        msg,
        prevSlots
      );

      return res.status(200).json({
        reply: nextPrompt,
        state: { slots, complete },
        intent: "appointment"
      });
    }

    // 4) FAQ – nur wenn es NICHT wie Slot-Update aussieht
    const faq = matchFaq(msg);
    if (faq) {
      return res.status(200).json({
        reply: faq,
        state: currentState,
        intent: "faq"
      });
    }

    // 5) Fallback
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
