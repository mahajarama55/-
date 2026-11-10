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

  // Save globally to server so ALL devices have it and server can auto-append!
  await saveSharedConfig({
    spreadsheetId,
    spreadsheetUrl,
    googleAccessToken: token,
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
  } else if (activeToken && spreadsheetId) {
    // Method 2: Google Sheets API v4 (fallback when webhook not used)
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

    // Registrations (Strict deduplication before pushing to Google Sheet)
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

    const seenRegs = new Set<string>();
    const uniqueRegs: Registration[] = [];
    for (const r of registrations) {
      if (!r) continue;
      const stdId = String(r.studentId || '').trim();
      if (!stdId) continue;
      const actKey = String(r.activityCode || r.activityId || '').trim().toLowerCase();
      const key = `${actKey}_${stdId}`;
      if (!seenRegs.has(key)) {
        seenRegs.add(key);
        uniqueRegs.push(r);
      }
    }

    const regRows = uniqueRegs.map((r, i) => [
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
      googleAccessToken: token,
      lastSyncedAt: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error('Error during full sheet sync:', err);
    throw err;
  }
};

/**
 * Universal Zero-Login Google Sheet Sync via Backend Server & Webhook.
 * Works from EVERY device and browser without requiring Google sign-in!
 */
export const triggerZeroLoginSheetSync = async (customWebhookUrl?: string): Promise<{ success: boolean; message: string; lastSyncedAt?: string }> => {
  const currentConfig = await fetchSharedConfig();
  const webhookUrl = customWebhookUrl || currentConfig.webhookUrl;

  if (!webhookUrl) {
    return {
      success: false,
      message: 'ยังไม่ได้ระบุ Webhook URL ของ Google Sheet กรุณาวาง URL ของ Google Apps Script ในส่วนการตั้งค่าด้านล่าง',
    };
  }

  try {
    const res = await fetch('/api/sheets/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (data.lastSyncedAt) {
        await saveSharedConfig({ lastSyncedAt: data.lastSyncedAt });
      }
      return {
        success: true,
        message: 'ซิงค์ข้อมูลกิจกรรมและรายชื่อนักศึกษาลง Google Sheet สำเร็จแล้ว (ไม่ต้องล็อกอิน Google)',
        lastSyncedAt: data.lastSyncedAt,
      };
    } else {
      return {
        success: false,
        message: data.error || 'ไม่สามารถซิงค์ข้อมูลกับ Google Sheet ได้ ตรวจสอบสิทธิ์การเข้าถึง Web App',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
    };
  }
};

/**
 * Ready-to-use Google Apps Script code for 100% automated multi-device sync
 * Zero login required for admins or students!
 */
export const GOOGLE_APPS_SCRIPT_CODE = `// ========================================================
// รหัส Google Apps Script สำหรับระบบกิจกรรมหอพัก มช. (CMU Dorm)
// รองรับทั้ง doGet (ดึงข้อมูล) และ doPost (บันทึกข้อมูล) อัตโนมัติจากทุกเครื่อง!
// 
// วิธีติดตั้ง / อัปเดต (ทำครั้งเดียว):
// 1. ใน Google Sheet ไปที่เมนู "ส่วนขยาย (Extensions)" > "Apps Script"
// 2. ลบโค้ดเดิมออกทั้งหมด แล้ววางโค้ดนี้ลงไป
// 3. กดไอคอน "บันทึก (Save 💾)" หรือกด Ctrl+S
// 4. กดปุ่มสีน้ำเงิน "ทำให้ใช้งานได้ (Deploy)" > "จัดการการทำให้ใช้งานได้ (Manage deployments)"
// 5. กดไอคอนดินสอ "แก้ไข (Edit)" > ที่ช่องเวอร์ชันเลือก "เวอร์ชันใหม่ (New version)"
// 6. ตรวจสอบสิทธิ์: ผู้มีสิทธิ์เข้าถึง (Who has access) = "ทุกคน (Anyone)"
// 7. กด "ทำให้ใช้งานได้ (Deploy)"
// ========================================================

// 1. รองรับการดึงข้อมูลผ่าน GET (เรียกจากเว็บแอพ หรือเปิดในบราวเซอร์)
function doGet(e) {
  return handleFetchData(e);
}

// 2. รองรับการบันทึก/ซิงค์ข้อมูลผ่าน POST
function doPost(e) {
  try {
    var contents = {};
    if (e && e.postData && e.postData.contents) {
      try {
        contents = JSON.parse(e.postData.contents);
      } catch (pe) {
        contents = {};
      }
    }

    // กรณีเรียกดูข้อมูลผ่าน POST
    if (contents.action === 'fetchData' || contents.action === 'getData') {
      return handleFetchData(e);
    }

    var ss = getTargetSpreadsheet();

    // กรณี A: ซิงค์ข้อมูลทั้งหมด (ทั้งกิจกรรม และรายชื่อผู้สมัคร)
    if (contents.action === 'syncAll') {
      var activities = contents.activities || [];
      var registrations = contents.registrations || [];

      // --- จัดการแท็บกิจกรรมทั้งหมด ---
      var actSheet = ss.getSheetByName('กิจกรรมทั้งหมด');
      if (!actSheet) {
        actSheet = ss.insertSheet('กิจกรรมทั้งหมด');
      } else {
        actSheet.clearContents();
      }

      var actHeaders = [
        'รหัสกิจกรรม', 'ชื่อโครงการ/กิจกรรม', 'หมวดหมู่', 'สถานที่จัด',
        'วันเวลาเริ่มกิจกรรม', 'วันเวลาสิ้นสุด', 'จำนวนรับ (คน)',
        'วันเปิดรับสมัคร', 'วันปิดรับสมัคร', 'กลุ่มเป้าหมาย', 'คะแนนกิจกรรม', 'วันที่บันทึกล่าสุด'
      ];
      var actRows = [actHeaders];

      for (var i = 0; i < activities.length; i++) {
        var a = activities[i];
        actRows.push([
          a.code || '',
          a.title || '',
          a.categoryLabel || a.category || '',
          a.location || '',
          a.eventDateTime || '',
          a.eventEndDateTime || '',
          a.maxParticipants || 0,
          a.openDate || '',
          a.closeDate || '',
          a.targetAudience || '',
          a.hoursEarned || 0,
          new Date().toLocaleString('th-TH')
        ]);
      }
      actSheet.getRange(1, 1, actRows.length, actHeaders.length).setValues(actRows);
      actSheet.getRange(1, 1, 1, actHeaders.length).setFontWeight('bold').setBackground('#6C3994').setFontColor('#FFFFFF');
      actSheet.setFrozenRows(1);

      // --- จัดการแท็บรายชื่อผู้สมัครเข้าร่วม ---
      var regSheet = ss.getSheetByName('รายชื่อผู้สมัครเข้าร่วม');
      if (!regSheet) {
        regSheet = ss.insertSheet('รายชื่อผู้สมัครเข้าร่วม');
      } else {
        regSheet.clearContents();
      }

      var regHeaders = [
        'ลำดับ', 'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'รหัสนักศึกษา',
        'ชื่อ-นามสกุล', 'หอพักนักศึกษา', 'วันเวลาที่สมัคร', 'สถานะ'
      ];
      var regRows = [regHeaders];
      var seenRegs = {};
      var cleanCount = 0;

      for (var j = 0; j < registrations.length; j++) {
        var r = registrations[j];
        var sId = String(r.studentId || '').trim();
        var aCode = String(r.activityCode || r.activityId || '').trim();
        var rKey = aCode + '_' + sId;
        if (!seenRegs[rKey] && sId) {
          seenRegs[rKey] = true;
          cleanCount++;
          regRows.push([
            cleanCount,
            r.activityCode || '',
            r.activityTitle || '',
            r.studentId || '',
            r.fullName || '',
            r.dormitory || '',
            r.registeredAt || '',
            r.status === 'confirmed' ? 'ยืนยันแล้ว' : (r.status || 'ยืนยันแล้ว')
          ]);
        }
      }
      regSheet.getRange(1, 1, regRows.length, regHeaders.length).setValues(regRows);
      regSheet.getRange(1, 1, 1, regHeaders.length).setFontWeight('bold').setBackground('#6C3994').setFontColor('#FFFFFF');
      regSheet.setFrozenRows(1);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        syncedActivities: activities.length,
        syncedRegistrations: cleanCount,
        syncedAt: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // กรณี B: เพิ่มกิจกรรมใหม่
    if (contents.action === 'addActivity') {
      var act = contents.activity;
      var aSheet = ss.getSheetByName('กิจกรรมทั้งหมด');
      if (!aSheet) {
        aSheet = ss.insertSheet('กิจกรรมทั้งหมด');
        aSheet.appendRow([
          'รหัสกิจกรรม', 'ชื่อโครงการ/กิจกรรม', 'หมวดหมู่', 'สถานที่จัด',
          'วันเวลาเริ่มกิจกรรม', 'วันเวลาสิ้นสุด', 'จำนวนรับ (คน)',
          'วันเปิดรับสมัคร', 'วันปิดรับสมัคร', 'กลุ่มเป้าหมาย', 'คะแนนกิจกรรม', 'วันที่บันทึก'
        ]);
        aSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#6C3994').setFontColor('#FFFFFF');
        aSheet.setFrozenRows(1);
      }
      aSheet.appendRow([
        act.code, act.title, act.categoryLabel, act.location,
        act.eventDateTime, act.eventEndDateTime, act.maxParticipants,
        act.openDate, act.closeDate, act.targetAudience, act.hoursEarned,
        new Date().toLocaleString('th-TH')
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    // กรณี C: บันทึกการสมัครของนักศึกษา (อัตโนมัติจากทุกเครื่อง)
    if (contents.action === 'addRegistration') {
      var rSheet = ss.getSheetByName('รายชื่อผู้สมัครเข้าร่วม');
      if (!rSheet) {
        rSheet = ss.insertSheet('รายชื่อผู้สมัครเข้าร่วม');
        rSheet.appendRow([
          'ลำดับ', 'รหัสกิจกรรม', 'ชื่อกิจกรรม', 'รหัสนักศึกษา',
          'ชื่อ-นามสกุล', 'หอพักนักศึกษา', 'วันเวลาที่สมัคร', 'สถานะ'
        ]);
        rSheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#6C3994').setFontColor('#FFFFFF');
        rSheet.setFrozenRows(1);
      }
      var regData = contents.registration || contents;
      var targetStudentId = String(regData.studentId || '').trim();
      var targetActCode = String(regData.activityCode || '').trim();
      var targetActTitle = String(regData.activityTitle || '').trim();

      // ตรวจสอบข้อมูลซ้ำซ้อน: หากมีรหัสนักศึกษานี้ในกิจกรรมนี้แล้ว จะไม่บันทึกซ้ำ
      var lastRow = rSheet.getLastRow();
      if (lastRow > 1) {
        var existingData = rSheet.getRange(2, 1, lastRow - 1, 4).getValues();
        for (var k = 0; k < existingData.length; k++) {
          var rowActCode = String(existingData[k][1] || '').trim();
          var rowActTitle = String(existingData[k][2] || '').trim();
          var rowStudentId = String(existingData[k][3] || '').trim();
          var isSameAct = (targetActCode && rowActCode === targetActCode) || (targetActTitle && rowActTitle === targetActTitle);
          if (isSameAct && rowStudentId === targetStudentId) {
            return ContentService.createTextOutput(JSON.stringify({
              status: 'success',
              duplicateIgnored: true,
              message: 'มีข้อมูลนักศึกษาคนนี้ในกิจกรรมแล้ว (ป้องกันการบันทึกซ้ำ)'
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      var nextIndex = contents.index || lastRow;
      rSheet.appendRow([
        nextIndex,
        regData.activityCode,
        regData.activityTitle,
        regData.studentId,
        regData.fullName,
        regData.dormitory,
        regData.registeredAt || new Date().toISOString(),
        'ยืนยันแล้ว'
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    return handleFetchData(e);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชันดึงข้อมูลจาก Google Sheet ส่งกลับเป็น JSON
function handleFetchData(e) {
  try {
    var ss = getTargetSpreadsheet();

    // 1. อ่านแท็บ "กิจกรรมทั้งหมด"
    var actSheet = ss.getSheetByName('กิจกรรมทั้งหมด');
    var activities = [];
    if (actSheet && actSheet.getLastRow() > 1) {
      var actData = actSheet.getRange(2, 1, actSheet.getLastRow() - 1, 12).getValues();
      for (var i = 0; i < actData.length; i++) {
        var row = actData[i];
        var code = String(row[0] || '').trim();
        var title = String(row[1] || '').trim();
        if (!code && !title) continue;

        activities.push({
          code: code,
          title: title,
          categoryLabel: String(row[2] || '').trim(),
          location: String(row[3] || '').trim(),
          eventDateTime: formatDateTime(row[4]),
          eventEndDateTime: formatDateTime(row[5]),
          maxParticipants: Number(row[6]) || 50,
          openDate: formatDateTime(row[7]),
          closeDate: formatDateTime(row[8]),
          targetAudience: String(row[9] || '').trim(),
          hoursEarned: Number(row[10]) || 3,
          createdAt: String(row[11] || '').trim()
        });
      }
    }

    // 2. อ่านแท็บ "รายชื่อผู้สมัครเข้าร่วม"
    var regSheet = ss.getSheetByName('รายชื่อผู้สมัครเข้าร่วม');
    var registrations = [];
    var seenFetchRegs = {};
    if (regSheet && regSheet.getLastRow() > 1) {
      var regData = regSheet.getRange(2, 1, regSheet.getLastRow() - 1, 8).getValues();
      for (var j = 0; j < regData.length; j++) {
        var r = regData[j];
        var studentId = String(r[3] || '').trim();
        var fullName = String(r[4] || '').trim();
        var actCode = String(r[1] || '').trim();
        if (!studentId && !fullName) continue;

        var fKey = actCode + '_' + studentId;
        if (seenFetchRegs[fKey]) continue;
        seenFetchRegs[fKey] = true;

        registrations.push({
          index: registrations.length + 1,
          activityCode: actCode,
          activityTitle: String(r[2] || '').trim(),
          studentId: studentId,
          fullName: fullName,
          dormitory: String(r[5] || '').trim(),
          registeredAt: formatDateTime(r[6]),
          status: String(r[7] || 'ยืนยันแล้ว').trim()
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      activities: activities,
      registrations: registrations,
      count: {
        activities: activities.length,
        registrations: registrations.length
      },
      updatedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ดึง Spreadsheet จาก Active หรือ ID โดยอัตโนมัติ
function getTargetSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  return SpreadsheetApp.openById('1OZvweHpIqzopQPb-ISQTraC8U7BcdjJ4q-pGkBIJnBg');
}

function formatDateTime(val) {
  if (!val) return '';
  if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]' || typeof val.getTime === 'function') {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm");
    } catch (e) {
      try {
        return val.toISOString().slice(0, 16);
      } catch (e2) {}
    }
  }
  return String(val).trim();
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

/**
 * Fetch activities and registrations directly from the connected Google Sheet
 */
export const fetchDataFromGoogleSheet = async (
  spreadsheetId?: string,
  token?: string
): Promise<{ success: boolean; activities: Activity[]; registrations: Registration[]; message?: string }> => {
  const currentConfig = await fetchSharedConfig();
  const targetId = spreadsheetId || currentConfig.spreadsheetId;
  const activeToken = token || (await getAccessToken()) || currentConfig.googleAccessToken;

  if (!targetId) {
    return {
      success: false,
      activities: [],
      registrations: [],
      message: 'ยังไม่มี Google Sheet ที่เชื่อมต่อ'
    };
  }

  try {
    const res = await fetch('/api/sheets/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId: targetId,
        googleAccessToken: activeToken
      })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        activities: data.activities || [],
        registrations: data.registrations || [],
        message: data.message
      };
    } else {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        activities: [],
        registrations: [],
        message: err.error || 'ไม่สามารถดึงข้อมูลจาก Google Sheet ได้'
      };
    }
  } catch (e: any) {
    return {
      success: false,
      activities: [],
      registrations: [],
      message: e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
    };
  }
};

