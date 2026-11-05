import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  Search,
  ShieldCheck,
  Bell,
  FileSpreadsheet,
  Building2,
  ExternalLink,
  PlusCircle,
  LogIn,
  LogOut,
  X,
  Check
} from 'lucide-react';
import { NotificationItem } from '../types';
import { getSavedSpreadsheetUrl } from '../services/googleSheets';

interface NavbarProps {
  activeTab: 'activities' | 'calendar' | 'my-registrations' | 'stats' | 'admin';
  setActiveTab: (tab: 'activities' | 'calendar' | 'my-registrations' | 'stats' | 'admin') => void;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  onLogoutAdmin: () => void;
  onOpenAddModal: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  onSelectNotificationActivity?: (activityId: string) => void;
  openGoogleSheetModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isAdmin,
  onOpenAdminLogin,
  onLogoutAdmin,
  onOpenAddModal,
  notifications,
  onMarkNotificationsRead,
  onSelectNotificationActivity,
  openGoogleSheetModal
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const sheetUrl = getSavedSpreadsheetUrl();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-xs">
      {/* Top emergency announcement / CMU Dorm banner */}
      <div className="bg-gradient-to-r from-[#502175] via-[#6C3994] to-[#8648B8] text-white px-4 py-1.5 text-xs sm:text-sm font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="bg-amber-400 text-purple-950 font-bold px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase">
              CMU DORM
            </span>
            <span className="truncate">
              สำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่ | ระบบรับสมัครกิจกรรมหอพักนักศึกษาแบบเรียลไทม์
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo & Name */}
          <div
            onClick={() => setActiveTab('activities')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img
              src="/assets/aistudio/cmu-dorm-logo-ribbon-thai_0_b6a328b0.png"
              alt="ตราสำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่"
              className="h-12 sm:h-14 w-auto object-contain drop-shadow-xs group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 group-hover:text-[#6C3994] transition-colors">
                  CMU DORM ACTIVITIES
                </span>
                {isAdmin && (
                  <span className="bg-purple-100 text-[#6C3994] text-[11px] font-semibold px-2 py-0.5 rounded-full border border-purple-200">
                    เจ้าหน้าที่ผู้ดูแล
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                ระบบจัดการกิจกรรม สำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่
              </p>
            </div>
          </div>

          {/* Navigation Items (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => setActiveTab('activities')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'activities'
                  ? 'bg-purple-50 text-[#6C3994] font-semibold'
                  : 'text-slate-600 hover:text-[#6C3994] hover:bg-slate-50'
              }`}
            >
              <Layers className="w-4 h-4" />
              กิจกรรมทั้งหมด
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'calendar'
                  ? 'bg-purple-50 text-[#6C3994] font-semibold'
                  : 'text-slate-600 hover:text-[#6C3994] hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              ปฏิทินกิจกรรม
            </button>

            <button
              onClick={() => setActiveTab('my-registrations')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'my-registrations'
                  ? 'bg-purple-50 text-[#6C3994] font-semibold'
                  : 'text-slate-600 hover:text-[#6C3994] hover:bg-slate-50'
              }`}
            >
              <Search className="w-4 h-4" />
              ตรวจสอบการสมัคร
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'stats'
                  ? 'bg-purple-50 text-[#6C3994] font-semibold'
                  : 'text-slate-600 hover:text-[#6C3994] hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              สถิติหอพัก
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#6C3994] hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              ระบบ Admin
            </button>
          </nav>

            {/* Google Sheet Sync Action */}
              {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
  

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadCount > 0) {
                    onMarkNotificationsRead();
                  }
                }}
                className="relative p-2 text-slate-600 hover:text-[#6C3994] hover:bg-purple-50 rounded-xl transition-colors border border-slate-200"
                title="การแจ้งเตือนกิจกรรม"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#6C3994]" />
                      <span className="font-semibold text-slate-800 text-sm">การแจ้งเตือน</span>
                    </div>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">ไม่มีการแจ้งเตือนใหม่</p>
                    ) : (
                      notifications.map(item => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.activityId && onSelectNotificationActivity) {
                              onSelectNotificationActivity(item.activityId);
                              setShowNotifications(false);
                            }
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            item.isRead
                              ? 'bg-slate-50/70 border-slate-100 text-slate-600'
                              : 'bg-purple-50/70 border-purple-100 text-slate-800 font-medium'
                          } hover:border-[#6C3994]/40`}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-semibold text-slate-900">{item.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(item.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-relaxed text-[11px]">{item.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Add Quick Action or Login */}
            {isAdmin ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onOpenAddModal}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#6C3994] to-[#8648B8] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs hover:shadow-md hover:brightness-105 transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  เพิ่มกิจกรรม
                </button>
                <button
                  onClick={onLogoutAdmin}
                  title="ออกจากระบบ Admin"
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-rose-100"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAdminLogin}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition-all"
              >
                <LogIn className="w-4 h-4 text-purple-700" />
                <span className="hidden sm:inline">Admin</span> เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => setActiveTab('activities')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg ${
              activeTab === 'activities' ? 'text-[#6C3994] font-bold' : 'text-slate-500'
            }`}
          >
            <Layers className="w-4 h-4" />
            กิจกรรม
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg ${
              activeTab === 'calendar' ? 'text-[#6C3994] font-bold' : 'text-slate-500'
            }`}
          >
            <Calendar className="w-4 h-4" />
            ปฏิทิน
          </button>
          <button
            onClick={() => setActiveTab('my-registrations')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg ${
              activeTab === 'my-registrations' ? 'text-[#6C3994] font-bold' : 'text-slate-500'
            }`}
          >
            <Search className="w-4 h-4" />
            ตรวจสถานะ
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg ${
              activeTab === 'stats' ? 'text-[#6C3994] font-bold' : 'text-slate-500'
            }`}
          >
            <Building2 className="w-4 h-4" />
            สถิติ
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg ${
              activeTab === 'admin' ? 'text-[#6C3994] font-bold' : 'text-slate-500'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </button>
        </div>
      </div>
    </header>
  );
};
