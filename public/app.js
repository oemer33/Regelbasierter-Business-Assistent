// ===============================
// public/app.js – ChatGPT-Style UI
// Login + Sprache, Tipp-Animation, TTS ohne Emojis,
// Sidepanel & Drei-Punkte-Menü
// ===============================

const $ = (s) => document.querySelector(s);

// Overlay / Login
const overlay = $("#welcome_overlay");
const startBtn = $("#start_btn");
const welcomeEmail = $("#welcome_email");
const welcomeLang = $("#welcome_lang");

// Header / Menüs
const menuBtn = $("#menu_btn");
const moreBtn = $("#more_btn");
const infoPanel = $("#info_panel");
const closePanelBtn = $("#close_panel");
const moreMenu = $("#more_menu");
const moreCloseBtn = $("#more_close_btn");

// Chat-Elemente
const transcript = $("#transcript");
const typingIndicator = $("#typing_indicator");
const micBtn = $("#mic_btn");
const textInput = $("#text_input");
const sendBtn = $("#send_btn");
const serviceSelect = $("#service_select");

// Feedback (im Drei-Punkte-Menü)
const feedbackText = $("#feedback_text");
const feedbackSendBtn = $("#feedback_send_btn");
const feedbackStatus = $("#feedback_status");

let agentState = { slots: {}, complete: false };
let speaking = false;
let initialized = false;

let userProfile = {
  email: "",
  lang: "de"
};

// Emojis aus Text entfernen (nur für Sprachausgabe)
function removeEmojis(text) {
  return text.replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u26FF])/g,
    ""
  );
}

// Salon-Stammdaten laden
fetch("/api/salon")
  .then((r) => r.json())
  .then((salon) => {
    const companyNameEl = $("#company_name");
    if (companyNameEl) companyNameEl.textContent = salon.company_name;

    const panelName = $("#panel_name");
    if (panelName) panelName.textContent = salon.company_name;

    const panelAddress = $("#panel_address");
    const panelPhone = $("#panel_phone");
    const panelEmail = $("#panel_email");

    if (panelAddress) panelAddress.textContent = salon.address || "";
    if (panelPhone) {
      panelPhone.textContent = salon.phone || "";
      panelPhone.href = salon.phone
        ? `tel:${salon.phone.replace(/\s+/g, "")}`
        : "#";
    }
    if (panelEmail) {
      panelEmail.textContent = salon.email || "";
      panelEmail.href = salon.email ? `mailto:${salon.email}` : "#";
    }
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

function getVoiceForLang(langCode) {
  if (!voices || voices.length === 0) return null;
  const v = voices.find(
    (voice) =>
      voice.lang &&
      voice.lang.toLowerCase().startsWith(langCode.toLowerCase().slice(0, 2))
  );
  return v || voices[0];
}

function getLangCode() {
  if (userProfile.lang === "en") return "en-US";
  if (userProfile.lang === "tr") return "tr-TR";
  return "de-DE";
}

function speak(text) {
  if (!hasTTS) return;
  try {
    if (!text || typeof text !== "string") return;
    if (synth.speaking) synth.cancel();

    const clean = removeEmojis(text);
    if (!clean.trim()) return;

    const utter = new SpeechSynthesisUtterance(clean);
    const langCode = getLangCode();
    utter.lang = langCode;
    const voice = getVoiceForLang(langCode);
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

// Nachricht ins Chatfenster schreiben
function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<span class="who">${
    role === "user" ? "Du" : "Agent"
  }</span><span>${text}</span>`;
  transcript.appendChild(div);

  // Nur die letzten 4 Nachrichten behalten
  while (transcript.children.length > 4) {
    transcript.removeChild(transcript.firstChild);
  }

  transcript.scrollTop = transcript.scrollHeight;
}

// Tipp-Animation
function showTyping() {
  if (typingIndicator) typingIndicator.classList.remove("hidden");
}
function hideTyping() {
  if (typingIndicator) typingIndicator.classList.add("hidden");
}

// Termin an Server senden (für auto_send vom Agent)
async function sendAppointment() {
  const s = agentState.slots || {};
  const datetime = s.date && s.time ? `${s.date}T${s.time}` : null;
  const service = serviceSelect ? serviceSelect.value : "";
  const contact = s.email || s.phone || userProfile.email;

  const payload = {
    name: s.name,
    datetime,
    contact,
    service,
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

// Nachricht an Agent schicken
async function sendToAgent(text) {
  if (!initialized) {
    alert("Bitte zuerst E-Mail und Sprache wählen.");
    return;
  }
  if (!text || !text.trim()) return;

  const clean = text.trim();
  addMsg("user", clean);
  textInput.value = "";

  showTyping();
  try {
    const r = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: clean,
        state: agentState,
        lang: userProfile.lang,
        user: { email: userProfile.email }
      })
    });
    const data = await r.json();
    hideTyping();

    agentState = data.state || agentState;

    addMsg("agent", data.reply);
    speak(data.reply);

    if (data.auto_send) {
      await sendAppointment();
    }
  } catch (e) {
    hideTyping();
    addMsg("agent", "Es gab ein Verbindungsproblem mit dem Server.");
  }
}

// Spracherkennung starten
function startRecognition() {
  if (!initialized) {
    alert("Bitte zuerst E-Mail und Sprache wählen.");
    return;
  }
  if (!SpeechRecognition) {
    alert(
      "Spracherkennung wird von diesem Browser nicht unterstützt. Bitte einen aktuellen Browser verwenden."
    );
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = getLangCode();
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    micBtn.classList.add("recording");
  };
  rec.onend = () => {
    micBtn.classList.remove("recording");
  };
  rec.onerror = () => {
    micBtn.classList.remove("recording");
  };
  rec.onresult = (evt) => {
    const text = evt.results[0][0].transcript;
    sendToAgent(text);
  };

  rec.start();
}

// Feedback senden
async function sendFeedback() {
  feedbackStatus.textContent = "";
  const text = feedbackText.value.trim();

  if (!text) {
    feedbackStatus.textContent = "Bitte schreibe kurz, was los ist 🙂";
    return;
  }

  try {
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userProfile.email || "",
        text
      })
    });
    const data = await r.json();

    if (data.ok) {
      feedbackStatus.textContent = "Vielen Dank für dein Feedback 🙏";
      feedbackText.value = "";
    } else {
      feedbackStatus.textContent = "Feedback konnte nicht gesendet werden.";
    }
  } catch (e) {
    feedbackStatus.textContent = "Netzwerkfehler beim Senden des Feedbacks.";
  }
}

// Overlay / Login
if (startBtn) {
  startBtn.addEventListener("click", () => {
    const email = (welcomeEmail.value || "").trim();
    const lang = welcomeLang.value || "de";

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      alert("Bitte eine gültige E-Mail-Adresse eingeben (z. B. name@icloud.com).");
      return;
    }

    userProfile.email = email;
    userProfile.lang = lang;
    initialized = true;

    if (overlay) {
      overlay.classList.add("hidden");
    }
  });
}

// Sidepanel: Salon-Infos
if (menuBtn && infoPanel && closePanelBtn) {
  menuBtn.addEventListener("click", () => {
    infoPanel.classList.remove("hidden");
  });

  closePanelBtn.addEventListener("click", () => {
    infoPanel.classList.add("hidden");
  });

  // Panel schließen, wenn in den dunklen Bereich geklickt wird (außerhalb)
  infoPanel.addEventListener("click", (e) => {
    if (e.target === infoPanel) {
      infoPanel.classList.add("hidden");
    }
  });
}

// Drei-Punkte-Menü: Leistung + Feedback
if (moreBtn && moreMenu && moreCloseBtn) {
  moreBtn.addEventListener("click", () => {
    moreMenu.classList.remove("hidden");
  });

  moreCloseBtn.addEventListener("click", () => {
    moreMenu.classList.add("hidden");
  });

  moreMenu.addEventListener("click", (e) => {
    if (e.target === moreMenu) {
      moreMenu.classList.add("hidden");
    }
  });
}

// Events

micBtn.addEventListener("click", () => {
  if (hasTTS && speaking) {
    synth.cancel();
    speaking = false;
  }
  startRecognition();
});

sendBtn.addEventListener("click", () => {
  const text = textInput.value;
  sendToAgent(text);
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const text = textInput.value;
    sendToAgent(text);
  }
});

feedbackSendBtn.addEventListener("click", () => {
  sendFeedback();
});
