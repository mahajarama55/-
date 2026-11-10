import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  Edit2,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  Users,
  Award,
  Layers,
  Sparkles
} from 'lucide-react';
import { Activity } from '../types';
import { ACTIVITY_CATEGORIES } from '../utils/initialData';
import { getSavedSpreadsheetId, getSavedSpreadsheetUrl } from '../services/googleSheets';
import { normalizeDateTimeString } from '../utils/storage';

interface AddEditActivityModalProps {
  activityToEdit?: Activity | null;
  onClose: () => void;
  onSave: (activity: Activity) => void;
  nextSuggestedCode: string;
}

export const AddEditActivityModal: React.FC<AddEditActivityModalProps> = ({
  activityToEdit,
  onClose,
  onSave,
  nextSuggestedCode
}) => {
  const isEditing = Boolean(activityToEdit);

  const [code, setCode] = useState(activityToEdit?.code || nextSuggestedCode);
  const [title, setTitle] = useState(activityToEdit?.title || '');
  const [category, setCategory] = useState<Activity['category']>(activityToEdit?.category || 'skills');
  const [location, setLocation] = useState(activityToEdit?.location || 'อาคารบริการหอพักนักศึกษา มช.');
  const [eventDateTime, setEventDateTime] = useState(normalizeDateTimeString(activityToEdit?.eventDateTime) || '2026-11-25T13:30');
  const [eventEndDateTime, setEventEndDateTime] = useState(normalizeDateTimeString(activityToEdit?.eventEndDateTime) || '2026-11-25T16:30');
  const [maxParticipants, setMaxParticipants] = useState<number>(activityToEdit?.maxParticipants || 50);
  const [openDate, setOpenDate] = useState(normalizeDateTimeString(activityToEdit?.openDate) || '2026-11-04T08:00');
  const [closeDate, setCloseDate] = useState(normalizeDateTimeString(activityToEdit?.closeDate) || '2026-11-24T18:00');
  const [targetAudience, setTargetAudience] = useState(activityToEdit?.targetAudience || 'นักศึกษาหอพักทุกหอ');
  const [hoursEarned, setHoursEarned] = useState<number>(activityToEdit?.hoursEarned || 3);
  const [description, setDescription] = useState(activityToEdit?.description || '');
  const [syncToSheet, setSyncToSheet] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const hasSpreadsheet = Boolean(getSavedSpreadsheetId());
  const sheetUrl = getSavedSpreadsheetUrl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim() || !title.trim()) {
      setError('กรุณากรอกรหัสกิจกรรมและชื่อกิจกรรมให้ครบถ้วน');
      return;
    }

    if (maxParticipants <= 0) {
      setError('จำนวนผู้เข้าร่วมต้องมากกว่า 0');
      return;
    }

    if (new Date(closeDate) < new Date(openDate)) {
      setError('วันปิดรับสมัครต้องอยู่หลังจากวันเปิดรับสมัคร');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedCatObj = ACTIVITY_CATEGORIES.find(c => c.id === category);

      const activityData: Activity = {
        id: activityToEdit?.id || `act-${Date.now()}`,
        code: code.trim().toUpperCase(),
        title: title.trim(),
        description: description.trim() || `กิจกรรม ${title.trim()} จัดโดยสำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่`,
        location: location.trim(),
        category,
        categoryLabel: selectedCatObj?.label || 'กิจกรรมหอพัก',
        eventDateTime,
        eventEndDateTime,
        maxParticipants: Number(maxParticipants),
        openDate,
        closeDate,
        targetAudience: targetAudience.trim(),
        hoursEarned: Number(hoursEarned),
        bannerGradient: selectedCatObj?.color || 'from-purple-700 to-indigo-800',
        syncedToSheet: activityToEdit?.syncedToSheet || false,
        createdAt: activityToEdit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      activityData.syncedToSheet = true;
      onSave(activityData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกกิจกรรม');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#502175] via-[#6C3994] to-[#8648B8] text-white p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-amber-400 text-purple-950 font-bold px-2 py-0.5 rounded-full text-xs">
              ADMIN CONTROL
            </span>
            <span className="text-purple-200 text-xs">สำนักงานหอพักนักศึกษา มช.</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            {isEditing ? <Edit2 className="w-6 h-6" /> : <PlusCircle className="w-6 h-6" />}
            <span>{isEditing ? 'แก้ไขข้อมูลกิจกรรมโครงการ' : 'เพิ่มกิจกรรมโครงการใหม่'}</span>
          </h2>
          <p className="text-xs text-purple-100 mt-1">
            กำหนดรายละเอียด รหัส วันเวลา จำนวนที่รับ และบันทึกข้อมูลลง Google Sheet
          </p>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Code and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                รหัสกิจกรรม <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ACT-DORM-6901"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-sm font-mono font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                หมวดหมู่กิจกรรม <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs sm:text-sm bg-white"
              >
                {ACTIVITY_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              ชื่อกิจกรรม / ชื่อโครงการ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น การอบรมการดับเพลิงและการซ้อมอพยพหนีไฟ ประจำปีการศึกษา 2569"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-sm font-medium"
            />
          </div>

          {/* Row 3: Location and Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                สถานที่จัดกิจกรรม <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="เช่น ลานกิจกรรมหอ 3 หญิง หรือ อาคารบริการหอพัก"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                กลุ่มเป้าหมายผู้เข้าร่วม
              </label>
              <input
                type="text"
                placeholder="เช่น นักศึกษาหอพักทุกหอ, หอพักชาย 1-7"
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Row 4: Event Date Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/50 p-3 rounded-2xl border border-purple-100">
            <div>
              <label className="block text-xs font-semibold text-purple-950 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6C3994]" />
                วันเวลาเริ่มกิจกรรม <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={eventDateTime}
                onChange={e => setEventDateTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs sm:text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-950 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#6C3994]" />
                วันเวลาสิ้นสุดกิจกรรม
              </label>
              <input
                type="datetime-local"
                value={eventEndDateTime}
                onChange={e => setEventEndDateTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs sm:text-sm bg-white"
              />
            </div>
          </div>

          {/* Row 5: Registration Dates & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                จำนวนที่รับ (คน) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  max={5000}
                  required
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-sm font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                วันเปิดรับสมัคร <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={openDate}
                onChange={e => setOpenDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                วันปิดรับสมัคร <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={closeDate}
                onChange={e => setCloseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs"
              />
            </div>
          </div>

          {/* Row 6: Hours Earned */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                คะแนนกิจกรรมหอพัก
              </label>
              <input
                type="number"
                min={0}
                max={40}
                value={hoursEarned}
                onChange={e => setHoursEarned(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-sm font-semibold"
              />
            </div>

            <div className="sm:col-span-2 pt-4">
              <span className="text-xs text-slate-500 block leading-tight">
                * กิจกรรมของสำนักงานหอพักนักศึกษาใช้สะสมสำหรับคะแนนเพื่อพิจารณาการอยู่หอพักต่อในปีการศึกษาถัดไป
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              รายละเอียดโครงการ / กำหนดการ
            </label>
            <textarea
              rows={3}
              placeholder="ระบุกำหนดการ รายละเอียดกิจกรรม สิ่งที่ต้องเตรียมมา และเกณฑ์การผ่านกิจกรรม..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-200 text-xs sm:text-sm"
            />
          </div>

          {/* Google Sheets Sync Checkbox */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <input
              type="checkbox"
              id="syncToSheet"
              checked={syncToSheet}
              onChange={e => setSyncToSheet(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <label htmlFor="syncToSheet" className="text-xs cursor-pointer">
              <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 inline" />
                บันทึกและซิงค์ข้อมูลกิจกรรมนี้ลงใน Google Sheet
              </span>
              <span className="text-emerald-700 block mt-0.5 text-[11px]">
                {hasSpreadsheet
                  ? 'ระบบจะเพิ่มแถวข้อมูลโครงการลงในชีต "กิจกรรมทั้งหมด" โดยอัตโนมัติ'
                  : 'เมื่อเชื่อมต่อ Google Sheet ในระบบ Admin ข้อมูลจะถูกจัดเก็บบน Google Drive ทันที'}
              </span>
            </label>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 py-2.5 px-6 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isEditing ? <Edit2 className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
            <span>{isSubmitting ? 'กำลังบันทึก...' : isEditing ? 'บันทึกการแก้ไข' : 'เพิ่มกิจกรรมลงระบบ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
