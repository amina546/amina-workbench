/* ================================================================
   Amina Workbench - Backend Server v6
   Multi-device sync: JSON file DB + simple token auth + REST API
   ================================================================ */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Config ----
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

app.use(express.json({ limit: '50mb' }));

// ---- CORS: allow CloudStudio frontend to access tunnel backend ----
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(__dirname, { index: 'index.html' }));

// ---- File-based DB helpers ----
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeDB(data) {
  ensureDataDir();
  // Atomic-ish write: write to temp then rename
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ---- Auth ----
function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { passwordHash: null, salt: null };
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// In-memory token store (cleared on restart — user re-logs in)
const tokens = new Map(); // token -> { createdAt }

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ---- Routes: Auth ----

// POST /api/login — first call sets password, subsequent calls verify
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: '密码至少4位' });
  }

  const config = getConfig();

  if (!config.passwordHash) {
    // First-time setup: create password
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ passwordHash: hash, salt }));
    const token = generateToken();
    tokens.set(token, { createdAt: Date.now() });
    return res.json({ token, firstRun: true });
  }

  // Verify
  const hash = hashPassword(password, config.salt);
  if (hash !== config.passwordHash) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = generateToken();
  tokens.set(token, { createdAt: Date.now() });
  res.json({ token });
});

// POST /api/logout
app.post('/api/logout', authMiddleware, (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  tokens.delete(token);
  res.json({ ok: true });
});

// GET /api/check — check if password is set
app.get('/api/check', (req, res) => {
  const config = getConfig();
  res.json({ initialized: !!config.passwordHash });
});

// ---- Routes: Sync ----

// Known data keys (for validation)
const DATA_KEYS = new Set([
  'amina_workbench_data',
  'amina_categories',
  'amina_categories_income',
  'amina_savings',
  'amina_health',
  'amina_film_reviews',
  'amina_cal_annotations'
]);

// GET /api/sync — return all data with timestamps
app.get('/api/sync', authMiddleware, (req, res) => {
  const db = readDB();
  res.json(db);
});

// POST /api/sync — receive data entries, merge by updatedAt (last-write-wins)
app.post('/api/sync', authMiddleware, (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Invalid data' });
  }
  const db = readDB();
  let updated = false;
  for (const [key, entry] of Object.entries(incoming)) {
    if (!DATA_KEYS.has(key)) continue;
    if (!entry || typeof entry.updatedAt !== 'number') continue;
    if (!db[key] || entry.updatedAt > (db[key].updatedAt || 0)) {
      db[key] = { value: entry.value, updatedAt: entry.updatedAt };
      updated = true;
    }
  }
  if (updated) writeDB(db);
  res.json({ ok: true, updated });
});

// ---- SPA fallback (serve index.html for non-API, non-static routes) ----
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  // Don't interfere with static files
  const filePath = path.join(__dirname, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Start ----
app.listen(PORT, '0.0.0.0', () => {
  ensureDataDir();
  console.log(`\n  Amina Workbench running at http://localhost:${PORT}`);
  console.log(`  On other devices: use your computer's IP address\n`);
});
