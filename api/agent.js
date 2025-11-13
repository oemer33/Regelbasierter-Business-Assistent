// =======================================
//  api/agent.js – robuste, einfache Logik
//  - Begrüßung funktioniert immer
//  - FAQs funktionieren immer
//  - Termin-Daten werden gesammelt
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

    const hasSlots =
      currentState.slots && typeof currentState.slots === "object";
    const appointmentComplete = hasSlots && currentState.complete;

    const greeting = greetingIfHallo(msg);
    const faqAnswer = matchFaq(msg);
    const slotLike = looksLikeSlotUpdate(msg);
    const intent = intentFromText(msg); // "appointment" oder "fallback"

    // =======================================
    // 1) Termin ist schon vollständig
    // =======================================
    if (appointmentComplete) {
      // a) JA → Termin automatisch senden
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
      if (faqAnswer) {
        return res.status(200).json({
          reply: faqAnswer,
          state: currentState,
          intent: "faq"
        });
      }

      // d) Begrüßung funktioniert trotzdem
      if (greeting) {
        return res.status(200).json({
          reply: greeting,
          state: currentState,
          intent: "greeting"
        });
      }

      // e) Erinnerung auf Ja/Nein
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

    // a) Wenn Nachricht wie Termin-Daten aussieht
    //    oder explizit "Termin" erwähnt
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

    // b) Falls KEIN Termin-Kontext → erst Begrüßung/FAQ prüfen

    // Begrüßung (wenn noch kein Termin läuft)
    if (greeting && !hasSlots) {
      return res.status(200).json({
        reply: greeting,
        state: currentState,
        intent: "greeting"
      });
    }

    // FAQ (Preise, Öffnungszeiten, Adresse, Zahlung, Kontakt)
    if (faqAnswer && !hasSlots) {
      return res.status(200).json({
        reply: faqAnswer,
        state: currentState,
        intent: "faq"
      });
    }

    // c) Wenn Termin schon angefangen wurde (hasSlots),
    //    aber Nachricht KEINE neuen Daten enthält und kein FAQ/Begrüßung ist:
    if (hasSlots) {
      const { slots, complete, nextPrompt } = collectAppointmentSlots(
        "",
        currentState.slots
      );
      return res.status(200).json({
        reply: nextPrompt,
        state: { slots, complete },
        intent: "appointment"
      });
    }

    // d) Kein Termin, keine Begrüßung, keine FAQ → allgemeine Antwort
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

