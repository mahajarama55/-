import { Activity, Registration, NotificationItem } from '../types';
import { INITIAL_ACTIVITIES, INITIAL_REGISTRATIONS } from './initialData';

const ACTIVITIES_STORAGE_KEY = 'cmu_dorm_activities_v1';
const REGISTRATIONS_STORAGE_KEY = 'cmu_dorm_registrations_v1';
const NOTIFICATIONS_STORAGE_KEY = 'cmu_dorm_notifications_v1';

export const loadActivities = (): Activity[] => {
  try {
    const raw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(INITIAL_ACTIVITIES));
      return INITIAL_ACTIVITIES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading activities:', err);
    return INITIAL_ACTIVITIES;
  }
};

export const saveActivities = (activities: Activity[]) => {
  try {
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
  } catch (err) {
    console.error('Error saving activities:', err);
  }
};

export const loadRegistrations = (): Registration[] => {
  try {
    const raw = localStorage.getItem(REGISTRATIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(INITIAL_REGISTRATIONS));
      return INITIAL_REGISTRATIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading registrations:', err);
    return INITIAL_REGISTRATIONS;
  }
};

export const saveRegistrations = (registrations: Registration[]) => {
  try {
    localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(registrations));
  } catch (err) {
    console.error('Error saving registrations:', err);
  }
};

/**
 * Fetch activities from the shared backend server.
 * Ensures any edits made on an admin laptop instantly appear on students' phones!
 */
export const fetchActivitiesFromServer = async (): Promise<Activity[]> => {
  try {
    const res = await fetch('/api/activities');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
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
        saveRegistrations(data);
        return data;
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
export const postRegistrationToServer = async (reg: Registration): Promise<{ success: boolean; sheetSynced?: boolean }> => {
  try {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reg),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not post registration to server:', err);
  }
  return { success: false };
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

// Thai Date formatting helper
export const formatThaiDateTime = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day} ${month} ${year} เวลา ${hours}:${minutes} น.`;
  } catch {
    return dateStr;
  }
};

export const formatThaiDateOnly = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
};

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
