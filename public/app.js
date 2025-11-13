// ===============================
//   public/app.js – UI + kurzer Chatverlauf
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

if (hasTTS) {
  const loadVoices = () => {
    voices = synth.getVoices();
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
    utter.onend = () => {
      speaking = false;
    };
    utter.onerror = () => {
      speaking = false;
    };

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

  // NUR die letzten 4 Nachrichten behalten
  while (transcript.children.length > 4) {
    transcript.removeChild(transcript.firstChild);
  }

  transcript.scrollTop = transcript.scrollHeight;
}

// Termin an Server senden (wird vom Button und von auto_send genutzt)
async function sendAppointment() {
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
        "Der Termin wurde an das Team gesendet! Wenn der Termin abgesagt oder verschoben wird, melden wir uns bei Ihnen.";
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
}

async function sendToAgent(text) {
  if (!text || !text.trim()) return;
  const clean = text.trim();
  addMsg("user", clean);
  textInput.value = "";

  try {
    const r = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: clean, state: agentState })
    });
    const data = await r.json();
    agentState = data.state || agentState;

    addMsg("agent", data.reply);
    speak(data.reply);

    confirmBtn.disabled = !agentState?.complete;
    confirmHint.textContent = agentState?.complete
      ? "Alle Angaben vorhanden (Name, Datum, Uhrzeit, Kontakt). Du kannst 'Ja' sagen oder den Button nutzen."
      : "Wird aktiv, wenn Name, Datum, Uhrzeit und Kontakt vorhanden sind.";

    if (data.auto_send) {
      await sendAppointment();
    }
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

// Termin absenden (manuell per Button)
confirmBtn.addEventListener("click", async () => {
  await sendAppointment();
});
