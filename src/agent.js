// =======================================
// src/agent.js – zufällige Antworten,
// lockere Begrüßung & einfache Termin-Logik
// =======================================

const fs = require("fs");
const path = require("path");

// --------------------------------------------------------
// Zufällige Antwort auswählen
// --------------------------------------------------------
function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

// --------------------------------------------------------
// FAQs laden
// --------------------------------------------------------
function loadFaqs() {
  const p = path.join(process.cwd(), "config", "faqs.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// --------------------------------------------------------
// Lockere Begrüßung mit Emojis & mehreren Varianten
// --------------------------------------------------------
function greetingIfHallo(userText) {
  const lower = userText.toLowerCase().trim();

  const isGreeting =
    lower.startsWith("hallo") ||
    lower.startsWith("hi") ||
    lower.startsWith("hey") ||
    lower.startsWith("guten tag") ||
    lower.startsWith("servus");

  if (!isGreeting) return null;

  const options = [
    "Hallo 👋 Wie kann ich dir helfen?",
    "Hi 😊 Was kann ich für dich tun?",
    "Hey! Wobei darf ich dich unterstützen?",
    "Willkommen im Salon-Chat ✨ Wie kann ich helfen?"
  ];

  return pickRandom(options);
}

// --------------------------------------------------------
// FAQ-Erkennung (mit zufälliger Antwort)
// --------------------------------------------------------
function matchFaq(userText) {
  const text = userText.toLowerCase();
  const faqs = loadFaqs();

  for (const f of faqs) {
    if (!Array.isArray(f.tags)) continue;

    if (f.tags.some((t) => text.includes(t.toLowerCase()))) {
      if (Array.isArray(f.answers) && f.answers.length > 0) {
        return pickRandom(f.answers);
      }
      if (typeof f.answer_template === "string") {
        return f.answer_template;
      }
    }
  }

  return null;
}

// --------------------------------------------------------
// Intent bestimmen (Termin oder nicht)
// --------------------------------------------------------
function intentFromText(text) {
  const t = text.toLowerCase();

  if (
    t.includes("termin") ||
    t.includes("buchen") ||
    t.includes("vereinbaren") ||
    t.includes("appointment")
  ) {
    return "appointment";
  }

  return "fallback";
}

// --------------------------------------------------------
// Prüfen, ob Nachricht wie Termin-Daten aussieht
// (Datum, Uhrzeit, Nummer, Name etc.)
// --------------------------------------------------------
function looksLikeSlotUpdate(text) {
  const t = text.toLowerCase();

  const hasDate = /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(t);
  const hasTime = /\b\d{1,2}:\d{2}\b/.test(t) || /\b\d{1,2}\s*uhr\b/.test(t);
  const hasPhone = /\d{6,}/.test(t); // 👉 mind. 6 Ziffern hintereinander
  const hasNamePhrase = t.includes("mein name ist") || t.includes("ich bin ");

  return hasDate || hasTime || hasPhone || hasNamePhrase;
}

// --------------------------------------------------------
// Termin-Daten sammeln
// Slots: name, date, time, phone
// --------------------------------------------------------
function collectAppointmentSlots(msg, prev) {
  const text = msg.toLowerCase();
  let slots = { ...prev };

  // Name
  if (!slots.name) {
    const m = text.match(/(ich bin|mein name ist)\s+([a-zA-Zäöüß ]+)/);
    if (m) {
      slots.name = m[2].trim();
    } else {
      // falls nur Name geschrieben wird, z.B. "Tom"
      const single = msg.trim();
      if (
        single.length > 1 &&
        single.split(/\s+/).length <= 3 &&
        /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß ]+$/.test(single)
      ) {
        slots.name = single;
      }
    }
  }

  // Datum (z.B. 23.12.2025)
  if (!slots.date) {
    const m = text.match(/\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/);
    if (m) slots.date = m[1];
  }

  // Uhrzeit (z.B. 14:00 oder "14 uhr")
  if (!slots.time) {
    const m1 = text.match(/\b(\d{1,2}:\d{2})\b/);
    const m2 = text.match(/\b(\d{1,2})\s*uhr\b/);
    if (m1) slots.time = m1[1];
    else if (m2) slots.time = m2[1] + ":00";
  }

  // Telefonnummer – ab jetzt: jede Folge von mindestens 6 Ziffern
  if (!slots.phone) {
    const m = text.match(/(\d{6,})/);
    if (m) {
      slots.phone = m[1];
    }
  }

  // komplett?
  const complete = !!(slots.name && slots.date && slots.time && slots.phone);

  const missing = [];
  if (!slots.name) missing.push("deinen Namen");
  if (!slots.date) missing.push("das Datum");
  if (!slots.time) missing.push("die Uhrzeit");
  if (!slots.phone) missing.push("deine Telefonnummer");

  let nextPrompt = "";
  if (complete) {
    nextPrompt = "Perfekt 👍 Ich habe alles. Soll ich den Termin jetzt an dein Salon-Team schicken?";
  } else if (missing.length === 1) {
    nextPrompt = `Alles klar 😊 Ich brauche noch ${missing[0]}.`;
  } else {
    nextPrompt = `Damit ich den Termin eintragen kann, brauche ich noch: ${missing.join(", ")}.`;
  }

  return { slots, complete, nextPrompt };
}

// --------------------------------------------------------
// Fallback-Antwort (wenn nichts passt)
// --------------------------------------------------------
function answerGeneral(msg) {
  const responses = [
    "Gern 🙂 Was möchtest du genau wissen?",
    "Okay 😊 Wie kann ich dir helfen?",
    "Alles klar ✨ Stell mir einfach deine Frage."
  ];
  return pickRandom(responses);
}

module.exports = {
  intentFromText,
  matchFaq,
  greetingIfHallo,
  looksLikeSlotUpdate,
  collectAppointmentSlots,
  answerGeneral
};
