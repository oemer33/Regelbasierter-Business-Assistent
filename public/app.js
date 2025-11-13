// ===============================
//   public/app.js (kompletter Ersatz)
// ===============================

const $ = (s) => document.querySelector(s);
const transcript = $("#transcript");
const micBtn = $("#mic_btn");
const micStatus = $("#mic_status");
const confirmBtn = $("#confirm_btn");
const confirmHint = $("#confirm_hint");

let agentState = { slots: {}, complete: false };
let speaking = false;

// -----------------------------
//  Stammdaten laden
// -----------------------------
fetch("/api/salon")
  .then((r) => r.json())
  .then((salon) => {
    $("#company_name").textContent = salon.company_name;
    $("#address").textContent = salon.address;
    $("#phone").textContent = salon.phone;
    $("#phone").href = `tel:${salon.phone.replace(/\s+/g, "")}`;
    $("#email").textContent = salon.email;
    $("#email").href = `mailto:${salon.email}`;
  })
  .catch(() => {
    // Falls API nicht geht, einfach still ignorieren
  });

// -----------------------------
//  Sprachausgabe (Text-to-Speech)
// -----------------------------
const hasTTS =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

const synth = hasTTS ? window.speechSynthesis : null;
let voices = [];
let ttsReady = false;

if (hasTTS) {
  // Manche Browser laden Stimmen asynchron
  const loadVoices = () => {
    voices = synth.getVoices();
    ttsReady = voices && voices.length > 0;
  };

  loadVoices();
  if (typeof window !== "undefined") {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
} else {
  console.warn("Dieser Browser unterstützt keine Sprachausgabe (speechSynthesis).");
}

function getGermanVoice() {
  if (!voices || voices.length === 0) return null;
  // Versuche zuerst eine deutsche Stimme
  const de = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("de"));
  return de || voices[0];
}

function speak(text) {
  if (!hasTTS) {
    // Kein TTS → einfach nichts sagen
    return;
  }

  try {
    if (!text || typeof text !== "string") return;

    // Laufende Ausgabe abbrechen
    if (synth.speaking) {
      synth.cancel();
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "de-DE";
    utter.rate = 1.0;
    utter.pitch = 1.0;

    const voice = getGermanVoice();
    if (voice) utter.voice = voice;

    speaking = true;
    utter.onend = () => {
      speaking = false;
    };
    utter.onerror = (e) => {
      speaking = false;
      console.error("Fehler bei TTS:", e);
    };

    synth.speak(utter);
  } catch (e) {
    console.error("TTS-Ausnahme:", e);
  }
}

// -----------------------------
//  Spracherkennung (SpeechRecognition)
// -----------------------------
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<span class="who">${
    role === "user" ? "Du" : "Agent"
  }</span><span>${text}</span>`;
  transcript.appendChild(div);
  transcript.scrollTop = transcript.scrollHeight;
}

async function sendToAgent(text) {
  addMsg("user", text);

  try {
    const r = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, state: agentState })
    });

    const data = await r.json();
    agentState = data.state || agentState;

    addMsg("agent", data.reply);
    speak(data.reply);

    confirmBtn.disabled = !agentState?.complete;
    confirmHint.textContent = agentState?.complete
      ? "Alle Angaben vorhanden. Jetzt Termin anfragen!"
      : "Wird aktiv, wenn alle Angaben vorhanden sind.";
  } catch (e) {
    addMsg("agent", "Es gab ein Verbindungsproblem mit dem Server.");
    console.error("Fehler beim /api/agent-Call:", e);
  }
}

function startRecognition() {
  if (!SpeechRecognition) {
    alert(
      "Spracherkennung wird von diesem Browser nicht unterstützt. Bitte Chrome oder einen aktuellen Browser verwenden."
    );
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = "de-DE";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    micStatus.textContent = "Zuhören…";
    micBtn.classList.add("recording");
  };
  rec.onend = () => {
    micStatus.textContent = "bereit";
    micBtn.classList.remove("recording");
  };
  rec.onerror = (e) => {
    micStatus.textContent = "Fehler: " + e.error;
    console.error("SpeechRecognition Fehler:", e);
  };
  rec.onresult = (evt) => {
    const text = evt.results[0][0].transcript;
    sendToAgent(text);
  };

  rec.start();
}

// Klick auf „Sprechen“
// (Startet sowohl das Mikro als auch – durch den Klick – Audio-Rechte für TTS)
micBtn.addEventListener("click", () => {
  // Falls gerade gesprochen wird → abbrechen
  if (hasTTS && speaking) {
    try {
      synth.cancel();
      speaking = false;
    } catch (_) {}
  }
  startRecognition();
});

// -----------------------------
//  Termin absenden
// -----------------------------
confirmBtn.addEventListener("click", async () => {
  const s = agentState.slots || {};
  const datetime = s.date && s.time ? `${s.date}T${s.time}` : null;

  const payload = {
    name: s.name,
    datetime,
    notes: s.notes
  };

  try {
    const r = await fetch("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();

    if (data.ok) {
      const msg =
        data.message ||
        "Danke! Deine Anfrage wurde an unser Team gesendet. Wir melden uns schnellstmöglich.";
      addMsg("agent", msg);
      speak(msg);
      confirmBtn.disabled = true;
    } else {
      const errMsg = "Konnte nicht senden: " + (data.error || "Unbekannter Fehler");
      addMsg("agent", errMsg);
      speak("Leider konnte ich die Anfrage nicht senden.");
      console.error("Fehler bei /api/appointment:", data);
    }
  } catch (e) {
    addMsg("agent", "Konnte nicht senden: Netzwerkfehler.");
    console.error("Netzwerkfehler bei /api/appointment:", e);
  }
});

