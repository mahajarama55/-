import React from 'react';
import {
  Building2,
  Users,
  Award,
  Trophy,
  PieChart,
  Download,
  Flame
} from 'lucide-react';
import { Registration } from '../types';
import { CMU_DORMITORIES } from '../utils/initialData';
import { exportToCsv } from '../services/googleSheets';

interface DormStatsModalProps {
  registrations: Registration[];
}

export const DormStatsModal: React.FC<DormStatsModalProps> = ({ registrations }) => {
  const activeRegs = registrations.filter(r => r.status !== 'cancelled');

  // Count by dorm
  const dormCounts: { dorm: string; count: number; percent: number }[] = CMU_DORMITORIES.map(dorm => {
    const count = activeRegs.filter(r => r.dormitory === dorm).length;
    return {
      dorm,
      count,
      percent: activeRegs.length > 0 ? Math.round((count / activeRegs.length) * 100) : 0
    };
  }).sort((a, b) => b.count - a.count);

  const topDorms = dormCounts.filter(d => d.count > 0);

  const handleExportStats = () => {
    const headers = ['ลำดับ', 'หอพักนักศึกษา', 'จำนวนนักศึกษาที่เข้าร่วม (คน)', 'คิดเป็นสัดส่วน (%)'];
    const rows = dormCounts.map((d, i) => [i + 1, d.dorm, d.count, `${d.percent}%`]);
    exportToCsv('สถิติการเข้าร่วมกิจกรรมแยกตามหอพักนักศึกษา_มช', [headers, ...rows]);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-[#6C3994] rounded-full text-xs font-semibold mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>สถิติการมีส่วนร่วมของชาวหอพัก มช.</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            สถิติการสมัครกิจกรรมแยกตามหอพักนักศึกษา
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            อันดับหอพักที่มีการสมัครเข้าร่วมกิจกรรมมากที่สุด ประจำปีการศึกษาปัจจุบัน
          </p>
        </div>

        <button
          onClick={handleExportStats}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-[#6C3994] font-semibold text-xs rounded-xl border border-purple-200 transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>ส่งออกรายงานสถิติ (CSV)</span>
        </button>
      </div>

      {/* Top 3 Podium Highlights */}
      {topDorms.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rank 2 */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between order-2 md:order-1">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-slate-400">#2</span>
              <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                🥈
              </span>
            </div>
            <div className="my-3">
              <h4 className="text-base font-bold text-slate-900">{topDorms[1].dorm}</h4>
              <p className="text-xs text-slate-500">รองชนะเลิศอันดับ 1</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xl font-extrabold text-slate-800">{topDorms[1].count} คน</span>
              <span className="text-xs text-purple-700 font-semibold">{topDorms[1].percent}%</span>
            </div>
          </div>

          {/* Rank 1 (Gold Leader) */}
          <div className="bg-gradient-to-b from-purple-50 to-white rounded-3xl p-6 border-2 border-purple-300 shadow-md flex flex-col justify-between order-1 md:order-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#6C3994] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-300" />
              หอพักยอดเยี่ยม
            </div>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-extrabold text-[#6C3994]">#1</span>
              <span className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-xs">
                🥇
              </span>
            </div>
            <div className="my-3">
              <h4 className="text-lg font-bold text-slate-900">{topDorms[0].dorm}</h4>
              <p className="text-xs text-[#6C3994] font-medium">อันดับ 1 หอพักที่แอคทีฟที่สุด</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-purple-100">
              <span className="text-2xl font-black text-[#6C3994]">{topDorms[0].count} คน</span>
              <span className="text-xs text-purple-800 font-bold">{topDorms[0].percent}% ของทั้งหมด</span>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between order-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-amber-700">#3</span>
              <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
                🥉
              </span>
            </div>
            <div className="my-3">
              <h4 className="text-base font-bold text-slate-900">{topDorms[2].dorm}</h4>
              <p className="text-xs text-slate-500">รองชนะเลิศอันดับ 2</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xl font-extrabold text-slate-800">{topDorms[2].count} คน</span>
              <span className="text-xs text-purple-700 font-semibold">{topDorms[2].percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Complete Dorm Participation List with Progress Gauges */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4">
          ตารางแสดงจำนวนการเข้าร่วมของทุกหอพัก
        </h3>

        <div className="space-y-3">
          {dormCounts.map((item, index) => {
            const maxCount = topDorms[0]?.count || 1;
            const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

            return (
              <div
                key={item.dorm}
                className="p-3.5 rounded-2xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/20 transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 font-mono text-slate-400 font-bold text-center">
                      {index + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{item.dorm}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.count} คน</span>
                    <span className="text-[11px] text-slate-400">({item.percent}%)</span>
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      index === 0
                        ? 'bg-[#6C3994]'
                        : index < 3
                        ? 'bg-purple-400'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
