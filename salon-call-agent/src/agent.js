const fs = require("fs");
const path = require("path");
const { loadSalon } = require("./validate");

const faqsPath = path.join(process.cwd(), "config", "faqs.json");
const apptsPath = path.join(process.cwd(), "data", "appointments.json");

function loadFaqs() {
  const raw = fs.readFileSync(faqsPath, "utf-8");
  return JSON.parse(raw);
}

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

function answerGeneral() {
  const salon = loadSalon();
  return (
    "Das habe ich leider nicht verstanden. Ich kann Fragen zu Öffnungszeiten, Preisen, Adresse oder Zahlung beantworten. " +
    `Oder ich nehme gern eine Terminanfrage auf. Unser Salon heißt "${salon.company_name}".`
  );
}

function saveAppointment(appt) {
  try {
    // Auf Vercel ist FS nur temporär – wir versuchen es dennoch (lokal nützlich)
    const list = JSON.parse(fs.readFileSync(apptsPath, "utf-8"));
    list.push({ ...appt, created_at: new Date().toISOString() });
    fs.writeFileSync(apptsPath, JSON.stringify(list, null, 2), "utf-8");
  } catch (_) {
    // Ignorieren, wenn nicht möglich (z. B. im Serverless)
  }
}

function intentFromText(userText) {
  const t = userText.toLowerCase();
  if (["termin", "buchen", "vereinbaren", "appointment"].some((k) => t.includes(k))) {
    return "appointment";
  }
  if (matchFaq(userText)) return "faq";
  return "fallback";
}

function collectAppointmentSlots(userText, state = {}) {
  let s = { ...state };
  const maybeName = userText.match(/\b(ich bin|mein name ist)\s+([a-zäöüß\- ]+)/i);
  if (!s.name && maybeName) s.name = maybeName[2].trim();

  const services = loadSalon().services.map((x) => x.name.toLowerCase());
  for (const svc of services) {
    if (!s.service && userText.toLowerCase().includes(svc)) s.service = svc;
  }

  const dateMatch = userText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);        // YYYY-MM-DD
  const timeMatch = userText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);   // HH:MM
  if (!s.date && dateMatch) s.date = dateMatch[1];
  if (!s.time && timeMatch) s.time = timeMatch[0];

  const contact = userText.match(/\b\S+@\S+\.\S+|\+?\d[\d\s\-\/]{6,}\b/);
  if (!s.contact && contact) s.contact = contact[0];

  const missing = [];
  if (!s.name) missing.push("deinen Namen");
  if (!s.service) missing.push("gewünschten Service");
  if (!s.date) missing.push("Datum (YYYY-MM-DD)");
  if (!s.time) missing.push("Uhrzeit (HH:MM)");
  if (!s.contact) missing.push("Kontakt (Telefon oder E-Mail)");

  const complete = missing.length === 0;
  const nextPrompt = complete
    ? "Perfekt. Ich prüfe kurz die Öffnungszeiten und sende eine Anfrage an unser Team. Einverstanden?"
    : `Um die Terminanfrage zu erstellen, brauche ich noch: ${missing.join(", ")}.`;

  return { slots: s, complete, nextPrompt };
}

module.exports = {
  loadFaqs,
  matchFaq,
  answerGeneral,
  saveAppointment,
  intentFromText,
  collectAppointmentSlots
};
