import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
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
  registrations: [],
  chatSessions: [],
  chatMessages: []
};

// Helper: Ensure 100% deduplication of registrations (Unique by activity + studentId)
function deduplicateRegistrations(regs: any[]): any[] {
  if (!Array.isArray(regs)) return [];
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const r of regs) {
    if (!r) continue;
    const studentId = String(r.studentId || '').trim();
    if (!studentId) continue;
    const actKey = String(r.activityCode || r.activityId || '').trim().toLowerCase();
    const key = `${actKey}_${studentId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return unique;
}

// Universal date normalizer: converts any date string format to standard ISO YYYY-MM-DDTHH:mm
function normalizeDateTimeString(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  const jsDateMatch = str.match(/([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (jsDateMatch) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = monthNames.findIndex(mn => mn.toLowerCase() === jsDateMatch[1].toLowerCase());
    if (monthIdx >= 0) {
      let y = parseInt(jsDateMatch[3], 10);
      if (y > 2400) y -= 543;
      const m = String(monthIdx + 1).padStart(2, '0');
      const d = String(parseInt(jsDateMatch[2], 10)).padStart(2, '0');
      const hh = String(parseInt(jsDateMatch[4], 10)).padStart(2, '0');
      const mm = String(parseInt(jsDateMatch[5], 10)).padStart(2, '0');
      return `${y}-${m}-${d}T${hh}:${mm}`;
    }
  }

  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slashMatch) {
    const d = String(parseInt(slashMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
    let y = parseInt(slashMatch[3], 10);
    if (y > 2400) y -= 543;
    const hh = slashMatch[4] ? String(parseInt(slashMatch[4], 10)).padStart(2, '0') : '09';
    const mm = slashMatch[5] ? String(parseInt(slashMatch[5], 10)).padStart(2, '0') : '00';
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  const isoMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    if (y > 2400) y -= 543;
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    const hh = isoMatch[4] ? String(parseInt(isoMatch[4], 10)).padStart(2, '0') : '09';
    const mm = isoMatch[5] ? String(parseInt(isoMatch[5], 10)).padStart(2, '0') : '00';
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    let y = fallback.getFullYear();
    if (y > 2400) y -= 543;
    const m = String(fallback.getMonth() + 1).padStart(2, '0');
    const d = String(fallback.getDate()).padStart(2, '0');
    const hh = String(fallback.getHours()).padStart(2, '0');
    const mm = String(fallback.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  return str;
}

function normalizeActivity(a: any): any {
  if (!a) return a;
  return {
    ...a,
    eventDateTime: normalizeDateTimeString(a.eventDateTime),
    eventEndDateTime: normalizeDateTimeString(a.eventEndDateTime),
    openDate: normalizeDateTimeString(a.openDate),
    closeDate: normalizeDateTimeString(a.closeDate),
  };
}

// Read Database
function readDb() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
      return DEFAULT_DATA;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.activities && Array.isArray(parsed.activities)) {
      parsed.activities = parsed.activities.map(normalizeActivity);
    }
    if (parsed.registrations && Array.isArray(parsed.registrations)) {
      parsed.registrations = deduplicateRegistrations(parsed.registrations);
    }
    if (!parsed.chatSessions || !Array.isArray(parsed.chatSessions)) {
      parsed.chatSessions = [];
    }
    if (!parsed.chatMessages || !Array.isArray(parsed.chatMessages)) {
      parsed.chatMessages = [];
    }
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return DEFAULT_DATA;
  }
}

// Write Database
function writeDb(data: any) {
  try {
    if (data && data.activities && Array.isArray(data.activities)) {
      data.activities = data.activities.map(normalizeActivity);
    }
    if (data && data.registrations && Array.isArray(data.registrations)) {
      data.registrations = deduplicateRegistrations(data.registrations);
    }
    if (data && (!data.chatSessions || !Array.isArray(data.chatSessions))) {
      data.chatSessions = [];
    }
    if (data && (!data.chatMessages || !Array.isArray(data.chatMessages))) {
      data.chatMessages = [];
    }
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
      redirect: 'follow',
    });
    return res.ok || res.status < 400;
  } catch (e) {
    console.warn('Webhook delivery warning:', e);
    return false;
  }
}

// Function to append registration directly to Google Sheet via Google Sheets API v4
async function appendRegistrationToGoogleSheetApi(spreadsheetId: string, token: string, reg: any, countIndex: number) {
  try {
    const row = [
      countIndex,
      reg.activityCode || '',
      reg.activityTitle || '',
      reg.studentId || '',
      reg.fullName || '',
      reg.dormitory || '',
      reg.registeredAt || new Date().toISOString(),
      'ยืนยันแล้ว'
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'รายชื่อผู้สมัครเข้าร่วม'!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [row]
        })
      }
    );
    return res.ok;
  } catch (err) {
    console.warn('Server direct Google Sheet append failed:', err);
    return false;
  }
}

// Helper to parse CSV text
function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(cur.trim());
      if (row.length > 0 && row.some(cell => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(cell => cell.length > 0)) lines.push(row);
  }
  return lines;
}

const GRADIENTS = [
  'from-purple-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-blue-600 to-indigo-700',
  'from-amber-500 to-orange-600',
  'from-pink-600 to-rose-700',
  'from-violet-700 to-purple-800'
];

function determineCategory(catLabel: string): { category: string; categoryLabel: string } {
  const lower = (catLabel || '').toLowerCase();
  if (lower.includes('กีฬา') || lower.includes('sport')) {
    return { category: 'sports', categoryLabel: 'กีฬาและนันทนาการ' };
  }
  if (lower.includes('จิตอาสา') || lower.includes('volunteer')) {
    return { category: 'volunteer', categoryLabel: 'จิตอาสา/บำเพ็ประโยชน์' };
  }
  if (lower.includes('ทักษะ') || lower.includes('วิชาการ') || lower.includes('skill')) {
    return { category: 'skills', categoryLabel: 'พัฒนาทักษะชีวิตและวิชาการ' };
  }
  if (lower.includes('วัฒนธรรม') || lower.includes('ประเพณี') || lower.includes('culture')) {
    return { category: 'culture', categoryLabel: 'ประเพณีและศิลปวัฒนธรรม' };
  }
  if (lower.includes('สิ่งแวดล้อม') || lower.includes('5ส') || lower.includes('environment')) {
    return { category: 'environment', categoryLabel: 'สิ่งแวดล้อมและ 5ส หอพัก' };
  }
  return { category: 'skills', categoryLabel: catLabel || 'ทั่วไป' };
}

function parseActivitiesFromRows(rows: any[][]): any[] {
  if (!rows || rows.length === 0) return [];
  const startIdx = (rows[0] && (String(rows[0][0] || '').includes('รหัส') || String(rows[0][1] || '').includes('ชื่อ'))) ? 1 : 0;
  const activities: any[] = [];

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const code = String(row[0] || '').trim();
    const title = String(row[1] || '').trim();
    if (!code && !title) continue;

    const rawCategory = String(row[2] || '').trim();
    const { category, categoryLabel } = determineCategory(rawCategory);
    const location = String(row[3] || 'สำนักงานหอพักนักศึกษา มช.').trim();
    const eventDateTime = String(row[4] || '').trim();
    const eventEndDateTime = String(row[5] || '').trim();
    const maxParticipants = parseInt(String(row[6] || '50'), 10) || 50;
    const openDate = String(row[7] || '').trim();
    const closeDate = String(row[8] || '').trim();
    const targetAudience = String(row[9] || 'นักศึกษาหอพักทุกหอ').trim();
    const hoursEarned = parseInt(String(row[10] || '3'), 10) || 3;
    const createdAt = String(row[11] || new Date().toISOString()).trim();

    const id = `act-${(code || title).toLowerCase().replace(/[^a-z0-9]/g, '-') || (i + 1)}`;
    const bannerGradient = GRADIENTS[(i - startIdx) % GRADIENTS.length];

    activities.push({
      id,
      code: code || `ACT-${String(i).padStart(4, '0')}`,
      title: title || 'กิจกรรมหอพักนักศึกษา',
      description: `โครงการ ${title} จัดโดยสำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่`,
      location,
      category,
      categoryLabel,
      eventDateTime: normalizeDateTimeString(eventDateTime) || new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
      eventEndDateTime: normalizeDateTimeString(eventEndDateTime) || new Date(Date.now() + 86400000 * 7 + 14400000).toISOString().slice(0, 16),
      maxParticipants,
      openDate: normalizeDateTimeString(openDate) || new Date(Date.now() - 86400000).toISOString().slice(0, 16),
      closeDate: normalizeDateTimeString(closeDate) || new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 16),
      targetAudience,
      hoursEarned,
      bannerGradient,
      syncedToSheet: true,
      createdAt
    });
  }

  return activities;
}

function parseRegistrationsFromRows(rows: any[][], activities: any[]): any[] {
  if (!rows || rows.length === 0) return [];
  const startIdx = (rows[0] && (String(rows[0][0] || '').includes('ลำดับ') || String(rows[0][1] || '').includes('รหัสกิจกรรม') || String(rows[0][3] || '').includes('รหัสนักศึกษา'))) ? 1 : 0;
  const registrations: any[] = [];

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const activityCode = String(row[1] || '').trim();
    const activityTitle = String(row[2] || '').trim();
    const studentId = String(row[3] || '').trim();
    const fullName = String(row[4] || '').trim();
    const dormitory = String(row[5] || 'หอพักนักศึกษา').trim();
    const registeredAt = String(row[6] || new Date().toISOString()).trim();
    const statusText = String(row[7] || '').trim();

    if (!studentId && !fullName) continue;

    const matchedAct = activities.find(a => a.code === activityCode || a.title === activityTitle);
    const activityId = matchedAct ? matchedAct.id : `act-${activityCode.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'dorm'}`;

    registrations.push({
      id: `reg-sheet-${i}-${studentId || Math.random().toString(36).slice(2, 7)}`,
      activityId,
      activityCode: activityCode || (matchedAct ? matchedAct.code : ''),
      activityTitle: activityTitle || (matchedAct ? matchedAct.title : ''),
      studentId,
      fullName,
      dormitory,
      registeredAt,
      status: statusText.includes('ยกเลิก') ? 'cancelled' : 'confirmed',
      attendanceChecked: false,
      syncedToSheet: true
    });
  }

  return deduplicateRegistrations(registrations);
}

// Helper to parse activities from Webhook JSON format or row format
function parseActivitiesFromWebhookList(list: any[]): any[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  if (Array.isArray(list[0])) {
    return parseActivitiesFromRows(list);
  }
  return list.map((item, index) => {
    const code = String(item.code || '').trim();
    const title = String(item.title || '').trim();
    const rawCategory = String(item.categoryLabel || item.category || '').trim();
    const { category, categoryLabel } = determineCategory(rawCategory);
    const id = item.id || `act-${(code || title).toLowerCase().replace(/[^a-z0-9]/g, '-') || (index + 1)}`;
    const bannerGradient = item.bannerGradient || GRADIENTS[index % GRADIENTS.length];
    return {
      id,
      code: code || `ACT-${String(index + 1).padStart(4, '0')}`,
      title: title || 'กิจกรรมหอพักนักศึกษา',
      description: item.description || `โครงการ ${title} จัดโดยสำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่`,
      location: item.location || 'สำนักงานหอพักนักศึกษา มช.',
      category,
      categoryLabel,
      eventDateTime: normalizeDateTimeString(item.eventDateTime) || new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
      eventEndDateTime: normalizeDateTimeString(item.eventEndDateTime) || new Date(Date.now() + 86400000 * 7 + 14400000).toISOString().slice(0, 16),
      maxParticipants: parseInt(String(item.maxParticipants || '50'), 10) || 50,
      openDate: normalizeDateTimeString(item.openDate) || new Date(Date.now() - 86400000).toISOString().slice(0, 16),
      closeDate: normalizeDateTimeString(item.closeDate) || new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 16),
      targetAudience: item.targetAudience || 'นักศึกษาหอพักทุกหอ',
      hoursEarned: parseInt(String(item.hoursEarned || '3'), 10) || 3,
      bannerGradient,
      syncedToSheet: true,
      createdAt: item.createdAt || new Date().toISOString()
    };
  });
}

function parseRegistrationsFromWebhookList(list: any[], activities: any[]): any[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  if (Array.isArray(list[0])) {
    return parseRegistrationsFromRows(list, activities);
  }
  const parsed = list.map((item, index) => {
    const activityCode = String(item.activityCode || '').trim();
    const activityTitle = String(item.activityTitle || '').trim();
    const studentId = String(item.studentId || '').trim();
    const fullName = String(item.fullName || '').trim();
    const dormitory = String(item.dormitory || 'หอพักนักศึกษา').trim();
    const matchedAct = activities.find(a => a.code === activityCode || a.title === activityTitle);
    const activityId = matchedAct ? matchedAct.id : (item.activityId || `act-${activityCode.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'dorm'}`);
    return {
      id: item.id || `reg-sheet-${index}-${studentId || Math.random().toString(36).slice(2, 7)}`,
      activityId,
      activityCode: activityCode || (matchedAct ? matchedAct.code : ''),
      activityTitle: activityTitle || (matchedAct ? matchedAct.title : ''),
      studentId,
      fullName,
      dormitory,
      roomNumber: item.roomNumber || '',
      faculty: item.faculty || '',
      phone: item.phone || '',
      email: item.email || '',
      registeredAt: item.registeredAt || new Date().toISOString(),
      status: (item.status === 'confirmed' || item.status === 'ยืนยันแล้ว') ? 'confirmed' : item.status,
      attendanceChecked: !!item.attendanceChecked,
      syncedToSheet: true
    };
  });
  return deduplicateRegistrations(parsed);
}

// Function to fetch data from Google Sheet via Webhook, API, or CSV export
async function fetchDataFromGoogleSheetApi(spreadsheetId: string, token?: string | null, webhookUrl?: string | null) {
  // Strategy 0: Google Apps Script Webhook (Zero Login for any device)
  if (webhookUrl) {
    // 0.1 Try GET request to Webhook
    try {
      const getUrl = webhookUrl.includes('?') ? `${webhookUrl}&action=getData` : `${webhookUrl}?action=getData`;
      const res = await fetch(getUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data && (Array.isArray(data.activities) || Array.isArray(data.registrations))) {
            const activities = parseActivitiesFromWebhookList(data.activities || []);
            const registrations = parseRegistrationsFromWebhookList(data.registrations || [], activities);
            if (activities.length > 0 || registrations.length > 0) {
              return { activities, registrations, source: 'webhook_get' };
            }
          }
        } catch (jsonErr) {
          // not JSON (e.g. HTML redirect or error message)
        }
      }
    } catch (err) {
      console.warn('Webhook GET fetch error:', err);
    }

    // 0.2 Try POST request to Webhook
    try {
      const resPost = await fetch(webhookUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetchData' })
      });
      if (resPost.ok) {
        const text = await resPost.text();
        try {
          const data = JSON.parse(text);
          if (data && (Array.isArray(data.activities) || Array.isArray(data.registrations))) {
            const activities = parseActivitiesFromWebhookList(data.activities || []);
            const registrations = parseRegistrationsFromWebhookList(data.registrations || [], activities);
            if (activities.length > 0 || registrations.length > 0) {
              return { activities, registrations, source: 'webhook_post' };
            }
          }
        } catch (jsonErr) {}
      }
    } catch (err) {
      console.warn('Webhook POST fetch error:', err);
    }
  }

  let actRows: any[][] = [];
  let regRows: any[][] = [];

  // Strategy 1: Google Sheets API v4 with OAuth token
  if (token) {
    try {
      const actRange = encodeURIComponent("'กิจกรรมทั้งหมด'!A1:Z1000");
      const actRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${actRange}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (actRes.ok) {
        const actData = await actRes.json();
        actRows = actData.values || [];
      }

      const regRange = encodeURIComponent("'รายชื่อผู้สมัครเข้าร่วม'!A1:Z5000");
      const regRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${regRange}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (regRes.ok) {
        const regData = await regRes.json();
        regRows = regData.values || [];
      }
    } catch (e) {
      console.warn('Google Sheets API v4 fetch failed, trying CSV export:', e);
    }
  }

  // Strategy 2: gviz CSV export (works if sheet is shared as Anyone with link can view)
  if (actRows.length === 0) {
    try {
      const encodedSheet = encodeURIComponent('กิจกรรมทั้งหมด');
      const csvRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`);
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('accounts.google.com')) {
          actRows = parseCsv(csvText);
        }
      }
    } catch (e) {
      console.warn('gviz CSV fetch for activities failed:', e);
    }
  }

  if (regRows.length === 0) {
    try {
      const encodedSheet = encodeURIComponent('รายชื่อผู้สมัครเข้าร่วม');
      const csvRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`);
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('accounts.google.com')) {
          regRows = parseCsv(csvText);
        }
      }
    } catch (e) {
      console.warn('gviz CSV fetch for registrations failed:', e);
    }
  }

  // Fallback gid=0
  if (actRows.length === 0) {
    try {
      const csvRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=0`);
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('accounts.google.com')) {
          actRows = parseCsv(csvText);
        }
      }
    } catch (e) {}
  }

  const activities = parseActivitiesFromRows(actRows);
  const registrations = parseRegistrationsFromRows(regRows, activities);

  return { activities, registrations, source: actRows.length > 0 ? 'sheets_api_or_csv' : 'empty' };
}

// Function to sync entire dataset directly to Google Sheet via Google Sheets API v4
async function syncAllToGoogleSheetApi(spreadsheetId: string, token: string, activities: any[], registrations: any[]) {
  try {
    const actHeaders = [
      'รหัสกิจกรรม', 'ชื่อโครงการ/กิจกรรม', 'หมวดหมู่', 'สถานที่จัด',
      'วันเวลาเริ่มกิจกรรม', 'วันเวลาสิ้นสุด', 'จำนวนรับ (คน)',
      'วันเปิดรับสมัคร', 'วันปิดรับสมัคร', 'กลุ่มเป้าหมาย', 'คะแนนกิจกรรม', 'วันที่บันทึกระบบ'
    ];
    const actRows = activities.map((a: any) => [
      a.code, a.title, a.categoryLabel, a.location,
      a.eventDateTime, a.eventEndDateTime, a.maxParticipants,
      a.openDate, a.closeDate, a.targetAudience, a.hoursEarned,
      a.createdAt || new Date().toISOString()
    ]);

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'กิจกรรมทั้งหมด'!A1:Z1000:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'กิจกรรมทั้งหมด'!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [actHeaders, ...actRows]
        })
      }
    );

    const regHeaders = [
      'ลำดับ', 'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'รหัสนักศึกษา',
      'ชื่อ-นามสกุล', 'หอพักนักศึกษา', 'วันเวลาที่สมัคร', 'สถานะ'
    ];
    const uniqueRegistrations = deduplicateRegistrations(registrations);
    const regRows = uniqueRegistrations.map((r: any, i: number) => [
      i + 1,
      r.activityCode,
      r.activityTitle,
      r.studentId,
      r.fullName,
      r.dormitory,
      r.registeredAt,
      r.status === 'confirmed' ? 'ยืนยันแล้ว' : r.status
    ]);

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'รายชื่อผู้สมัครเข้าร่วม'!A1:Z5000:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'รายชื่อผู้สมัครเข้าร่วม'!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [regHeaders, ...regRows]
        })
      }
    );

    return true;
  } catch (err) {
    console.warn('Server syncAllToGoogleSheetApi error:', err);
    return false;
  }
}

// ================= API ROUTES =================

// 1. Get shared Google Sheet configuration
app.get('/api/config', (req, res) => {
  const db = readDb();
  res.json(db.config || DEFAULT_DATA.config);
});

// 2. Update shared Google Sheet configuration
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

// 2.1 Fetch data directly from Google Sheet (Primary Data Source)
const handleFetchFromSheet = async (req: express.Request, res: express.Response) => {
  const db = readDb();
  const spreadsheetId = req.body?.spreadsheetId || (req.query?.spreadsheetId as string) || db.config?.spreadsheetId;
  const token = req.body?.googleAccessToken || (req.query?.googleAccessToken as string) || db.config?.googleAccessToken;
  const webhookUrl = req.body?.webhookUrl || (req.query?.webhookUrl as string) || db.config?.webhookUrl;

  if (!spreadsheetId && !webhookUrl) {
    return res.status(400).json({ error: 'ยังไม่มี Google Spreadsheet ID หรือ Web App URL ที่เชื่อมต่อในระบบ' });
  }

  try {
    const { activities, registrations, source } = await fetchDataFromGoogleSheetApi(spreadsheetId || '', token, webhookUrl);

    // Update server DB directly with Google Sheet data as primary source
    db.activities = activities;
    db.registrations = registrations;
    db.config.lastSyncedAt = new Date().toISOString();
    if (req.body?.spreadsheetId) db.config.spreadsheetId = req.body.spreadsheetId;
    if (req.body?.webhookUrl) db.config.webhookUrl = req.body.webhookUrl;
    if (token) db.config.googleAccessToken = token;
    writeDb(db);

    return res.json({
      success: true,
      activities,
      registrations,
      count: {
        activities: activities.length,
        registrations: registrations.length,
      },
      lastSyncedAt: db.config.lastSyncedAt,
      message: `ดึงข้อมูลจาก Google Sheet สำเร็จ: พบกิจกรรม ${activities.length} โครงการ, ผู้สมัคร ${registrations.length} คน`
    });
  } catch (err: any) {
    console.error('Error fetching data from Google Sheet:', err);
    return res.status(500).json({ error: err.message || 'ไม่สามารถดึงข้อมูลจาก Google Sheet ได้' });
  }
};

app.post('/api/sheets/fetch', handleFetchFromSheet);
app.get('/api/sheets/fetch', handleFetchFromSheet);

// 2.2 Sync all activities and registrations to Google Sheet (Auto-Sync)
app.post('/api/sheets/sync-all', async (req, res) => {
  const db = readDb();
  const token = req.body?.googleAccessToken || db.config?.googleAccessToken;
  const spreadsheetId = req.body?.spreadsheetId || db.config?.spreadsheetId;
  const webhookUrl = req.body?.webhookUrl || db.config?.webhookUrl;

  let synced = false;

  // 1. Sync via Google Sheets API if token and spreadsheetId available
  if (spreadsheetId && token) {
    synced = await syncAllToGoogleSheetApi(spreadsheetId, token, db.activities || [], db.registrations || []);
  }

  // 2. Sync via Webhook if configured
  if (webhookUrl) {
    const webhookRes = await pushToGoogleSheetWebhook(webhookUrl, {
      action: 'syncAll',
      activities: db.activities || [],
      registrations: db.registrations || [],
    });
    if (webhookRes) synced = true;
  }

  if (synced) {
    db.config.lastSyncedAt = new Date().toISOString();
    writeDb(db);
    return res.json({ success: true, lastSyncedAt: db.config.lastSyncedAt });
  } else {
    return res.status(400).json({
      error: 'ยังไม่ได้เชื่อมต่อ Google Sheet หรือ Webhook กรุณากดเชื่อมต่อ Google Sheet ในระบบ'
    });
  }
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

  // Auto-sync with Google Sheet Webhook if configured (Zero-Login for all machines)
  if (db.config?.webhookUrl) {
    pushToGoogleSheetWebhook(db.config.webhookUrl, {
      action: 'syncAll',
      activities: db.activities || [],
      registrations: db.registrations || [],
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

  // Auto-sync with Google Sheet Webhook after deletion
  if (db.config?.webhookUrl) {
    pushToGoogleSheetWebhook(db.config.webhookUrl, {
      action: 'syncAll',
      activities: db.activities || [],
      registrations: db.registrations || [],
    }).catch(() => {});
  }

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

  if (!registration || !registration.studentId || (!registration.activityId && !registration.activityCode)) {
    return res.status(400).json({ error: 'ข้อมูลการสมัครไม่ครบถ้วน' });
  }

  const cleanStudentId = String(registration.studentId || '').trim();
  const cleanActId = String(registration.activityId || '').trim();
  const cleanActCode = String(registration.activityCode || '').trim();

  // Strict check duplicate: studentId + (activityId OR activityCode)
  const existing = (db.registrations || []).find(
    (r: any) =>
      String(r.studentId || '').trim() === cleanStudentId &&
      (
        (cleanActId && String(r.activityId || '').trim() === cleanActId) ||
        (cleanActCode && String(r.activityCode || '').trim() === cleanActCode)
      ) &&
      r.status !== 'cancelled'
  );
  if (existing) {
    return res.status(400).json({
      error: `รหัสนักศึกษา ${cleanStudentId} ได้ลงทะเบียนกิจกรรมนี้แล้ว`,
      duplicate: true
    });
  }

  // Check quota
  const activity = (db.activities || []).find(
    (a: any) =>
      (cleanActId && a.id === cleanActId) ||
      (cleanActCode && a.code === cleanActCode)
  );
  if (activity) {
    const enrolled = (db.registrations || []).filter(
      (r: any) =>
        (r.activityId === activity.id || r.activityCode === activity.code) &&
        r.status !== 'cancelled'
    ).length;
    if (enrolled >= activity.maxParticipants) {
      return res.status(400).json({ error: 'ที่นั่งสำหรับกิจกรรมนี้เต็มตามจำนวนแล้ว' });
    }
  }

  // Pre-clean existing registrations to ensure no duplicate backlog
  db.registrations = deduplicateRegistrations(db.registrations || []);
  db.registrations.unshift(registration);
  writeDb(db);

  // Auto-sync participant to Google Sheet!
  let sheetSynced = false;
  const activeEnrolledCount = db.registrations.filter(
    (r: any) =>
      (r.activityId === registration.activityId || r.activityCode === registration.activityCode) &&
      r.status !== 'cancelled'
  ).length;

  // Auto-sync participant to Google Sheet (Execute ONLY ONCE)
  if (db.config?.webhookUrl) {
    const webhookRes = await pushToGoogleSheetWebhook(db.config.webhookUrl, {
      action: 'addRegistration',
      registration,
      index: activeEnrolledCount,
    });
    if (webhookRes) sheetSynced = true;
  } else if (db.config?.spreadsheetId && db.config?.googleAccessToken) {
    sheetSynced = await appendRegistrationToGoogleSheetApi(
      db.config.spreadsheetId,
      db.config.googleAccessToken,
      registration,
      activeEnrolledCount
    );
  }

  res.json({ success: true, registration, sheetSynced });
});

// 7.1 Clean and deduplicate registrations across system
app.post('/api/registrations/deduplicate', async (req, res) => {
  const db = readDb();
  const beforeCount = (db.registrations || []).length;
  db.registrations = deduplicateRegistrations(db.registrations || []);
  const removed = beforeCount - db.registrations.length;
  writeDb(db);

  // If connected to Google Sheet API or Webhook, sync the cleaned list
  if (db.config?.spreadsheetId && db.config?.googleAccessToken) {
    await syncAllToGoogleSheetApi(
      db.config.spreadsheetId,
      db.config.googleAccessToken,
      db.activities || [],
      db.registrations || []
    ).catch(() => {});
  } else if (db.config?.webhookUrl) {
    pushToGoogleSheetWebhook(db.config.webhookUrl, {
      action: 'syncAll',
      activities: db.activities || [],
      registrations: db.registrations || []
    }).catch(() => {});
  }

  res.json({ success: true, removed, count: db.registrations.length });
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

// ================= 🤖 GEMINI AI CHATBOT ENGINE =================
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

function buildGeminiSystemPrompt(activities: any[]): string {
  const actText = activities.map((a, i) => `[${i + 1}] รหัส: ${a.code} | ชื่อโครงการ: "${a.title}"
- หมวดหมู่: ${a.categoryLabel || a.category}
- สถานที่จัด: ${a.location}
- วันเวลาเริ่ม-สิ้นสุด: ${a.eventDateTime} ถึง ${a.eventEndDateTime || '-'}
- จำนวนรับสมัคร: ${a.maxParticipants} คน
- วันเปิด-ปิดรับสมัคร: ${a.openDate} ถึง ${a.closeDate}
- กลุ่มเป้าหมาย: ${a.targetAudience}
- คะแนนกิจกรรมหอพัก: +${a.hoursEarned} คะแนนหอพัก
- คำอธิบาย: ${a.description}`).join('\n\n');

  return `คุณคือ "น้องช้างหอพัก AI" (CMU Dorm Assistant) แชทบอทและผู้ช่วยอัจฉริยะประจำสำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่ (มช.)
ภารกิจหลักของคุณ:
1. ให้ข้อมูลและตอบคำถามนักศึกษาเกี่ยวกับโครงการกิจกรรมหอพักนักศึกษา มช., กำหนดการ, วันเปิดรับสมัคร, สถานที่จัด, การลงทะเบียน, และการเก็บชั่วโมง/คะแนนหอพัก
2. ข้อมูลโครงการกิจกรรมปัจจุบันในระบบฐานข้อมูล:
${actText || '(ขณะนี้ยังไม่มีกิจกรรมที่เปิดรับสมัคร)'}

3. ข้อมูลพื้นฐานของสำนักงานหอพักนักศึกษา มช.:
- ที่ตั้ง: สำนักงานหอพักนักศึกษา 239 ถนนห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200
- วันเวลาทำการ: วันจันทร์ - วันศุกร์ เวลา 08:30 - 16:30 น. (เว้นวันหยุดราชการ)
- เบอร์โทรศัพท์: 0-5394-4750 หรือ 0-5394-4066
- เกณฑ์คะแนนหอพัก: นักศึกษาที่พักในหอพัก มช. ต้องเข้าร่วมกิจกรรมและสะสมคะแนนหอพักตามเกณฑ์ที่มหาวิทยาลัยกำหนด เพื่อใช้ประกอบการพิจารณาคัดเลือกอยู่หอพักต่อในภาคเรียนถัดไป

คำแนะนำการตอบ:
- ตอบด้วยภาษาไทยที่สุภาพ อบอุ่น เป็นมิตรและชัดเจน (สามารถลงท้ายด้วย ค่ะ/ครับ ได้อย่างเป็นกันเอง)
- อ้างอิงข้อมูลกิจกรรมจากรายการด้านบนอย่างแม่นยำ เช่น รหัสกิจกรรม, วันเวลา, สถานที่ และคะแนนหอพัก
- หากนักศึกษาต้องการติดต่อเจ้าหน้าที่โดยตรง หรือต้องการสอบถามเรื่องส่วนตัวที่ระบบยังไม่ทราบ ให้แจ้งอย่างสุภาพว่า: "น้องสามารถกดปุ่ม 'ติดต่อเจ้าหน้าที่' หรือพิมพ์แจ้งไว้ได้เลยนะคะ เดี๋ยวพี่แอดมินเจ้าหน้าที่จะเข้ามาสนทนาช่วยเหลือในแชทนี้แบบเรียลไทม์ค่ะ 😊"
- ตอบกระชับ เข้าใจง่าย ไม่ยาวเกินจำเป็น`;
}

// Intelligent Knowledge Engine fallback based on real-time activity database and dorm policies
function generateDynamicKnowledgeReply(userMessage: string, activities: any[]): string {
  const q = (userMessage || '').toLowerCase().trim();

  // 1. Inquiries about activities / hours / points
  if (
    q.includes('กิจกรรม') ||
    q.includes('ชั่วโมง') ||
    q.includes('คะแนน') ||
    q.includes('โครงการ') ||
    q.includes('มีอะไรบ้าง') ||
    q.includes('เปิดรับ')
  ) {
    if (!activities || activities.length === 0) {
      return `สวัสดีค่ะน้องช้าง AI ยินดีให้บริการค่ะ 🐘\nขณะนี้ยังไม่มีรายการกิจกรรมใหม่เปิดรับสมัครในระบบ น้องสามารถติดตามประกาศเพิ่มเติม หรือสอบถามพี่แอดมินได้เลยนะคะ! 😊`;
    }

    const actList = activities.slice(0, 4).map((a, i) =>
      `${i + 1}. [${a.code}] ${a.title}\n   📅 ${a.eventDateTime ? a.eventDateTime.replace('T', ' ') : '-'}\n   📍 ${a.location || '-'}\n   ⭐ ได้รับ: ${a.hoursEarned || 2} คะแนนหอพัก`
    ).join('\n\n');

    return `สวัสดีค่ะ! น้องช้าง AI ขอแนะนำกิจกรรมหอพัก มช. ที่น่าสนใจขณะนี้ค่ะ 🐘✨\n\n${actList}\n\n💡 น้องสามารถกดปุ่ม "ลงทะเบียน" ในหน้าระบบเพื่อเข้าร่วมกิจกรรมและสะสมคะแนนหอพักได้ทันทีนะคะ หรือสอบถามรายละเอียดเพิ่มเติมได้เลยค่ะ 😊`;
  }

  // 2. Inquiries about registration or how to apply
  if (q.includes('สมัคร') || q.includes('ลงทะเบียน') || q.includes('เข้าร่วม') || q.includes('จอง')) {
    return `น้องสามารถลงทะเบียนเข้าร่วมกิจกรรมได้ง่ายๆ ดังนี้ค่ะ 🐘\n1. ไปที่แท็บ "กิจกรรมทั้งหมด" หรือ "ปฏิทินกิจกรรม"\n2. เลือกโครงการที่สนใจแล้วกดปุ่ม "ลงทะเบียน"\n3. กรอกรหัสนักศึกษา 9 หลัก และเลือกหอพัก\n4. ตรวจสอบสถานะการสมัครได้ที่แท็บ "กิจกรรมของฉัน" ได้ตลอดเวลาค่ะ 😊`;
  }

  // 3. Inquiries about curfew / open-close time
  if (q.includes('ปิดหอ') || q.includes('เปิดหอ') || q.includes('กี่โมง') || q.includes('เวลา') || q.includes('เคอร์ฟิว') || q.includes('เข้าหอ')) {
    return `🕒 กำหนดเวลาเปิด-ปิดประตูหอพักนักศึกษา มช. โดยทั่วไป:\n- ประตูหอพักเปิด: 06:00 น.\n- ประตูหอพักปิด: 23:00 น. (หรือ 24:00 น. สำหรับบางหอพัก)\n\nหากน้องมีความจำเป็นต้องกลับหลังเวลาปิดหอพักเนื่องจากการเรียนหรือกิจกรรมของมหาวิทยาลัย กรุณาติดต่อแจ้ง รปภ. ประจำหอพัก หรือสแกนลายนิ้วมือ/คีย์การ์ดตามระเบียบนะคะ 🐘`;
  }

  // 4. Inquiries about room inspection / 5S cleaning
  if (q.includes('ตรวจห้อง') || q.includes('5ส') || q.includes('ความสะอาด') || q.includes('ย้ายหอ') || q.includes('คืนห้อง')) {
    return `🧹 การตรวจห้องพักและกิจกรรม 5ส:\n- กรรมการหอพักและเจ้าหน้าที่จะมีการตรวจประเมินความสะอาดและความเรียบร้อยของห้องพักเป็นประจำทุกภาคเรียน\n- หากตรวจผ่านตามเกณฑ์ น้องจะได้รับคะแนนกิจกรรมความสะอาดประจำห้องพักสะสมด้วยค่ะ!\nหากต้องการสอบถามกำหนดการตรวจห้องของหอพักน้อง สามารถแจ้งชื่อหอพักไว้ได้เลยนะคะ 😊`;
  }

  // 5. Inquiries about contact, office hours, or human admin
  if (q.includes('ติดต่อ') || q.includes('เบอร์') || q.includes('โทร') || q.includes('สำนักงาน') || q.includes('เจ้าหน้าที่') || q.includes('แอดมิน') || q.includes('คน')) {
    return `📞 ข้อมูลติดต่อสำนักงานหอพักนักศึกษา มช.:\n- ที่ตั้ง: 239 ถนนห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200\n- โทรศัพท์: 0-5394-4750 หรือ 0-5394-4066\n- เวลาทำการ: จันทร์ - ศุกร์ 08:30 - 16:30 น.\n\n💬 น้องสามารถกดปุ่ม "ติดต่อเจ้าหน้าที่" ด้านบน หรือพิมพ์ข้อความทิ้งไว้ที่นี่ได้เลยค่ะ พี่แอดมินจะเข้ามาช่วยตอบและประสานงานให้ทันทีนะคะ 😊`;
  }

  // 6. Greetings
  if (q.includes('สวัสดี') || q.includes('หวัดดี') || q.includes('hello') || q.includes('hi') || q.includes('ช่วย')) {
    const totalActs = activities ? activities.length : 0;
    return `สวัสดีค่ะน้อง! น้องช้าง AI ผู้ช่วยสำนักงานหอพักนักศึกษา มช. ยินดีให้บริการค่ะ 🐘💜\nขณะนี้ในระบบมีโครงการกิจกรรมทั้งหมด ${totalActs} โครงการเปิดให้น้องๆ เข้าร่วมสะสมคะแนนหอพัก\n\nน้องสามารถสอบถามเรื่อง:\n- กิจกรรมที่เปิดรับสมัครและคะแนนหอพัก\n- วิธีการลงทะเบียนเข้าร่วม\n- กฎระเบียบและเวลาเปิด-ปิดหอพัก\n- หรือกดสลับคุยกับ "พี่แอดมินเจ้าหน้าที่" ได้ตลอดเวลานะคะ 😊`;
  }

  // Default friendly fallback
  return `ขอบคุณสำหรับคำถามนะคะน้อง 🐘\nน้องช้าง AI ขอแนะนำให้น้องตรวจสอบกิจกรรมล่าสุดได้ที่แท็บ "กิจกรรมทั้งหมด" หรือหากต้องการความช่วยเหลือเฉพาะเรื่อง น้องสามารถกดปุ่ม "ติดต่อเจ้าหน้าที่" ด้านบนเพื่อให้พี่แอดมินหอพักเข้ามาสนทนาช่วยเหลือได้แบบเรียลไทม์เลยนะคะ 😊`;
}

async function askGeminiForChatReply(userMessage: string, history: any[], activities: any[]): Promise<string> {
  const gemini = getGeminiClient();

  // If Gemini API is available, invoke model gemini-3.8-flash with dynamic activity grounding
  if (gemini) {
    try {
      const systemInstruction = buildGeminiSystemPrompt(activities);
      const contents: any[] = [];
      const recentHistory = (history || []).slice(-6);
      for (const msg of recentHistory) {
        if (msg.sender === 'user') {
          contents.push({ role: 'user', parts: [{ text: String(msg.text || '') }] });
        } else if (msg.sender === 'ai' || msg.sender === 'admin') {
          contents.push({ role: 'model', parts: [{ text: String(msg.text || '') }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 5000)
      );

      const generatePromise = gemini.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
        }
      });

      const response = await Promise.race([generatePromise, timeoutPromise]) as any;

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn('Gemini generateContent notice, using CMU Dorm engine:', err?.message || err);
    }
  }

  // Seamless fallback to CMU Dorm Dynamic Knowledge Engine
  return generateDynamicKnowledgeReply(userMessage, activities);
}

// ================= 💬 REAL-TIME CHAT ENGINE & WEBSOCKET =================
interface ChatClientInfo {
  ws: WebSocket;
  sessionId: string;
  role: 'user' | 'admin';
  name: string;
}

const chatClients = new Set<ChatClientInfo>();

function broadcastChat(payload: any, filter?: (c: ChatClientInfo) => boolean) {
  const json = JSON.stringify(payload);
  for (const client of chatClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!filter || filter(client)) {
        try {
          client.ws.send(json);
        } catch (e) {}
      }
    }
  }
}

async function handleIncomingChatMessage(params: {
  sessionId: string;
  sender: 'user' | 'admin';
  senderName: string;
  text: string;
  studentId?: string;
  dormitory?: string;
}) {
  const db = readDb();
  const now = new Date().toISOString();

  // Find or create session
  let session = (db.chatSessions || []).find((s: any) => s.id === params.sessionId);
  if (!session) {
    session = {
      id: params.sessionId,
      studentId: params.studentId || '',
      userName: params.senderName || 'นักศึกษาหอพัก',
      dormitory: params.dormitory || '',
      createdAt: now,
      lastMessageAt: now,
      lastMessagePreview: params.text.slice(0, 80),
      unreadAdminCount: params.sender === 'user' ? 1 : 0,
      unreadUserCount: params.sender === 'admin' ? 1 : 0,
      aiAutoReply: true,
      status: 'active',
      mode: 'ai'
    };
    db.chatSessions.unshift(session);
  } else {
    session.lastMessageAt = now;
    session.lastMessagePreview = params.text.slice(0, 80);
    if (params.studentId && !session.studentId) session.studentId = params.studentId;
    if (params.dormitory && !session.dormitory) session.dormitory = params.dormitory;
    if (params.senderName && session.userName === 'นักศึกษาหอพัก') session.userName = params.senderName;
    if (params.sender === 'user') {
      session.unreadAdminCount = (session.unreadAdminCount || 0) + 1;
    } else {
      session.unreadUserCount = (session.unreadUserCount || 0) + 1;
      // When admin replies, mark session mode as 'admin'
      session.mode = 'admin';
    }
  }

  const userMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId: params.sessionId,
    sender: params.sender,
    senderName: params.senderName,
    senderRole: params.sender === 'admin' ? 'เจ้าหน้าที่หอพัก' : 'นักศึกษา',
    text: params.text,
    timestamp: now,
    isReadByAdmin: params.sender === 'admin',
    isReadByUser: params.sender === 'user',
  };

  db.chatMessages.push(userMsg);
  writeDb(db);

  // Broadcast message to session participants & all admins
  broadcastChat({
    type: 'new_message',
    message: userMsg,
    session
  }, (c) => c.sessionId === params.sessionId || c.role === 'admin');

  // Trigger AI if sender is user and session has AI enabled
  if (params.sender === 'user' && session.aiAutoReply !== false) {
    broadcastChat({
      type: 'typing',
      sessionId: params.sessionId,
      sender: 'ai',
      isTyping: true
    }, (c) => c.sessionId === params.sessionId || c.role === 'admin');

    try {
      const sessionHistory = db.chatMessages.filter((m: any) => m.sessionId === params.sessionId);
      const aiReplyText = await askGeminiForChatReply(params.text, sessionHistory, db.activities || []);
      const aiNow = new Date().toISOString();

      const aiMsg = {
        id: `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sessionId: params.sessionId,
        sender: 'ai' as const,
        senderName: 'น้องช้าง AI หอพัก มช.',
        senderRole: 'AI ผู้ช่วยหอพัก',
        text: aiReplyText,
        timestamp: aiNow,
        isReadByAdmin: true,
        isReadByUser: false,
      };

      const freshDb = readDb();
      freshDb.chatMessages.push(aiMsg);
      const s = (freshDb.chatSessions || []).find((x: any) => x.id === params.sessionId);
      if (s) {
        s.lastMessageAt = aiNow;
        s.lastMessagePreview = aiReplyText.slice(0, 80);
        s.unreadUserCount = (s.unreadUserCount || 0) + 1;
      }
      writeDb(freshDb);

      broadcastChat({
        type: 'new_message',
        message: aiMsg,
        session: s || session
      }, (c) => c.sessionId === params.sessionId || c.role === 'admin');
    } catch (err) {
      console.error('Error generating AI reply:', err);
    } finally {
      broadcastChat({
        type: 'typing',
        sessionId: params.sessionId,
        sender: 'ai',
        isTyping: false
      }, (c) => c.sessionId === params.sessionId || c.role === 'admin');
    }
  }

  return { message: userMsg, session };
}

// 10. Chat: Get all chat sessions
app.get('/api/chat/sessions', (req, res) => {
  const db = readDb();
  const sessions = (db.chatSessions || []).slice().sort((a: any, b: any) => {
    return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
  });
  res.json(sessions);
});

// 11. Chat: Get messages for session
app.get('/api/chat/sessions/:sessionId/messages', (req, res) => {
  const db = readDb();
  const { sessionId } = req.params;
  const messages = (db.chatMessages || []).filter((m: any) => m.sessionId === sessionId);
  const session = (db.chatSessions || []).find((s: any) => s.id === sessionId);
  res.json({ session, messages });
});

// 12. Chat: Send message (REST fallback)
app.post('/api/chat/sessions/:sessionId/messages', async (req, res) => {
  const { sessionId } = req.params;
  const { text, sender, senderName, studentId, dormitory } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }
  const result = await handleIncomingChatMessage({
    sessionId,
    sender: sender === 'admin' ? 'admin' : 'user',
    senderName: senderName || (sender === 'admin' ? 'เจ้าหน้าที่หอพัก' : 'นักศึกษา'),
    text: text.trim(),
    studentId,
    dormitory,
  });
  res.json({ success: true, ...result });
});

// 13. Chat: Update session settings (e.g. toggle AI, switch mode)
app.patch('/api/chat/sessions/:sessionId', (req, res) => {
  const db = readDb();
  const { sessionId } = req.params;
  const session = (db.chatSessions || []).find((s: any) => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (typeof req.body.aiAutoReply === 'boolean') {
    session.aiAutoReply = req.body.aiAutoReply;
  }
  if (req.body.mode) {
    session.mode = req.body.mode;
  }
  if (req.body.status) {
    session.status = req.body.status;
  }
  writeDb(db);
  broadcastChat({
    type: 'session_updated',
    session
  }, (c) => c.sessionId === sessionId || c.role === 'admin');
  res.json({ success: true, session });
});

// 14. Chat: Mark read
app.post('/api/chat/sessions/:sessionId/mark-read', (req, res) => {
  const db = readDb();
  const { sessionId } = req.params;
  const { by } = req.body; // 'admin' | 'user'
  const session = (db.chatSessions || []).find((s: any) => s.id === sessionId);
  if (session) {
    if (by === 'admin') {
      session.unreadAdminCount = 0;
      (db.chatMessages || []).forEach((m: any) => {
        if (m.sessionId === sessionId) m.isReadByAdmin = true;
      });
    } else {
      session.unreadUserCount = 0;
      (db.chatMessages || []).forEach((m: any) => {
        if (m.sessionId === sessionId) m.isReadByUser = true;
      });
    }
    writeDb(db);
    broadcastChat({
      type: 'session_updated',
      session
    }, (c) => c.sessionId === sessionId || c.role === 'admin');
  }
  res.json({ success: true });
});

// 15. Chat: Delete a specific session
app.delete('/api/chat/sessions/:sessionId', (req, res) => {
  const db = readDb();
  const { sessionId } = req.params;
  const prevCount = (db.chatSessions || []).length;
  db.chatSessions = (db.chatSessions || []).filter((s: any) => s.id !== sessionId);
  db.chatMessages = (db.chatMessages || []).filter((m: any) => m.sessionId !== sessionId);
  writeDb(db);

  broadcastChat({
    type: 'session_deleted',
    sessionId
  }, (c) => c.role === 'admin');

  res.json({ success: true, deleted: prevCount !== db.chatSessions.length });
});

// 16. Chat: Clear all sessions & messages (Purge test/sample data)
app.post('/api/chat/sessions/clear-all', (req, res) => {
  const db = readDb();
  db.chatSessions = [];
  db.chatMessages = [];
  writeDb(db);

  broadcastChat({
    type: 'all_sessions_cleared'
  }, (c) => c.role === 'admin');

  res.json({ success: true });
});

// ================= STATIC OR VITE DEV MIDDLEWARE =================
async function startServer() {
  const server = http.createServer(app);

  // Initialize WebSocket Server for Real-Time Live Chat
  const wss = new WebSocketServer({ server, path: '/ws/chat' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const sessionId = url.searchParams.get('sessionId') || `sess_${Date.now()}`;
    const role = (url.searchParams.get('role') as 'user' | 'admin') || 'user';
    const name = url.searchParams.get('name') || (role === 'admin' ? 'เจ้าหน้าที่หอพัก' : 'นักศึกษา');

    const clientInfo: ChatClientInfo = { ws, sessionId, role, name };
    chatClients.add(clientInfo);

    const db = readDb();
    if (role === 'admin') {
      ws.send(JSON.stringify({
        type: 'init_admin',
        sessions: (db.chatSessions || []).slice().sort((a: any, b: any) => {
          return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
        }),
        messages: db.chatMessages || [],
      }));
    } else {
      const sessionMessages = (db.chatMessages || []).filter((m: any) => m.sessionId === sessionId);
      const session = (db.chatSessions || []).find((s: any) => s.id === sessionId);
      ws.send(JSON.stringify({
        type: 'init_user',
        sessionId,
        session,
        messages: sessionMessages,
      }));
    }

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'send_message') {
          await handleIncomingChatMessage({
            sessionId: data.sessionId || sessionId,
            sender: data.sender || role,
            senderName: data.senderName || name,
            text: data.text,
            studentId: data.studentId,
            dormitory: data.dormitory,
          });
        } else if (data.type === 'typing') {
          broadcastChat({
            type: 'typing',
            sessionId: data.sessionId || sessionId,
            sender: data.sender || role,
            isTyping: !!data.isTyping
          }, (c) => (c.sessionId === (data.sessionId || sessionId) || c.role === 'admin') && c.ws !== ws);
        } else if (data.type === 'mark_read') {
          const freshDb = readDb();
          const targetSessionId = data.sessionId || sessionId;
          const s = (freshDb.chatSessions || []).find((x: any) => x.id === targetSessionId);
          if (s) {
            if (data.by === 'admin' || role === 'admin') {
              s.unreadAdminCount = 0;
              (freshDb.chatMessages || []).forEach((m: any) => {
                if (m.sessionId === targetSessionId) m.isReadByAdmin = true;
              });
            } else {
              s.unreadUserCount = 0;
              (freshDb.chatMessages || []).forEach((m: any) => {
                if (m.sessionId === targetSessionId) m.isReadByUser = true;
              });
            }
            writeDb(freshDb);
            broadcastChat({
              type: 'session_updated',
              session: s
            }, (c) => c.sessionId === targetSessionId || c.role === 'admin');
          }
        } else if (data.type === 'toggle_ai') {
          const freshDb = readDb();
          const targetSessionId = data.sessionId || sessionId;
          const s = (freshDb.chatSessions || []).find((x: any) => x.id === targetSessionId);
          if (s) {
            s.aiAutoReply = !!data.enabled;
            if (data.mode) s.mode = data.mode;
            writeDb(freshDb);
            broadcastChat({
              type: 'session_updated',
              session: s
            }, (c) => c.sessionId === targetSessionId || c.role === 'admin');
          }
        }
      } catch (e) {
        console.warn('WS message handle error:', e);
      }
    });

    ws.on('close', () => {
      chatClients.delete(clientInfo);
    });

    ws.on('error', (err) => {
      console.warn('WS connection error:', err);
      chatClients.delete(clientInfo);
    });
  });

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

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CMU Dorm Activities Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

