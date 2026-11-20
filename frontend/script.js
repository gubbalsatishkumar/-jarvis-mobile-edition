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

// ===== ENCRYPTED SAFE ALBUM & DOCUMENT VAULT (INDEXEDDB + AES-GCM) =====
const VAULT_DB_NAME = 'JarvisSafeAlbumDB';
const VAULT_STORE_NAME = 'albums';
const VAULT_PIN_HASH_KEY = 'jarvis_vault_pin_hash';

const safeDocInput = document.createElement('input');
safeDocInput.type = 'file';
safeDocInput.accept = 'image/*,.pdf,.doc,.docx,.txt';
safeDocInput.multiple = true;
safeDocInput.style.display = 'none';
document.body.appendChild(safeDocInput);

function openVaultDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllVaultItems() {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
    const req = tx.objectStore(VAULT_STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function addVaultItem(record) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
    tx.objectStore(VAULT_STORE_NAME).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllVaultItems() {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
    tx.objectStore(VAULT_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveVaultKey(pin, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function verifyOrSetupPin() {
  let savedHash = localStorage.getItem(VAULT_PIN_HASH_KEY);
  if (!savedHash) {
    const newPin = prompt('Create a 4-digit Master PIN to lock your Safe Album:');
    if (!newPin || newPin.trim().length < 4) return null;
    savedHash = await sha256Hex(newPin.trim());
    localStorage.setItem(VAULT_PIN_HASH_KEY, savedHash);
    return newPin.trim();
  }
  const enteredPin = prompt('Enter your Master PIN to verify identity, Boss:');
  if (!enteredPin) return null;
  const enteredHash = await sha256Hex(enteredPin.trim());
  if (enteredHash !== savedHash) return 'INVALID';
  return enteredPin.trim();
}

async function encryptBytes(pin, plainUint8Array) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(pin, salt);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainUint8Array);
  return { salt, iv, cipherBuf };
}

async function decryptBytes(pin, salt, iv, cipherBuf) {
  const key = await deriveVaultKey(pin, new Uint8Array(salt));
  return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, cipherBuf);
}

function pickDocumentsFromDevice() {
  return new Promise((resolve) => {
    safeDocInput.value = '';
    safeDocInput.onchange = () => {
      resolve(Array.from(safeDocInput.files || []));
    };
    safeDocInput.click();
  });
}

async function storeDocumentsInSafeAlbum(albumName, label) {
  const pin = await verifyOrSetupPin();
  if (!pin) return 'Safe Album operation cancelled, Boss.';
  if (pin === 'INVALID') return 'Access denied. Incorrect Master PIN.';

  add(`J.A.R.V.I.S: Identity verified. Select your document(s) or photos to lock in "${albumName}"...`, 'ai');
  const files = await pickDocumentsFromDevice();
  if (!files.length) return 'No documents selected, Boss.';

  for (const file of files) {
    const rawBuf = await file.arrayBuffer();
    const { salt, iv, cipherBuf } = await encryptBytes(pin, new Uint8Array(rawBuf));
    await addVaultItem({
      kind: 'file',
      album: albumName,
      label: label || file.name,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      savedAt: new Date().toLocaleString('en-IN'),
      salt,
      iv,
      cipherBuf
    });
  }

  const allItems = await getAllVaultItems();
  return `Encrypted and locked ${files.length} document${files.length > 1 ? 's' : ''} inside Safe Album "${albumName}", Boss (${allItems.length} total items stored).`;
}

async function storeNoteInSafeAlbum(albumName, secretNote) {
  const pin = await verifyOrSetupPin();
  if (!pin) return 'Safe Album operation cancelled, Boss.';
  if (pin === 'INVALID') return 'Access denied. Incorrect Master PIN.';

  const encoded = new TextEncoder().encode(secretNote);
  const { salt, iv, cipherBuf } = await encryptBytes(pin, encoded);
  await addVaultItem({
    kind: 'note',
    album: albumName,
    label: 'Secret Note',
    savedAt: new Date().toLocaleString('en-IN'),
    salt,
    iv,
    cipherBuf
  });

  const allItems = await getAllVaultItems();
  return `Identity verified, Boss. Encrypted and stored in Safe Album "${albumName}" (${allItems.length} total items).`;
}

async function openSafeAlbum(filterAlbum) {
  const items = await getAllVaultItems();
  if (!items.length) return 'Your Safe Album is currently empty, Boss.';

  const pin = await verifyOrSetupPin();
  if (!pin) return 'Safe Album locked.';
  if (pin === 'INVALID') return 'Access denied. Incorrect Master PIN.';

  const target = (filterAlbum || '').toLowerCase().trim();
  const matched = target && target !== 'album' && target !== 'all'
    ? items.filter(it => (it.album || 'Important Documents').toLowerCase().includes(target))
    : items;

  if (!matched.length) {
    const available = [...new Set(items.map(i => i.album || 'Important Documents'))].join(', ');
    return `No items found in album "${filterAlbum}". Available albums: ${available}.`;
  }

  const box = document.createElement('div');
  box.className = 'msg ai';
  box.innerHTML = `<b>J.A.R.V.I.S: Identity Verified — Safe Album (${matched.length} item${matched.length > 1 ? 's' : ''})</b><br>`;

  for (let i = 0; i < matched.length; i++) {
    const it = matched[i];
    try {
      const plainBuf = await decryptBytes(pin, it.salt, it.iv, it.cipherBuf);
      const row = document.createElement('div');
      row.style.marginTop = '8px';
      row.style.padding = '6px';
      row.style.border = '1px solid rgba(0,255,255,0.35)';

      if (it.kind === 'file') {
        const blob = new Blob([plainBuf], { type: it.mimeType });
        const url = URL.createObjectURL(blob);
        row.innerHTML = `<div>📁 <b>[${it.album}]</b> ${it.fileName} <small>(${it.savedAt})</small></div>`;

        if ((it.mimeType || '').startsWith('image/')) {
          const img = document.createElement('img');
          img.src = url;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '180px';
          img.style.marginTop = '6px';
          img.style.borderRadius = '6px';
          img.style.display = 'block';
          row.appendChild(img);
        }

        const link = document.createElement('a');
        link.href = url;
        link.download = it.fileName;
        link.innerText = '⬇ Open / Download Document';
        link.style.color = '#0f0';
        link.style.display = 'inline-block';
        link.style.marginTop = '4px';
        row.appendChild(link);
      } else {
        const textNote = new TextDecoder().decode(plainBuf);
        row.innerText = `🔒 [${it.album}] (${it.savedAt}): ${textNote}`;
      }
      box.appendChild(row);
    } catch (e) {
      const errDiv = document.createElement('div');
      errDiv.innerText = `${i + 1}. [Could not decrypt item]`;
      box.appendChild(errDiv);
    }
  }

  chat.appendChild(box);
  chat.scrollTop = chat.scrollHeight;
  speak(`Safe Album unlocked, Boss. Showing ${matched.length} encrypted items.`);
  return '__HANDLED_HTML__';
}

async function clearSafeAlbum() {
  const pin = await verifyOrSetupPin();
  if (!pin || pin === 'INVALID') return 'Access denied. Safe Album was not cleared.';
  await clearAllVaultItems();
  return 'Safe Album wiped clean, Boss.';
}

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

// ===== 3. ALL TOOLS (EPISODE 06 + SAFE ALBUM + EMAIL + ANDROID INTENTS - ZERO QUOTA) =====
async function fetchToolJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

const ANDROID_APPS = {
  whatsapp: 'intent://send#Intent;scheme=whatsapp;package=com.whatsapp;end',
  telegram: 'intent://resolve#Intent;scheme=tg;package=org.telegram.messenger;end',
  maps: 'intent://maps.google.com/maps#Intent;scheme=https;package=com.google.android.apps.maps;end',
  gmail: 'intent://#Intent;package=com.google.android.gm;end',
  camera: 'intent://#Intent;action=android.media.action.IMAGE_CAPTURE;end',
  settings: 'intent://#Intent;action=android.settings.SETTINGS;end',
  calculator: 'intent://#Intent;package=com.google.android.calculator;end'
};

function handleEmailCommand(text) {
  const t = text.toLowerCase().trim();

  // Open Gmail / Inbox directly
  if (t === 'email' || t === 'gmail' || t.includes('open email') || t.includes('open gmail') || t.includes('check email') || t.includes('check gmail')) {
    window.location.href = ANDROID_APPS.gmail;
    return 'Opening Gmail, Boss.';
  }

  // Send / Compose / Write Email
  if (t.includes('send email') || t.includes('send mail') || t.includes('compose email') || t.includes('write email') || t.includes('email to')) {
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    let to = emailMatch ? emailMatch[1] : prompt('Enter recipient email address:');
    if (!to) return 'Email cancelled, Boss.';

    const subjMatch = text.match(/\bsubject\s+(.+?)(?=\s+\b(?:body|message|saying|text)\b|$)/i);
    let subject = subjMatch ? subjMatch[1].trim() : prompt('Enter email subject:', 'Message from J.A.R.V.I.S');
    if (subject === null) return 'Email cancelled, Boss.';

    const bodyMatch = text.match(/\b(?:body|message|saying|text)\s+(.+)$/i);
    let body = bodyMatch ? bodyMatch[1].trim() : prompt('Enter email message:');
    if (body === null) return 'Email cancelled, Boss.';

    window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return `Opening email draft to ${to.trim()}, Boss.`;
  }

  return null;
}

async function handleTools(text) {
  const t = text.toLowerCase().trim();

  // Owner Identity Verification
  if (t.includes('recognize me') || t.includes('recognise me') || t.includes('who am i') || t.includes('verify me')) {
    const pin = await verifyOrSetupPin();
    if (!pin || pin === 'INVALID') return 'Voice/PIN mismatch. Identity could not be verified.';
    return 'Biometric PIN confirmed. Welcome back, Boss — Gubbala Satish Kumar. All J.A.R.V.I.S systems are at your command.';
  }

  // Safe Album: Store Documents or Notes ("please store safe my important documents in Album")
  const storeMatch = text.match(/(?:please\s+)?(?:store\s+safe|save\s+safe|keep\s+safe)\s*:?\s*(.+)/i);
  if (storeMatch && storeMatch[1]) {
    const rawContent = storeMatch[1].trim();
    const inAlbumMatch = rawContent.match(/^(.*?)\s+in\s+(?:the\s+)?(.+?)(?:\s+album)?$/i);
    const itemDesc = (inAlbumMatch ? inAlbumMatch[1] : rawContent).trim();
    const albumName = (inAlbumMatch && inAlbumMatch[2] ? inAlbumMatch[2] : 'Important Documents').trim();

    if (/\b(?:document|documents|doc|docs|photo|photos|image|images|file|files|pdf|card|certificate|id|aadhaar|pan)\b/i.test(itemDesc) || /\balbum\b/i.test(rawContent)) {
      return await storeDocumentsInSafeAlbum(albumName, itemDesc);
    }
    return await storeNoteInSafeAlbum(albumName, itemDesc);
  }

  // Safe Album: Open / Read
  const openAlbumMatch = text.match(/(?:open|read|show|view)\s+(?:my\s+)?(?:safe(?:\s+vault|\s+album)?|album)(?:\s+(.+))?$/i);
  if (openAlbumMatch || t.includes('safe vault') || t.includes('safe album') || t.includes('my documents')) {
    const requestedAlbum = openAlbumMatch && openAlbumMatch[1] ? openAlbumMatch[1].replace(/\balbum\b/i, '').trim() : '';
    return await openSafeAlbum(requestedAlbum);
  }

  // Safe Album: Clear
  if (t.includes('clear safe') || t.includes('delete safe') || t.includes('clear album')) {
    return await clearSafeAlbum();
  }

  // Email & Gmail
  if (t.includes('email') || t.includes('gmail') || t.includes('send mail')) {
    const emailRes = handleEmailCommand(text);
    if (emailRes) return emailRes;
  }

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

  // Open Native Android Apps via Intent
  for (const [appName, intentUrl] of Object.entries(ANDROID_APPS)) {
    if (t.includes('open ' + appName) || t === appName) {
      window.location.href = intentUrl;
      return `Launching ${appName.charAt(0).toUpperCase() + appName.slice(1)}, Boss.`;
    }
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
    const thinkingNode = chat.lastChild;
    const toolReply = await handleTools(p);
    if (toolReply) {
      if (toolReply === '__HANDLED_HTML__') {
        if (thinkingNode && thinkingNode.parentNode) thinkingNode.remove();
      } else {
        thinkingNode.innerText = 'J.A.R.V.I.S: ' + toolReply;
        speak(toolReply);
      }
      setCoreState('', 'SYSTEM READY');
      return;
    }

    // 3. Gemini Brain
    const reply = await callGemini(p);
    MEMORY.push({ role: 'user', text: p });
    MEMORY.push({ role: 'model', text: reply });
    saveMemory();
    thinkingNode.innerText = 'J.A.R.V.I.S: ' + reply;
    speak(reply);
  } catch (e) {
    if (chat.lastChild && chat.lastChild.innerText.includes('Thinking...')) {
      chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR ' + e.message;
    } else {
      add('J.A.R.V.I.S: ERROR ' + e.message, 'ai');
    }
  }
  setCoreState('', 'SYSTEM READY');
}

// ===== 7. VISION ENGINE (EPISODE 05) =====
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
  setCoreState('thinking', 'SCANNING IMAGE...');
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
      if (!res.ok || data.error) {
        const msg = data.error?.message || ("HTTP " + res.status);
        lastErr = new Error(msg);
        if (res.status === 429 || res.status === 503 || /quota|rate|limit|high demand|temporar|unavailable|deprecated|not found/i.test(msg)) continue;
        throw lastErr;
      }
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
        speak(reply);
        setCoreState('', 'SYSTEM READY');
        return;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR ' + lastErr.message;
  setCoreState('', 'SYSTEM READY');
}

// ===== 8. VOICE, WAKE WORD ENGINE (EPISODE 09) & UI CONTROLS =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let wakewordEnabled = false;
let wakeCommandMode = false;
const WAKE_WORD = "hey jarvis";

if (SR) {
  rec = new SR();
  rec.lang = 'en-US';

  rec.onresult = (e) => {
    const last = e.results.length - 1;
    const transcript = e.results[last][0].transcript.trim();
    const lower = transcript.toLowerCase();

    if (wakewordEnabled) {
      if (!wakeCommandMode && lower.includes(WAKE_WORD)) {
        const afterWake = lower.split(WAKE_WORD)[1]?.trim();
        setCoreState('listening', 'LISTENING FOR COMMAND...');
        speak("Yes Boss?");

        if (afterWake && afterWake.length > 2) {
          wakeCommandMode = false;
          add('YOU: ' + afterWake, 'user');
          processCommand(afterWake);
        } else {
          wakeCommandMode = true;
        }
      } else if (wakeCommandMode && e.results[last].isFinal) {
        wakeCommandMode = false;
        add('YOU: ' + transcript, 'user');
        processCommand(transcript);
      }
    } else {
      add('YOU: ' + transcript, 'user');
      processCommand(transcript);
    }
  };

  rec.onend = () => {
    if (wakewordEnabled) {
      try {
        rec.start();
      } catch (e) {}
    } else {
      if (micBtn) micBtn.innerText = '🎤';
      setCoreState('', 'SYSTEM READY');
    }
  };
}

if (micBtn) {
  micBtn.onclick = () => {
    if (!rec) return;
    if (wakewordEnabled) toggleWakeword();
    rec.continuous = false;
    rec.interimResults = false;
    try {
      rec.start();
      micBtn.innerText = 'LISTENING...';
      setCoreState('listening', 'LISTENING...');
    } catch (e) {}
  };
}

function toggleWakeword() {
  wakewordEnabled = !wakewordEnabled;
  wakeCommandMode = false;
  const btn = document.getElementById('wake-btn');
  const status = document.getElementById('wake-status');

  if (wakewordEnabled) {
    if (btn) btn.classList.add('active', 'listening');
    if (status) {
      status.innerText = "LISTENING FOR 'HEY JARVIS'...";
      status.style.color = "#00ff00";
    }
    startContinuousListening();
  } else {
    if (btn) btn.classList.remove('active', 'listening');
    if (status) {
      status.innerText = "WAKE: OFF";
      status.style.color = "#888";
    }
    stopContinuousListening();
  }
}

function startContinuousListening() {
  if (!rec) return;
  rec.continuous = true;
  rec.interimResults = true;
  try {
    rec.start();
  } catch (e) {
    console.log("Recognition already running:", e);
  }
}

function stopContinuousListening() {
  if (!rec) return;
  rec.continuous = false;
  rec.interimResults = false;
  try {
    rec.stop();
  } catch (e) {}
  setCoreState('', 'SYSTEM READY');
}

const wakeBtn = document.getElementById('wake-btn');
if (wakeBtn) {
  wakeBtn.onclick = toggleWakeword;
}

let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function speak(t) {
  speechSynthesis.cancel();
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

input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('send').click();
});

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

// ===== 9. PWA SERVICE WORKER REGISTRATION =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.log('SW error:', err));
}
