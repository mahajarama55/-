import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Award,
  Bell,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Activity, Registration } from '../types';
import { formatThaiDateTime, getActivityStats, sendBrowserNotification } from '../utils/storage';

interface CalendarViewProps {
  activities: Activity[];
  registrations: Registration[];
  onSelectActivity: (activity: Activity) => void;
  onRegisterActivity: (activity: Activity) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  activities,
  registrations,
  onSelectActivity,
  onRegisterActivity
}) => {
  // Calendar base state (Year and Month)
  // Default to November 2026 based on initial data
  const [currentDate, setCurrentDate] = useState(new Date(2026, 10, 1)); // 10 is November in JS (0-indexed)
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-11-15');
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const thaiDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  // Days in month
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    setCurrentDate(new Date(2026, 10, 1));
    setSelectedDateStr('2026-11-15');
  };

  // Group activities by date string "YYYY-MM-DD"
  const activitiesByDate: Record<string, Activity[]> = {};
  activities.forEach(act => {
    const dStr = act.eventDateTime.slice(0, 10);
    if (!activitiesByDate[dStr]) {
      activitiesByDate[dStr] = [];
    }
    activitiesByDate[dStr].push(act);
  });

  // Selected date's activities
  const selectedActivities = activitiesByDate[selectedDateStr] || [];

  const handleEnableNotifications = () => {
    sendBrowserNotification(
      'เปิดการแจ้งเตือนกิจกรรมหอพัก มช.',
      'ระบบจะแจ้งเตือนเมื่อใกล้ถึงวันจัดกิจกรรม หรือเมื่อมีกิจกรรมใหม่ที่เปิดรับสมัคร'
    );
    setNotificationEnabled(true);
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header with Navigation and Notification Alert */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-50 text-[#6C3994]">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              ปฏิทินกิจกรรมหอพักนักศึกษา มช.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            แสดงตารางกิจกรรมทั้งหมดแบบเรียลไทม์ ตรวจสอบวันจัดกิจกรรมและกำหนดการรับสมัคร
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={handleEnableNotifications}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              notificationEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {notificationEnabled ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>เปิดแจ้งเตือนแล้ว</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
                <span>เปิดระบบแจ้งเตือนวันเวลากิจกรรม</span>
              </>
            )}
          </button>

          <button
            onClick={handleGoToday}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors"
          >
            กิจกรรมเดือนนี้
          </button>
        </div>
      </div>

      {/* Main Grid: Calendar on Left/Top, Scheduled Events List on Right/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid (7 or 8 columns on desktop) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          {/* Month Navigator */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="text-[#6C3994]">{thaiMonths[month]}</span>
              <span>พ.ศ. {year + 543}</span>
            </h3>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 mb-2">
            {thaiDays.map((d, i) => (
              <div key={d} className={`py-1 ${i === 0 ? 'text-rose-500' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Days Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Previous month padding days */}
            {Array.from({ length: firstDayIndex }).map((_, i) => {
              const dayNum = prevMonthTotalDays - firstDayIndex + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="min-h-[55px] sm:min-h-[70px] p-1.5 rounded-2xl bg-slate-50/50 text-slate-300 text-xs flex flex-col justify-between"
                >
                  <span className="font-mono text-[11px]">{dayNum}</span>
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayActs = activitiesByDate[dateStr] || [];
              const isSelected = selectedDateStr === dateStr;
              const hasActivities = dayActs.length > 0;

              return (
                <div
                  key={`cur-${dayNum}`}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`min-h-[55px] sm:min-h-[70px] p-1.5 sm:p-2 rounded-2xl cursor-pointer transition-all flex flex-col justify-between border ${
                    isSelected
                      ? 'bg-purple-50/90 border-[#6C3994] ring-2 ring-purple-200 shadow-xs'
                      : hasActivities
                      ? 'bg-white hover:bg-purple-50/40 border-purple-200 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-semibold ${
                        isSelected
                          ? 'text-[#6C3994]'
                          : hasActivities
                          ? 'text-purple-950 font-bold'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {hasActivities && (
                      <span className="w-2 h-2 rounded-full bg-[#6C3994] animate-pulse" />
                    )}
                  </div>

                  {hasActivities && (
                    <div className="mt-1 space-y-0.5">
                      {dayActs.slice(0, 2).map(act => (
                        <div
                          key={act.id}
                          className="text-[9px] sm:text-[10px] truncate px-1 py-0.5 rounded bg-purple-100 text-[#502175] font-medium"
                          title={act.title}
                        >
                          {act.title}
                        </div>
                      ))}
                      {dayActs.length > 2 && (
                        <span className="text-[9px] text-purple-600 block text-right font-medium">
                          +{dayActs.length - 2} เพิ่มเติม
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Panel (Right side) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  กำหนดการของวันที่เลือก
                </span>
                <h4 className="text-base font-bold text-slate-900">
                  {selectedDateStr ? (
                    new Date(selectedDateStr).toLocaleDateString('th-TH', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  ) : (
                    'เลือกวันที่ในปฏิทิน'
                  )}
                </h4>
              </div>
              <span className="px-2.5 py-1 bg-purple-50 text-[#6C3994] text-xs font-bold rounded-full">
                {selectedActivities.length} กิจกรรม
              </span>
            </div>

            {selectedActivities.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <p className="text-xs">ไม่มีกิจกรรมที่จัดในวันที่เลือก</p>
                <p className="text-[11px] text-slate-400">
                  คลิกเลือกวันที่มีจุดสีม่วงในปฏิทินเพื่อดูตารางโครงการ
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedActivities.map(act => {
                  const stats = getActivityStats(act, registrations);
                  return (
                    <div
                      key={act.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-[#6C3994]/40 hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-[#6C3994] font-semibold">
                            {act.code}
                          </span>
                          <h5 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                            {act.title}
                          </h5>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${stats.badgeClass}`}>
                          {stats.statusText}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>เวลา {act.eventDateTime.slice(11, 16)} - {act.eventEndDateTime ? act.eventEndDateTime.slice(11, 16) : ''} น.</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="truncate">{act.location}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="flex items-center gap-1 text-[#6C3994] font-semibold text-[11px]">
                            <Award className="w-3.5 h-3.5" />
                            +{act.hoursEarned} คะแนนหอพัก
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            ผู้สมัคร {stats.enrolledCount} / {act.maxParticipants} คน
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                        {stats.canRegister && (
                          <button
                            onClick={() => onRegisterActivity(act)}
                            className="flex-1 py-1.5 px-3 bg-[#6C3994] hover:bg-[#562879] text-white text-xs font-semibold rounded-xl transition-colors text-center"
                          >
                            สมัครเข้าร่วม
                          </button>
                        )}
                        <button
                          onClick={() => onSelectActivity(act)}
                          className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 transition-colors text-center"
                        >
                          ดูรายละเอียด
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Reminder Tip Box */}
          <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>ข้อแนะนำ:</strong> กิจกรรมที่มีผู้สมัครใกล้เต็มจะปิดรับสมัครอัตโนมัติเมื่อครบโควตา นักศึกษาควรตรวจสอบวันเปิดรับสมัครและรีบลงทะเบียนล่วงหน้า
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
