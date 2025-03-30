// ---------- Global Variables and Storage Keys ----------
const KB_KEY = 'knowledgeBase';
const SESSIONS_KEY = 'chatSessions';
let activeChatId = null;
let trainingPending = false;
let pendingQuestion = "";
let lastBotMessage = "";

// ---------- DOM Elements ----------
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatSessionsDiv = document.getElementById('chat-sessions');
const chatTitle = document.getElementById('chat-title');
const downloadBtn = document.getElementById('download-btn');
const fileInput = document.getElementById('file-input');
const clearKBBtn = document.getElementById('clear-kb-btn');

// ---------- Knowledge Base Functions ----------
function loadKB() {
  const kbString = localStorage.getItem(KB_KEY);
  return kbString ? JSON.parse(kbString) : {};
}

function saveKB(kb) {
  localStorage.setItem(KB_KEY, JSON.stringify(kb));
}

function addEntry(question, answer) {
  const kb = loadKB();
  const normQ = normalize(question);
  kb[normQ] = answer;
  saveKB(kb);
}

function findAnswer(question) {
  const kb = loadKB();
  const normQ = normalize(question);
  return kb[normQ] || "";
}

function normalize(text) {
  return text.trim().toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ");
}

// ---------- Chat Session Storage Functions ----------
function loadChatSessions() {
  const sessions = localStorage.getItem(SESSIONS_KEY);
  return sessions ? JSON.parse(sessions) : [];
}

function saveChatSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function createNewSession() {
  const sessions = loadChatSessions();
  const newSession = {
    id: Date.now().toString(),
    name: "New Chat",
    messages: [],
    archived: false
  };
  sessions.push(newSession);
  saveChatSessions(sessions);
  return newSession;
}

function updateSession(session) {
  let sessions = loadChatSessions();
  sessions = sessions.map(s => s.id === session.id ? session : s);
  saveChatSessions(sessions);
}

// ---------- UI Rendering Functions ----------
function renderChatSessions() {
  const sessions = loadChatSessions();
  chatSessionsDiv.innerHTML = "";
  sessions.forEach(session => {
    // Create session container
    const sessionDiv = document.createElement('div');
    sessionDiv.className = 'chat-session' + (session.id === activeChatId ? ' active' : '');
    sessionDiv.dataset.id = session.id;
    
    // Session name element
    const nameSpan = document.createElement('span');
    nameSpan.className = 'session-name';
    nameSpan.textContent = session.name;
    nameSpan.addEventListener('click', () => {
      setActiveSession(session.id);
    });
    sessionDiv.appendChild(nameSpan);
    
    // Hamburger menu button for chat options
    const menuBtn = document.createElement('button');
    menuBtn.className = 'session-menu';
    menuBtn.textContent = '☰';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle dropdown menu: if exists, remove it
      const existingMenu = sessionDiv.querySelector('.dropdown-menu');
      if (existingMenu) {
        existingMenu.remove();
      } else {
        // Create dropdown menu element
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu';
        
        // Rename option
        const renameOption = document.createElement('div');
        renameOption.className = 'dropdown-menu-item';
        renameOption.textContent = 'Rename';
        renameOption.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const newName = prompt("Enter new chat name:", session.name);
          if (newName) {
            session.name = newName;
            updateSession(session);
            renderChatSessions();
            if (session.id === activeChatId) chatTitle.textContent = newName;
          }
          dropdown.remove();
        });
        dropdown.appendChild(renameOption);
        
        // Archive option
        const archiveOption = document.createElement('div');
        archiveOption.className = 'dropdown-menu-item';
        archiveOption.textContent = 'Archive';
        archiveOption.addEventListener('click', (ev) => {
          ev.stopPropagation();
          session.archived = true;
          updateSession(session);
          renderChatSessions();
          if (session.id === activeChatId) {
            const remaining = loadChatSessions().filter(s => !s.archived);
            if (remaining.length) {
              setActiveSession(remaining[0].id);
            } else {
              activeChatId = null;
              chatTitle.textContent = "Flinging Machine";
              chatContainer.innerHTML = "";
            }
          }
          dropdown.remove();
        });
        dropdown.appendChild(archiveOption);
        
        // Delete option
        const deleteOption = document.createElement('div');
        deleteOption.className = 'dropdown-menu-item';
        deleteOption.textContent = 'Delete';
        deleteOption.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (confirm("Are you sure you want to delete this chat?")) {
            let sessions = loadChatSessions();
            sessions = sessions.filter(s => s.id !== session.id);
            saveChatSessions(sessions);
            if (session.id === activeChatId) {
              activeChatId = null;
              chatContainer.innerHTML = "";
              chatTitle.textContent = "Flinging Machine";
              if (sessions.length) setActiveSession(sessions[0].id);
            }
            renderChatSessions();
          }
          dropdown.remove();
        });
        dropdown.appendChild(deleteOption);
        
        sessionDiv.appendChild(dropdown);
      }
    });
    sessionDiv.appendChild(menuBtn);
    chatSessionsDiv.appendChild(sessionDiv);
  });
}

function setActiveSession(sessionId) {
  activeChatId = sessionId;
  const sessions = loadChatSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;
  chatTitle.textContent = session.name;
  renderChatSessions();
  renderChatMessages(session);
}

function renderChatMessages(session) {
  chatContainer.innerHTML = "";
  session.messages.forEach(msg => {
    appendMessage(msg.text, msg.sender, false);
  });
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendMessage(message, sender, save = true) {
  const div = document.createElement('div');
  div.className = `chat-message ${sender}`;
  div.textContent = message;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  if (save && activeChatId) {
    let sessions = loadChatSessions();
    const session = sessions.find(s => s.id === activeChatId);
    if (session) {
      session.messages.push({ sender, text: message });
      updateSession(session);
    }
  }
}

// ---------- Chat and Training Logic ----------
function generateResponse(userText) {
  const lower = normalize(userText);
  if (lower.match(/^(hi|hello|hey)$/)) {
    return "Hello! How can I assist you today?";
  }
  if (lower.match(/\b(bye|goodbye)\b/)) {
    return "Goodbye! Feel free to chat again anytime.";
  }
  return findAnswer(userText);
}

function processUserMessage() {
  const userText = chatInput.value.trim();
  if (!userText || !activeChatId) return;
  appendMessage("You: " + userText, "user");
  chatInput.value = "";
  
  if (trainingPending) {
    addEntry(pendingQuestion, userText);
    appendMessage("Bot: Thanks, I've learned that!", "bot");
    trainingPending = false;
    pendingQuestion = "";
    return;
  }
  
  const response = generateResponse(userText);
  if (response) {
    lastBotMessage = response;
    setTimeout(() => {
      appendMessage("Bot: " + response, "bot");
    }, 500);
  } else {
    pendingQuestion = userText;
    trainingPending = true;
    lastBotMessage = "I don't know that. Could you please teach me the correct answer?";
    setTimeout(() => {
      appendMessage("Bot: " + lastBotMessage, "bot");
    }, 500);
  }
}

// ---------- Voice Synthesis ----------
voiceBtn.addEventListener('click', () => {
  if (!lastBotMessage) return;
  const utterance = new SpeechSynthesisUtterance(lastBotMessage);
  speechSynthesis.speak(utterance);
});

// ---------- File Import/Export for KB ----------
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const content = evt.target.result;
    let count = 0;
    if (file.name.endsWith('.json') || content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        const jsonData = JSON.parse(content);
        if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
          for (const question in jsonData) {
            addEntry(question, jsonData[question]);
            count++;
          }
        } else if (Array.isArray(jsonData)) {
          jsonData.forEach(item => {
            if (item.question && item.answer) {
              addEntry(item.question, item.answer);
              count++;
            }
          });
        }
        appendMessage("Bot: Loaded " + count + " entries from JSON file.", "bot");
      } catch (err) {
        appendMessage("Bot: Error parsing JSON file.", "bot");
      }
    } else {
      const lines = content.split(/\r?\n/);
      lines.forEach(line => {
        if (line.trim() === "") return;
        const parts = line.split("|||");
        if (parts.length === 2) {
          addEntry(parts[0], parts[1]);
          count++;
        }
      });
      appendMessage("Bot: Loaded " + count + " entries from text file.", "bot");
    }
  };
  reader.readAsText(file);
});

downloadBtn.addEventListener('click', () => {
  const kb = loadKB();
  let content = "";
  for (const question in kb) {
    content += question + "|||" + kb[question] + "\n";
  }
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'knowledge_base.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});

clearKBBtn.addEventListener('click', () => {
  if (confirm("Are you sure you want to clear the knowledge base?")) {
    localStorage.removeItem(KB_KEY);
    appendMessage("Bot: Knowledge base cleared.", "bot");
  }
});

// ---------- New Chat Feature ----------
newChatBtn.addEventListener('click', () => {
  const newSession = createNewSession();
  activeChatId = newSession.id;
  chatContainer.innerHTML = "";
  chatTitle.textContent = newSession.name;
  renderChatSessions();
  appendMessage("Bot: New chat started. How can I help you today?", "bot", false);
});

// ---------- Send Message Listener ----------
sendBtn.addEventListener('click', processUserMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') processUserMessage();
});

// ---------- Pre-Load Knowledge Base from data.json ----------
async function loadPreTrainedData() {
  try {
    const response = await fetch('data.json');
    const preTrainedData = await response.json();
    const kb = loadKB();
    let count = 0;
    preTrainedData.forEach(pair => {
      const normQ = normalize(pair.question);
      if (!kb[normQ]) {  // Only add if not already present
        addEntry(pair.question, pair.answer);
        count++;
      }
    });
    appendMessage("Bot: Pre-trained " + count + " entries loaded.", "bot", false);
  } catch (err) {
    console.error("Error loading pre-trained data:", err);
  }
}

// ---------- Initialization ----------
function init() {
  loadPreTrainedData();
  let sessions = loadChatSessions();
  if (!sessions.length) {
    const defaultSession = createNewSession();
    activeChatId = defaultSession.id;
  } else if (!activeChatId) {
    const activeSession = sessions.find(s => !s.archived) || sessions[0];
    activeChatId = activeSession.id;
  }
  renderChatSessions();
  const currentSession = loadChatSessions().find(s => s.id === activeChatId);
  if (currentSession) {
    chatTitle.textContent = currentSession.name;
    renderChatMessages(currentSession);
  }
}

init();

