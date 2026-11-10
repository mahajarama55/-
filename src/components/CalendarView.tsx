import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Award,
  Bell,
  CheckCircle2,
  AlertTriangle,
  List,
  Grid,
  CalendarDays,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Activity, Registration } from '../types';
import {
  formatThaiDateTime,
  formatThaiDateOnly,
  formatTimeRange,
  toDateKey,
  toTimeString,
  parseAnyDate,
  getActivityStats,
  sendBrowserNotification
} from '../utils/storage';

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
  // Calendar View Mode: 'calendar' (monthly grid) | 'agenda' (timeline list)
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  // Group activities by standard "YYYY-MM-DD" key
  const { activitiesByDate, allEventDates, activitiesThisMonth, sortedActivities } = useMemo(() => {
    const byDate: Record<string, Activity[]> = {};
    const datesSet = new Set<string>();

    const sorted = [...activities].sort((a, b) => {
      const da = parseAnyDate(a.eventDateTime)?.getTime() || 0;
      const db = parseAnyDate(b.eventDateTime)?.getTime() || 0;
      return da - db;
    });

    sorted.forEach(act => {
      const dKey = toDateKey(act.eventDateTime);
      if (dKey) {
        if (!byDate[dKey]) {
          byDate[dKey] = [];
        }
        byDate[dKey].push(act);
        datesSet.add(dKey);
      }
    });

    return {
      activitiesByDate: byDate,
      allEventDates: Array.from(datesSet).sort(),
      sortedActivities: sorted,
      activitiesThisMonth: [] as Activity[] // will calculate per current view
    };
  }, [activities]);

  // Determine initial date: preferably the nearest activity date, or today
  const initialDate = useMemo(() => {
    if (allEventDates.length > 0) {
      // Find first date that is today or in future, or first available date
      const todayKey = toDateKey(new Date());
      const upcoming = allEventDates.find(d => d >= todayKey) || allEventDates[0];
      const parsed = parseAnyDate(upcoming);
      if (parsed) {
        return {
          monthDate: new Date(parsed.getFullYear(), parsed.getMonth(), 1),
          selectedKey: upcoming
        };
      }
    }
    const now = new Date();
    return {
      monthDate: new Date(now.getFullYear(), now.getMonth(), 1),
      selectedKey: toDateKey(now)
    };
  }, [allEventDates]);

  // Current viewed month & year
  const [currentDate, setCurrentDate] = useState<Date>(initialDate.monthDate);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(initialDate.selectedKey);

  // Update selection if activities change and selected date has no activity
  useEffect(() => {
    if (allEventDates.length > 0 && !allEventDates.includes(selectedDateStr)) {
      const todayKey = toDateKey(new Date());
      const nextDate = allEventDates.find(d => d >= todayKey) || allEventDates[0];
      if (nextDate) {
        setSelectedDateStr(nextDate);
        const p = parseAnyDate(nextDate);
        if (p) {
          setCurrentDate(new Date(p.getFullYear(), p.getMonth(), 1));
        }
      }
    }
  }, [allEventDates]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const thaiDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  // Days in month calculation
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
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(toDateKey(now));
  };

  const handleJumpToEventMonth = () => {
    if (allEventDates.length > 0) {
      const todayKey = toDateKey(new Date());
      const targetDateStr = allEventDates.find(d => d >= todayKey) || allEventDates[0];
      const parsed = parseAnyDate(targetDateStr);
      if (parsed) {
        setCurrentDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        setSelectedDateStr(targetDateStr);
      }
    }
  };

  // Selected date's activities
  const selectedActivities = activitiesByDate[selectedDateStr] || [];

  // Activities in currently viewed month
  const currentMonthActivities = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return sortedActivities.filter(act => {
      const dKey = toDateKey(act.eventDateTime);
      return dKey && dKey.startsWith(monthPrefix);
    });
  }, [sortedActivities, year, month]);

  const handleEnableNotifications = () => {
    sendBrowserNotification(
      'เปิดการแจ้งเตือนกิจกรรมหอพัก มช.',
      'ระบบจะแจ้งเตือนเมื่อใกล้ถึงวันจัดกิจกรรม หรือเมื่อมีกิจกรรมใหม่ที่เปิดรับสมัคร'
    );
    setNotificationEnabled(true);
  };

  // Total activities in system
  const totalActivitiesCount = activities.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
            {totalActivitiesCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6C3994] font-bold text-xs">
                {totalActivitiesCount} โครงการ
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            แสดงตารางกิจกรรมทั้งหมดแบบเรียลไทม์ ซิงค์ตรงกับ Google Sheet อัตโนมัติ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* View Mode Toggle: Calendar vs Agenda */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-[#6C3994] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>ปฏิทิน</span>
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'agenda'
                  ? 'bg-white text-[#6C3994] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>กำหนดการ</span>
            </button>
          </div>

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
                <span className="hidden sm:inline">เปิดแจ้งเตือนแล้ว</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
                <span>แจ้งเตือนกิจกรรม</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mode 1: Calendar Grid View */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Calendar Grid (7 columns on desktop) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            {/* Month Navigator */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-[#6C3994]">{thaiMonths[month]}</span>
                  <span>พ.ศ. {year + 543}</span>
                </h3>
                <span className="text-xs text-slate-500">
                  {currentMonthActivities.length > 0
                    ? `พบ ${currentMonthActivities.length} กิจกรรมในเดือนนี้`
                    : 'ยังไม่มีกิจกรรมในเดือนนี้'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {currentMonthActivities.length === 0 && allEventDates.length > 0 && (
                  <button
                    onClick={handleJumpToEventMonth}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#6C3994] text-xs font-semibold rounded-xl border border-purple-200 transition-colors"
                    title="ไปยังเดือนที่มีกิจกรรม"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ไปยังเดือนที่มีกิจกรรม</span>
                  </button>
                )}
                <button
                  onClick={handleGoToday}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors"
                >
                  วันนี้
                </button>
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
                    className="min-h-[58px] sm:min-h-[76px] p-1.5 rounded-2xl bg-slate-50/50 text-slate-300 text-xs flex flex-col justify-between"
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
                const isToday = toDateKey(new Date()) === dateStr;

                return (
                  <div
                    key={`cur-${dayNum}`}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`min-h-[58px] sm:min-h-[76px] p-1.5 sm:p-2 rounded-2xl cursor-pointer transition-all flex flex-col justify-between border ${
                      isSelected
                        ? 'bg-purple-50/90 border-[#6C3994] ring-2 ring-purple-300 shadow-xs'
                        : hasActivities
                        ? 'bg-purple-50/20 hover:bg-purple-50/60 border-purple-200/90 shadow-2xs'
                        : isToday
                        ? 'bg-amber-50/30 border-amber-300'
                        : 'bg-white hover:bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#6C3994] text-white'
                            : isToday
                            ? 'bg-amber-500 text-white font-bold'
                            : hasActivities
                            ? 'text-purple-950 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {hasActivities && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#6C3994] animate-pulse" />
                          <span className="text-[10px] font-bold text-purple-700 hidden sm:inline">
                            {dayActs.length}
                          </span>
                        </span>
                      )}
                    </div>

                    {hasActivities && (
                      <div className="mt-1 space-y-0.5">
                        {dayActs.slice(0, 2).map(act => (
                          <div
                            key={act.id}
                            className="text-[9px] sm:text-[10px] truncate px-1.5 py-0.5 rounded-lg bg-purple-100 text-[#502175] font-semibold hover:bg-purple-200 transition-colors"
                            title={`${act.code}: ${act.title}`}
                          >
                            {act.title}
                          </div>
                        ))}
                        {dayActs.length > 2 && (
                          <span className="text-[9px] text-[#6C3994] block text-right font-bold">
                            +{dayActs.length - 2} อื่นๆ
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
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    {selectedDateStr ? (
                      formatThaiDateOnly(selectedDateStr)
                    ) : (
                      'เลือกวันที่ในปฏิทิน'
                    )}
                  </h4>
                </div>
                <span className="px-3 py-1 bg-purple-50 text-[#6C3994] text-xs font-bold rounded-full">
                  {selectedActivities.length} กิจกรรม
                </span>
              </div>

              {selectedActivities.length === 0 ? (
                <div className="py-6 space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-slate-400 space-y-2">
                    <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <p className="text-xs font-medium">ไม่มีกิจกรรมที่จัดในวันที่เลือก</p>
                    <p className="text-[11px] text-slate-400">
                      คลิกเลือกวันที่มีจุดสีม่วงในปฏิทินเพื่อดูกำหนดการ
                    </p>
                  </div>

                  {/* Show other activities in current month so student never sees empty list */}
                  {currentMonthActivities.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          กิจกรรมในเดือน {thaiMonths[month]} ({currentMonthActivities.length} โครงการ)
                        </span>
                      </div>

                      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {currentMonthActivities.map(act => {
                          const actDateKey = toDateKey(act.eventDateTime);
                          const stats = getActivityStats(act, registrations);
                          return (
                            <div
                              key={act.id}
                              onClick={() => {
                                if (actDateKey) setSelectedDateStr(actDateKey);
                              }}
                              className="p-3 rounded-2xl border border-slate-200/80 bg-white hover:border-[#6C3994] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-[#6C3994] font-bold">
                                    {formatThaiDateOnly(act.eventDateTime)}
                                  </span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${stats.badgeClass}`}>
                                    {stats.statusText}
                                  </span>
                                </div>
                                <h6 className="font-bold text-slate-900 text-xs truncate">
                                  {act.title}
                                </h6>
                                <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                                  +{act.hoursEarned} คะแนนหอพัก
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectActivity(act);
                                }}
                                className="px-2.5 py-1 text-xs text-[#6C3994] hover:bg-purple-50 rounded-xl font-semibold border border-purple-200 shrink-0"
                              >
                                ดูข้อมูล
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                  {selectedActivities.map(act => {
                    const stats = getActivityStats(act, registrations);
                    const timeRangeText = formatTimeRange(act.eventDateTime, act.eventEndDateTime);

                    return (
                      <div
                        key={act.id}
                        className="p-4 rounded-2xl border border-purple-200/90 bg-gradient-to-b from-purple-50/40 to-white hover:border-[#6C3994] hover:shadow-md transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-[#6C3994] font-bold">
                              {act.code}
                            </span>
                            <h5 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                              {act.title}
                            </h5>
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full shrink-0 font-medium ${stats.badgeClass}`}>
                            {stats.statusText}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600">
                          {timeRangeText && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <Clock className="w-3.5 h-3.5 text-[#6C3994] shrink-0" />
                              <span>{timeRangeText}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#6C3994] shrink-0" />
                            <span className="truncate">{act.location}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="flex items-center gap-1 text-[#6C3994] font-bold text-xs">
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
                              className="flex-1 py-2 px-3 bg-[#6C3994] hover:bg-[#562879] text-white text-xs font-semibold rounded-xl transition-colors text-center shadow-xs"
                            >
                              สมัครเข้าร่วม
                            </button>
                          )}
                          <button
                            onClick={() => onSelectActivity(act)}
                            className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors text-center"
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
      )}

      {/* Mode 2: Timeline Agenda View */}
      {viewMode === 'agenda' && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#6C3994]" />
              <span>ตารางกำหนดการกิจกรรมทั้งหมด (เรียงตามวันจัดกิจกรรม)</span>
            </h3>
            <span className="text-xs text-slate-500">
              ทั้งหมด {sortedActivities.length} โครงการ
            </span>
          </div>

          {sortedActivities.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-sm">ยังไม่มีกิจกรรมในระบบ</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedActivities.map(act => {
                const stats = getActivityStats(act, registrations);
                const timeText = formatTimeRange(act.eventDateTime, act.eventEndDateTime);

                return (
                  <div
                    key={act.id}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 hover:border-[#6C3994] bg-white hover:shadow-md transition-all flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      {/* Date Badge */}
                      <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col items-center justify-center text-center shrink-0">
                        <span className="text-[11px] text-purple-700 font-semibold leading-none">
                          {formatThaiDateOnly(act.eventDateTime).split(' ')[1] || 'มช.'}
                        </span>
                        <span className="text-lg font-bold text-[#6C3994] leading-tight">
                          {formatThaiDateOnly(act.eventDateTime).split(' ')[0] || '-'}
                        </span>
                        <span className="text-[10px] text-slate-500 leading-none">
                          {formatThaiDateOnly(act.eventDateTime).split(' ')[2] || ''}
                        </span>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#6C3994] px-2 py-0.5 bg-purple-100 rounded-lg">
                            {act.code}
                          </span>
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${stats.badgeClass}`}>
                            {stats.statusText}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {act.categoryLabel}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-slate-900 leading-snug">
                          {act.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          {timeText && (
                            <div className="flex items-center gap-1 text-slate-700 font-medium">
                              <Clock className="w-3.5 h-3.5 text-[#6C3994]" />
                              <span>{timeText}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#6C3994]" />
                            <span>{act.location}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[#6C3994] font-bold">
                            <Award className="w-3.5 h-3.5" />
                            <span>+{act.hoursEarned} คะแนนหอพัก</span>
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            ผู้สมัคร {stats.enrolledCount} / {act.maxParticipants} คน
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto w-full md:w-auto">
                      {stats.canRegister && (
                        <button
                          onClick={() => onRegisterActivity(act)}
                          className="flex-1 md:flex-initial px-4 py-2 bg-[#6C3994] hover:bg-[#562879] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                        >
                          สมัครเข้าร่วม
                        </button>
                      )}
                      <button
                        onClick={() => onSelectActivity(act)}
                        className="flex-1 md:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
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
      )}
    </div>
  );
};
