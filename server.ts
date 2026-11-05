import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Persistent shared database file
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'app-data.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DEFAULT_DATA = {
  config: {
    spreadsheetId: null,
    spreadsheetUrl: null,
    webhookUrl: null,
    autoSync: true,
    lastSyncedAt: null,
  },
  activities: [],
  registrations: []
};
// Read Database
function readDb() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
      return DEFAULT_DATA;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database file:', err);
    return DEFAULT_DATA;
  }
}

// Write Database
function writeDb(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// Function to push to Google Sheet Webhook if configured
async function pushToGoogleSheetWebhook(webhookUrl: string, payload: any) {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.warn('Webhook delivery warning:', e);
    return false;
  }
}

// ================= API ROUTES =================

// 1. Get shared Google Sheet configuration
app.get('/api/config', (req, res) => {
  const db = readDb();
  res.json(db.config || DEFAULT_DATA.config);
});

// 2. Update shared Google Sheet configuration (Spreadsheet ID, URL, Webhook URL)
app.post('/api/config', async (req, res) => {
  const db = readDb();
  db.config = {
    ...db.config,
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  writeDb(db);
  res.json({ success: true, config: db.config });
});

// 3. Get all activities (shared across all devices)
app.get('/api/activities', (req, res) => {
  const db = readDb();
  res.json(db.activities || []);
});

// 4. Save/Update activity
app.post('/api/activities', async (req, res) => {
  const db = readDb();
  const activity = req.body;
  if (!activity || !activity.id) {
    return res.status(400).json({ error: 'Invalid activity data' });
  }

  const existingIdx = db.activities.findIndex((a: any) => a.id === activity.id);
  if (existingIdx >= 0) {
    db.activities[existingIdx] = activity;
  } else {
    db.activities.unshift(activity);
  }

  writeDb(db);

  // If webhook is configured, notify Google Sheet automatically
  if (db.config?.webhookUrl) {
    pushToGoogleSheetWebhook(db.config.webhookUrl, {
      action: 'addActivity',
      activity,
    }).catch(() => {});
  }

  res.json({ success: true, activity });
});

// 5. Delete activity
app.delete('/api/activities/:id', (req, res) => {
  const db = readDb();
  const { id } = req.params;
  db.activities = db.activities.filter((a: any) => a.id !== id);
  db.registrations = db.registrations.filter((r: any) => r.activityId !== id);
  writeDb(db);
  res.json({ success: true });
});

// 6. Get all registrations (shared across all devices)
app.get('/api/registrations', (req, res) => {
  const db = readDb();
  res.json(db.registrations || []);
});

// 7. Student registers for an activity
app.post('/api/registrations', async (req, res) => {
  const db = readDb();
  const registration = req.body;

  if (!registration || !registration.studentId || !registration.activityId) {
    return res.status(400).json({ error: 'ข้อมูลการสมัครไม่ครบถ้วน' });
  }

  // Check duplicate
  const existing = db.registrations.find(
    (r: any) =>
      r.activityId === registration.activityId &&
      r.studentId === registration.studentId &&
      r.status !== 'cancelled'
  );
  if (existing) {
    return res.status(400).json({ error: 'รหัสนักศึกษานี้ได้ลงทะเบียนกิจกรรมนี้แล้ว' });
  }

  // Check quota
  const activity = db.activities.find((a: any) => a.id === registration.activityId);
  if (activity) {
    const enrolled = db.registrations.filter(
      (r: any) => r.activityId === activity.id && r.status !== 'cancelled'
    ).length;
    if (enrolled >= activity.maxParticipants) {
      return res.status(400).json({ error: 'ที่นั่งสำหรับกิจกรรมนี้เต็มตามจำนวนแล้ว' });
    }
  }

  db.registrations.unshift(registration);
  writeDb(db);

  // Auto-sync to Google Sheet Webhook if configured!
  let sheetSynced = false;
  if (db.config?.webhookUrl) {
    const activeEnrolledCount = db.registrations.filter(
      (r: any) => r.activityId === registration.activityId && r.status !== 'cancelled'
    ).length;

    sheetSynced = await pushToGoogleSheetWebhook(db.config.webhookUrl, {
      action: 'addRegistration',
      registration,
      index: activeEnrolledCount,
    });
  }

  res.json({ success: true, registration, sheetSynced });
});

// 8. Cancel registration
app.delete('/api/registrations/:id', (req, res) => {
  const db = readDb();
  const { id } = req.params;
  db.registrations = db.registrations.filter((r: any) => r.id !== id);
  writeDb(db);
  res.json({ success: true });
});

// 9. Toggle registration attendance
app.patch('/api/registrations/:id/attendance', (req, res) => {
  const db = readDb();
  const { id } = req.params;
  const reg = db.registrations.find((r: any) => r.id === id);
  if (reg) {
    reg.attendanceChecked = !reg.attendanceChecked;
    writeDb(db);
    return res.json({ success: true, registration: reg });
  }
  res.status(404).json({ error: 'Not found' });
});

// ================= STATIC OR VITE DEV MIDDLEWARE =================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CMU Dorm Activities Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
