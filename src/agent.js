// ===============================
//   src/agent.js (1:1 Ersatz)
// ===============================

const fs = require("fs");
const path = require("path");
const { loadSalon } = require("./validate");

const faqsPath = path.join(process.cwd(), "config", "faqs.json");
const apptsPath = path.join(process.cwd(), "data", "appointments.json");

// FAQs laden
function loadFaqs() {
  const raw = fs.readFileSync(faqsPath, "utf-8");
  return JSON.parse(raw);
}

// FAQ-Erkennung
function matchFaq(userText) {
  const text = userText.toLowerCase();
  const faqs = loadFaqs();

  for (const f of faqs) {
    if (f.tags.some((t) => text.includes(t.toLowerCase()))) {
      return f.answer_template;
    }
  }
  return null;
}

// Begrüßungs-Logik
function greetingIfHallo(userText) {
  const lower = userText.toLowerCase();
  if (
    lower.startsWith("hallo") ||
    lower.startsWith("hi") ||
    lower.startsWith("guten tag") ||
    lower.startsWith("servus")
  ) {
    return "Hallo, herzlich willkommen! Ich bin Ihr persönlicher Call-Agent. Wie kann ich Ihnen helfen?";
  }
  return null;
}

// Fallback
function answerGeneral() {
  const salon = loadSalon();
  return (
    "Das habe ich leider nicht verstanden. Ich kann Fragen zu Öffnungszeiten, Preisen, Adresse oder Zahlung beantworten. " +
    `Oder ich nehme gern eine Terminanfrage auf. Unser Salon heißt "${salon.company_name}".`
  );
}

// Termin speichern (lokal/temporär)
function saveAppointment(appt) {
  try {
    const list = JSON.parse(fs.readFileSync(apptsPath, "utf-8"));
    list.push({ ...appt, created_at: new Date().toISOString() });
    fs.writeFileSync(apptsPath, JSON.stringify(list, null, 2), "utf-8");
  } catch (_) {}
}

// Intent-Erkennung
function intentFromText(userText) {
  const t = userText.toLowerCase();

  // Erst: Begrüßung?
  if (t.startsWith("hallo") || t.startsWith("hi") || t.startsWith("guten tag"))
    return "greeting";

  if (
    ["termin", "buchen", "vereinbaren", "appointment"].some((k) =>
      t.includes(k)
    )
  ) {
    return "appointment";
  }

  if (matchFaq(userText)) return "faq";

  return "fallback";
}

// Vereinfachte Termin-Slot-Erkennung
function collectAppointmentSlots(userText, state = {}) {
  let s = { ...state };

  // Name erkennen
  const maybeName = userText.match(
    /\b(ich bin|mein name ist)\s+([a-zäöüß\- ]+)/i
  );
  if (!s.name && maybeName) s.name = maybeName[2].trim();

  // Datum (YYYY-MM-DD)
  const dateMatch = userText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (!s.date && dateMatch) s.date = dateMatch[1];

  // Zeit (HH:MM)
  const timeMatch = userText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!s.time && timeMatch) s.time = timeMatch[0];

  // Fehlende Angaben
  const missing = [];
  if (!s.name) missing.push("deinen Namen");
  if (!s.date) missing.push("das Datum (YYYY-MM-DD)");
  if (!s.time) missing.push("die Uhrzeit (HH:MM)");

  const complete = missing.length === 0;

  const nextPrompt = complete
    ? "Alles klar! Soll ich diesen Termin jetzt an unser Team senden?"
    : `Ich brauche noch: ${missing.join(", ")}.`;

  return { slots: s, complete, nextPrompt };
}

module.exports = {
  loadFaqs,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  saveAppointment,
  intentFromText,
  collectAppointmentSlots
};

