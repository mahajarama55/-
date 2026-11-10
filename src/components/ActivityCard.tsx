import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Award,
  ChevronRight,
  FileSpreadsheet,
  Edit2,
  Trash2,
  UserCheck
} from 'lucide-react';
import { Activity, Registration } from '../types';
import { getActivityStats, formatThaiDateTime } from '../utils/storage';

interface ActivityCardProps {
  activity: Activity;
  registrations: Registration[];
  onRegister: (activity: Activity) => void;
  onViewDetails: (activity: Activity) => void;
  isAdmin?: boolean;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  registrations,
  onRegister,
  onViewDetails,
  isAdmin,
  onEdit,
  onDelete
}) => {
  const stats = getActivityStats(activity, registrations);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-purple-200 transition-all duration-300 flex flex-col overflow-hidden group">
      {/* Top Banner Gradient Header */}
      <div className={`h-3 bg-gradient-to-r ${activity.bannerGradient || 'from-purple-600 to-indigo-600'}`} />

      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Badges Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-50 text-[#6C3994] border border-purple-100">
                {activity.code}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                {activity.categoryLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${stats.badgeClass}`}>
                {stats.statusText}
              </span>
              {activity.syncedToSheet && (
                <span title="ซิงค์ลง Google Sheet แล้ว" className="text-emerald-600 bg-emerald-50 p-1 rounded-md">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>

          {/* Activity Title */}
          <h3
            onClick={() => onViewDetails(activity)}
            className="text-lg font-bold text-slate-900 group-hover:text-[#6C3994] transition-colors leading-snug cursor-pointer mb-2 line-clamp-2"
          >
            {activity.title}
          </h3>

          {/* Description snippet */}
          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mb-4 leading-relaxed">
            {activity.description}
          </p>

          {/* Details Metadata */}
          <div className="space-y-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="truncate font-medium text-slate-700">{activity.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="truncate">
                จัดกิจกรรม: <span className="font-semibold text-slate-800">{formatThaiDateTime(activity.eventDateTime)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">
                ปิดรับสมัคร: <span className="text-slate-700">{formatThaiDateTime(activity.closeDate)}</span>
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5 text-purple-700 font-semibold">
                <Award className="w-4 h-4 text-purple-600" />
                <span>+{activity.hoursEarned} คะแนนหอพัก</span>
              </div>
              <span className="text-[11px] text-slate-500">{activity.targetAudience}</span>
            </div>
          </div>
        </div>

        {/* Real-time Capacity Progress Bar */}
        <div>
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Users className="w-3.5 h-3.5 text-[#6C3994]" />
                <span>
                  ผู้สมัคร <strong className="text-slate-900">{stats.enrolledCount}</strong> / {activity.maxParticipants} คน
                </span>
              </div>
              <span className={`text-[11px] font-bold ${stats.percentFilled >= 100 ? 'text-rose-600' : 'text-[#6C3994]'}`}>
                {stats.percentFilled}% ({stats.remainingSeats > 0 ? `ว่าง ${stats.remainingSeats} ที่` : 'เต็ม'})
              </span>
            </div>

            {/* Visual Gauge */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.percentFilled >= 100
                    ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                    : stats.percentFilled >= 80
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-gradient-to-r from-[#6C3994] to-[#9333EA]'
                }`}
                style={{ width: `${Math.min(100, stats.percentFilled)}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            {stats.canRegister ? (
              <button
                onClick={() => onRegister(activity)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
              >
                <UserCheck className="w-4 h-4" />
                สมัครเข้าร่วม
              </button>
            ) : (
              <button
                disabled
                className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-400 text-xs sm:text-sm font-semibold rounded-xl cursor-not-allowed border border-slate-200"
              >
                {stats.statusText}
              </button>
            )}

            <button
              onClick={() => onViewDetails(activity)}
              title="ดูรายละเอียดและรายชื่อผู้สมัคร"
              className="px-3 py-2.5 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-[#6C3994] text-xs sm:text-sm font-medium rounded-xl transition-colors border border-slate-200/80 flex items-center gap-1"
            >
              <span>รายละเอียด</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Admin quick tools */}
            {isAdmin && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                <button
                  onClick={() => onEdit && onEdit(activity)}
                  title="แก้ไขข้อมูลโครงการ"
                  className="p-2 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete && onDelete(activity)}
                  title="ลบโครงการนี้"
                  className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
