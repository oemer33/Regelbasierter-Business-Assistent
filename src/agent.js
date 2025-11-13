// ===============================
//   src/agent.js (kompletter Ersatz)
//   - Termin-Slots: name, date, time, contact
//   - Begrüßung "Hallo, herzlich willkommen ..."
//   - Datum: 2025-11-13 oder 13.11.2025
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

// Begrüßungs-Logik
function greetingIfHallo(userText) {
  const lower = userText.toLowerCase();
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

// Fallback-Antwort
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
  } catch (_) {
    // im Serverless ggf. nicht möglich → ignorieren
  }
}

// Intent-Erkennung
function intentFromText(userText) {
  const t = userText.toLowerCase();

  // 1) Begrüßung zuerst
  if (
    t.startsWith("hallo") ||
    t.startsWith("hi") ||
    t.startsWith("guten tag") ||
    t.startsWith("servus")
  ) {
    return "greeting";
  }

  // 2) Termin-Wunsch
  if (
    ["termin", "buchen", "vereinbaren", "appointment"].some((k) =>
      t.includes(k)
    )
  ) {
    return "appointment";
  }

  // 3) FAQ
  if (matchFaq(userText)) return "faq";

  // 4) sonst Fallback
  return "fallback";
}

// Datum aus Text holen (ISO)
function extractDateToISO(userText) {
  const text = userText.toLowerCase();

  // YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // DD.MM.YYYY
  const dotMatch = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (dotMatch) {
    let day = dotMatch[1].padStart(2, "0");
    let month = dotMatch[2].padStart(2, "0");
    const year = dotMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

// Zeit aus Text holen (HH:MM)
function extractTimeToHHMM(userText) {
  const text = userText.toLowerCase();

  // HH:MM
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (timeMatch) {
    return timeMatch[0];
  }

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

// Kontakt (Telefon oder E-Mail) aus Text holen
function extractContact(userText) {
  // E-Mail oder Telefonnummer (mind. 7 Ziffern)
  const contactMatch = userText.match(
    /\b\S+@\S+\.\S+|\+?\d[\d\s\-\/]{6,}\b/
  );
  return contactMatch ? contactMatch[0] : null;
}

// Name + Datum + Uhrzeit + Kontakt aus dem Text sammeln
function collectAppointmentSlots(userText, state = {}) {
  let s = { ...state };
  const text = userText.toLowerCase();

  // Name erkennen
  const maybeName = userText.match(
    /\b(ich bin|mein name ist)\s+([a-zäöüß\- ]+)/i
  );
  if (!s.name && maybeName) {
    s.name = maybeName[2].trim();
  }

  // Datum
  if (!s.date) {
    const dateISO = extractDateToISO(text);
    if (dateISO) {
      s.date = dateISO;
    }
  }

  // Zeit
  if (!s.time) {
    const timeHHMM = extractTimeToHHMM(text);
    if (timeHHMM) {
      s.time = timeHHMM;
    }
  }

  // Kontakt (Telefon oder E-Mail)
  if (!s.contact) {
    const contact = extractContact(userText);
    if (contact) {
      s.contact = contact;
    }
  }

  const missing = [];
  if (!s.name) missing.push("deinen Namen");
  if (!s.date) missing.push("das Datum (z.B. 13.11.2025)");
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
  collectAppointmentSlots
};
