import React, { useState } from 'react';
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
  Award
} from 'lucide-react';
import { Activity, Registration } from '../types';
import { getActivityStats, formatThaiDateTime } from '../utils/storage';
import {
  createCmuActivitySpreadsheet,
  getSavedSpreadsheetId,
  getSavedSpreadsheetUrl,
  syncAllDataToSheet,
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
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isAdmin,
  onLoginSuccess,
  activities,
  registrations,
  onOpenAddModal,
  onEditActivity,
  onDeleteActivity,
  onViewRoster
}) => {
  // Login State
  const [username, setUsername] = useState('admin@cmu.ac.th');
  const [password, setPassword] = useState('Aod007HDR_');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Google Sheets state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const spreadsheetId = getSavedSpreadsheetId();
  const spreadsheetUrl = getSavedSpreadsheetUrl();

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (username === 'admin@cmu.ac.th' || username === 'admindorm') &&
      (password === 'Aod007HDR_' || password === 'admin44750$')
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

  // Google Sheet actions
  const handleCreateOrSyncSheet = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        // Trigger Google sign-in to get token
        const signin = await googleSignIn();
        token = signin?.accessToken || null;
      }

      if (!token) {
        throw new Error('ไม่สามารถรับสิทธิ์เข้าถึง Google Workspace ได้');
      }

      if (!spreadsheetId) {
        // Create new spreadsheet
        const res = await createCmuActivitySpreadsheet(token, activities, registrations);
        setSyncStatusMsg(`สร้าง Google Sheet เรียบร้อยแล้ว! รหัส: ${res.spreadsheetId.slice(0, 10)}...`);
      } else {
        // Full Sync
        await syncAllDataToSheet(token, spreadsheetId, activities, registrations);
        setSyncStatusMsg('ซิงค์ข้อมูลกิจกรรมและรายชื่อผู้สมัครลง Google Sheet สำเร็จแล้ว');
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถเชื่อมต่อได้'}`);
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

          <p className="text-[11px] text-slate-400 text-center pt-2">
            * สำหรับเจ้าหน้าที่สำนักงานหอพักนักศึกษา มช.
          </p>
        </form>
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
          <div className="text-sm font-bold text-slate-900 truncate">
            {spreadsheetId ? 'เชื่อมต่อพร้อมใช้งาน' : 'ยังไม่ได้เชื่อมต่อ'}
          </div>
          <span className="text-[11px] text-slate-500">
            {spreadsheetId ? `ID: ${spreadsheetId.slice(0, 8)}...` : 'คลิกปุ่มด้านล่างเพื่อสร้าง'}
          </span>
        </div>
      </div>

      {/* Google Sheets Sync & Action Bar */}
      <div className="bg-gradient-to-r from-purple-900 via-[#562879] to-[#6C3994] text-white p-5 sm:p-6 rounded-3xl shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">
              ระบบเชื่อมต่อและจัดเก็บข้อมูลลง Google Sheet
            </h3>
          </div>
          <p className="text-xs text-purple-200 max-w-2xl leading-relaxed">
            บันทึกทะเบียนโครงการกิจกรรมและรายชื่อนักศึกษาที่สมัครเข้าร่วมลงใน Google Sheet
            เพื่อความสะดวกในการส่งออกข้อมูล สรุปรายงาน และแชร์ให้กับบุคลากรหอพัก
          </p>
          {syncStatusMsg && (
            <p className="text-xs text-emerald-300 font-semibold pt-1">
              ✓ {syncStatusMsg}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
            onClick={handleExportAllCsv}
            title="ดาวน์โหลดข้อมูลสรุปโครงการทั้งหมดเป็น CSV"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-800 hover:bg-slate-100 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-[#6C3994]" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
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
    </div>
  );
};
