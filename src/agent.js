// ===============================
//   src/agent.js (kompletter Ersatz)
//   - Termin-Slots: name, date, time, contact
//   - Begrüßung als Call- & Chat-Agent
//   - Datum: 2025-12-24 oder 24.12.2025
//   - Zeit: 14:00, 14 Uhr, um 14
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

// Begrüßung
function greetingIfHallo(userText) {
  const lower = userText.toLowerCase().trim();
  if (
    lower.startsWith("hallo") ||
    lower.startsWith("hi") ||
    lower.startsWith("guten tag") ||
    lower.startsWith("servus")
  ) {
    return "Hallo, herzlich willkommen! Ich bin Ihr persönlicher Call- und Chat-Agent. Wie kann ich Ihnen helfen?";
  }
  return null;
}

// Fallback-Antwort mit Kontaktinfos
function answerGeneral() {
  const salon = loadSalon();
  return (
    "Ich bin der digitale Assistent deines Salons. Ich kann dir bei Öffnungszeiten, Preisen, Adresse, Zahlung und Terminanfragen helfen. " +
    `Wenn du eine persönliche Frage hast, erreichst du uns direkt unter Telefon ${salon.phone} oder E-Mail ${salon.email}.`
  );
}

// Termin speichern (lokal/temporär – auf Vercel nicht dauerhaft)
function saveAppointment(appt) {
  try {
    const list = JSON.parse(fs.readFileSync(apptsPath, "utf-8"));
    list.push({ ...appt, created_at: new Date().toISOString() });
    fs.writeFileSync(apptsPath, JSON.stringify(list, null, 2), "utf-8");
  } catch (_) {}
}

// Intent-Erkennung (nur ob es um Termin geht)
function intentFromText(userText) {
  const t = userText.toLowerCase();
  if (
    ["termin", "buchen", "vereinbaren", "appointment"].some((k) =>
      t.includes(k)
    )
  ) {
    return "appointment";
  }
  return "fallback";
}

// Datum extrahieren (ISO)
function extractDateToISO(userText) {
  const text = userText.toLowerCase();

  // YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  // DD.MM.YYYY
  const dotMatch = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, "0");
    const month = dotMatch[2].padStart(2, "0");
    const year = dotMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

// Zeit extrahieren (HH:MM)
function extractTimeToHHMM(userText) {
  const text = userText.toLowerCase();

  // HH:MM
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (timeMatch) return timeMatch[0];

  // "um 14 uhr" / "14 uhr"
  const hourUhrMatch = text.match(/\b(?:um\s*)?([01]?\d|2[0-3])\s*uhr\b/);
  if (hourUhrMatch) {
    const h = hourUhrMatch[1].padStart(2, "0");
    return `${h}:00`;
  }

  // "um 14"
  const hourOnlyMatch = text.match(/\bum\s*([01]?\d|2[0-3])\b/);
  if (hourOnlyMatch) {
    const h = hourOnlyMatch[1].padStart(2, "0");
    return `${h}:00`;
  }

  return null;
}

// Kontakt (Telefon oder E-Mail)
function extractContact(userText) {
  const contactMatch = userText.match(
    /\b\S+@\S+\.\S+|\+?\d[\d\s\-\/]{6,}\b/
  );
  return contactMatch ? contactMatch[0] : null;
}

// Name aus Text holen
function extractName(userText) {
  // Phrasen
  const namePhrase = userText.match(
    /\b(ich bin|mein name ist|ich heiße|ich heisse)\s+([A-ZÄÖÜ][a-zäöüß\-]+(?:\s+[A-ZÄÖÜ][a-zäöüß\-]+)*)/i
  );
  if (namePhrase) return namePhrase[2].trim();

  // Kurze Eingaben wie "Tom", "Tom Müller"
  const trimmed = userText.trim();
  if (
    trimmed.length > 0 &&
    trimmed.split(/\s+/).length <= 3 &&
    /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\- ]+$/.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

// Hilfsfunktion: Sieht die Nachricht nach Termin-Details aus?
function looksLikeSlotUpdate(userText) {
  const text = userText.toLowerCase();
  const trimmed = userText.trim();

  const hasDate =
    /\b(20\d{2}-\d{2}-\d{2})\b/.test(text) ||
    /\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/.test(text);

  const hasTime =
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/.test(text) ||
    /\b(?:um\s*)?([01]?\d|2[0-3])\s*uhr\b/.test(text);

  const hasNamePhrase = /\b(ich bin|mein name ist|ich heiße|ich heisse)\b/i.test(
    text
  );

  const isShortName =
    trimmed.length > 0 &&
    trimmed.split(/\s+/).length <= 3 &&
    /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\- ]+$/.test(trimmed);

  const hasContactPhrase =
    /\b(telefon|handy|nummer|rufnummer|mail|email|e-mail)\b/.test(text) ||
    /\+?\d[\d\s\-\/]{6,}/.test(userText) ||
    /\S+@\S+\.\S+/.test(userText);

  return hasDate || hasTime || hasNamePhrase || isShortName || hasContactPhrase;
}

// Slots sammeln
function collectAppointmentSlots(userText, state = {}) {
  let s = { ...state };
  const text = userText.toLowerCase();

  if (!s.name) {
    const n = extractName(userText);
    if (n) s.name = n;
  }

  if (!s.date) {
    const d = extractDateToISO(text);
    if (d) s.date = d;
  }

  if (!s.time) {
    const t = extractTimeToHHMM(text);
    if (t) s.time = t;
  }

  if (!s.contact) {
    const c = extractContact(userText);
    if (c) s.contact = c;
  }

  const missing = [];
  if (!s.name) missing.push("deinen Namen");
  if (!s.date) missing.push("das Datum (z.B. 23.12.2025)");
  if (!s.time) missing.push("die Uhrzeit (z.B. 14 Uhr)");
  if (!s.contact) missing.push("deine Telefonnummer oder E-Mail");

  const complete = missing.length === 0;

  const nextPrompt = complete
    ? "Perfekt, ich habe Name, Datum, Uhrzeit und Kontakt. Soll ich diesen Termin jetzt an unser Team senden?"
    : `Um die Terminanfrage abzuschließen, brauche ich noch: ${missing.join(", ")}.`;

  return { slots: s, complete, nextPrompt };
}

module.exports = {
  loadFaqs,
  matchFaq,
  greetingIfHallo,
  answerGeneral,
  saveAppointment,
  intentFromText,
  collectAppointmentSlots,
  looksLikeSlotUpdate
};

