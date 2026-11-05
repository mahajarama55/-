import React, { useState } from 'react';
import {
  Search,
  User,
  Calendar,
  MapPin,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Printer,
  ChevronRight
} from 'lucide-react';
import { Activity, Registration } from '../types';
import { formatThaiDateTime } from '../utils/storage';

interface MyRegistrationsModalProps {
  activities: Activity[];
  registrations: Registration[];
  onCancelRegistration: (regId: string) => void;
  onViewActivityDetails: (activity: Activity) => void;
}

export const MyRegistrationsModal: React.FC<MyRegistrationsModalProps> = ({
  activities,
  registrations,
  onCancelRegistration,
  onViewActivityDetails
}) => {
  const [studentIdInput, setStudentIdInput] = useState('');
  const [searchedId, setSearchedId] = useState('');
  const [activeTicketReg, setActiveTicketReg] = useState<Registration | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedId(studentIdInput.trim());
  };

  const userRegs = searchedId
    ? registrations.filter(
        r => r.studentId === searchedId && r.status !== 'cancelled'
      )
    : [];

  const totalEarnedHours = userRegs.reduce((acc, r) => {
    const act = activities.find(a => a.id === r.activityId);
    return acc + (act?.hoursEarned || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-[#6C3994] text-xs font-semibold mb-3">
            <User className="w-3.5 h-3.5" />
            <span>สำหรับนักศึกษาหอพัก มช.</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
            ตรวจสอบประวัติและการลงทะเบียนกิจกรรม
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            กรอกรหัสนักศึกษา 9 หลัก เพื่อตรวจสอบรายการกิจกรรมหอพักที่ได้ลงทะเบียนไว้ ตรวจสอบวันเวลาจัดงาน พิมพ์ใบยืนยันการสมัคร หรือยกเลิกการลงทะเบียน
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mt-5 flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                maxLength={9}
                required
                placeholder="กรอกรหัสนักศึกษา เช่น 650610345"
                value={studentIdInput}
                onChange={e => setStudentIdInput(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-[#6C3994] focus:ring-2 focus:ring-purple-200 font-mono text-sm sm:text-base font-semibold shadow-2xs"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-[#6C3994] hover:bg-[#562879] active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-md transition-all shrink-0"
            >
              ค้นหาข้อมูล
            </button>
          </form>

          {/* Quick Demo Student ID hint */}
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
            <span>ตัวอย่างรหัสทดสอบ:</span>
            <button
              type="button"
              onClick={() => {
                setStudentIdInput('650610345');
                setSearchedId('650610345');
              }}
              className="text-[#6C3994] font-mono hover:underline font-semibold"
            >
              650610345
            </button>
            <span>,</span>
            <button
              type="button"
              onClick={() => {
                setStudentIdInput('660510112');
                setSearchedId('660510112');
              }}
              className="text-[#6C3994] font-mono hover:underline font-semibold"
            >
              660510112
            </button>
          </div>
        </div>
      </div>

      {/* Results View */}
      {searchedId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                รายการกิจกรรมของรหัส <span className="text-[#6C3994] font-mono">{searchedId}</span>
              </h3>
              <p className="text-xs text-slate-500">
                พบ {userRegs.length} รายการลงทะเบียนที่ยืนยันแล้ว
              </p>
            </div>

            {userRegs.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-[#6C3994] rounded-xl border border-purple-100 text-xs font-bold">
                <Award className="w-4 h-4 text-amber-500" />
                <span>คะแนนกิจกรรมทั้งหมด: {totalEarnedHours} คะแนน.</span>
              </div>
            )}
          </div>

          {userRegs.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-xs space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <h4 className="text-sm font-bold text-slate-800">
                ไม่พบประวัติการลงทะเบียนของรหัสนี้
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                คุณยังไม่ได้ลงทะเบียนเข้าร่วมกิจกรรมหอพักใดๆ ในขณะนี้ สามารถเลือกดูกิจกรรมที่กำลังเปิดรับสมัครได้ที่หน้าหลัก
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userRegs.map(reg => {
                const act = activities.find(a => a.id === reg.activityId);
                return (
                  <div
                    key={reg.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-purple-300 transition-all space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#6C3994] bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-100">
                          {reg.activityCode}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                          {reg.activityTitle}
                        </h4>
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold shrink-0">
                        {reg.attendanceChecked ? 'เข้าร่วมแล้ว' : 'ยืนยันสิทธิ์แล้ว'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>ผู้สมัคร: <strong className="text-slate-800">{reg.fullName}</strong> ({reg.dormitory})</span>
                      </div>
                      {act && (
                        <>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>วันจัด: <strong className="text-slate-800">{formatThaiDateTime(act.eventDateTime)}</strong></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span className="truncate">{act.location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-purple-700 font-semibold pt-1 border-t border-slate-200/60">
                            <Award className="w-3.5 h-3.5" />
                            <span>ได้รับ {act.hoursEarned} คะแนนกิจกรรม</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      {act && (
                        <button
                          onClick={() => onViewActivityDetails(act)}
                          className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-[#6C3994] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1"
                        >
                          <span>ดูรายละเอียดโครงการ</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
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
