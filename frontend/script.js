// ===== 1. API KEY =====
let API_KEY = localStorage.getItem('jarvis_key');
if (!API_KEY) {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY) localStorage.setItem('jarvis_key', API_KEY);
}
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];

// ===== 2. MEMORY =====
let MEMORY = [];
try {
  const storedMemory = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');
  if (Array.isArray(storedMemory)) {
    MEMORY = storedMemory.filter(
      m => m && (m.role === 'user' || m.role === 'model') &&
      typeof m.text === 'string' &&
      !(m.role === 'model' && /(?:Your strong password:|password:)/i.test(m.text))
    );
    if (MEMORY.length !== storedMemory.length) {
      localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
    }
  } else {
    localStorage.removeItem('jarvis_memory');
  }
} catch (e) {
  localStorage.removeItem('jarvis_memory');
}

function saveMemory() {
  localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
}

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');
const camBtn = document.getElementById('cam-btn');
const imgInput = document.getElementById('img-input');

MEMORY.forEach(m => add((m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text, m.role === 'user' ? 'user' : 'ai'));

// ===== WORKOUT PLAN DATA (6-DAY PHYSIQUE TRANSFORMATION SPLIT) =====
const WORKOUT_PLAN = {
  1: "Day 1 (Monday) - Chest + Triceps: Bench Press 3x8-12, Incline DB Press 3x10, Chest Fly 3x12, Tricep Pushdown 3x12, OH Tricep Extension 3x10, Push-ups 2 sets.",
  2: "Day 2 (Tuesday) - Back + Biceps: Lat Pulldown 3x10, Seated Cable Row 3x10, One-arm DB Row 3x10, Barbell Curl 3x12, Hammer Curl 3x12, Dead Hang 2 sets.",
  3: "Day 3 (Wednesday) - Legs: Squats 4x8, Leg Press 3x10, Leg Curl 3x12, Leg Extension 3x12, Calf Raises 4x15.",
  4: "Day 4 (Thursday) - Shoulders + Abs: Shoulder Press 3x10, Lateral Raises 3x12, Front Raises 3x12, Shrugs 3x15, Crunches 3x20, Leg Raises 3x15, Plank 3x30 sec.",
  5: "Day 5 (Friday) - Chest + Back: Incline Bench Press 3x10, Lat Pulldown 3x10, Dumbbell Press 3x10, Cable Row 3x10, Push-ups 2 sets.",
  6: "Day 6 (Saturday) - Arms + Abs: Barbell Curl 3x10, Hammer Curl 3x12, Tricep Dips 3x10, Rope Pushdown 3x12, Russian Twists 3x20, Plank 3x45 sec.",
  7: "Day 7 (Sunday) - Rest Day: Light Walking or Cycling, Stretching, Stay Hydrated, and Get Good Sleep."
};

function getWorkoutResponse(t) {
  if (t.includes('full workout') || t.includes('all workout') || t.includes('weekly workout')) {
    return Object.values(WORKOUT_PLAN).join('\n');
  }
  if (t.includes('day 1') || t.includes('monday') || (t.includes('chest') && t.includes('tricep'))) return WORKOUT_PLAN[1];
  if (t.includes('day 2') || t.includes('tuesday') || t.includes('back') && t.includes('bicep')) return WORKOUT_PLAN[2];
  if (t.includes('day 3') || t.includes('wednesday') || t.includes('leg')) return WORKOUT_PLAN[3];
  if (t.includes('day 4') || t.includes('thursday') || t.includes('shoulder')) return WORKOUT_PLAN[4];
  if (t.includes('day 5') || t.includes('friday') || (t.includes('chest') && t.includes('back'))) return WORKOUT_PLAN[5];
  if (t.includes('day 6') || t.includes('saturday') || t.includes('arm')) return WORKOUT_PLAN[6];
  if (t.includes('day 7') || t.includes('sunday') || t.includes('rest day')) return WORKOUT_PLAN[7];

  // Default to today's day of the week (JS getDay(): 0 = Sunday -> Day 7, 1 = Monday -> Day 1, etc.)
  const jsDay = new Date().getDay();
  const planDay = jsDay === 0 ? 7 : jsDay;
  return "Today's Workout, Boss — " + WORKOUT_PLAN[planDay];
}

// ===== 3. TOOLS (THE HANDS) =====
async function fetchToolJson(url, options = {}, timeoutMs = 10000) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function handleTools(text) {
  const t = text.toLowerCase();

  // Workout Plan Tool (Custom Tool from Image)
  if (t.includes('workout') || t.includes('gym') || t.includes('exercise') || t.includes('split')) {
    return getWorkoutResponse(t);
  }

  // Open Instagram (Custom Tool)
  if (t.includes('instagram') || t.includes('insta')) {
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    return 'Opening Instagram, Boss.';
  }

  // Make Phone Calls (Custom Tool)
  if (t.includes('call') || t.includes('dial')) {
    const phoneMatch = t.match(/(\+?\d[\d\s-]{6,15}\d)/);
    if (phoneMatch) {
      const number = phoneMatch[1].replace(/[\s-]/g, '');
      window.location.href = `tel:${number}`;
      return `Calling ${number}, Boss.`;
    } else {
      window.location.href = 'tel:';
      return 'Opening phone dialer, Boss.';
    }
  }

  // Open YouTube
  if (/^\s*(?:please\s+)?(?:open\s+youtube|youtube\s+open|youtube)(?:\s+please)?[.!?]*\s*$/i.test(text)) {
    window.open('https://youtube.com', '_blank', 'noopener,noreferrer');
    return 'Opening YouTube, Boss.';
  }

  // Open Google
  if (/^\s*(?:please\s+)?(?:open\s+google|google\s+open|google)(?:\s+please)?[.!?]*\s*$/i.test(text)) {
    window.open('https://google.com', '_blank', 'noopener,noreferrer');
    return 'Opening Google, Boss.';
  }

  // Open Specific URL
  const urlCommand = text.match(/^\s*(?:open|visit|go to)\s+(https?:\/\/\S+)\s*$/i);
  if (urlCommand) {
    try {
      const destination = new URL(urlCommand[1]);
      if (destination.protocol !== 'https:' && destination.protocol !== 'http:') {
        return 'Only http and https links can be opened.';
      }
      window.open(destination.href, '_blank', 'noopener,noreferrer');
      return 'Opening ' + destination.hostname + ', Boss.';
    } catch (e) {
      return 'That link does not look valid.';
    }
  }

  // Google Search
  if (/^\s*(?:google\s+search|search\s+(?:on\s+)?google)(?:\s+for)?\s*$/i.test(text)) {
    return 'Tell me what to search for on Google.';
  }
  const googleSearch = text.match(/^\s*(?:google\s+search|search\s+(?:on\s+)?google)(?:\s+for)?\s+(.+?)\s*$/i);
  if (googleSearch) {
    const query = googleSearch[1].trim();
    if (!query) return 'Tell me what to search for on Google.';
    window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank', 'noopener,noreferrer');
    return 'Searching Google for ' + query + ', Boss.';
  }

  // YouTube Search / Play
  const playMatch = text.match(/^\s*play\s+(.+?)\s*$/i);
  const youtubeMatch = text.match(/^\s*youtube(?:\s+search)?(?:\s+for)?\s+(.+?)\s*$/i);
  const searchYoutubeMatch = text.match(/^\s*search\s+(?:on\s+)?youtube(?:\s+for)?\s+(.+?)\s*$/i);
  const videoQuery = (playMatch || youtubeMatch || searchYoutubeMatch)?.[1]?.trim();
  if (videoQuery) {
    window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(videoQuery), '_blank', 'noopener,noreferrer');
    return 'Searching YouTube for ' + videoQuery + ', Boss.';
  }

  // Time Tool
  if (/\btime\b/.test(t) || t.includes('సమయం') || t.includes('టైం')) {
    return 'Current time is ' + new Date().toLocaleTimeString() + ', Boss.';
  }

  // Weather Tool
  if (t.includes('weather') || t.includes('వాతావరణం')) {
    return await new Promise(res => {
      navigator.geolocation.getCurrentPosition(async p => {
        try {
          const d = await fetchToolJson(`https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current_weather=true`);
          res(`Current temperature is ${d.current_weather.temperature}°C, wind speed ${d.current_weather.windspeed} km/h.`);
        } catch (e) {
          res('Weather service error, Boss.');
        }
      }, () => res('Location permission denied for weather.'));
    });
  }

  // Tech News Tool
  if (t.includes('news')) {
    try {
      const d = await fetchToolJson('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=3');
      const headlines = (d.hits || []).map(h => h.title).join('; ');
      return headlines ? 'Top tech headlines: ' + headlines : 'No news available right now.';
    } catch (e) {
      return 'News service error, Boss.';
    }
  }

  // Crypto / Bitcoin Tool
  if (t.includes('crypto') || t.includes('bitcoin') || t.includes('btc')) {
    try {
      const d = await fetchToolJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,inr');
      return `Bitcoin price is $${d.bitcoin.usd} (₹${d.bitcoin.inr}).`;
    } catch (e) {
      return 'Crypto price service error, Boss.';
    }
  }

  // Timer Tool
  const m = t.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i);
  if ((t.includes('timer') || t.includes('టైమర్')) && m) {
    const amount = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const factor = /^(hours?|hrs?|h)/.test(unit) ? 3600000 : /^(seconds?|secs?|s)/.test(unit) ? 1000 : 60000;
    setTimeout(() => speak(`Time is up Boss! ${amount} ${unit} timer completed.`), amount * factor);
    return `Timer set for ${amount} ${unit}, Boss.`;
  }

  // Translate Tool
  if (t.includes('translate')) {
    const q = text.replace(/translate\s+(this\s+)?/i, '').replace(/\s+(to|into)\s+telugu/i, '').trim() || 'hello';
    try {
      const d = await fetchToolJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=en|te');
      return 'In Telugu: ' + d.responseData.translatedText;
    } catch (e) {
      return 'Translate error, Boss.';
    }
  }

  // Wikipedia Search Tool
  const searchMatch = text.match(/^\s*(?:search|look up)\s+(?:for\s+)?(.+?)\s*$/i);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    if (!query) return 'Tell me what to search for.';
    try {
      const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&srsearch=' + encodeURIComponent(query) + '&format=json&origin=*';
      const data = await fetchToolJson(url);
      const result = data?.query?.search?.[0];
      if (!result) return 'I could not find that, Boss.';
      const snippet = String(result.snippet || '')
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      return 'Wikipedia summary: ' + result.title + (snippet ? '. ' + snippet : '');
    } catch (e) {
      return 'Search error, Boss.';
    }
  }

  return null;
}

// ===== 3.5. AGENT MODE ENGINE (EPISODE 07) =====
const AGENT_TOOLS = Object.freeze({
  time: async () => handleTools('current time'),
  weather: async () => handleTools('weather'),
  news: async () => handleTools('news'),
  crypto: async () => handleTools('bitcoin'),
  workout: async () => handleTools('workout')
});

const AGENT_TOOL_NAMES = Object.freeze({
  time: 'time',
  weather: 'weather',
  news: 'news',
  crypto: 'crypto',
  workout: 'workout'
});

function isAgentModeRequest(text = '') {
  const value = String(text || '');
  if (/\b(?:agent(?:\s+mode)?|run\s+(?:the\s+)?agent|use\s+(?:the\s+)?agent)\b/i.test(value)) return true;
  if (/\b(?:briefing|research|analy[sz]e|analysis)\b/i.test(value)) return true;
  return /\bplan\b/i.test(value) && /\b(?:time|weather|news|crypto|bitcoin|btc|workout|gym)\b/i.test(value);
}

function parseAgentToolPlan(responseText) {
  const text = String(responseText || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('Agent plan format incorrect.');
  const parsed = JSON.parse(text.slice(start, end + 1));
  const allowed = new Set(Object.keys(AGENT_TOOLS));
  return [...new Set(
    parsed
      .filter(item => typeof item === 'string')
      .map(item => item.trim().toLowerCase())
      .filter(item => allowed.has(item))
  )];
}

function fallbackAgentToolPlan(goal) {
  const g = String(goal || '').toLowerCase();
  const plan = [];
  if (g.includes('briefing') || g.includes('morning')) return ['time', 'weather', 'workout', 'news'];
  if (g.includes('time')) plan.push('time');
  if (g.includes('weather') || g.includes('trip') || g.includes('plan')) plan.push('weather');
  if (g.includes('workout') || g.includes('gym')) plan.push('workout');
  if (g.includes('news') || g.includes('research')) plan.push('news');
  if (g.includes('crypto') || g.includes('bitcoin')) plan.push('crypto');
  return plan.length ? plan : ['time', 'weather', 'news'];
}

async function runAgent(goal) {
  add('J.A.R.V.I.S: AGENT MODE ACTIVATED.', 'ai');
  add('J.A.R.V.I.S: Goal analyze chesthunna...', 'ai');

  const planPrompt = 'Select the needed tools from ["time", "weather", "news", "crypto", "workout"] and return ONLY a JSON array. Goal: ' + JSON.stringify(String(goal));
  let toolsToRun;
  try {
    toolsToRun = parseAgentToolPlan(await callGeminiRaw(planPrompt));
    if (!toolsToRun.length) toolsToRun = fallbackAgentToolPlan(goal);
  } catch (error) {
    toolsToRun = fallbackAgentToolPlan(goal);
  }

  const results = {};
  for (let i = 0; i < toolsToRun.length; i++) {
    const tool = toolsToRun[i];
    add('J.A.R.V.I.S: [' + (i + 1) + '/' + toolsToRun.length + '] ' + AGENT_TOOL_NAMES[tool] + ' tool run chesthunna...', 'ai');
    try {
      results[tool] = await AGENT_TOOLS[tool]();
    } catch (e) {
      results[tool] = 'Tool error';
    }
  }

  add('J.A.R.V.I.S: Results combine chesthunna...', 'ai');
  const summaryPrompt = 'Goal: ' + JSON.stringify(String(goal)) + '. Tool results: ' + JSON.stringify(results) + '. Give a concise, helpful Telugu/English summary for Boss.';
  return await callGemini(summaryPrompt);
}

// ===== 4. GEMINI BRAIN =====
async function callGeminiRaw(promptText) {
  if (!API_KEY) throw new Error('Gemini API key is missing.');
  let lastErr;
  for (const m of MODELS) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptText }] }] })
      });
      const data = await res.json();
      if (data.error) {
        lastErr = new Error(data.error.message);
        if (/high demand|temporar|quota|rate|unavailable|deprecated/i.test(data.error.message)) continue;
        throw lastErr;
      }
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function callGemini(p) {
  if (!API_KEY) throw new Error('Gemini API key is missing.');
  const contents = MEMORY.slice(-12).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
  contents.push({ role: 'user', parts: [{ text: p }] });

  let lastErr;
  for (const m of MODELS) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: contents })
      });
      const data = await res.json();
      if (data.error) {
        lastErr = new Error(data.error.message);
        if (/high demand|temporar|quota|rate|unavailable|deprecated/i.test(data.error.message)) continue;
        throw lastErr;
      }
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ===== 5. MASTER ROUTER (AGENT -> TOOLS -> BRAIN) =====
async function processCommand(p) {
  try {
    // 1. Check if Agent Mode should trigger
    if (isAgentModeRequest(p)) {
      const agentReply = await runAgent(p);
      MEMORY.push({ role: 'user', text: p });
      MEMORY.push({ role: 'model', text: agentReply });
      saveMemory();
      add('J.A.R.V.I.S: ' + agentReply, 'ai');
      speak(agentReply);
      return;
    }

    // 2. Check single Tools
    add('J.A.R.V.I.S: Thinking...', 'ai');
    const toolReply = await handleTools(p);
    if (toolReply) {
      chat.lastChild.innerText = 'J.A.R.V.I.S: ' + toolReply;
      speak(toolReply);
      return;
    }

    // 3. Default to Gemini Brain with Memory
    const reply = await callGemini(p);
    MEMORY.push({ role: 'user', text: p });
    MEMORY.push({ role: 'model', text: reply });
    saveMemory();
    chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
    speak(reply);
  } catch (e) {
    add('J.A.R.V.I.S: ERROR ' + e.message, 'ai');
  }
}

// ===== 6. VISION ENGINE (THE EYES) =====
if (camBtn && imgInput) {
  camBtn.onclick = () => imgInput.click();
  imgInput.onchange = () => {
    const file = imgInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      const q = input.value.trim() || 'What do you see? Describe briefly.';
      add('YOU: [IMAGE] ' + q, 'user');
      input.value = '';
      askVision(base64, file.type, q);
    };
    reader.readAsDataURL(file);
  };
}

async function askVision(base64, mime, q) {
  add('J.A.R.V.I.S: Analyzing image...', 'ai');
  let lastErr;
  for (const m of MODELS) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: q }, { inline_data: { mime_type: mime, data: base64 } }] }]
        })
      });
      const data = await res.json();
      if (data.error) {
        lastErr = new Error(data.error.message);
        if (/high demand|temporar|quota|rate|unavailable|deprecated/i.test(data.error.message)) continue;
        throw lastErr;
      }
      const reply = data.candidates[0].content.parts[0].text;
      chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
      speak(reply);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR ' + lastErr.message;
}

// ===== 7. VOICE & UTILS =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR && micBtn) {
  const rec = new SR();
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    const t = e.results[0][0].transcript;
    add('YOU: ' + t, 'user');
    processCommand(t);
  };
  micBtn.onclick = () => {
    rec.start();
    micBtn.innerText = 'LISTENING...';
  };
  rec.onend = () => {
    micBtn.innerText = '🎤';
  };
}

let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function speak(t) {
  const u = new SpeechSynthesisUtterance(t);
  u.rate = 1.05;
  u.pitch = 0.85;
  const v = voices.find(v => v.lang.startsWith('en'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

document.getElementById('send').onclick = () => {
  const t = input.value.trim();
  if (!t) return;
  add('YOU: ' + t, 'user');
  input.value = '';
  processCommand(t);
};

if (clearBtn) {
  clearBtn.onclick = () => {
    MEMORY = [];
    saveMemory();
    chat.innerHTML = '';
    add('SYSTEM: Memory cleared.', 'ai');
  };
}

function add(t, w) {
  const d = document.createElement('div');
  d.className = 'msg ' + w;
  d.innerText = t;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}
