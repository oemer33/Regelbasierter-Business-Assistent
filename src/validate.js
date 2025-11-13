// ===============================
//   src/validate.js (1:1 Ersatz)
// ===============================

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

  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
  const oh = salon.opening_hours[day];
  if (!oh || oh === "geschlossen")
    return { ok: false, reason: "An diesem Tag geschlossen." };

  const [start, end] = oh.split("-");
  const toMin = (v) => {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  };

  const cur = date.getHours() * 60 + date.getMinutes();

  if (cur < toMin(start) || cur > toMin(end))
    return {
      ok: false,
      reason: `Außerhalb der Öffnungszeiten (${oh}).`
    };

  return { ok: true };
}

// NUR Name + datetime sind Pflicht
function validateAppointment(payload) {
  if (!payload.name)
    return { ok: false, reason: "Name fehlt." };

  if (!payload.datetime)
    return { ok: false, reason: "Datum und Uhrzeit fehlen." };

  const win = withinOpeningHours(payload.datetime);
  if (!win.ok) return win;

  return { ok: true };
}

module.exports = { loadSalon, withinOpeningHours, validateAppointment };
