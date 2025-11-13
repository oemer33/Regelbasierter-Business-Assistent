// =======================================
//  api/agent.js – einfache, robuste Logik
//  - FAQs funktionieren immer
//  - Begrüßung funktioniert immer
//  - Termin-Daten werden gesammelt
//  - Ja/Nein bestätigt oder bricht ab
// =======================================

const {
  intentFromText,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  collectAppointmentSlots
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
    const msg = (message || "").toString();
    let currentState = state || {};
    const hasSlots =
      currentState.slots && typeof currentState.slots === "object";
    const appointmentComplete = hasSlots && currentState.complete;

    // 1) Termin ist schon komplett → auf JA / NEIN warten
    if (appointmentComplete) {
      // a) JA → auto_send
      if (isYes(msg)) {
        return res.status(200).json({
          reply: "Alles klar, ich sende den Termin jetzt an unser Team.",
          auto_send: true,
          state: currentState,
          intent: "appointment_confirm_yes"
        });
      }

      // b) NEIN → Termin verwerfen
      if (isNo(msg)) {
        return res.status(200).json({
          reply:
            "Alles klar, ich sende den Termin nicht. Wenn du einen neuen Termin möchtest, sag mir einfach Bescheid.",
          state: {},
          intent: "appointment_confirm_no"
        });
      }

      // c) FAQ funktioniert trotzdem
      const faqAnswer = matchFaq(msg);
      if (faqAnswer) {
        return res.status(200).json({
          reply: faqAnswer,
          state: currentState,
          intent: "faq"
        });
      }

      // d) Begrüßung funktioniert trotzdem
      const greeting = greetingIfHallo(msg);
      if (greeting) {
        return res.status(200).json({
          reply: greeting,
          state: currentState,
          intent: "greeting"
        });
      }

      // e) Erinnerung, dass wir auf JA/NEIN warten
      return res.status(200).json({
        reply: "Sag 'ja', wenn ich den Termin senden soll, oder 'nein', um abzubrechen.",
        state: currentState,
        intent: "appointment_wait_confirm"
      });
    }

    // 2) Termin ist noch NICHT komplett

    // a) Begrüßung (immer möglich)
    const greeting = greetingIfHallo(msg);
    if (greeting && !hasSlots && !intentFromText(msg) === "appointment") {
      return res.status(200).json({
        reply: greeting,
        state: currentState,
        intent: "greeting"
      });
    }

    // b) FAQ (Preise, Öffnungszeiten, Adresse, Zahlung, Kontakt)
    const faqAnswer = matchFaq(msg);
    if (faqAnswer && !intentFromText(msg) === "appointment" && !hasSlots) {
      return res.status(200).json({
        reply: faqAnswer,
        state: currentState,
        intent: "faq"
      });
    }

    // c) Wenn Nachricht Termin erwähnt ODER wir schon Slots haben → Slots sammeln
    const intent = intentFromText(msg); // "appointment" oder "fallback"
    if (intent === "appointment" || hasSlots) {
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

    // d) Wenn jetzt noch kein Termin, keine FAQ, keine Begrüßung → allgemeine Antwort
    if (faqAnswer) {
      // (falls oben wegen intent nicht gegriffen hat)
      return res.status(200).json({
        reply: faqAnswer,
        state: currentState,
        intent: "faq"
      });
    }

    if (greeting) {
      return res.status(200).json({
        reply: greeting,
        state: currentState,
        intent: "greeting"
      });
    }

    // e) Fallback
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
