// ===============================
//   public/app.js (kompletter Ersatz)
//   - Sprach- und Texteingabe
//   - Termin: name, date, time, contact
// ===============================

const $ = (s) => document.querySelector(s);
const transcript = $("#transcript");
const micBtn = $("#mic_btn");
const micStatus = $("#mic_status");
const confirmBtn = $("#confirm_btn");
const confirmHint = $("#confirm_hint");
const textInput = $("#text_input");
const sendBtn = $("#send_btn");

let agentState = { slots: {}, complete: false };
let speaking = false;

// Stammdaten laden
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
  .catch(() => {});

// Text-to-Speech
const hasTTS =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

const synth = hasTTS ? window.speechSynthesis : null;
let voices = [];
let ttsReady = false;

if (hasTTS) {
  const loadVoices = () => {
    voices = synth.getVoices();
    ttsReady = voices && voices.length > 0;
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function getGermanVoice() {
  if (!voices || voices.length === 0) return null;
  const de = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("de"));
  return de || voices[0];
}

function speak(text) {
  if (!hasTTS) return;
  try {
    if (!text || typeof text !== "string") return;
    if (synth.speaking) synth.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "de-DE";
    const voice = getGermanVoice();
    if (voice) utter.voice = voice;
    utter.rate = 1.0;
    utter.pitch = 1.0;

    speaking = true;
    utter.onend = () => { speaking = false; };
    utter.onerror = () => { speaking = false; };

    synth.speak(utter);
  } catch (_) {}
}

// SpeechRecognition
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
  if (!text || !text.trim()) return;
  addMsg("user", text.trim());
  textInput.value = "";

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
      ? "Alle Angaben vorhanden (Name, Datum, Uhrzeit, Kontakt). Jetzt Termin anfragen!"
      : "Wird aktiv, wenn Name, Datum, Uhrzeit und Kontakt vorhanden sind.";
  } catch (e) {
    addMsg("agent", "Es gab ein Verbindungsproblem mit dem Server.");
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
  };
  rec.onresult = (evt) => {
    const text = evt.results[0][0].transcript;
    sendToAgent(text);
  };

  rec.start();
}

// Mic-Button
micBtn.addEventListener("click", () => {
  if (hasTTS && speaking) {
    synth.cancel();
    speaking = false;
  }
  startRecognition();
});

// Text-Chat: Button
sendBtn.addEventListener("click", () => {
  const text = textInput.value;
  sendToAgent(text);
});

// Text-Chat: Enter-Taste
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const text = textInput.value;
    sendToAgent(text);
  }
});

// Termin absenden
confirmBtn.addEventListener("click", async () => {
  const s = agentState.slots || {};
  const datetime = s.date && s.time ? `${s.date}T${s.time}` : null;

  const payload = {
    name: s.name,
    datetime,
    contact: s.contact,
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
      const errMsg =
        "Konnte nicht senden: " + (data.error || "Unbekannter Fehler");
      addMsg("agent", errMsg);
      speak("Leider konnte ich die Anfrage nicht senden.");
    }
  } catch (e) {
    addMsg("agent", "Konnte nicht senden: Netzwerkfehler.");
  }
});
