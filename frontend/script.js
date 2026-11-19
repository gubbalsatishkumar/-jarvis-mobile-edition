// ===== 1. API KEY & MULTI-MODEL QUOTA FALLBACK =====
let API_KEY = localStorage.getItem('jarvis_key');
if (!API_KEY) {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY) localStorage.setItem('jarvis_key', API_KEY);
}
// Rotates automatically if one model hits the 20/day free tier limit
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-flash-latest"
];

// ===== 2. MEMORY =====
let MEMORY = [];
try {
  const storedMemory = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');
  if (Array.isArray(storedMemory)) {
    MEMORY = storedMemory.filter(
      m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string'
    );
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

// ===== WORKOUT PLAN DATA (ZERO API QUOTA) =====
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

// ===== 3. FREE LOCAL TOOLS (ZERO GEMINI QUOTA USED) =====
async function fetchToolJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return await response.json();
}

async function handleTools(text) {
  const t = text.toLowerCase();

  // Change API Key command (Type "change api key" if you ever want to swap keys)
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
    } else {
      window.location.href = 'tel:';
      return 'Opening phone dialer, Boss.';
    }
  }

  // Time
  if (/\btime\b/.test(t) || t.includes('సమయం') || t.includes('టైం')) {
    return 'Current time is ' + new Date().toLocaleTimeString() + ', Boss.';
  }

  // Weather
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

  // News
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

  // Translate
  if (t.includes('translate')) {
    const q = text.replace(/translate\s+(this\s+)?/i, '').replace(/\s+(to|into)\s+telugu/i, '').trim() || 'hello';
    try {
      const d = await fetchToolJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=en|te');
      return 'In Telugu: ' + d.responseData.translatedText;
    } catch (e) {
      return 'Translate error, Boss.';
    }
  }

  // YouTube / Open Apps
  if (t.includes('youtube') || t.startsWith('play ')) {
    const q = text.replace(/^(play|open|search)\s*(on\s*)?(youtube\s*)?/i, '').trim();
    if (q) {
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank', 'noopener,noreferrer');
      return 'Searching YouTube for ' + q + ', Boss.';
    }
    window.open('https://youtube.com', '_blank', 'noopener,noreferrer');
    return 'Opening YouTube, Boss.';
  }

  return null;
}

// ===== 4. GEMINI BRAIN WITH AUTO-FALLBACK =====
async function callGemini(p) {
  if (!API_KEY) throw new Error('Gemini API key is missing.');
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
      if (data.error) {
        lastErr = new Error(data.error.message);
        // Automatically switch to next model if quota/rate limit or high demand occurs
        if (/quota|rate|limit|high demand|temporar|unavailable|deprecated|not found/i.test(data.error.message)) {
          continue;
        }
        throw lastErr;
      }
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ===== 5. COMMAND ROUTER =====
async function processCommand(p) {
  add('J.A.R.V.I.S: Thinking...', 'ai');

  // 1. Run Free Local Tools First (Uses 0 Gemini Quota)
  const toolReply = await handleTools(p);
  if (toolReply) {
    chat.lastChild.innerText = 'J.A.R.V.I.S: ' + toolReply;
    speak(toolReply);
    return;
  }

  // 2. Ask Gemini Brain with Multi-Model Fallback
  try {
    const reply = await callGemini(p);
    MEMORY.push({ role: 'user', text: p });
    MEMORY.push({ role: 'model', text: reply });
    saveMemory();
    chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
    speak(reply);
  } catch (e) {
    chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR ' + e.message;
  }
}

// ===== 6. VISION ENGINE =====
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
        if (/quota|rate|limit|high demand|temporar|unavailable|deprecated|not found/i.test(data.error.message)) continue;
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
