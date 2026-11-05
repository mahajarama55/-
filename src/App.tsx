import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  Calendar,
  Sparkles,
  Users,
  Award,
  ChevronDown,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  PlusCircle,
  Clock,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Activity, Registration, NotificationItem } from './types';
import {
  loadActivities,
  saveActivities,
  loadRegistrations,
  saveRegistrations,
  loadNotifications,
  saveNotifications,
  getActivityStats,
  sendBrowserNotification,
  fetchActivitiesFromServer,
  fetchRegistrationsFromServer,
  postRegistrationToServer,
  postActivityToServer,
  deleteActivityOnServer,
  cancelRegistrationOnServer
} from './utils/storage';
import { ACTIVITY_CATEGORIES } from './utils/initialData';
import { Navbar } from './components/Navbar';
import { ActivityCard } from './components/ActivityCard';
import { RegisterModal } from './components/RegisterModal';
import { ActivityDetailModal } from './components/ActivityDetailModal';
import { AddEditActivityModal } from './components/AddEditActivityModal';
import { CalendarView } from './components/CalendarView';
import { AdminPanel } from './components/AdminPanel';
import { MyRegistrationsModal } from './components/MyRegistrationsModal';
import { DormStatsModal } from './components/DormStatsModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { initAuth } from './services/firebaseAuth';
import { getSavedSpreadsheetUrl, fetchSharedConfig, appendRegistrationToSheet, appendActivityToSheet } from './services/googleSheets';

export default function App() {
  // Main Data States
  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'activities' | 'calendar' | 'my-registrations' | 'stats' | 'admin'>('activities');

  // Filter States for Activities Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'deadline' | 'seats'>('date');

  // Admin State
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);

  // Modal States
  const [registeringActivity, setRegisteringActivity] = useState<Activity | null>(null);
  const [viewingDetailActivity, setViewingDetailActivity] = useState<Activity | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState<boolean>(false);

  // Load initial data and sync with server
  useEffect(() => {
    // 1. Initial fast local load
    const loadedActs = loadActivities();
    const loadedRegs = loadRegistrations();
    const loadedNotes = loadNotifications();

    setActivities(loadedActs);
    setRegistrations(loadedRegs);
    setNotifications(loadedNotes);

    // 2. Fetch shared config (Google Sheet settings) from backend so every device connects automatically
    fetchSharedConfig().catch(() => {});

    // 3. Fetch latest shared activities and registrations from backend server
    const syncWithServer = async () => {
      try {
        const [serverActs, serverRegs] = await Promise.all([
          fetchActivitiesFromServer(),
          fetchRegistrationsFromServer()
        ]);
        if (serverActs && serverActs.length > 0) setActivities(serverActs);
        if (serverRegs) setRegistrations(serverRegs);
      } catch (e) {
        console.warn('Server sync error:', e);
      }
    };

    syncWithServer();

    // Periodic live sync every 10 seconds so changes on one device show on another
    const interval = setInterval(syncWithServer, 10000);
    window.addEventListener('focus', syncWithServer);

    // Initialize Firebase Auth listener
    initAuth(
      (user, token) => {
        console.log('User signed in with Google:', user.email);
      },
      () => {}
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncWithServer);
    };
  }, []);

  // Save changes to storage
  const handleUpdateActivities = (newActivities: Activity[]) => {
    setActivities(newActivities);
    saveActivities(newActivities);
  };

  const handleUpdateRegistrations = (newRegistrations: Registration[]) => {
    setRegistrations(newRegistrations);
    saveRegistrations(newRegistrations);
  };

  const handleUpdateNotifications = (newNotes: NotificationItem[]) => {
    setNotifications(newNotes);
    saveNotifications(newNotes);
  };

  // Add or Edit Activity
  const handleSaveActivity = async (activity: Activity) => {
    const existingIndex = activities.findIndex(a => a.id === activity.id);
    let updated: Activity[];

    if (existingIndex >= 0) {
      updated = [...activities];
      updated[existingIndex] = activity;
    } else {
      updated = [activity, ...activities];
      // Dispatch notification for new activity
      const newNote: NotificationItem = {
        id: `note-${Date.now()}`,
        title: 'เปิดรับสมัครกิจกรรมใหม่!',
        message: `${activity.title} (${activity.code}) เปิดรับสมัครแล้ว จำนวน ${activity.maxParticipants} ที่นั่ง`,
        type: 'info',
        activityId: activity.id,
        timestamp: new Date().toISOString(),
        isRead: false
      };
      handleUpdateNotifications([newNote, ...notifications]);
      sendBrowserNotification('เปิดรับสมัครกิจกรรมใหม่!', `${activity.title}`);
    }

    handleUpdateActivities(updated);

    // Persist to server (shared across all devices)
    await postActivityToServer(activity);

    // Automatically push to Google Sheet
    appendActivityToSheet(activity).catch(e => console.warn('Auto-append activity failed:', e));
  };

  // Delete Activity
  const handleDeleteActivity = async (activity: Activity) => {
    const updatedActs = activities.filter(a => a.id !== activity.id);
    const updatedRegs = registrations.filter(r => r.activityId !== activity.id);
    handleUpdateActivities(updatedActs);
    handleUpdateRegistrations(updatedRegs);
    if (viewingDetailActivity?.id === activity.id) {
      setViewingDetailActivity(null);
    }
    await deleteActivityOnServer(activity.id);
  };

  // Success Registration
  const handleRegistrationSuccess = async (newReg: Registration) => {
    const updated = [newReg, ...registrations];
    handleUpdateRegistrations(updated);

    // 1. Persist to shared backend (which also pushes to Google Sheet Webhook if configured)
    postRegistrationToServer(newReg).catch(e => console.warn('Post registration error:', e));

    // 2. Client-side direct append to Google Sheet as secondary guarantee
    const activeCount = updated.filter(r => r.activityId === newReg.activityId && r.status !== 'cancelled').length;
    appendRegistrationToSheet(newReg, activeCount).catch(e => console.warn('Direct sheet append error:', e));

    // Notification item
    const note: NotificationItem = {
      id: `note-${Date.now()}`,
      title: 'การลงทะเบียนสำเร็จ',
      message: `คุณได้ลงทะเบียนเข้าร่วม ${newReg.activityTitle} (${newReg.activityCode}) เรียบร้อยแล้ว`,
      type: 'success',
      activityId: newReg.activityId,
      timestamp: new Date().toISOString(),
      isRead: false
    };
    handleUpdateNotifications([note, ...notifications]);
  };

  // Cancel Registration
  const handleCancelRegistration = async (regId: string) => {
    const updated = registrations.filter(r => r.id !== regId);
    handleUpdateRegistrations(updated);
    await cancelRegistrationOnServer(regId);
  };

  // Toggle Attendance
  const handleToggleAttendance = (regId: string) => {
    const updated = registrations.map(r => {
      if (r.id === regId) {
        return { ...r, attendanceChecked: !r.attendanceChecked };
      }
      return r;
    });
    handleUpdateRegistrations(updated);
  };

  // Mark all notifications read
  const handleMarkNotificationsRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    handleUpdateNotifications(updated);
  };

  // Select notification target activity
  const handleSelectNotificationActivity = (actId: string) => {
    const found = activities.find(a => a.id === actId);
    if (found) {
      setViewingDetailActivity(found);
    }
  };

  // Filter activities for main listing
  const filteredActivities = activities
    .filter(act => {
      const stats = getActivityStats(act, registrations);
      const matchesSearch =
        act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || act.category === selectedCategory;
      let matchesStatus = true;
      if (selectedStatus === 'open') matchesStatus = stats.status === 'open' || stats.status === 'filling';
      else if (selectedStatus === 'full') matchesStatus = stats.status === 'full';
      else if (selectedStatus === 'closed') matchesStatus = stats.status === 'closed' || stats.status === 'completed';

      return matchesSearch && matchesCat && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') {
        return new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime();
      }
      if (sortBy === 'seats') {
        const statsA = getActivityStats(a, registrations);
        const statsB = getActivityStats(b, registrations);
        return statsA.remainingSeats - statsB.remainingSeats;
      }
      return new Date(a.eventDateTime).getTime() - new Date(b.eventDateTime).getTime();
    });

  const nextSuggestedCode = `ACT-DORM-69${String(activities.length + 1).padStart(2, '0')}`;
  const sheetUrl = getSavedSpreadsheetUrl();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 selection:bg-purple-200 selection:text-purple-900">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        onOpenAdminLogin={() => {
          if (isAdmin) {
            setActiveTab('admin');
          } else {
            setActiveTab('admin');
          }
        }}
        onLogoutAdmin={() => {
          setIsAdmin(false);
          setActiveTab('activities');
        }}
        onOpenAddModal={() => {
          setEditingActivity(null);
          setIsAddModalOpen(true);
        }}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onSelectNotificationActivity={handleSelectNotificationActivity}
        openGoogleSheetModal={() => setIsGoogleSheetModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* ================= TAB 1: ACTIVITIES BROWSER ================= */}
        {activeTab === 'activities' && (
          <div className="space-y-6">
            {/* Hero / Announcement Banner */}
            <div className="bg-gradient-to-r from-[#502175] via-[#6C3994] to-[#8648B8] rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none select-none text-[180px] font-black text-white leading-none">
                CMU
              </div>

              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-semibold text-purple-100">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>ระบบลงทะเบียนกิจกรรมออนไลน์ ประจำปีการศึกษา 2569</span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
                  กิจกรรมหอพักนักศึกษา <br className="hidden sm:inline" />
                  มหาวิทยาลัยเชียงใหม่
                </h1>

                <p className="text-xs sm:text-sm text-purple-100 leading-relaxed max-w-xl">
                  กิจกรรมเสริมสร้างประสบการณ์ ทักษะชีวิต ในหอพักนักศึกษา สะสมชั่วโมงกิจกรรมหอพักได้ทันที พร้อมอัปเดตที่นั่งแบบเรียลไทม์
                </p>

                {/* Quick Quick Status Pills */}
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                    <Layers className="w-3.5 h-3.5 text-amber-300" />
                    กำลังเปิดรับ: <strong>{activities.filter(a => getActivityStats(a, registrations).canRegister).length} กิจกรรม</strong>
                  </span>
                  <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                    <Users className="w-3.5 h-3.5 text-emerald-300" />
                    ผู้สมัครแล้วรวม: <strong>{registrations.filter(r => r.status !== 'cancelled').length} คน</strong>
                  </span>
                  {sheetUrl && (
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-600 px-3 py-1.5 rounded-xl text-white font-medium transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                      Google Sheet ซิงค์อยู่
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อกิจกรรม, รหัสกิจกรรม (เช่น ACT-DORM), หรือสถานที่..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:border-[#6C3994] focus:ring-2 focus:ring-purple-200 text-xs sm:text-sm transition-all"
                  />
                </div>

                {/* Status and Sorting Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="py-2.5 px-3 rounded-2xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-700"
                  >
                    <option value="all">ทุกสถานะที่นั่ง</option>
                    <option value="open">เปิดรับสมัครอยู่</option>
                    <option value="full">ที่นั่งเต็ม</option>
                    <option value="closed">ปิดรับสมัครแล้ว</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="py-2.5 px-3 rounded-2xl border border-slate-200 text-xs sm:text-sm bg-white text-slate-700"
                  >
                    <option value="date">เรียงตาม: วันจัดกิจกรรม</option>
                    <option value="deadline">เรียงตาม: ใกล้ปิดรับสมัคร</option>
                    <option value="seats">เรียงตาม: ที่นั่งเหลือน้อยสุด</option>
                  </select>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-[#6C3994] text-white shadow-xs font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  ทั้งหมด ({activities.length})
                </button>
                {ACTIVITY_CATEGORIES.map(cat => {
                  const count = activities.filter(a => a.category === cat.id).length;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all ${
                        isSelected
                          ? 'bg-[#6C3994] text-white shadow-xs font-semibold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cat.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activities Cards Grid */}
            {filteredActivities.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
                <h3 className="text-base font-bold text-slate-800">
                  ไม่พบกิจกรรมที่ตรงกับเงื่อนไขการค้นหา
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  ลองล้างคำค้นหาหรือเลือกหมวดหมู่อื่นเพื่อดูกิจกรรมที่กำลังเปิดรับสมัคร
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedStatus('all');
                  }}
                  className="px-4 py-2 bg-purple-50 text-[#6C3994] text-xs font-semibold rounded-xl hover:bg-purple-100 transition-colors"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredActivities.map(activity => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    registrations={registrations}
                    onRegister={act => setRegisteringActivity(act)}
                    onViewDetails={act => setViewingDetailActivity(act)}
                    isAdmin={isAdmin}
                    onEdit={act => {
                      setEditingActivity(act);
                      setIsAddModalOpen(true);
                    }}
                    onDelete={act => handleDeleteActivity(act)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: CALENDAR VIEW ================= */}
        {activeTab === 'calendar' && (
          <CalendarView
            activities={activities}
            registrations={registrations}
            onSelectActivity={act => setViewingDetailActivity(act)}
            onRegisterActivity={act => setRegisteringActivity(act)}
          />
        )}

        {/* ================= TAB 3: CHECK MY REGISTRATIONS ================= */}
        {activeTab === 'my-registrations' && (
          <MyRegistrationsModal
            activities={activities}
            registrations={registrations}
            onCancelRegistration={handleCancelRegistration}
            onViewActivityDetails={act => setViewingDetailActivity(act)}
          />
        )}

        {/* ================= TAB 4: DORM STATS ================= */}
        {activeTab === 'stats' && (
          <DormStatsModal registrations={registrations} />
        )}

        {/* ================= TAB 5: ADMIN PANEL ================= */}
        {activeTab === 'admin' && (
          <AdminPanel
            isAdmin={isAdmin}
            onLoginSuccess={() => setIsAdmin(true)}
            activities={activities}
            registrations={registrations}
            onOpenAddModal={() => {
              setEditingActivity(null);
              setIsAddModalOpen(true);
            }}
            onEditActivity={act => {
              setEditingActivity(act);
              setIsAddModalOpen(true);
            }}
            onDeleteActivity={act => handleDeleteActivity(act)}
            onViewRoster={act => setViewingDetailActivity(act)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-slate-200/80 py-10 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center space-y-3">
          <img
            src="/assets/aistudio/cmu-dorm-logo-ribbon-thai_0_b6a328b0.png"
            alt="ตราสำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่"
            className="h-16 sm:h-20 w-auto object-contain drop-shadow-xs hover:scale-105 transition-transform"
          />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">
              สำนักงานหอพักนักศึกษา มหาวิทยาลัยเชียงใหม่
            </h4>
            <p className="text-xs text-[#6C3994] font-medium">
              Chiang Mai University Dormitory Officer
            </p>
            <p className="text-[11px] text-slate-400 pt-1">
              239 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมือง จังหวัดเชียงใหม่ 50200 | โทรศัพท์ 0-5394-4750
            </p>
          </div>
        </div>
      </footer>

      {/* ================= MODALS ================= */}

      {/* 1. Register Modal */}
      {registeringActivity && (
        <RegisterModal
          activity={registeringActivity}
          existingRegistrations={registrations}
          onClose={() => setRegisteringActivity(null)}
          onSuccess={handleRegistrationSuccess}
        />
      )}

      {/* 2. Activity Detail / Roster Modal */}
      {viewingDetailActivity && (
        <ActivityDetailModal
          activity={viewingDetailActivity}
          registrations={registrations}
          onClose={() => setViewingDetailActivity(null)}
          onRegister={act => {
            setViewingDetailActivity(null);
            setRegisteringActivity(act);
          }}
          isAdmin={isAdmin}
          onCancelRegistration={handleCancelRegistration}
          onToggleAttendance={handleToggleAttendance}
        />
      )}

      {/* 3. Add or Edit Activity Modal (Admin) */}
      {isAddModalOpen && (
        <AddEditActivityModal
          activityToEdit={editingActivity}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingActivity(null);
          }}
          onSave={handleSaveActivity}
          nextSuggestedCode={nextSuggestedCode}
        />
      )}

      {/* 4. Google Sheets Connection & Sync Modal */}
      {isGoogleSheetModalOpen && (
        <GoogleSheetsModal
          onClose={() => setIsGoogleSheetModalOpen(false)}
          activities={activities}
          registrations={registrations}
        />
      )}
    </div>
  );
}
