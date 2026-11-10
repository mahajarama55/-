import { Activity, Registration, NotificationItem } from '../types';
import { INITIAL_ACTIVITIES, INITIAL_REGISTRATIONS } from './initialData';

const ACTIVITIES_STORAGE_KEY = 'cmu_dorm_activities_v1';
const REGISTRATIONS_STORAGE_KEY = 'cmu_dorm_registrations_v1';
const NOTIFICATIONS_STORAGE_KEY = 'cmu_dorm_notifications_v1';

export const loadActivities = (): Activity[] => {
  try {
    const raw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: Activity[] = JSON.parse(raw);
    const filtered = parsed.filter(a => !['act-001', 'act-002', 'act-003', 'act-004', 'act-005'].includes(a.id));
    if (filtered.length !== parsed.length) {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch (err) {
    console.error('Error loading activities:', err);
    return [];
  }
};

export const saveActivities = (activities: Activity[]) => {
  try {
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
  } catch (err) {
    console.error('Error saving activities:', err);
  }
};

export const deduplicateRegistrations = (registrations: Registration[]): Registration[] => {
  if (!Array.isArray(registrations)) return [];
  const seen = new Set<string>();
  const unique: Registration[] = [];
  for (const r of registrations) {
    if (!r) continue;
    const stdId = String(r.studentId || '').trim();
    if (!stdId) continue;
    const actKey = String(r.activityCode || r.activityId || '').trim().toLowerCase();
    const key = `${actKey}_${stdId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return unique;
};

export const loadRegistrations = (): Registration[] => {
  try {
    const raw = localStorage.getItem(REGISTRATIONS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: Registration[] = JSON.parse(raw);
    const filtered = parsed.filter(r => !['reg-001', 'reg-002', 'reg-003', 'reg-004', 'reg-005', 'reg-006'].includes(r.id));
    const deduplicated = deduplicateRegistrations(filtered);
    if (deduplicated.length !== parsed.length) {
      localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch (err) {
    console.error('Error loading registrations:', err);
    return [];
  }
};

export const saveRegistrations = (registrations: Registration[]) => {
  try {
    const clean = deduplicateRegistrations(registrations);
    localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.error('Error saving registrations:', err);
  }
};

/**
 * Fetch activities from the shared backend server.
 */
export const fetchActivitiesFromServer = async (): Promise<Activity[]> => {
  try {
    const res = await fetch('/api/activities');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveActivities(data);
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend server unreachable, using cached activities:', err);
  }
  return loadActivities();
};

/**
 * Fetch registrations from the shared backend server.
 */
export const fetchRegistrationsFromServer = async (): Promise<Registration[]> => {
  try {
    const res = await fetch('/api/registrations');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const clean = deduplicateRegistrations(data);
        saveRegistrations(clean);
        return clean;
      }
    }
  } catch (err) {
    console.warn('Backend server unreachable, using cached registrations:', err);
  }
  return loadRegistrations();
};

/**
 * Post registration to server (also triggers automatic Google Sheet write on server)
 */
export const postRegistrationToServer = async (
  reg: Registration
): Promise<{ success: boolean; sheetSynced?: boolean; error?: string; registration?: Registration }> => {
  try {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reg),
    });
    if (res.ok) {
      return await res.json();
    } else {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: err.error || 'ไม่สามารถลงทะเบียนได้ หรือรหัสนักศึกษานี้ได้ลงทะเบียนกิจกรรมนี้แล้ว'
      };
    }
  } catch (err: any) {
    console.warn('Could not post registration to server:', err);
    return {
      success: false,
      error: err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
    };
  }
};

/**
 * Post activity to server
 */
export const postActivityToServer = async (act: Activity): Promise<boolean> => {
  try {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(act),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not post activity to server:', err);
    return false;
  }
};

/**
 * Delete activity on server
 */
export const deleteActivityOnServer = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    return false;
  }
};

/**
 * Cancel registration on server
 */
export const cancelRegistrationOnServer = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    return false;
  }
};

export const loadNotifications = (): NotificationItem[] => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      const defaultNotes: NotificationItem[] = [
        {
          id: 'note-01',
          title: 'ยินดีต้อนรับสู่ระบบกิจกรรมหอพัก มช.',
          message: 'สำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่ เปิดรับสมัครกิจกรรมภาคเรียนนี้แล้ว ตรวจสอบกำหนดการและลงทะเบียนได้ทันที',
          type: 'info',
          timestamp: new Date().toISOString(),
          isRead: false
        },
        {
          id: 'note-02',
          title: 'ใกล้ปิดรับสมัคร!',
          message: 'โครงการจิตอาสาพัฒนาสิ่งแวดล้อมและ 5ส เหลือที่นั่งว่างไม่มากและจะปิดรับสมัครในเร็วๆ นี้',
          type: 'warning',
          activityId: 'act-001',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          isRead: false
        }
      ];
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(defaultNotes));
      return defaultNotes;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading notifications:', err);
    return [];
  }
};

export const saveNotifications = (notes: NotificationItem[]) => {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Error saving notifications:', err);
  }
};

// Activity status calculation
export type ActivityDisplayStatus = 'upcoming' | 'open' | 'filling' | 'full' | 'closed' | 'completed';

export const getActivityStats = (activity: Activity, registrations: Registration[]) => {
  const activityRegs = registrations.filter(
    r => r.activityId === activity.id && r.status !== 'cancelled'
  );
  const enrolledCount = activityRegs.length;
  const remainingSeats = Math.max(0, activity.maxParticipants - enrolledCount);
  const percentFilled = Math.min(100, Math.round((enrolledCount / activity.maxParticipants) * 100));

  const now = new Date();
  const openTime = new Date(activity.openDate);
  const closeTime = new Date(activity.closeDate);
  const eventTime = new Date(activity.eventDateTime);

  let status: ActivityDisplayStatus = 'open';
  let statusText = 'เปิดรับสมัคร';
  let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';

  if (now > eventTime) {
    status = 'completed';
    statusText = 'กิจกรรมเสร็จสิ้นแล้ว';
    badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
  } else if (now > closeTime) {
    status = 'closed';
    statusText = 'ปิดรับสมัครแล้ว';
    badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
  } else if (now < openTime) {
    status = 'upcoming';
    statusText = 'เร็วๆ นี้ (ยังไม่เปิด)';
    badgeClass = 'bg-sky-100 text-sky-800 border-sky-200';
  } else if (enrolledCount >= activity.maxParticipants) {
    status = 'full';
    statusText = 'ที่นั่งเต็มแล้ว';
    badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (percentFilled >= 80) {
    status = 'filling';
    statusText = `ใกล้เต็ม (เหลือ ${remainingSeats} ที่)`;
    badgeClass = 'bg-orange-100 text-orange-800 border-orange-200';
  }

  return {
    enrolledCount,
    remainingSeats,
    percentFilled,
    status,
    statusText,
    badgeClass,
    canRegister: status === 'open' || status === 'filling'
  };
};

// Re-export Universal Date & Time helpers
export {
  parseAnyDate,
  toDateKey,
  toTimeString,
  normalizeDateTimeString,
  formatTimeRange,
  formatThaiDateTime,
  formatThaiDateOnly
} from './dateUtils';


// Request and send Browser Notification
export const sendBrowserNotification = (title: string, body: string) => {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/cmu-icon.png'
      });
    } catch (e) {
      console.warn('Could not fire browser notification:', e);
    }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
};
