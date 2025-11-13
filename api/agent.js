// =======================================
//  api/agent.js – einfache saubere Logik
//  - Begrüßung funktioniert immer
//  - FAQs funktionieren immer
//  - Termin-Daten nur, wenn Text nach Termin aussieht
//  - Ja/Nein bestätigt oder bricht ab
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
    const msg = (message || "").toString();
    const currentState = state || {};

    const slots = currentState.slots || {};
    const appointmentComplete = !!currentState.complete;

    const greeting = greetingIfHallo(msg);
    const faqAnswer = matchFaq(msg);
    const slotLike = looksLikeSlotUpdate(msg);
    const intent = intentFromText(msg); // "appointment" oder "fallback"

    // =======================================
    // 1) Termin ist schon vollständig → JA/NEIN
    // =======================================
    if (appointmentComplete) {
      if (isYes(msg)) {
        return res.status(200).json({
          reply: "Alles klar, ich sende den Termin jetzt an unser Team.",
          auto_send: true,
          state: currentState,
          intent: "appointment_confirm_yes"
        });
      }

      if (isNo(msg)) {
        return res.status(200).json({
          reply:
            "Alles klar, ich sende den Termin nicht. Wenn du einen neuen Termin möchtest, sag mir einfach Bescheid.",
          state: {},
          intent: "appointment_confirm_no"
        });
      }

      // FAQ trotzdem erlauben
      if (faqAnswer) {
        return res.status(200).json({
          reply: faqAnswer,
          state: currentState,
          intent: "faq"
        });
      }

      // Begrüßung trotzdem erlauben
      if (greeting) {
        return res.status(200).json({
          reply: greeting,
          state: currentState,
          intent: "greeting"
        });
      }

      // sonst Erinnerung
      return res.status(200).json({
        reply:
          "Sag 'ja', wenn ich den Termin senden soll, oder 'nein', um abzubrechen.",
        state: currentState,
        intent: "appointment_wait_confirm"
      });
    }

    // =======================================
    // 2) Termin ist NOCH NICHT vollständig
    // =======================================

    // a) Begrüßung (immer möglich, wenn wir noch nicht mitten in Details sind)
    if (greeting && !slotLike && intent !== "appointment") {
      return res.status(200).json({
        reply: greeting,
        state: currentState,
        intent: "greeting"
      });
    }

    // b) FAQ (Preise, Öffnungszeiten, Adresse, etc.), nur wenn
    //    die Nachricht NICHT wie Termin-Daten aussieht
    if (faqAnswer && !slotLike && intent !== "appointment") {
      return res.status(200).json({
        reply: faqAnswer,
        state: currentState,
        intent: "faq"
      });
    }

    // c) Termin-Slots sammeln
    //    - wenn explizit "Termin" erwähnt wurde
    //    - oder wenn die Nachricht wie Termin-Details aussieht
    if (intent === "appointment" || slotLike) {
      const { slots: newSlots, complete, nextPrompt } =
        collectAppointmentSlots(msg, slots);

      return res.status(200).json({
        reply: nextPrompt,
        state: { slots: newSlots, complete },
        intent: "appointment"
      });
    }

    // d) Kein Termin, kein FAQ, keine Begrüßung → allgemeine Antwort
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
