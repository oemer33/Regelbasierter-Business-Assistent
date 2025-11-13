// =======================================
//  api/agent.js – FIX: Termin + FAQ + Hallo
// =======================================

const {
  intentFromText,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  collectAppointmentSlots,
  looksLikeSlotUpdate
} = require("../src/agent");

// Ja/Nein-Erkennung für Terminbestätigung
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

    let currentState = state || {};
    const hasSlots =
      currentState.slots && typeof currentState.slots === "object";
    const appointmentComplete = hasSlots && currentState.complete;

    const greeting = greetingIfHallo(msg);
    const faq = matchFaq(msg);
    const slotLike = looksLikeSlotUpdate(msg);
    const intent = intentFromText(msg); // erkennt nur "appointment" oder "fallback"

    // ===================================================
    // 1) Wenn Termin vollständig → auf JA / NEIN warten
    // ===================================================
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

      // FAQ trotzdem erlauben, auch wenn Termin voll ist
      if (faq) {
        return res.status(200).json({
          reply: faq,
          state: currentState,
          intent: "faq"
        });
      }

      // Begrüßung auch erlauben
      if (greeting) {
        return res.status(200).json({
          reply: greeting,
          state: currentState,
          intent: "greeting"
        });
      }

      // Sonst Erinnerung, dass wir auf Ja/Nein warten
      return res.status(200).json({
        reply: "Sag 'ja', wenn ich den Termin senden soll, oder 'nein', um abzubrechen.",
        state: currentState,
        intent: "appointment_wait_confirm"
      });
    }

    // ===================================================
    // 2) Noch kein kompletter Termin
    //    → zuerst prüfen: sieht Nachricht nach Termin-Details aus?
    // ===================================================

    // a) Terminstart oder Update (Datum, Uhrzeit, Name, Kontakt etc.)
    if (intent === "appointment" || slotLike || hasSlots) {
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

    // b) FAQ (Preise, Öffnungszeiten, Adresse, Zahlung, Kontakt ...)
    if (faq) {
      return res.status(200).json({
        reply: faq,
        state: currentState,
        intent: "faq"
      });
    }

    // c) Begrüßung (wenn kein Termin-Kontext)
    if (greeting) {
      return res.status(200).json({
        reply: greeting,
        state: currentState,
        intent: "greeting"
      });
    }

    // d) Wenn wir schon ein paar Slots haben, aber nichts Termin-ähnliches kommt:
    if (hasSlots && !appointmentComplete) {
      // Keine neuen Infos, aber Termin läuft noch → freundliche Erinnerung
      const { slots, complete, nextPrompt } = collectAppointmentSlots(
        "",
        currentState.slots
      );
      return res.status(200).json({
        reply: nextPrompt,
        state: { slots, complete },
        intent: "appointment_reminder"
      });
    }

    // e) Alles andere → allgemeine Antwort
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
