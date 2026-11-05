import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  Award,
  Download,
  Printer,
  Search,
  Building,
  UserCheck,
  FileSpreadsheet,
  CheckCircle,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Activity, Registration } from '../types';
import { formatThaiDateTime, getActivityStats } from '../utils/storage';
import { exportToCsv, getSavedSpreadsheetUrl } from '../services/googleSheets';
import { CMU_DORMITORIES } from '../utils/initialData';

interface ActivityDetailModalProps {
  activity: Activity | null;
  registrations: Registration[];
  onClose: () => void;
  onRegister: (activity: Activity) => void;
  isAdmin?: boolean;
  onCancelRegistration?: (regId: string) => void;
  onToggleAttendance?: (regId: string) => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  registrations,
  onClose,
  onRegister,
  isAdmin,
  onCancelRegistration,
  onToggleAttendance
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'roster'>('info');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDorm, setSelectedDorm] = useState('all');

  if (!activity) return null;

  const activityRegs = registrations.filter(
    r => r.activityId === activity.id && r.status !== 'cancelled'
  );
  const stats = getActivityStats(activity, registrations);
  const sheetUrl = getSavedSpreadsheetUrl();

  // Filter roster
  const filteredRegs = activityRegs.filter(r => {
    const matchesSearch =
      r.studentId.includes(searchQuery.trim()) ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.faculty ? r.faculty.toLowerCase().includes(searchQuery.toLowerCase()) : false);
    const matchesDorm = selectedDorm === 'all' || r.dormitory === selectedDorm;
    return matchesSearch && matchesDorm;
  });

  const handleExportRosterCsv = () => {
    const headers = [
      'ลำดับ',
      'รหัสนักศึกษา',
      'ชื่อ-นามสกุล',
      'หอพักนักศึกษา',
      'วันเวลาที่สมัคร',
      'การเช็คชื่อ'
    ];

    const rows = activityRegs.map((r, i) => [
      i + 1,
      r.studentId,
      r.fullName,
      r.dormitory,
      formatThaiDateTime(r.registeredAt),
      r.attendanceChecked ? 'เข้าร่วมแล้ว' : 'ยังไม่เช็คชื่อ'
    ]);

    exportToCsv(`รายชื่อผู้สมัคร_${activity.code}_${activity.title.slice(0, 20)}`, [headers, ...rows]);
  };

  const handlePrintCheckinSheet = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className={`p-6 bg-gradient-to-r ${activity.bannerGradient || 'from-purple-700 to-indigo-800'} text-white relative shrink-0`}>
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 p-2 rounded-full transition-colors no-print"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-white text-[#6C3994] font-mono text-xs font-bold px-2.5 py-1 rounded-md shadow-xs">
              {activity.code}
            </span>
            <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-md backdrop-blur-xs">
              {activity.categoryLabel}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stats.badgeClass}`}>
              {stats.statusText}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold leading-tight pr-8">
            {activity.title}
          </h2>

          <div className="flex flex-wrap items-center gap-4 text-xs text-purple-100 mt-3">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-300" />
              {activity.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-300" />
              +{activity.hoursEarned} คะแนนกิจกรรมหอพัก
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-300" />
              ผู้สมัคร {stats.enrolledCount} / {activity.maxParticipants} คน ({stats.percentFilled}%)
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 px-6 pt-3 bg-slate-50 shrink-0 no-print">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'info'
                ? 'border-[#6C3994] text-[#6C3994]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            รายละเอียดโครงการ
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'roster'
                ? 'border-[#6C3994] text-[#6C3994]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>รายชื่อผู้สมัครเข้าร่วม</span>
            <span className="bg-purple-100 text-[#6C3994] text-xs px-2 py-0.5 rounded-full font-bold">
              {activityRegs.length}
            </span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'info' ? (
            /* TAB 1: Project Information */
            <div className="space-y-6">
              {/* Description Box */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2">วัตถุประสงค์และรายละเอียดโครงการ</h4>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                  {activity.description}
                </div>
              </div>

              {/* Schedule and Timetable Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-white">
                  <div className="flex items-center gap-2 text-[#6C3994] font-bold text-sm mb-3">
                    <Calendar className="w-4 h-4" />
                    <span>วันเวลาที่จัดกิจกรรม</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[11px]">เริ่มกิจกรรม:</span>
                      <strong className="text-slate-800 text-sm">{formatThaiDateTime(activity.eventDateTime)}</strong>
                    </div>
                    {activity.eventEndDateTime && (
                      <div className="pt-1">
                        <span className="text-slate-400 block text-[11px]">สิ้นสุดกิจกรรม:</span>
                        <strong className="text-slate-800">{formatThaiDateTime(activity.eventEndDateTime)}</strong>
                      </div>
                    )}
                    <div className="pt-2 text-slate-500">
                      สถานที่: <strong className="text-slate-800">{activity.location}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/80 bg-white">
                  <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-3">
                    <Clock className="w-4 h-4" />
                    <span>ระยะเวลารับสมัคร</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[11px]">เปิดรับสมัครตั้งแต่:</span>
                      <strong className="text-slate-800">{formatThaiDateTime(activity.openDate)}</strong>
                    </div>
                    <div className="pt-1">
                      <span className="text-slate-400 block text-[11px]">ปิดรับสมัครเวลา:</span>
                      <strong className="text-rose-700 font-semibold">{formatThaiDateTime(activity.closeDate)}</strong>
                    </div>
                    <div className="pt-2 text-slate-500">
                      กลุ่มเป้าหมาย: <strong className="text-slate-800">{activity.targetAudience}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quota & Capacity status */}
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h5 className="font-bold text-slate-900 text-sm">โควตาและจำนวนผู้เข้าร่วม</h5>
                  <p className="text-xs text-slate-600 mt-0.5">
                    เปิดรับสมัครทั้งสิ้น {activity.maxParticipants} คน (มีผู้สมัครแล้ว {stats.enrolledCount} คน, เหลืออีก {stats.remainingSeats} ที่นั่ง)
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  {stats.canRegister ? (
                    <button
                      onClick={() => onRegister(activity)}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      สมัครเข้าร่วมตอนนี้
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-slate-200 text-slate-500 text-xs font-semibold rounded-xl">
                      {stats.statusText}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: Registered Students Roster */
            <div className="space-y-4">
              {/* Printable Header (Visible only when printing) */}
              <div className="hidden print-only mb-4 border-b pb-3">
                <h2 className="text-lg font-bold text-black">
                  ใบรายชื่อผู้เข้าร่วมกิจกรรม: {activity.title} ({activity.code})
                </h2>
                <p className="text-xs text-gray-600">
                  วันเวลาจัด: {formatThaiDateTime(activity.eventDateTime)} | สถานที่: {activity.location} | สำนักงานหอพักนักศึกษา มช.
                </p>
              </div>

              {/* Controls & Search toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
                <div className="flex flex-1 items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหารหัสนักศึกษา, ชื่อ, หรือคณะ..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200"
                    />
                  </div>

                  <select
                    value={selectedDorm}
                    onChange={e => setSelectedDorm(e.target.value)}
                    className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700"
                  >
                    <option value="all">ทุกหอพัก ({activityRegs.length})</option>
                    {CMU_DORMITORIES.map(dorm => {
                      const count = activityRegs.filter(r => r.dormitory === dorm).length;
                      if (count === 0) return null;
                      return (
                        <option key={dorm} value={dorm}>
                          {dorm} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleExportRosterCsv}
                    title="ส่งออกรายชื่อเป็นไฟล์ CSV"
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV / Excel</span>
                  </button>

                  <button
                    onClick={handlePrintCheckinSheet}
                    title="พิมพ์ใบเช็คชื่อเข้าร่วมกิจกรรม"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">พิมพ์ใบเช็คชื่อ</span>
                  </button>

                  {sheetUrl && (
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold rounded-xl border border-purple-200 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Google Sheet</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3">รหัสนักศึกษา</th>
                      <th className="py-3 px-3">ชื่อ-นามสกุล</th>
                      <th className="py-3 px-3">หอพัก</th>
                      <th className="py-3 px-3">วันที่สมัคร</th>
                      <th className="py-3 px-3 text-center">เช็คชื่อ</th>
                      {isAdmin && <th className="py-3 px-3 text-center no-print">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRegs.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-slate-400">
                          {activityRegs.length === 0
                            ? 'ยังไม่มีผู้ลงทะเบียนกิจกรรมนี้ เป็นคนแรกที่สมัครเลย!'
                            : 'ไม่พบข้อมูลที่ตรงกับคำค้นหา'}
                        </td>
                      </tr>
                    ) : (
                      filteredRegs.map((r, index) => (
                        <tr key={r.id} className="hover:bg-purple-50/40 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                            {r.studentId}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {r.fullName}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-purple-900">{r.dormitory}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(r.registeredAt).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isAdmin ? (
                              <button
                                onClick={() => onToggleAttendance && onToggleAttendance(r.id)}
                                className={`p-1 rounded-md transition-colors ${
                                  r.attendanceChecked
                                    ? 'text-emerald-600 bg-emerald-50'
                                    : 'text-slate-300 hover:text-emerald-500'
                                }`}
                                title="คลิกเพื่อเช็คชื่อเข้าร่วม"
                              >
                                <CheckCircle className="w-5 h-5 inline" />
                              </button>
                            ) : (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                r.attendanceChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {r.attendanceChecked ? 'มาแล้ว' : 'รอเช็คชื่อ'}
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-center no-print">
                              <button
                                onClick={() => {
                                  if (window.confirm(`ต้องการยกเลิกการสมัครของ ${r.fullName} (${r.studentId}) ใช่หรือไม่?`)) {
                                    onCancelRegistration && onCancelRegistration(r.id);
                                  }
                                }}
                                title="ยกเลิกการสมัครนี้"
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 no-print">
          <span className="text-xs text-slate-500">
            สำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่
          </span>
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
