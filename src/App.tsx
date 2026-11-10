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
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Activity, Registration, NotificationItem } from './types';
import {
  loadActivities,
  saveActivities,
  loadRegistrations,
  saveRegistrations,
  deduplicateRegistrations,
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
import { LiveChatWidget } from './components/LiveChatWidget';
import { initAuth } from './services/firebaseAuth';
import {
  getSavedSpreadsheetUrl,
  fetchSharedConfig,
  fetchDataFromGoogleSheet
} from './services/googleSheets';
import { parseAnyDate } from './utils/storage';

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

  // Pulling from Google Sheet State
  const [isPullingSheet, setIsPullingSheet] = useState<boolean>(false);
  const [sheetPullToast, setSheetPullToast] = useState<string | null>(null);

  // Load initial data and sync with Google Sheet as primary data source
  useEffect(() => {
    // 1. Initial fast local load
    const loadedActs = loadActivities();
    const loadedRegs = loadRegistrations();
    const loadedNotes = loadNotifications();

    setActivities(loadedActs);
    setRegistrations(loadedRegs);
    setNotifications(loadedNotes);

    // 2. Fetch shared config & pull directly from Google Sheet if connected
    const syncData = async () => {
      try {
        const cfg = await fetchSharedConfig().catch(() => null);

        // Priority 1: Pull from Google Sheet if connected
        if (cfg?.spreadsheetId) {
          const sheetResult = await fetchDataFromGoogleSheet(cfg.spreadsheetId);
          if (sheetResult.success) {
            const cleanRegs = deduplicateRegistrations(sheetResult.registrations);
            setActivities(sheetResult.activities);
            setRegistrations(cleanRegs);
            saveActivities(sheetResult.activities);
            saveRegistrations(cleanRegs);
            return;
          }
        }

        // Priority 2: Fetch shared backend server DB
        const [serverActs, serverRegs] = await Promise.all([
          fetchActivitiesFromServer(),
          fetchRegistrationsFromServer()
        ]);
        if (Array.isArray(serverActs)) setActivities(serverActs);
        if (Array.isArray(serverRegs)) {
          const cleanRegs = deduplicateRegistrations(serverRegs);
          setRegistrations(cleanRegs);
        }
      } catch (e) {
        console.warn('Sync error:', e);
      }
    };

    syncData();

    // Periodic live sync every 15 seconds
    const interval = setInterval(syncData, 15000);
    window.addEventListener('focus', syncData);

    // Initialize Firebase Auth listener
    initAuth(
      (user, token) => {
        console.log('User signed in with Google:', user.email);
      },
      () => {}
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncData);
    };
  }, []);

  // Manual Pull from Google Sheet handler
  const handlePullFromSheet = async () => {
    setIsPullingSheet(true);
    try {
      const cfg = await fetchSharedConfig();
      if (!cfg.spreadsheetId) {
        setSheetPullToast('ยังไม่มี Google Sheet ที่เชื่อมต่อในระบบ กรุณากดเชื่อมต่อในเมนูตั้งค่า');
        setTimeout(() => setSheetPullToast(null), 4000);
        return;
      }
      const res = await fetchDataFromGoogleSheet(cfg.spreadsheetId);
      if (res.success) {
        const cleanRegs = deduplicateRegistrations(res.registrations);
        setActivities(res.activities);
        setRegistrations(cleanRegs);
        saveActivities(res.activities);
        saveRegistrations(cleanRegs);
        setSheetPullToast(`ดึงข้อมูลจาก Google Sheet สำเร็จ: พบกิจกรรม ${res.activities.length} โครงการ, ผู้สมัคร ${cleanRegs.length} คน`);
      } else {
        setSheetPullToast(res.message || 'ไม่สามารถดึงข้อมูลจาก Google Sheet ได้');
      }
    } catch (err: any) {
      setSheetPullToast(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
      setIsPullingSheet(false);
      setTimeout(() => setSheetPullToast(null), 4000);
    }
  };

  // Save changes to storage
  const handleUpdateActivities = (newActivities: Activity[]) => {
    setActivities(newActivities);
    saveActivities(newActivities);
  };

  const handleUpdateRegistrations = (newRegistrations: Registration[]) => {
    const clean = deduplicateRegistrations(newRegistrations);
    setRegistrations(clean);
    saveRegistrations(clean);
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

    // Persist to server (which handles deduplication & Google Sheet auto-sync once)
    await postActivityToServer(activity);
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
    // 1. Persist to shared backend (which strictly validates and syncs to Google Sheet once)
    const serverResult = await postRegistrationToServer(newReg);
    if (!serverResult.success) {
      return {
        success: false,
        error: serverResult.error || 'ไม่สามารถลงทะเบียนได้ หรือรหัสนักศึกษานี้ได้ลงทะเบียนกิจกรรมนี้แล้ว'
      };
    }

    // 2. Only on server success, update client state with automatic deduplication
    const updated = [newReg, ...registrations];
    handleUpdateRegistrations(updated);

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
    return { success: true };
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
        const da = parseAnyDate(a.closeDate)?.getTime() || 0;
        const db = parseAnyDate(b.closeDate)?.getTime() || 0;
        return da - db;
      }
      if (sortBy === 'seats') {
        const statsA = getActivityStats(a, registrations);
        const statsB = getActivityStats(b, registrations);
        return statsA.remainingSeats - statsB.remainingSeats;
      }
      const da = parseAnyDate(a.eventDateTime)?.getTime() || 0;
      const db = parseAnyDate(b.eventDateTime)?.getTime() || 0;
      return da - db;
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
                </div>
              </div>
            </div>

            {/* Pull Notification Toast */}
            {sheetPullToast && (
              <div className="p-3 bg-purple-50 border border-purple-200 text-[#6C3994] rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{sheetPullToast}</span>
                </div>
                <button
                  onClick={() => setSheetPullToast(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
                >
                  ✕
                </button>
              </div>
            )}

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
            {activities.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200/80 shadow-xs space-y-4">
                <div className="w-16 h-16 bg-purple-50 text-[#6C3994] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800">
                    ระบบดึงข้อมูลจาก Google Sheet เป็นหลัก
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                    ยังไม่มีข้อมูลกิจกรรมในระบบ (ไม่มีข้อมูลตัวอย่าง) ข้อมูลกิจกรรมและรายชื่อนักศึกษาจะถูกดึงมาจาก Google Sheet โดยตรง หรือผู้ดูแลระบบสามารถสร้างกิจกรรมใหม่ได้
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handlePullFromSheet}
                    disabled={isPullingSheet}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6C3994] to-[#8648B8] hover:from-[#562879] hover:to-[#6C3994] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isPullingSheet ? 'animate-spin' : ''}`} />
                    <span>{isPullingSheet ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Google Sheet ทันที'}</span>
                  </button>
                  <button
                    onClick={() => setIsGoogleSheetModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs sm:text-sm font-semibold rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>ตั้งค่า Google Sheet</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setEditingActivity(null);
                        setIsAddModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-[#6C3994] hover:bg-purple-100 text-xs sm:text-sm font-semibold rounded-xl border border-purple-200 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>เพิ่มกิจกรรมใหม่</span>
                    </button>
                  )}
                </div>
              </div>
            ) : filteredActivities.length === 0 ? (
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
            onDataLoadedFromSheet={(newActs, newRegs) => {
              setActivities(newActs);
              setRegistrations(newRegs);
              saveActivities(newActs);
              saveRegistrations(newRegs);
            }}
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
          onDataLoadedFromSheet={(newActs, newRegs) => {
            setActivities(newActs);
            setRegistrations(newRegs);
            saveActivities(newActs);
            saveRegistrations(newRegs);
          }}
        />
      )}

      {/* 5. Live Chat & AI Chatbot Widget (Always accessible for students) */}
      <LiveChatWidget />
    </div>
  );
}
