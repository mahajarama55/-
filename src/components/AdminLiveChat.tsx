import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Bot,
  User,
  ShieldCheck,
  Sparkles,
  Send,
  Check,
  CheckCheck,
  Clock,
  Filter,
  ToggleLeft,
  ToggleRight,
  Headphones,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Users,
  Building,
  Trash2
} from 'lucide-react';
import { ChatMessage, ChatSession, Registration, Activity } from '../types';

interface AdminLiveChatProps {
  activities: Activity[];
  registrations: Registration[];
}

export const AdminLiveChat: React.FC<AdminLiveChatProps> = ({
  activities,
  registrations
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unhandled' | 'ai'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());
  const [remoteTyping, setRemoteTyping] = useState<{ sessionId: string; sender: string; isTyping: boolean } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Find student registrations if studentId is present
  const studentRegistrations = selectedSession?.studentId
    ? registrations.filter((r) => r.studentId === selectedSession.studentId && r.status !== 'cancelled')
    : [];

  // Connect WebSocket as Admin
  const connectAdminWs = () => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat?role=admin&name=${encodeURIComponent('เจ้าหน้าที่หอพัก')}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'init_admin') {
            if (Array.isArray(data.sessions)) {
              setSessions(data.sessions);
              if (!selectedSessionId && data.sessions.length > 0) {
                setSelectedSessionId(data.sessions[0].id);
              }
            }
            if (Array.isArray(data.messages)) {
              setMessages(data.messages);
            }
          } else if (data.type === 'new_message') {
            const newMsg = data.message as ChatMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            if (data.session) {
              setSessions((prev) => {
                const idx = prev.findIndex((s) => s.id === data.session.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = data.session;
                  return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
                }
                return [data.session, ...prev];
              });
            }
          } else if (data.type === 'session_updated') {
            if (data.session) {
              setSessions((prev) => {
                const idx = prev.findIndex((s) => s.id === data.session.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = data.session;
                  return updated;
                }
                return [data.session, ...prev];
              });
            }
          } else if (data.type === 'session_deleted') {
            setSessions((prev) => prev.filter((s) => s.id !== data.sessionId));
            setMessages((prev) => prev.filter((m) => m.sessionId !== data.sessionId));
            setSelectedSessionId((curr) => (curr === data.sessionId ? null : curr));
          } else if (data.type === 'all_sessions_cleared') {
            setSessions([]);
            setMessages([]);
            setSelectedSessionId(null);
          } else if (data.type === 'typing') {
            setRemoteTyping({
              sessionId: data.sessionId,
              sender: data.sender,
              isTyping: !!data.isTyping
            });
            setTimeout(() => {
              setRemoteTyping(null);
            }, 3000);
          }
        } catch (e) {
          console.warn('Admin WS message parse error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectAdminWs();
          }, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('Admin WS init error:', e);
      setIsConnected(false);
    }
  };

  const fetchSessionsFeed = async (selectFirstIfNone = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/chat/sessions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessions(data);
          setLastSyncedTime(new Date());
          if (selectFirstIfNone && !selectedSessionId && data.length > 0) {
            setSelectedSessionId(data[0].id);
          } else if (selectedSessionId && !data.some((s: any) => s.id === selectedSessionId)) {
            setSelectedSessionId(data.length > 0 ? data[0].id : null);
          }
        }
      }
    } catch (e) {
      console.warn('Real-time feed sync error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('คุณต้องการลบห้องสนทนานี้และประวัติข้อความทั้งหมดหรือไม่?')) return;
    try {
      const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setMessages((prev) => prev.filter((m) => m.sessionId !== sessionId));
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
        }
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการลบห้องสนทนา');
    }
  };

  const handleClearAllSessions = async () => {
    if (!window.confirm('ยืนยันล้างข้อมูลแชททั้งหมดในระบบหรือไม่? (ข้อความทั้งหมดจะถูกลบ)')) return;
    try {
      const res = await fetch('/api/chat/sessions/clear-all', { method: 'POST' });
      if (res.ok) {
        setSessions([]);
        setMessages([]);
        setSelectedSessionId(null);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการล้างข้อมูล');
    }
  };

  useEffect(() => {
    connectAdminWs();
    fetchSessionsFeed(true);

    // High frequency real-time polling fallback (every 3 seconds)
    const pollInterval = setInterval(() => {
      fetchSessionsFeed(false);
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Fetch messages when selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId) return;

    fetch(`/api/chat/sessions/${encodeURIComponent(selectedSessionId)}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && Array.isArray(data.messages)) {
          setMessages((prev) => {
            const others = prev.filter((m) => m.sessionId !== selectedSessionId);
            return [...others, ...data.messages];
          });
        }
      })
      .catch(() => {});

    // Mark as read by admin
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'mark_read',
          sessionId: selectedSessionId,
          by: 'admin'
        })
      );
    } else {
      fetch(`/api/chat/sessions/${encodeURIComponent(selectedSessionId)}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ by: 'admin' })
      }).catch(() => {});
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === selectedSessionId ? { ...s, unreadAdminCount: 0 } : s))
    );
  }, [selectedSessionId]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedSessionId, remoteTyping]);

  // Send Admin message
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || !selectedSessionId) return;

    const payload = {
      type: 'send_message',
      sessionId: selectedSessionId,
      text,
      sender: 'admin',
      senderName: 'เจ้าหน้าที่หอพัก'
    };

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      fetch(`/api/chat/sessions/${encodeURIComponent(selectedSessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }

    if (!textToSend) {
      setInputMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle AI for current session
  const handleToggleAi = () => {
    if (!selectedSession) return;
    const nextState = !selectedSession.aiAutoReply;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'toggle_ai',
          sessionId: selectedSession.id,
          enabled: nextState,
          mode: nextState ? 'ai' : 'admin'
        })
      );
    } else {
      fetch(`/api/chat/sessions/${encodeURIComponent(selectedSession.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiAutoReply: nextState, mode: nextState ? 'ai' : 'admin' })
      }).catch(() => {});
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === selectedSession.id
          ? { ...s, aiAutoReply: nextState, mode: nextState ? 'ai' : 'admin' }
          : s
      )
    );
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      (s.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.studentId || '').includes(searchQuery) ||
      (s.dormitory || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.lastMessagePreview || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'unhandled') {
      return (s.unreadAdminCount && s.unreadAdminCount > 0) || s.mode === 'admin';
    }
    if (filterMode === 'ai') {
      return s.aiAutoReply && s.mode === 'ai';
    }
    return true;
  });

  const currentSessionMessages = selectedSessionId
    ? messages.filter((m) => m.sessionId === selectedSessionId)
    : [];

  const cannedReplies = [
    'สวัสดีครับ สำนักงานหอพักนักศึกษา มช. ยินดีให้บริการครับ',
    'ตรวจสอบข้อมูลการลงทะเบียนให้สักครู่ครับ',
    'กิจกรรมนี้จัดที่อาคารบริการหอพักนักศึกษา มช. ตรงเวลาตามกำหนดการครับ',
    'คะแนนหอพักจะได้รับการบันทึกหลังเสร็จสิ้นกิจกรรมภายใน 3 วันทำการครับ',
    'หากต้องการยกเลิกการสมัคร สามารถทำรายการผ่านหน้าเว็บไซต์ในเมนู "ตรวจสอบการสมัครของฉัน" ได้เลยครับ'
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-[700px]">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-purple-900 via-[#562879] to-[#6C3994] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20">
            <MessageSquare className="w-5 h-5 text-purple-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg">
                ศูนย์สนทนาสด & AI ผู้ช่วย (Live Chat Feed)
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isConnected ? 'ฟีดสด Real-time ออนไลน์' : 'กำลังเชื่อมต่อ'}</span>
              </span>
            </div>
            <p className="text-xs text-purple-200 mt-0.5">
              ดึงฟีดสดจากนักศึกษาแบบเรียลไทม์ 100% (ไม่มีข้อมูลตัวอย่าง) โต้ตอบได้ทันที พร้อม AI สแตนด์บายตอบคำถาม
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Real-Time Feed Button */}
          <button
            onClick={() => fetchSessionsFeed(false)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium transition-colors cursor-pointer"
            title="ดึงฟีดข้อความล่าสุดจากเซิร์ฟเวอร์ทันที"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'กำลังดึงฟีดสด...' : 'รีเฟรชฟีดสด'}</span>
          </button>

          {/* Purge All Chats Button */}
          {sessions.length > 0 && (
            <button
              onClick={handleClearAllSessions}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white border border-rose-400/30 text-xs font-medium transition-colors cursor-pointer"
              title="ล้างประวัติห้องสนทนาทั้งหมดในระบบ"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้างประวัติ</span>
            </button>
          )}

          <span className="text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-purple-100">
            ห้องสนทนาสด: <strong>{sessions.length} ห้อง</strong>
          </span>
        </div>
      </div>

      {/* Main Split Layout: Left Sessions List, Right Chat Room */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Sessions List */}
        <div className="w-full sm:w-80 md:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 shrink-0">
          {/* Search & Filter */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ, รหัสนักศึกษา, ข้อความ..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-purple-400 outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-[#6C3994] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด ({sessions.length})
              </button>
              <button
                onClick={() => setFilterMode('unhandled')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'unhandled'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                มีข้อความใหม่ / รอแอดมิน
              </button>
              <button
                onClick={() => setFilterMode('ai')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'ai'
                    ? 'bg-purple-100 text-[#6C3994] font-bold border border-purple-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                AI ดูแลอยู่
              </button>
            </div>
          </div>

          {/* Sessions Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                <p className="text-xs">ยังไม่มีรายการสนทนา</p>
                <p className="text-[11px] text-slate-400">
                  เมื่อนักศึกษาเปิด Live Chat ระบบจะสร้างห้องสนทนาขึ้นมาอัตโนมัติ
                </p>
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = s.id === selectedSessionId;
                const hasUnread = (s.unreadAdminCount || 0) > 0;

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-50/90 border-l-4 border-l-[#6C3994]'
                        : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {s.userName || 'นักศึกษาหอพัก'}
                        </span>
                        {s.studentId && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                            {s.studentId}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {s.lastMessageAt
                          ? new Date(s.lastMessageAt).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 truncate flex-1">
                        {s.lastMessagePreview || '(เริ่มต้นการสนทนา)'}
                      </p>

                      <div className="flex items-center gap-1 shrink-0">
                        {s.aiAutoReply ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-[#6C3994] font-semibold" title="AI เปิดตอบอัตโนมัติ">
                            AI
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold" title="เจ้าหน้าที่ดูแล">
                            แอดมิน
                          </span>
                        )}

                        {hasUnread && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                            {s.unreadAdminCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {s.dormitory && (
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        <span className="truncate">{s.dormitory}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedSession ? (
            <>
              {/* Chat Room Subheader */}
              <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 text-[#6C3994] flex items-center justify-center font-bold text-sm">
                    {selectedSession.userName.slice(0, 1) || 'มช'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {selectedSession.userName}
                      </h4>
                      {selectedSession.studentId && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-purple-100 text-[#6C3994] font-semibold">
                          รหัสนักศึกษา: {selectedSession.studentId}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {selectedSession.dormitory}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      {studentRegistrations.length > 0 && (
                        <span className="text-emerald-700 font-medium">
                          สมัครแล้ว {studentRegistrations.length} โครงการ ({studentRegistrations.map(r => r.activityTitle).join(', ')})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Auto-Reply Switch for this session & Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleAi}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedSession.aiAutoReply
                        ? 'bg-purple-50 text-[#6C3994] border-purple-300 hover:bg-purple-100'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    }`}
                    title="เปิด/ปิดการตอบอัตโนมัติของ AI สำหรับแชทนี้"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>
                      {selectedSession.aiAutoReply ? 'AI กำลังตอบอัตโนมัติ (เปิดอยู่)' : 'แอดมินดูแลสด (ปิด AI)'}
                    </span>
                    {selectedSession.aiAutoReply ? (
                      <ToggleRight className="w-5 h-5 text-[#6C3994]" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteSession(selectedSession.id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                    title="ลบห้องสนทนานี้และประวัติทั้งหมด"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
                {currentSessionMessages.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <p className="text-xs">ยังไม่มีข้อความในห้องนี้</p>
                  </div>
                ) : (
                  currentSessionMessages.map((msg) => {
                    const isStaff = msg.sender === 'admin';
                    const isAi = msg.sender === 'ai';
                    const isStudent = msg.sender === 'user';

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 ${
                          isStaff ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white text-xs ${
                            isStaff
                              ? 'bg-emerald-600'
                              : isAi
                              ? 'bg-[#6C3994]'
                              : 'bg-slate-600'
                          }`}
                        >
                          {isStaff ? (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          ) : isAi ? (
                            <Bot className="w-3.5 h-3.5" />
                          ) : (
                            <User className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div
                          className={`max-w-[78%] rounded-2xl p-3.5 text-xs shadow-2xs space-y-1 ${
                            isStaff
                              ? 'bg-emerald-600 text-white rounded-tr-xs'
                              : isAi
                              ? 'bg-white text-slate-800 border border-purple-200/90 rounded-tl-xs'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-1 mb-1">
                            <span
                              className={`text-[10px] font-bold ${
                                isStaff
                                  ? 'text-emerald-100'
                                  : isAi
                                  ? 'text-[#6C3994]'
                                  : 'text-slate-700'
                              }`}
                            >
                              {isStaff
                                ? '👮 คุณ (เจ้าหน้าที่หอพัก)'
                                : isAi
                                ? '🤖 น้องช้าง AI หอพัก'
                                : `🧑‍🎓 ${selectedSession.userName || 'นักศึกษา'}`}
                            </span>
                            <span
                              className={`text-[9px] font-mono ${
                                isStaff ? 'text-emerald-200' : 'text-slate-400'
                              }`}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Remote Typing Indicator */}
                {remoteTyping && remoteTyping.sessionId === selectedSessionId && remoteTyping.isTyping && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-[#6C3994] animate-bounce" />
                    <span>
                      {remoteTyping.sender === 'user'
                        ? 'นักศึกษากำลังพิมพ์ข้อความ...'
                        : 'AI กำลังตอบ...'}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Canned Quick Replies */}
              <div className="p-2 border-t border-slate-200 bg-slate-50 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
                <span className="text-[10px] font-bold text-slate-400 shrink-0 ml-1">คำตอบด่วน:</span>
                {cannedReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(reply)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 font-medium transition-colors"
                  >
                    {reply.slice(0, 32)}...
                  </button>
                ))}
              </div>

              {/* Admin Input Bar */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="พิมพ์ข้อความตอบกลับนักศึกษาแบบเรียลไทม์ (กด Enter เพื่อส่ง)..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-300 outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่งข้อความ</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-white via-purple-50/20 to-white text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-purple-100/80 border border-purple-200 text-[#6C3994] flex items-center justify-center shadow-inner">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                </span>
              </div>

              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-slate-800">
                  ระบบถ่ายทอดสด Live Chat พร้อมทำงานแบบ Real-Time
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ตัดข้อมูลตัวอย่างออกเรียบร้อยแล้ว — ระบบกำลังสแตนด์บายรอรับฟีดข้อความจริงจากนักศึกษาแบบเรียลไทม์ 100%
                </p>
              </div>

              {/* Real-time Status Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-xl pt-2 text-left">
                <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-xs font-semibold text-slate-800">WebSocket สด</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isConnected ? 'เชื่อมต่อสดพร้อมสตรีม' : 'กำลังเชื่อมต่อเครือข่าย'}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-3.5 h-3.5 text-[#6C3994]" />
                    <span className="text-xs font-semibold text-slate-800">น้องช้าง AI</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    สแตนด์บายช่วยตอบ 24 ชม.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-800">การแจ้งเตือนสด</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    เด้งเตือนทันทีเมื่อมีข้อความใหม่
                  </p>
                </div>
              </div>

              <div className="p-3 bg-purple-50/80 border border-purple-200/70 rounded-2xl max-w-xl text-xs text-[#6C3994] flex items-center gap-2.5 text-left">
                <Sparkles className="w-4 h-4 shrink-0 text-purple-600" />
                <span>💡 <strong>วิธีทดสอบฟีดสด:</strong> นักศึกษาหรือแอดมินสามารถคลิกไอคอนแชทสีม่วงมุมขวาล่างของหน้าจอเพื่อส่งข้อความทดสอบ ข้อความจริงจะปรากฏขึ้นบนหน้านี้ทันทีแบบ Real-Time!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
