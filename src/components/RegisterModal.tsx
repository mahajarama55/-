import React, { useState } from 'react';
import {
  X,
  UserCheck,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  Printer,
  Download,
  AlertCircle,
  FileSpreadsheet,
  Building,
  GraduationCap,
  Phone,
  Mail,
  User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Activity, Registration } from '../types';
import { CMU_DORMITORIES, CMU_FACULTIES } from '../utils/initialData';
import { formatThaiDateTime } from '../utils/storage';
import { appendRegistrationToSheet, getSavedSpreadsheetUrl } from '../services/googleSheets';

interface RegisterModalProps {
  activity: Activity | null;
  existingRegistrations: Registration[];
  onClose: () => void;
  onSuccess: (newRegistration: Registration) => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  activity,
  existingRegistrations,
  onClose,
  onSuccess
}) => {
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [dormitory, setDormitory] = useState(CMU_DORMITORIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successRegistration, setSuccessRegistration] = useState<Registration | null>(null);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<string | null>(null);

  if (!activity) return null;

  // Real-time capacity check
  const activeEnrolled = existingRegistrations.filter(
    r => r.activityId === activity.id && r.status !== 'cancelled'
  );
  const isFull = activeEnrolled.length >= activity.maxParticipants;
  const remainingSeats = Math.max(0, activity.maxParticipants - activeEnrolled.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate 9-digit CMU Student ID
    const cleanStudentId = studentId.trim();
    if (!/^\d{9}$/.test(cleanStudentId)) {
      setError('กรุณากรอกรหัสนักศึกษา มช. ให้ถูกต้อง (ตัวเลข 9 หลัก เช่น 650610123)');
      return;
    }

    if (!fullName.trim()) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    // Check duplicate
    const alreadyRegistered = existingRegistrations.some(
      r =>
        r.activityId === activity.id &&
        r.studentId === cleanStudentId &&
        r.status !== 'cancelled'
    );

    if (alreadyRegistered) {
      setError(`รหัสนักศึกษา ${cleanStudentId} ได้ลงทะเบียนกิจกรรมนี้แล้ว`);
      return;
    }

    if (isFull) {
      setError('ขออภัย ที่นั่งสำหรับกิจกรรมนี้เต็มตามจำนวนที่กำหนดแล้ว');
      return;
    }

    setIsSubmitting(true);

    try {
      const newReg: Registration = {
        id: `reg-${Date.now()}`,
        activityId: activity.id,
        activityCode: activity.code,
        activityTitle: activity.title,
        studentId: cleanStudentId,
        fullName: fullName.trim(),
        dormitory,
        registeredAt: new Date().toISOString(),
        status: 'confirmed',
        attendanceChecked: false,
        syncedToSheet: false
      };

      // Confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Safe fallback if blocked
      }

      // Try appending to Google Sheet if connected
      try {
        const nextCount = activeEnrolled.length + 1;
        const sheetOk = await appendRegistrationToSheet(newReg, nextCount);
        if (sheetOk) {
          newReg.syncedToSheet = true;
          setSheetSyncStatus('บันทึกข้อมูลลง Google Sheet อัตโนมัติเรียบร้อย');
        }
      } catch (sheetErr) {
        console.warn('Google sheet sync skipped:', sheetErr);
      }

      setSuccessRegistration(newReg);
      onSuccess(newReg);
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download .ics calendar event
  const downloadCalendarEvent = () => {
    if (!activity) return;
    const startStr = activity.eventDateTime.replace(/-|:|\s/g, '');
    const endStr = (activity.eventEndDateTime || activity.eventDateTime).replace(/-|:|\s/g, '');
    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CMU Dormitory Office//Student Activity//TH',
      'BEGIN:VEVENT',
      `UID:${activity.id}@cmu.ac.th`,
      `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, '')}`,
      `DTSTART:${startStr}00`,
      `DTEND:${endStr}00`,
      `SUMMARY:${activity.title}`,
      `DESCRIPTION:${activity.description} (สถานที่: ${activity.location})`,
      `LOCATION:${activity.location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activity.code}-calendar.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#502175] to-[#7C3AED] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors no-print"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-400 text-purple-950 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {activity.code}
            </span>
            <span className="text-purple-200 text-xs">
              +{activity.hoursEarned} คะแนนกิจกรรม
            </span>
          </div>

          <h2 className="text-xl font-bold leading-snug pr-8">
            {successRegistration ? 'ลงทะเบียนเข้าร่วมสำเร็จ!' : 'รับสมัครนักศึกษาเข้าร่วมกิจกรรม'}
          </h2>
          <p className="text-xs text-purple-100 mt-1 line-clamp-1">{activity.title}</p>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {successRegistration ? (
            /* Registration Success & E-Slip Ticket */
            <div className="space-y-6">
              <div className="text-center py-2">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  ยินดีด้วย! คุณได้สิทธิ์เข้าร่วมกิจกรรมแล้ว
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  กรุณาบันทึกภาพหน้าจอหรือพิมพ์ใบยืนยันการสมัครนี้ไว้เพื่อใช้ลงทะเบียนในวันงาน
                </p>
                {sheetSyncStatus && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    {sheetSyncStatus}
                  </div>
                )}
              </div>

              {/* Printable E-Ticket Card */}
              <div className="border-2 border-dashed border-purple-200 rounded-2xl p-5 bg-purple-50/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#6C3994] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  CMU DORM PASS
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <img
                    src="/assets/aistudio/cmu-dorm-logo-ribbon-thai_0_b6a328b0.png"
                    alt="CMU Dorm Logo"
                    className="w-12 h-12 object-contain shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight">
                      {activity.title}
                    </h4>
                    <span className="text-xs text-purple-700 font-mono font-semibold">
                      รหัสกิจกรรม: {activity.code}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-t border-b border-purple-200/60 py-3 my-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">รหัสนักศึกษา:</span>
                    <strong className="text-slate-900 font-mono text-sm">{successRegistration.studentId}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">ชื่อ-นามสกุล:</span>
                    <strong className="text-slate-900">{successRegistration.fullName}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[11px]">หอพักที่สังกัด:</span>
                    <strong className="text-slate-900 font-medium">{successRegistration.dormitory}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[11px]">วันเวลาที่จัดกิจกรรม:</span>
                    <span className="text-slate-900 font-semibold">{formatThaiDateTime(activity.eventDateTime)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[11px]">สถานที่จัดกิจกรรม:</span>
                    <span className="text-slate-800">{activity.location}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>เลขที่อ้างอิง: <strong className="font-mono">{successRegistration.id}</strong></span>
                  <span>สถานะ: <strong className="text-emerald-600 font-bold">ยืนยันแล้ว</strong></span>
                </div>
              </div>

              {/* Action Buttons for Registered User */}
              <div className="flex flex-wrap items-center gap-2 pt-2 no-print">
                <button
                  type="button"
                  onClick={downloadCalendarEvent}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 px-4 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-semibold rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" />
                  เพิ่มลงปฏิทิน (.ics)
                </button>
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  พิมพ์เอกสาร / บันทึก
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 bg-[#6C3994] hover:bg-[#562879] text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  เสร็จสิ้นและกลับสู่หน้าหลัก
                </button>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Event Info Brief Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ที่นั่งว่างคงเหลือ:</span>
                  <span className="font-bold text-[#6C3994]">
                    {remainingSeats} ที่นั่ง (จาก {activity.maxParticipants} ที่นั่ง)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>{formatThaiDateTime(activity.eventDateTime)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="truncate">{activity.location}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Student ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  รหัสนักศึกษา (9 หลัก) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={9}
                    placeholder="เช่น 650610123"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-2 focus:ring-purple-200 text-sm font-mono transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  ตัวเลข 9 หลักตามบัตรประจำตัวนักศึกษา มหาวิทยาลัยเชียงใหม่
                </span>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  ชื่อ - นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น นายศรี คำ"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-2 focus:ring-purple-200 text-sm transition-all"
                />
              </div>

              {/* Dormitory & Room Number */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    หอพักนักศึกษาที่พักอาศัย <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building className="w-4 h-4" />
                    </div>
                    <select
                      value={dormitory}
                      onChange={e => setDormitory(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-2 focus:ring-purple-200 text-xs sm:text-sm bg-white transition-all"
                    >
                      {CMU_DORMITORIES.map(dorm => (
                        <option key={dorm} value={dorm}>
                          {dorm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isFull}
                  className="flex-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserCheck className="w-4 h-4" />
                  {isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการสมัครเข้าร่วม'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
