// ===== 1. API KEY & MULTI-MODEL QUOTA FALLBACK =====
let API_KEY = localStorage.getItem('jarvis_key');
if (!API_KEY) {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY) localStorage.setItem('jarvis_key', API_KEY.trim());
}

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

// ===== 2. LONG-TERM MEMORY (EPISODE 05) =====
let MEMORY = [];
try {
  const stored = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');
  if (Array.isArray(stored)) {
    MEMORY = stored.filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string');
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
const core = document.getElementById('core');
const coreText = document.getElementById('core-text');

function setCoreState(state, label) {
  if (core) {
    core.classList.remove('listening', 'thinking');
    if (state) core.classList.add(state);
  }
  if (coreText && label) coreText.innerText = label;
}

MEMORY.forEach(m => add((m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text, m.role === 'user' ? 'user' : 'ai'));

// ===== WORKOUT SPLIT (6-DAY PHYSIQUE TRANSFORMATION) =====
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
  if (t.includes('day 2') || t.includes('tuesday') || (t.includes('back') && t.includes('bicep'))) return WORKOUT_PLAN[2];
  if (t.includes('day 3') || t.includes('wednesday') || t.includes('leg')) return WORKOUT_PLAN[3];
  if (t.includes('day 4') || t.includes('thursday') || t.includes('shoulder')) return WORKOUT_PLAN[4];
  if (t.includes('day 5') || t.includes('friday') || (t.includes('chest') && t.includes('back'))) return WORKOUT_PLAN[5];
  if (t.includes('day 6') || t.includes('saturday') || t.includes('arm')) return WORKOUT_PLAN[6];
  if (t.includes('day 7') || t.includes('sunday') || t.includes('rest day')) return WORKOUT_PLAN[7];

  const jsDay = new Date().getDay();
  const planDay = jsDay === 0 ? 7 : jsDay;
  return "Today's Workout, Boss — " + WORKOUT_PLAN[planDay];
}

// ===== 3. ALL TOOLS (EPISODE 06 + CUSTOM TOOLS - ZERO QUOTA) =====
async function fetchToolJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

async function handleTools(text) {
  const t = text.toLowerCase().trim();

  // Change / Reset API Key
  if (t.includes('change api key') || t.includes('reset api key')) {
    const newKey = prompt('Enter new Gemini API Key:');
    if (newKey) {
      API_KEY = newKey.trim();
      localStorage.setItem('jarvis_key', API_KEY);
      return 'New API Key saved, Boss.';
    }
    return 'API Key unchanged.';
  }

  // Workout Plan
  if (t.includes('workout') || t.includes('gym') || t.includes('exercise') || t.includes('split')) {
    return getWorkoutResponse(t);
  }

  // Open Instagram
  if (t.includes('instagram') || t.includes('insta')) {
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    return 'Opening Instagram, Boss.';
  }

  // Make Phone Calls
  if (t.includes('call') || t.includes('dial')) {
    const phoneMatch = t.match(/(\+?\d[\d\s-]{6,15}\d)/);
    if (phoneMatch) {
      const number = phoneMatch[1].replace(/[\s-]/g, '');
      window.location.href = `tel:${number}`;
      return `Calling ${number}, Boss.`;
    }
    window.location.href = 'tel:';
    return 'Opening phone dialer, Boss.';
  }

  // Time
  if (/\btime\b/.test(t) || t.includes('సమయం') || t.includes('టైం')) {
    return 'Current time is ' + new Date().toLocaleTimeString() + ', Boss.';
  }

  // Date
  if (/\bdate\b/.test(t)) {
    return 'Today is ' + new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ', Boss.';
  }

  // Weather (GPS with Rajamahendravaram coordinates fallback)
  if (t.includes('weather') || t.includes('వాతావరణం')) {
    return await new Promise(res => {
      const fetchWeather = async (lat, lon) => {
        try {
          const d = await fetchToolJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
          res(`Current temperature is ${d.current_weather.temperature}°C, wind speed ${d.current_weather.windspeed} km/h.`);
        } catch (e) {
          res('Weather service error, Boss.');
        }
      };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          p => fetchWeather(p.coords.latitude, p.coords.longitude),
          () => fetchWeather(17.0005, 81.8040)
        );
      } else {
        fetchWeather(17.0005, 81.8040);
      }
    });
  }

  // Tech News
  if (t.includes('news')) {
    try {
      const d = await fetchToolJson('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=3');
      const headlines = (d.hits || []).map(h => h.title).join('; ');
      return headlines ? 'Top tech headlines: ' + headlines : 'No news available right now.';
    } catch (e) {
      return 'News service error, Boss.';
    }
  }

  // Crypto / Bitcoin
  if (t.includes('crypto') || t.includes('bitcoin') || t.includes('btc')) {
    try {
      const d = await fetchToolJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,inr');
      return `Bitcoin price is $${d.bitcoin.usd} (₹${d.bitcoin.inr}).`;
    } catch (e) {
      return 'Crypto price service error, Boss.';
    }
  }

  // Timer
  const m = t.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i);
  if ((t.includes('timer') || t.includes('టైమర్')) && m) {
    const amount = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const factor = /^(hours?|hrs?|h)/.test(unit) ? 3600000 : /^(seconds?|secs?|s)/.test(unit) ? 1000 : 60000;
    setTimeout(() => speak(`Time is up Boss! ${amount} ${unit} timer completed.`), amount * factor);
    return `Timer set for ${amount} ${unit}, Boss.`;
  }

  // Telugu Translator
  if (t.includes('translate')) {
    const q = text.replace(/translate\s+(this\s+)?/i, '').replace(/\s+(to|into)\s+telugu/i, '').trim() || 'hello';
    try {
      const d = await fetchToolJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=en|te');
      return 'In Telugu: ' + d.responseData.translatedText;
    } catch (e) {
      return 'Translate error, Boss.';
    }
  }

  // Password Generator
  if (t.includes('password')) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%&*';
    let pass = '';
    for (let i = 0; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    return 'Generated password: ' + pass;
  }

  // Dice / Coin Flip
  if (t.includes('flip') || t.includes('coin')) {
    return 'Coin flip result: ' + (Math.random() < 0.5 ? 'Heads' : 'Tails') + ', Boss.';
  }
  if (t.includes('dice') || t.includes('roll')) {
    return 'Dice rolled: ' + (Math.floor(Math.random() * 6) + 1) + ', Boss.';
  }

  // Wikipedia Search
  const wikiMatch = text.match(/^\s*(?:wikipedia|wiki|who is|what is)\s+(.+?)\s*$/i);
  if (wikiMatch && !t.includes('time') && !t.includes('weather') && !t.includes('workout') && !t.includes('bitcoin')) {
    const query = wikiMatch[1].trim();
    try {
      const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&srsearch=' + encodeURIComponent(query) + '&format=json&origin=*';
      const data = await fetchToolJson(url);
      const result = data?.query?.search?.[0];
      if (result) {
        const snippet = String(result.snippet || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
        return 'Wikipedia: ' + result.title + '. ' + snippet;
      }
    } catch (e) {}
  }

  // YouTube / Google
  if (t.includes('youtube') || t.startsWith('play ')) {
    const q = text.replace(/^(play|open|search)\s*(on\s*)?(youtube\s*)?/i, '').trim();
    if (q) {
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank', 'noopener,noreferrer');
      return 'Searching YouTube for ' + q + ', Boss.';
    }
    window.open('https://youtube.com', '_blank', 'noopener,noreferrer');
    return 'Opening YouTube, Boss.';
  }

  if (t.startsWith('google ') || t.includes('search google')) {
    const q = text.replace(/^(search\s+google\s+for|google\s+search|google)\s*/i, '').trim();
    if (q) {
      window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener,noreferrer');
      return 'Searching Google for ' + q + ', Boss.';
    }
    window.open('https://google.com', '_blank', 'noopener,noreferrer');
    return 'Opening Google, Boss.';
  }

  return null;
}

// ===== 4. AUTONOMOUS AGENT ENGINE (EPISODE 07) =====
const AGENT_TOOLS = Object.freeze({
  time: async () => handleTools('current time'),
  weather: async () => handleTools('weather'),
  workout: async () => handleTools('workout'),
  news: async () => handleTools('news'),
  crypto: async () => handleTools('bitcoin')
});

function isAgentModeRequest(text = '') {
  const value = String(text || '');
  if (/\b(?:agent(?:\s+mode)?|run\s+(?:the\s+)?agent|use\s+(?:the\s+)?agent)\b/i.test(value)) return true;
  if (/\b(?:briefing|research|analy[sz]e|analysis)\b/i.test(value)) return true;
  return /\bplan\b/i.test(value) && /\b(?:day|trip|time|weather|news|crypto|bitcoin|btc|workout|gym)\b/i.test(value);
}

function planAgentTools(goal) {
  const g = String(goal || '').toLowerCase();
  if (g.includes('briefing') || g.includes('morning') || g.includes('my day')) {
    return ['time', 'weather', 'workout', 'news'];
  }
  const plan = [];
  if (g.includes('time')) plan.push('time');
  if (g.includes('weather') || g.includes('trip') || g.includes('plan')) plan.push('weather');
  if (g.includes('workout') || g.includes('gym')) plan.push('workout');
  if (g.includes('news') || g.includes('research')) plan.push('news');
  if (g.includes('crypto') || g.includes('bitcoin')) plan.push('crypto');
  return plan.length ? plan : ['time', 'weather', 'workout', 'news'];
}

async function runAgent(goal) {
  add('J.A.R.V.I.S: AGENT MODE ACTIVATED.', 'ai');
  const toolsToRun = planAgentTools(goal);
  const results = {};

  for (let i = 0; i < toolsToRun.length; i++) {
    const tool = toolsToRun[i];
    add(`J.A.R.V.I.S: [${i + 1}/${toolsToRun.length}] Running ${tool} tool...`, 'ai');
    try {
      results[tool] = await AGENT_TOOLS[tool]();
    } catch (e) {
      results[tool] = 'Tool error';
    }
  }

  add('J.A.R.V.I.S: Synthesizing final briefing...', 'ai');
  try {
    const summaryPrompt = `Goal: ${JSON.stringify(String(goal))}. Tool results: ${JSON.stringify(results)}. Give a concise, helpful Telugu/English summary for Boss.`;
    return await callGemini(summaryPrompt);
  } catch (e) {
    return Object.entries(results).map(([k, v]) => `• ${k.toUpperCase()}: ${v}`).join('\n');
  }
}

// ===== 5. GEMINI BRAIN WITH AUTO-FALLBACK =====
async function callGemini(p) {
  if (!API_KEY) throw new Error('Gemini API key is missing. Type "change api key" to add one.');
  const contents = MEMORY.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
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
      if (!res.ok || data.error) {
        const msg = data.error?.message || ("HTTP " + res.status);
        lastErr = new Error(msg);
        if (res.status === 429 || res.status === 503 || /quota|rate|limit|high demand|temporar|unavailable|deprecated|not found/i.test(msg)) {
          continue;
        }
        throw lastErr;
      }
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (replyText) return replyText;
      lastErr = new Error("Empty response from " + m);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ===== 6. MASTER COMMAND ROUTER =====
async function processCommand(p) {
  setCoreState('thinking', 'PROCESSING...');
  try {
    // 1. Agent Mode
    if (isAgentModeRequest(p)) {
      const agentReply = await runAgent(p);
      MEMORY.push({ role: 'user', text: p });
      MEMORY.push({ role: 'model', text: agentReply });
      saveMemory();
      add('J.A.R.V.I.S: ' + agentReply, 'ai');
      speak(agentReply);
      setCoreState('', 'SYSTEM READY');
      return;
    }

    // 2. Local Tools (Zero Quota)
    add('J.A.R.V.I.S: Thinking...', 'ai');
    const toolReply = await handleTools(p);
    if (toolReply) {
      chat.lastChild.innerText = 'J.A.R.V.I.S: ' + toolReply;
      speak(toolReply);
      setCoreState('', 'SYSTEM READY');
      return;
    }

    // 3. Gemini Brain
    const reply = await callGemini(p);
    MEMORY.push({ role: 'user', text: p });
    MEMORY
