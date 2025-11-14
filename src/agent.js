// =======================================
// src/agent.js
// - zufällige, lockere Antworten
// - FAQ mit mehreren Varianten
// - Termin-Slots (Name, Datum, Uhrzeit, E-Mail, Telefonnummer)
// - Datum robust: 23.12.2025 UND 23.12.25 → ISO
// - Telefonnummer: jede Folge von >= 6 Ziffern
// =======================================

const fs = require("fs");
const path = require("path");

// -----------------------------
// Zufällige Antwort auswählen
// -----------------------------
function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

// -----------------------------
// FAQs laden
// -----------------------------
function loadFaqs() {
  const p = path.join(process.cwd(), "config", "faqs.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// -----------------------------
// Lockere Begrüßung
// -----------------------------
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

// -----------------------------
// FAQ-Erkennung
// -----------------------------
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

// -----------------------------
// Intent bestimmen
// -----------------------------
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

// -----------------------------
// Sieht aus wie Termin-Details?
// -----------------------------
function looksLikeSlotUpdate(text) {
  const t = text.toLowerCase();

  const hasDate = /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(t);
  const hasTime =
    /\b\d{1,2}:\d{2}\b/.test(t) || /\b\d{1,2}\s*uhr\b/.test(t);
  const hasPhone = /\d{6,}/.test(t);
  const hasNamePhrase =
    t.includes("mein name ist") || t.includes("ich bin ");
  const hasEmail = /\S+@\S+\.\S+/.test(t);

  return hasDate || hasTime || hasPhone || hasNamePhrase || hasEmail;
}

// -----------------------------
// Datum: "23.12.25" → "2025-12-23"
// -----------------------------
function parseGermanDateToISO(text) {
  const m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (!m) return null;

  let day = parseInt(m[1], 10);
  let month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);

  if (year < 100) {
    year = 2000 + year;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year);
  return `${yyyy}-${mm}-${dd}`;
}

// -----------------------------
// Termin-Slots sammeln
// name, date (ISO), time, email, phone
// -----------------------------
function collectAppointmentSlots(msg, prev) {
  const text = msg.toLowerCase();
  let slots = { ...prev };

  // Name
  if (!slots.name) {
    const m = text.match(/(ich bin|mein name ist)\s+([a-zA-Zäöüß ]+)/);
    if (m) {
      slots.name = m[2].trim();
    } else {
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

  // Datum (überschreibt bei neuem Datum)
  const isoDate = parseGermanDateToISO(text);
  if (isoDate) {
    slots.date = isoDate;
  }

  // Uhrzeit
  const mTime1 = text.match(/\b(\d{1,2}):(\d{2})\b/);
  const mTime2 = text.match(/\b(\d{1,2})\s*uhr\b/);
  if (mTime1) {
    const h = mTime1[1].padStart(2, "0");
    const min = mTime1[2];
    slots.time = `${h}:${min}`;
  } else if (mTime2) {
    const h = mTime2[1].padStart(2, "0");
    slots.time = `${h}:00`;
  }

  // E-Mail
  const mEmail = msg.match(/\S+@\S+\.\S+/);
  if (mEmail) {
    slots.email = mEmail[0];
  }

  // Telefonnummer optional
  const mPhone = text.match(/(\d{6,})/);
  if (mPhone) {
    slots.phone = mPhone[1];
  }

  // komplett? (Name, Datum, Zeit, E-Mail)
  const complete = !!(slots.name && slots.date && slots.time && slots.email);

  const missing = [];
  if (!slots.name) missing.push("deinen Namen");
  if (!slots.date) missing.push("das Datum");
  if (!slots.time) missing.push("die Uhrzeit");
  if (!slots.email) missing.push("deine E-Mail-Adresse");

  let nextPrompt = "";
  if (complete) {
    nextPrompt =
      "Perfekt 👍 Ich habe Name, Datum, Uhrzeit und E-Mail. Soll ich den Termin jetzt an dein Salon-Team schicken?";
  } else if (missing.length === 1) {
    nextPrompt = `Alles klar 😊 Ich brauche noch ${missing[0]}.`;
  } else {
    nextPrompt = `Damit ich den Termin eintragen kann, brauche ich noch: ${missing.join(
      ", "
    )}.`;
  }

  return { slots, complete, nextPrompt };
}

// -----------------------------
// Fallback-Antwort
// -----------------------------
function answerGeneral() {
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
