export interface Activity {
  id: string;
  code: string; // รหัสกิจกรรม เช่น ACT-DORM-6901
  title: string; // ชื่อกิจกรรม
  description: string; // รายละเอียดโครงการ
  location: string; // สถานที่จัดกิจกรรม
  category: 'sports' | 'volunteer' | 'skills' | 'culture' | 'environment';
  categoryLabel: string;
  eventDateTime: string; // วันเวลาเริ่มจัดกิจกรรม YYYY-MM-DDTHH:mm
  eventEndDateTime: string; // วันเวลาสิ้นสุด YYYY-MM-DDTHH:mm
  maxParticipants: number; // จำนวนผู้เข้าร่วมที่รับ
  openDate: string; // วันเปิดรับสมัคร YYYY-MM-DDTHH:mm
  closeDate: string; // วันปิดรับสมัคร YYYY-MM-DDTHH:mm
  targetAudience: string; // กลุ่มเป้าหมาย (เช่น "นักศึกษาหอพักทุกหอ", "หอพักชาย", "หอพักหญิง")
  hoursEarned: number; // ชั่วโมงกิจกรรมหอพัก (กยศ. / กิจกรรมบังคับหอ)
  bannerGradient: string; // สีหัวการ์ดหรือแบนเนอร์
  googleSheetId?: string;
  googleSheetUrl?: string;
  syncedToSheet?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Registration {
  id: string;
  activityId: string;
  activityCode: string;
  activityTitle: string;
  studentId: string; // รหัสนักศึกษา 9 หลัก (มช.)
  fullName: string; // ชื่อ-นามสกุล
  dormitory: string; // หอพักนักศึกษา
  roomNumber?: string; // เลขห้อง
  faculty?: string; // คณะ
  phone?: string; // เบอร์โทรศัพท์
  email?: string;
  registeredAt: string; // วันเวลาที่ลงทะเบียน
  status: 'confirmed' | 'cancelled' | 'attended';
  attendanceChecked?: boolean;
  syncedToSheet?: boolean;
}

export interface SheetConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  webhookUrl: string | null;
  googleAccessToken?: string | null;
  autoSync: boolean;
  lastSyncedAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'deadline';
  timestamp: string;
  activityId?: string;
  isRead: boolean;
}

export interface DormStats {
  dormName: string;
  participantCount: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'user' | 'admin' | 'ai' | 'system';
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: string;
  isReadByAdmin: boolean;
  isReadByUser: boolean;
}

export interface ChatSession {
  id: string;
  studentId?: string;
  userName: string;
  dormitory?: string;
  createdAt: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadAdminCount: number;
  unreadUserCount: number;
  aiAutoReply: boolean;
  status: 'active' | 'closed';
  mode: 'ai' | 'admin';
}

