const $ = (s) => document.querySelector(s);
const transcript = $("#transcript");
const micBtn = $("#mic_btn");
const micStatus = $("#mic_status");
const confirmBtn = $("#confirm_btn");
const confirmHint = $("#confirm_hint");

let agentState = { slots: {}, complete: false };
let speaking = false;

// Stammdaten laden und Branding setzen
fetch("/api/salon")
  .then((r) => r.json())
  .then((salon) => {
    $("#company_name").textContent = salon.company_name;
    $("#address").textContent = salon.address;
    $("#phone").textContent = salon.phone;
    $("#phone").href = `tel:${salon.phone.replace(/\s+/g, "")}`;
    $("#email").textContent = salon.email;
    $("#email").href = `mailto:${salon.email}`;
  });

// Web Speech
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

function speak(text) {
  if (!synth) return;
  speaking = true;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "de-DE";
  utter.rate = 1.0;
  utter.onend = () => (speaking = false);
  synth.speak(utter);
}

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

  const r = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, state: agentState }),
  });

  const data = await r.json();

  agentState = data.state || agentState;

  // -----------------------------------------
  // WICHTIG: Wenn Server keine Antwort gibt → fallback
  // -----------------------------------------
  const replyText =
    data.reply ||
    data.error ||
    "Der Agent hat leider keine Antwort zurückgegeben.";

  addMsg("agent", replyText);
  speak(replyText);

  confirmBtn.disabled = !agentState?.complete;
  confirmHint.textContent = agentState?.complete
    ? "Alle Angaben vorhanden. Jetzt Termin anfragen!"
    : "Wird aktiv, wenn alle Angaben vorhanden sind.";
}

function startRecognition() {
  if (!SpeechRecognition) {
    alert(
      "Spracherkennung wird von diesem Browser nicht unterstützt. Bitte Chrome verwenden."
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

micBtn.addEventListener("click", () => {
  if (speaking) {
    synth.cancel();
    speaking = false;
  }
  startRecognition();
});

confirmBtn.addEventListener("click", async () => {
  const s = agentState.slots || {};
  const datetime = s.date && s.time ? `${s.date}T${s.time}` : null;

  const payload = {
    name: s.name,
    service: s.service,
    datetime,
    contact: s.contact,
    notes: s.notes,
  };

  const r = await fetch("/api/appointment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json();

  if (data.ok) {
    addMsg(
      "agent",
      "Danke! Deine Anfrage wurde an unser Team gesendet. Wir melden uns schnellstmöglich."
    );
    speak("Danke! Deine Anfrage wurde an unser Team gesendet.");
    confirmBtn.disabled = true;
  } else {
    addMsg("agent", "Konnte nicht senden: " + (data.error || "Unbekannter Fehler"));
    speak("Leider konnte ich die Anfrage nicht senden.");
  }
});

