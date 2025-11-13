// ===============================
//   api/agent.js (kompletter Ersatz)
//   - Termin-Kontext + Ja/Nein-Bestätigung
// ===============================

const {
  intentFromText,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  collectAppointmentSlots
} = require("../src/agent");

// einfache Ja/Nein-Erkennung
function isYes(msg) {
  const t = msg.toLowerCase().trim();
  const yesWords = [
    "ja",
    "ja bitte",
    "okay",
    "ok",
    "mach das",
    "alles klar",
    "passt",
    "in ordnung"
  ];
  return yesWords.some(
    (w) => t === w || t.startsWith(w + " ") || t.endsWith(" " + w)
  );
}

function isNo(msg) {
  const t = msg.toLowerCase().trim();
  const noWords = [
    "nein",
    "nee",
    "lieber nicht",
    "abbrechen",
    "nicht senden",
    "stopp"
  ];
  return noWords.some(
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
    if (!message) {
      res.status(400).json({ error: "message fehlt" });
      return;
    }

    const currentState = state || {};
    const hasSlots =
      currentState.slots && typeof currentState.slots === "object";
    const appointmentIncomplete = hasSlots && !currentState.complete;
    const appointmentComplete = hasSlots && currentState.complete;

    let intent = intentFromText(message);

    // 🔁 Wenn eine Terminanfrage schon läuft und noch Infos fehlen:
    // jede neue Nachricht als Termin-Fortsetzung behandeln (außer FAQ)
    if (appointmentIncomplete && intent !== "faq") {
      intent = "appointment";
    }

    // ✅ Termin ist vollständig, warten auf JA/NEIN
    if (appointmentComplete) {
      if (isYes(message)) {
        return res.status(200).json({
          reply: "Alles klar, ich sende den Termin jetzt an unser Team.",
          intent: "appointment_confirm_yes",
          state: currentState,
          auto_send: true
        });
      }
      if (isNo(message)) {
        return res.status(200).json({
          reply:
            "Alles klar, ich sende den Termin nicht. Wenn du einen neuen Termin möchtest, sag mir einfach Bescheid.",
          intent: "appointment_confirm_no",
          state: {} // zurücksetzen
        });
      }
      // wenn weder klar Ja noch Nein: Erinnerung
      intent = "appointment";
    }

    // 1) Begrüßung (nur wenn kein laufender Termin)
    if (intent === "greeting" && !appointmentIncomplete && !appointmentComplete) {
      const g = greetingIfHallo(message);
      return res.status(200).json({
        reply: g,
        intent: "greeting",
        state: currentState
      });
    }

    // 2) FAQ (nur wenn kein laufender Termin)
    if (intent === "faq" && !appointmentIncomplete) {
      const answer = matchFaq(message);
      return res.status(200).json({
        reply: answer,
        intent,
        state: currentState
      });
    }

    // 3) Termin-Erfassung
    if (intent === "appointment") {
      const prevSlots = (currentState && currentState.slots) || {};
      const { slots, complete, nextPrompt } = collectAppointmentSlots(
        message,
        prevSlots
      );

      return res.status(200).json({
        reply: nextPrompt,
        intent: "appointment",
        state: { slots, complete }
      });
    }

    // 4) Fallback
    return res.status(200).json({
      reply: answerGeneral(message),
      intent: "fallback",
      state: currentState
    });
  } catch (err) {
    console.error("Agent-Fehler:", err);
    res.status(500).json({
      reply: "Da ist ein Fehler passiert.",
      error: err.message
    });
  }
};
