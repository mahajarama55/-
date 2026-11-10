import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Edit2,
  Trash2,
  Users,
  FileSpreadsheet,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Lock,
  Layers,
  Calendar,
  Sparkles,
  Award,
  Link2,
  Save,
  Check,
  MessageSquare
} from 'lucide-react';
import { Activity, Registration, SheetConfig } from '../types';
import { AdminLiveChat } from './AdminLiveChat';
import { getActivityStats, formatThaiDateTime, fetchRegistrationsFromServer } from '../utils/storage';
import {
  fetchSharedConfig,
  saveSharedConfig,
  createCmuActivitySpreadsheet,
  syncAllDataToSheet,
  fetchDataFromGoogleSheet,
  getSavedSpreadsheetId,
  getSavedSpreadsheetUrl,
  exportToCsv
} from '../services/googleSheets';
import { getAccessToken, googleSignIn } from '../services/firebaseAuth';

interface AdminPanelProps {
  isAdmin: boolean;
  onLoginSuccess: () => void;
  activities: Activity[];
  registrations: Registration[];
  onOpenAddModal: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activity: Activity) => void;
  onViewRoster: (activity: Activity) => void;
  onDataLoadedFromSheet?: (activities: Activity[], registrations: Registration[]) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isAdmin,
  onLoginSuccess,
  activities,
  registrations,
  onOpenAddModal,
  onEditActivity,
  onDeleteActivity,
  onViewRoster,
  onDataLoadedFromSheet
}) => {
  // Login State
  const [username, setUsername] = useState('admin@cmu.ac.th');
  const [password, setPassword] = useState('Aod007HDR_');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Sub Tab
  const [adminSubTab, setAdminSubTab] = useState<'activities' | 'chat' | 'sheets'>('activities');

  // Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Google Sheets state
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    webhookUrl: null,
    autoSync: true,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showManualLink, setShowManualLink] = useState(false);
  const [customSheetUrl, setCustomSheetUrl] = useState('');

  // Load shared configuration from server
  useEffect(() => {
    fetchSharedConfig().then(cfg => {
      setSheetConfig(cfg);
      if (cfg.spreadsheetUrl) setCustomSheetUrl(cfg.spreadsheetUrl);
    });
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const p = password.trim();
    if (
      (u === 'admin@cmu.ac.th' || u === 'Aod007HDR_' || u === 'admindorm') &&
      (p === 'Aod007HDR_' || p === 'admin44750$')
    ) {
      onLoginSuccess();
      setLoginError(null);
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleGoogleAdminLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        onLoginSuccess();
        setLoginError(null);
      }
    } catch (err: any) {
      setLoginError(err?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
    }
  };

  // Google Sheet Direct Create and Full Sync via Google Sheets API (OAuth)
  const handleCreateOrSyncSheet = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        // Trigger Google sign-in popup to get access token
        const signin = await googleSignIn();
        token = signin?.accessToken || null;
      }

      if (!token) {
        throw new Error('ไม่สามารถรับสิทธิ์เข้าถึงบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง');
      }

      const activeId = sheetConfig.spreadsheetId || getSavedSpreadsheetId();

      if (!activeId) {
        // Create new spreadsheet directly in user's Google Drive
        const res = await createCmuActivitySpreadsheet(token, activities, registrations);
        const updated = await saveSharedConfig({
          spreadsheetId: res.spreadsheetId,
          spreadsheetUrl: res.spreadsheetUrl,
          lastSyncedAt: new Date().toISOString()
        });
        setSheetConfig(updated);
        setCustomSheetUrl(res.spreadsheetUrl);
        setSyncStatusMsg({
          type: 'success',
          text: `สร้าง Google Sheet เรียบร้อยแล้ว! พร้อมบันทึกข้อมูล ${activities.length} โครงการ และผู้สมัคร ${registrations.length} คน`
        });
      } else {
        // Full Sync
        await syncAllDataToSheet(token, activeId, activities, registrations);
        const updated = await saveSharedConfig({
          lastSyncedAt: new Date().toISOString()
        });
        setSheetConfig(prev => ({ ...prev, lastSyncedAt: updated.lastSyncedAt }));
        setSyncStatusMsg({
          type: 'success',
          text: `ซิงค์ข้อมูลกิจกรรม (${activities.length} โครงการ) และผู้สมัคร (${registrations.length} คน) ลง Google Sheet สำเร็จแล้ว`
        });
      }
    } catch (err: any) {
      console.error('Sheet Sync Error:', err);
      setSyncStatusMsg({
        type: 'error',
        text: `เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถเชื่อมต่อ Google Sheet ได้'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch activities and registrations directly from Google Sheet
  const handleFetchDataFromSheet = async () => {
    const activeId = sheetConfig.spreadsheetId || getSavedSpreadsheetId();
    if (!activeId) {
      setSyncStatusMsg({
        type: 'error',
        text: 'ยังไม่ได้เชื่อมต่อ Google Sheet กรุณาสร้างหรือผูก Google Sheet ก่อน'
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      const token = await getAccessToken();
      const res = await fetchDataFromGoogleSheet(activeId, token || undefined);
      if (res.success) {
        if (onDataLoadedFromSheet) {
          onDataLoadedFromSheet(res.activities, res.registrations);
        }
        setSyncStatusMsg({
          type: 'success',
          text: `ดึงข้อมูลจาก Google Sheet สำเร็จแล้ว! พบกิจกรรม ${res.activities.length} โครงการ, ผู้สมัคร ${res.registrations.length} คน`
        });
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: res.message || 'ไม่สามารถดึงข้อมูลจาก Google Sheet ได้'
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: `เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถดึงข้อมูลได้'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Link an existing Google Sheet URL
  const handleSaveCustomSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = customSheetUrl.trim();
    if (!cleanUrl) return;

    let extractedId: string | null = null;
    const match = cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      extractedId = match[1];
    } else {
      extractedId = cleanUrl; // maybe raw ID was entered
    }

    const updated = await saveSharedConfig({
      spreadsheetId: extractedId,
      spreadsheetUrl: cleanUrl.startsWith('http') ? cleanUrl : `https://docs.google.com/spreadsheets/d/${extractedId}/edit`,
      lastSyncedAt: new Date().toISOString()
    });
    setSheetConfig(updated);
    setShowManualLink(false);

    // Automatically pull data from this newly linked sheet!
    try {
      setIsSyncing(true);
      const token = await getAccessToken();
      const res = await fetchDataFromGoogleSheet(extractedId, token || undefined);
      if (res.success && onDataLoadedFromSheet) {
        onDataLoadedFromSheet(res.activities, res.registrations);
        setSyncStatusMsg({
          type: 'success',
          text: `ผูก Google Sheet และดึงข้อมูลสำเร็จ! พบกิจกรรม ${res.activities.length} โครงการ, ผู้สมัคร ${res.registrations.length} คน`
        });
      } else {
        setSyncStatusMsg({
          type: 'success',
          text: 'บันทึกการผูก Google Sheet เรียบร้อยแล้ว'
        });
      }
    } catch {
      setSyncStatusMsg({
        type: 'success',
        text: 'บันทึกการผูก Google Sheet เรียบร้อยแล้ว'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Deduplicate participants action
  const handleDeduplicate = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/registrations/deduplicate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const freshRegs = await fetchRegistrationsFromServer();
        if (onDataLoadedFromSheet) {
          onDataLoadedFromSheet(activities, freshRegs);
        }
        setSyncStatusMsg({
          type: 'success',
          text: data.removed > 0
            ? `ล้างข้อมูลซ้ำซ้อนสำเร็จ! ลบข้อมูลซ้ำออก ${data.removed} รายการ เหลือผู้สมัคร ${data.count} คน`
            : `ระบบตรวจสอบแล้ว ไม่พบข้อมูลผู้สมัครที่ซ้ำซ้อน (ผู้สมัคร ${data.count} คน)`
        });
      }
    } catch {
      setSyncStatusMsg({
        type: 'error',
        text: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลซ้ำซ้อน'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportAllCsv = () => {
    const headers = [
      'รหัสกิจกรรม',
      'ชื่อกิจกรรม',
      'หมวดหมู่',
      'สถานที่จัด',
      'วันเวลาเริ่ม',
      'วันเวลาสิ้นสุด',
      'จำนวนรับ (คน)',
      'ผู้สมัครแล้ว (คน)',
      'วันเปิดรับสมัคร',
      'วันปิดรับสมัคร',
      'คะแนนกิจกรรม'
    ];

    const rows = activities.map(a => {
      const stats = getActivityStats(a, registrations);
      return [
        a.code,
        a.title,
        a.categoryLabel,
        a.location,
        a.eventDateTime,
        a.eventEndDateTime,
        a.maxParticipants,
        stats.enrolledCount,
        a.openDate,
        a.closeDate,
        a.hoursEarned
      ];
    });

    exportToCsv(`ทะเบียนกิจกรรมหอพักนักศึกษา_มช_${new Date().toISOString().slice(0, 10)}`, [headers, ...rows]);
  };

  // Filter activities
  const filteredActivities = activities.filter(a => {
    const matchesSearch =
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === 'all' || a.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  // Calculate totals
  const totalRegistrations = registrations.filter(r => r.status !== 'cancelled').length;
  const totalCapacity = activities.reduce((acc, a) => acc + a.maxParticipants, 0);
  const averageFillRate = totalCapacity > 0 ? Math.round((totalRegistrations / totalCapacity) * 100) : 0;
  const spreadsheetId = sheetConfig.spreadsheetId || getSavedSpreadsheetId();
  const spreadsheetUrl = sheetConfig.spreadsheetUrl || getSavedSpreadsheetUrl();

  // Background Auto-Sync: Automatically keeps all participants and activities synchronized in Google Sheet
  useEffect(() => {
    if (!isAdmin || !sheetConfig.spreadsheetId || sheetConfig.autoSync === false) return;

    const autoSyncTimer = setInterval(async () => {
      try {
        const token = await getAccessToken();
        if (token && sheetConfig.spreadsheetId) {
          await syncAllDataToSheet(token, sheetConfig.spreadsheetId, activities, registrations);
          setSheetConfig(prev => ({ ...prev, lastSyncedAt: new Date().toISOString() }));
        }
      } catch (e) {
        // Silent background update catch
      }
    }, 30000);

    return () => clearInterval(autoSyncTimer);
  }, [isAdmin, sheetConfig.spreadsheetId, sheetConfig.autoSync, activities, registrations]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-purple-100 text-[#6C3994] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            ระบบผู้ดูแลโครงการ (Admin Login)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            สำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่
          </p>
        </div>

        {loginError && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              บัญชีผู้ใช้งาน / อีเมล
            </label>
            <input
              type="text"
              required
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รหัสผ่าน
            </label>
            <input
              type="password"
              required
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-sm font-semibold rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            เข้าสู่ระบบผู้ดูแล
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400">หรือ</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleAdminLogin}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl border border-slate-200 shadow-2xs transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>เข้าสู่ระบบด้วยบัญชี Google</span>
        </button>

        <p className="text-[11px] text-slate-400 text-center pt-3">
          * สำหรับเจ้าหน้าที่สำนักงานหอพักนักศึกษา มช.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin KPI Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">โครงการทั้งหมด</span>
            <div className="p-2 rounded-xl bg-purple-50 text-[#6C3994]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{activities.length} โครงการ</div>
          <span className="text-[11px] text-purple-700 font-medium">ภาคเรียนปัจจุบัน</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">ผู้สมัครเข้าร่วมรวม</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalRegistrations} คน</div>
          <span className="text-[11px] text-emerald-700 font-medium">
            จากโควตารวม {totalCapacity} คน
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">อัตราการเต็มที่นั่ง</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{averageFillRate}%</div>
          <span className="text-[11px] text-amber-700 font-medium">เฉลี่ยทุกกิจกรรม</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Google Sheet เชื่อมต่อ</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${spreadsheetId ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {spreadsheetId ? 'เชื่อมต่อพร้อมใช้งาน' : 'ยังไม่ได้เชื่อมต่อ'}
          </div>
          <span className="text-[11px] text-slate-500 truncate block">
            {spreadsheetId ? `ID: ${spreadsheetId.slice(0, 10)}...` : 'กดสร้าง Google Sheet ด้านล่าง'}
          </span>
        </div>
      </div>

      {/* Admin Sub Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setAdminSubTab('activities')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            adminSubTab === 'activities'
              ? 'bg-white text-[#6C3994] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>จัดการโครงการกิจกรรม ({activities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminSubTab('chat')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            adminSubTab === 'chat'
              ? 'bg-gradient-to-r from-[#6C3994] to-[#8648B8] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>ระบบ Live Chat & AI แชทบอท</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            adminSubTab === 'chat' ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-100 text-emerald-700'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
            Real-time
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAdminSubTab('sheets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            adminSubTab === 'sheets'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>การเชื่อมต่อ Google Sheets</span>
        </button>
      </div>

      {/* When Chat Subtab is Active */}
      {adminSubTab === 'chat' && (
        <AdminLiveChat activities={activities} registrations={registrations} />
      )}

      {/* When Sheets or Activities Subtab is Active */}
      {adminSubTab !== 'chat' && (
        <>
          {/* Google Sheets Sync & Action Bar */}
          <div className="bg-gradient-to-r from-purple-900 via-[#562879] to-[#6C3994] text-white p-5 sm:p-6 rounded-3xl shadow-md space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base sm:text-lg">
                    ระบบบันทึกและอัปเดตผู้เข้าร่วมกิจกรรมลง Google Sheet อัตโนมัติ
                  </h3>
                </div>
            <p className="text-xs text-purple-200 max-w-2xl leading-relaxed">
              บันทึกทะเบียนโครงการกิจกรรมและรายชื่อนักศึกษาผู้สมัครเข้าร่วมทั้งหมดลงใน Google Sheet
              บน Google Drive ของท่านโดยอัตโนมัติ ทุกครั้งที่มีนักศึกษาลงทะเบียนใหม่ ข้อมูลจะถูกอัปเดตลง Sheet ทันทีแบบเรียลไทม์
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
              <span className="inline-flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg text-emerald-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                บันทึกผู้เข้าร่วมแล้ว: <strong>{totalRegistrations} คน</strong>
              </span>
              {sheetConfig.lastSyncedAt && (
                <span className="text-purple-200">
                  ✓ อัปเดตล่าสุด: {new Date(sheetConfig.lastSyncedAt).toLocaleString('th-TH')}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Pull from Google Sheet Button (Primary Data Source) */}
            <button
              onClick={handleFetchDataFromSheet}
              disabled={isSyncing || !spreadsheetId}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
              title="ดึงข้อมูลกิจกรรมและรายชื่อผู้สมัครจาก Google Sheet มาเป็นข้อมูลหลักในระบบ"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>ดึงข้อมูลจาก Google Sheet</span>
            </button>

            {/* Primary Google Sheet Create/Sync Button */}
            <button
              onClick={handleCreateOrSyncSheet}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'กำลังซิงค์...' : spreadsheetId ? 'ซิงค์ข้อมูลลง Sheet' : 'สร้าง Google Sheet ทันที'}</span>
            </button>

            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-xl border border-white/20 transition-colors"
              >
                <span>เปิดดู Google Sheet</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={() => setShowManualLink(!showManualLink)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-purple-950/40 hover:bg-purple-950/60 text-purple-100 text-xs sm:text-sm font-medium rounded-xl border border-purple-400/30 transition-colors"
              title="ผูกกับ Google Sheet ที่มีอยู่แล้ว"
            >
              <Link2 className="w-4 h-4 text-purple-300" />
              <span>{showManualLink ? 'ซ่อน' : 'ผูกชีตที่มีอยู่'}</span>
            </button>

            <button
              onClick={handleExportAllCsv}
              title="ดาวน์โหลดข้อมูลสรุปโครงการทั้งหมดเป็น CSV"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-800 hover:bg-slate-100 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 text-[#6C3994]" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatusMsg && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center justify-between gap-2 border ${
              syncStatusMsg.type === 'success'
                ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500/40'
                : 'bg-rose-950/70 text-rose-200 border-rose-500/40'
            }`}
          >
            <div className="flex items-center gap-2">
              {syncStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{syncStatusMsg.text}</span>
            </div>
            <button
              onClick={() => setSyncStatusMsg(null)}
              className="text-white/60 hover:text-white text-xs px-2 py-0.5"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Manual Link Input */}
        {showManualLink && (
          <form onSubmit={handleSaveCustomSheet} className="pt-3 border-t border-purple-400/20 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="วาง URL ของ Google Sheet ที่คุณมี เช่น https://docs.google.com/spreadsheets/d/.../edit"
              value={customSheetUrl}
              onChange={e => setCustomSheetUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-400/40 text-white placeholder-purple-300/40 text-xs focus:outline-hidden focus:border-emerald-400"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-xs shrink-0 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>ผูกชีตนี้</span>
            </button>
          </form>
        )}
      </div>

      {/* Activities Table Control Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              ตารางจัดการโครงการและกิจกรรมหอพัก
            </h3>
            <p className="text-xs text-slate-500">
              ผู้ดูแลสามารถเพิ่ม แก้ไข ลบ และตรวจสอบรายชื่อนักศึกษาแต่ละกิจกรรมได้ที่นี่
            </p>
          </div>

          <button
            onClick={onOpenAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>เพิ่มกิจกรรมใหม่</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัสกิจกรรม, ชื่อโครงการ, หรือสถานที่..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs sm:text-sm"
            />
          </div>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-700"
          >
            <option value="all">ทุกหมวดหมู่กิจกรรม</option>
            <option value="sports">กีฬาและนันทนาการ</option>
            <option value="volunteer">จิตอาสา/บำเพ็ญประโยชน์</option>
            <option value="skills">พัฒนาทักษะชีวิตและวิชาการ</option>
            <option value="culture">ประเพณีและศิลปวัฒนธรรม</option>
            <option value="environment">สิ่งแวดล้อมและ 5ส</option>
          </select>
        </div>

        {/* Activities Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <th className="py-3 px-3">รหัส</th>
                <th className="py-3 px-3">ชื่อกิจกรรมโครงการ</th>
                <th className="py-3 px-3">หมวดหมู่</th>
                <th className="py-3 px-3">วันเวลาจัดกิจกรรม</th>
                <th className="py-3 px-3 text-center">ผู้สมัคร / โควตา</th>
                <th className="py-3 px-3">ระยะเวลารับสมัคร</th>
                <th className="py-3 px-3 text-center">สถานะ</th>
                <th className="py-3 px-3 text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    ไม่พบข้อมูลกิจกรรม
                  </td>
                </tr>
              ) : (
                filteredActivities.map(act => {
                  const stats = getActivityStats(act, registrations);
                  return (
                    <tr key={act.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#6C3994]">
                        {act.code}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 max-w-xs">{act.title}</div>
                        <span className="text-[11px] text-slate-500 block truncate">{act.location}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {act.categoryLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {formatThaiDateTime(act.eventDateTime)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onViewRoster(act)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg font-semibold transition-colors"
                          title="คลิกเพื่อดูรายชื่อนักศึกษา"
                        >
                          <Users className="w-3.5 h-3.5 text-[#6C3994]" />
                          <span>{stats.enrolledCount} / {act.maxParticipants}</span>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        <div>เปิด: {formatThaiDateTime(act.openDate)}</div>
                        <div className="text-rose-600 font-medium">ปิด: {formatThaiDateTime(act.closeDate)}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${stats.badgeClass}`}>
                          {stats.statusText}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewRoster(act)}
                            title="ดูรายชื่อผู้สมัคร"
                            className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditActivity(act)}
                            title="แก้ไขข้อมูลโครงการ"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`ยืนยันการลบโครงการ "${act.title}" (${act.code})? ข้อมูลผู้สมัครในโครงการนี้จะถูกลบด้วย`)) {
                                onDeleteActivity(act);
                              }
                            }}
                            title="ลบโครงการนี้"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
