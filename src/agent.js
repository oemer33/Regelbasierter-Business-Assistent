// =======================================
// src/agent.js – mit zufälligen Antworten,
// lockerer Begrüßung & FAQ aus JSON
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
// FAQ-Erkennung (mit 3 zufälligen Antworten)
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
// --------------------------------------------------------
function looksLikeSlotUpdate(text) {
  const t = text.toLowerCase();
  return (
    /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(t) || // Datum
    /\b\d{1,2}:\d{2}\b/.test(t) || // Uhrzeit
    /\b(0\d{10,11}|\+49\d{9,12})\b/.test(t) || // Telefonnummer
    t.includes("uhr") ||
    t.includes("nummer") ||
    t.includes("name ist") ||
    t.includes("mein name")
  );
}

// --------------------------------------------------------
// Termin-Daten sammeln
// --------------------------------------------------------
function collectAppointmentSlots(msg, prev) {
  const text = msg.toLowerCase();

  let slots = { ...prev };

  // Name
  if (!slots.name) {
    const m = text.match(/(ich bin|mein name ist)\s+([a-zA-Zäöüß ]+)/);
    if (m) slots.name = m[2].trim();
  }

  // Datum
  if (!slots.date) {
    const m = text.match(/\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/);
    if (m) slots.date = m[1];
  }

  // Uhrzeit
  if (!slots.time) {
    const m1 = text.match(/\b(\d{1,2}:\d{2})\b/);
    const m2 = text.match(/\b(\d{1,2})\s*uhr\b/);
    if (m1) slots.time = m1[1];
    if (m2) slots.time = m2[1] + ":00";
  }

  // Telefonnummer
  if (!slots.phone) {
    const m = text.match(/\b(0\d{10,11}|\+49\d{9,12})\b/);
    if (m) slots.phone = m[1];
  }

  // Termin komplett?
  const complete = slots.name && slots.date && slots.time && slots.phone;

  let missing = [];
  if (!slots.name) missing.push("deinen Namen");
  if (!slots.date) missing.push("das Datum");
  if (!slots.time) missing.push("die Uhrzeit");
  if (!slots.phone) missing.push("deine Nummer");

  let nextPrompt = "";

  if (complete) {
    nextPrompt = `Perfekt 👍 Ich habe alles! Soll ich den Termin jetzt abschicken?`;
  } else if (missing.length === 1) {
    nextPrompt = `Alles klar 😊 Ich brauche noch ${missing[0]}.`;
  } else {
    nextPrompt = `Um den Termin einzutragen, brauche ich noch: ${missing.join(", ")}.`;
  }

  return { slots, complete, nextPrompt };
}

// --------------------------------------------------------
// Fallback-Antwort
// --------------------------------------------------------
function answerGeneral(msg) {
  const responses = [
    "Gern! Was möchtest du genau wissen? 🙂",
    "Okay! Wie kann ich dir weiterhelfen? 😊",
    "Alles klar – stell mir gern deine Frage ✨"
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


