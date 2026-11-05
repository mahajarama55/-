import { Activity, Registration, SheetConfig } from '../types';
import { getAccessToken } from './firebaseAuth';

const SPREADSHEET_KEY = 'cmu_dorm_active_spreadsheet_id';
const SPREADSHEET_URL_KEY = 'cmu_dorm_active_spreadsheet_url';
const WEBHOOK_KEY = 'cmu_dorm_active_webhook_url';

let cachedConfig: SheetConfig = {
  spreadsheetId: localStorage.getItem(SPREADSHEET_KEY),
  spreadsheetUrl: localStorage.getItem(SPREADSHEET_URL_KEY),
  webhookUrl: localStorage.getItem(WEBHOOK_KEY),
  autoSync: true,
};

/**
 * Fetches the shared Google Sheet configuration from the backend server.
 * This guarantees that ANY device or machine automatically connects to the same Google Sheet!
 */
export const fetchSharedConfig = async (): Promise<SheetConfig> => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      cachedConfig = {
        spreadsheetId: data.spreadsheetId || localStorage.getItem(SPREADSHEET_KEY),
        spreadsheetUrl: data.spreadsheetUrl || localStorage.getItem(SPREADSHEET_URL_KEY),
        webhookUrl: data.webhookUrl || localStorage.getItem(WEBHOOK_KEY),
        autoSync: data.autoSync !== false,
        lastSyncedAt: data.lastSyncedAt,
      };

      if (cachedConfig.spreadsheetId) localStorage.setItem(SPREADSHEET_KEY, cachedConfig.spreadsheetId);
      if (cachedConfig.spreadsheetUrl) localStorage.setItem(SPREADSHEET_URL_KEY, cachedConfig.spreadsheetUrl);
      if (cachedConfig.webhookUrl) localStorage.setItem(WEBHOOK_KEY, cachedConfig.webhookUrl);

      return cachedConfig;
    }
  } catch (e) {
    console.warn('Could not reach backend /api/config, using local config:', e);
  }
  return cachedConfig;
};

/**
 * Saves the Google Sheet configuration to the server so ALL devices automatically receive it.
 */
export const saveSharedConfig = async (newConfig: Partial<SheetConfig>): Promise<SheetConfig> => {
  cachedConfig = { ...cachedConfig, ...newConfig };

  if (cachedConfig.spreadsheetId) localStorage.setItem(SPREADSHEET_KEY, cachedConfig.spreadsheetId);
  if (cachedConfig.spreadsheetUrl) localStorage.setItem(SPREADSHEET_URL_KEY, cachedConfig.spreadsheetUrl);
  if (cachedConfig.webhookUrl) localStorage.setItem(WEBHOOK_KEY, cachedConfig.webhookUrl);

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cachedConfig),
    });
  } catch (e) {
    console.warn('Could not persist config to backend:', e);
  }

  return cachedConfig;
};

export const getSavedSpreadsheetId = (): string | null => {
  return cachedConfig.spreadsheetId || localStorage.getItem(SPREADSHEET_KEY);
};

export const getSavedSpreadsheetUrl = (): string | null => {
  return cachedConfig.spreadsheetUrl || localStorage.getItem(SPREADSHEET_URL_KEY);
};

export const getSavedWebhookUrl = (): string | null => {
  return cachedConfig.webhookUrl || localStorage.getItem(WEBHOOK_KEY);
};

export const saveSpreadsheetInfo = (id: string, url: string, webhookUrl?: string) => {
  saveSharedConfig({
    spreadsheetId: id,
    spreadsheetUrl: url,
    webhookUrl: webhookUrl || cachedConfig.webhookUrl,
  });
};

export const clearSpreadsheetInfo = () => {
  localStorage.removeItem(SPREADSHEET_KEY);
  localStorage.removeItem(SPREADSHEET_URL_KEY);
  localStorage.removeItem(WEBHOOK_KEY);
  cachedConfig = {
    spreadsheetId: null,
    spreadsheetUrl: null,
    webhookUrl: null,
    autoSync: true,
  };
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cachedConfig),
  }).catch(() => {});
};

/**
 * Creates a brand new CMU Dormitory Activity Google Spreadsheet with two pre-formatted sheets:
 * 1. "กิจกรรมทั้งหมด" (Activities Master)
 * 2. "รายชื่อผู้สมัครเข้าร่วม" (Registrations Roster)
 */
export const createCmuActivitySpreadsheet = async (
  token: string,
  initialActivities: Activity[] = [],
  initialRegistrations: Registration[] = []
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const title = `[CMU Dorm] ทะเบียนกิจกรรมหอพักนักศึกษา มช. (${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short' })})`;

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title
      },
      sheets: [
        {
          properties: {
            title: 'กิจกรรมทั้งหมด',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        },
        {
          properties: {
            title: 'รายชื่อผู้สมัครเข้าร่วม',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`สร้าง Google Sheet ไม่สำเร็จ: ${errorText}`);
  }

  const data = await createRes.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Initialize Headers and Seed Data
  const activityHeaders = [
    'รหัสกิจกรรม',
    'ชื่อโครงการ/กิจกรรม',
    'หมวดหมู่',
    'สถานที่จัด',
    'วันเวลาเริ่มกิจกรรม',
    'วันเวลาสิ้นสุด',
    'จำนวนรับ (คน)',
    'วันเปิดรับสมัคร',
    'วันปิดรับสมัคร',
    'กลุ่มเป้าหมาย',
    'คะแนนกิจกรรม',
    'วันที่บันทึกระบบ'
  ];

  const activityRows = initialActivities.map(a => [
    a.code,
    a.title,
    a.categoryLabel,
    a.location,
    a.eventDateTime,
    a.eventEndDateTime,
    a.maxParticipants,
    a.openDate,
    a.closeDate,
    a.targetAudience,
    a.hoursEarned,
    a.createdAt
  ]);

  const regHeaders = [
    'ลำดับ',
    'รหัสกิจกรรม',
    'ชื่อกิจกรรม',
    'รหัสนักศึกษา',
    'ชื่อ-นามสกุล',
    'หอพักนักศึกษา',
    'วันเวลาที่สมัคร',
    'สถานะ'
  ];

  const regRows = initialRegistrations.map((r, i) => [
    i + 1,
    r.activityCode,
    r.activityTitle,
    r.studentId,
    r.fullName,
    r.dormitory,
    r.registeredAt,
    r.status === 'confirmed' ? 'ยืนยันแล้ว' : r.status
  ]);

  // Append Headers and rows for 'กิจกรรมทั้งหมด'
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'กิจกรรมทั้งหมด'!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [activityHeaders, ...activityRows]
      })
    }
  );

  // Append Headers and rows for 'รายชื่อผู้สมัครเข้าร่วม'
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'รายชื่อผู้สมัครเข้าร่วม'!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [regHeaders, ...regRows]
      })
    }
  );

  // Save globally to server so ALL devices have it!
  await saveSharedConfig({
    spreadsheetId,
    spreadsheetUrl,
    lastSyncedAt: new Date().toISOString(),
  });

  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Appends an activity to Google Sheet. Works on ANY machine:
 * 1. Checks if Webhook URL is configured (works without any Google login from any device)
 * 2. Checks if OAuth token is available and calls Google Sheets API
 */
export const appendActivityToSheet = async (
  activity: Activity,
  token?: string
): Promise<boolean> => {
  const webhookUrl = getSavedWebhookUrl();
  const spreadsheetId = getSavedSpreadsheetId();
  const activeToken = token || (await getAccessToken());

  let success = false;

  // Method 1: Webhook (universal from any device)
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addActivity',
          activity,
        }),
      });
      success = true;
    } catch (e) {
      console.warn('Webhook appendActivity warning:', e);
    }
  }

  // Method 2: Google Sheets API v4 with token
  if (activeToken && spreadsheetId) {
    try {
      const row = [
        activity.code,
        activity.title,
        activity.categoryLabel,
        activity.location,
        activity.eventDateTime,
        activity.eventEndDateTime,
        activity.maxParticipants,
        activity.openDate,
        activity.closeDate,
        activity.targetAudience,
        activity.hoursEarned,
        new Date().toISOString()
      ];

      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'กิจกรรมทั้งหมด'!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [row]
          })
        }
      );

      if (res.ok) success = true;
    } catch (error) {
      console.error('Error appending activity to Google Sheet:', error);
    }
  }

  return success;
};

/**
 * Appends a student registration to Google Sheet.
 * Works automatically on ANY machine (student's phone, laptop, etc.):
 * - Dispatches via Webhook or Server Proxy or Sheets API v4
 */
export const appendRegistrationToSheet = async (
  registration: Registration,
  countIndex: number,
  token?: string
): Promise<boolean> => {
  const webhookUrl = getSavedWebhookUrl();
  const spreadsheetId = getSavedSpreadsheetId();
  const activeToken = token || (await getAccessToken());

  let success = false;

  // Method 1: Webhook (instant direct write to Google Sheet from any machine without OAuth!)
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addRegistration',
          index: countIndex,
          activityCode: registration.activityCode,
          activityTitle: registration.activityTitle,
          studentId: registration.studentId,
          fullName: registration.fullName,
          dormitory: registration.dormitory,
          registeredAt: registration.registeredAt,
          status: 'ยืนยันแล้ว'
        }),
      });
      success = true;
    } catch (e) {
      console.warn('Webhook appendRegistration warning:', e);
    }
  }

  // Method 2: Google Sheets API v4 (when token and spreadsheet ID are present)
  if (activeToken && spreadsheetId) {
    try {
      const row = [
        countIndex,
        registration.activityCode,
        registration.activityTitle,
        registration.studentId,
        registration.fullName,
        registration.dormitory,
        registration.registeredAt,
        'ยืนยันแล้ว'
      ];

      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'รายชื่อผู้สมัครเข้าร่วม'!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [row]
          })
        }
      );

      if (res.ok) success = true;
    } catch (error) {
      console.error('Error appending registration to Google Sheet:', error);
    }
  }

  return success;
};

/**
 * Sync entire dataset to Google Sheets (Full Sync)
 */
export const syncAllDataToSheet = async (
  token: string,
  spreadsheetId: string,
  activities: Activity[],
  registrations: Registration[]
): Promise<boolean> => {
  try {
    const activityHeaders = [
      'รหัสกิจกรรม',
      'ชื่อโครงการ/กิจกรรม',
      'หมวดหมู่',
      'สถานที่จัด',
      'วันเวลาเริ่มกิจกรรม',
      'วันเวลาสิ้นสุด',
      'จำนวนรับ (คน)',
      'วันเปิดรับสมัคร',
      'วันปิดรับสมัคร',
      'กลุ่มเป้าหมาย',
      'คะแนนกิจกรรม',
      'วันที่บันทึกระบบ'
    ];

    const activityRows = activities.map(a => [
      a.code,
      a.title,
      a.categoryLabel,
      a.location,
      a.eventDateTime,
      a.eventEndDateTime,
      a.maxParticipants,
      a.openDate,
      a.closeDate,
      a.targetAudience,
      a.hoursEarned,
      a.createdAt
    ]);

    // Clear and re-populate
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
          values: [activityHeaders, ...activityRows]
        })
      }
    );

    // Registrations
    const regHeaders = [
      'ลำดับ',
      'รหัสกิจกรรม',
      'ชื่อกิจกรรม',
      'รหัสนักศึกษา',
      'ชื่อ-นามสกุล',
      'หอพักนักศึกษา',
      'วันเวลาที่สมัคร',
      'สถานะ'
    ];

    const regRows = registrations.map((r, i) => [
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

    await saveSharedConfig({
      spreadsheetId,
      lastSyncedAt: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error('Error during full sheet sync:', err);
    throw err;
  }
};

/**
 * Ready-to-use Google Apps Script code for 100% automated multi-device sync
 */
export const GOOGLE_APPS_SCRIPT_CODE = `// ========================================================
// รหัส Google Apps Script สำหรับระบบกิจกรรมหอพัก มช. (CMU Dorm)
// วิธีใช้:
// 1. ใน Google Sheet ของคุณ ไปที่เมนู "ส่วนขยาย (Extensions)" > "Apps Script"
// 2. วางโค้ดนี้ทั้งหมดลงไป แล้วกดบันทึก (Save)
// 3. กดปุ่ม "ทำให้ใช้งานได้ (Deploy)" > "การทำให้ใช้งานได้รายการใหม่ (New deployment)"
// 4. เลือกประเภท: "เว็บแอป (Web app)"
// 5. ช่อง "ผู้มีสิทธิ์เข้าถึง (Who has access)" ให้เลือก: "ทุกคน (Anyone)"
// 6. คัดลอก URL เว็บแอป (Web app URL) ที่ได้ มาวางในระบบกิจกรรมหอพัก มช.
// ทุกเครื่องจะเชื่อมต่อและบันทึกข้อมูลลง Google Sheet อัตโนมัติทันที!
// ========================================================

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. บันทึกข้อมูลกิจกรรมใหม่
    if (contents.action === 'addActivity') {
      var act = contents.activity;
      var sheet = ss.getSheetByName('กิจกรรมทั้งหมด');
      if (!sheet) {
        sheet = ss.insertSheet('กิจกรรมทั้งหมด');
        sheet.appendRow([
          'รหัสกิจกรรม', 'ชื่อโครงการ/กิจกรรม', 'หมวดหมู่', 'สถานที่จัด',
          'วันเวลาเริ่มกิจกรรม', 'วันเวลาสิ้นสุด', 'จำนวนรับ (คน)',
          'วันเปิดรับสมัคร', 'วันปิดรับสมัคร', 'กลุ่มเป้าหมาย', 'คะแนนกิจกรรม', 'วันที่บันทึก'
        ]);
        sheet.setFrozenRows(1);
      }
      sheet.appendRow([
        act.code, act.title, act.categoryLabel, act.location,
        act.eventDateTime, act.eventEndDateTime, act.maxParticipants,
        act.openDate, act.closeDate, act.targetAudience, act.hoursEarned,
        new Date().toISOString()
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. บันทึกข้อมูลการสมัครของนักศึกษา (อัตโนมัติจากทุกเครื่อง)
    if (contents.action === 'addRegistration') {
      var sheet = ss.getSheetByName('รายชื่อผู้สมัครเข้าร่วม');
      if (!sheet) {
        sheet = ss.insertSheet('รายชื่อผู้สมัครเข้าร่วม');
        sheet.appendRow([
          'ลำดับ', 'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'รหัสนักศึกษา',
          'ชื่อ-นามสกุล', 'หอพักนักศึกษา', 'วันเวลาที่สมัคร', 'สถานะ'
        ]);
        sheet.setFrozenRows(1);
      }
      var nextRow = sheet.getLastRow();
      sheet.appendRow([
        contents.index || nextRow,
        contents.activityCode,
        contents.activityTitle,
        contents.studentId,
        contents.fullName,
        contents.dormitory,
        contents.registeredAt || new Date().toISOString(),
        'ยืนยันแล้ว'
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'unknown_action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

/**
 * Universal CSV download export for backup and spreadsheet opening
 */
export const exportToCsv = (
  filename: string,
  rows: (string | number)[][]
) => {
  const processRow = (row: (string | number)[]) => {
    return row
      .map(val => {
        const text = String(val ?? '');
        if (text.search(/("|,|\n)/g) >= 0) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return `"${text}"`;
      })
      .join(',');
  };

  const csvContent = '\uFEFF' + rows.map(processRow).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
