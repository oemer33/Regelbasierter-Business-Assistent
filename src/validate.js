const fs = require("fs");
const path = require("path");

const dataPath = path.join(process.cwd(), "data", "salon_data.json");

function loadSalon() {
  const raw = fs.readFileSync(dataPath, "utf-8");
  return JSON.parse(raw);
}

function withinOpeningHours(dateISO) {
  const salon = loadSalon();
  const date = new Date(dateISO);
  if (isNaN(date)) return { ok: false, reason: "Ungültiges Datum." };

  const day = ["sun","mon","tue","wed","thu","fri","sat"][date.getDay()];
  const oh = salon.opening_hours[day];
  if (!oh || oh === "geschlossen") return { ok: false, reason: "An diesem Tag geschlossen." };

  const [start, end] = oh.split("-");
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const mins = date.getHours() * 60 + date.getMinutes();
  const ok = mins >= toMin(start) && mins <= toMin(end);
  return ok ? { ok: true } : { ok: false, reason: `Außerhalb der Öffnungszeiten (${oh}).` };
}

function validateAppointment(payload) {
  const required = ["name", "service", "datetime", "contact"];
  for (const k of required) {
    if (!payload[k] || String(payload[k]).trim() === "") {
      return { ok: false, reason: `Feld "${k}" fehlt.` };
    }
  }
  const win = withinOpeningHours(payload.datetime);
  if (!win.ok) return win;
  return { ok: true };
}

module.exports = { loadSalon, withinOpeningHours, validateAppointment };
