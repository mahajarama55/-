import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  Check,
  CheckCheck,
  Minimize2,
  ChevronDown,
  PhoneCall,
  Info,
  Clock,
  Building,
  HelpCircle,
  Headphones
} from 'lucide-react';
import { useChat } from '../services/chatSocket';
import { CMU_DORMITORIES } from '../utils/initialData';

export const LiveChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  // Load or create persistent sessionId
  const [sessionId] = useState<string>(() => {
    let sid = localStorage.getItem('cmu_dorm_chat_session_id');
    if (!sid) {
      sid = `cmu_sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('cmu_dorm_chat_session_id', sid);
    }
    return sid;
  });

  // User Profile
  const [studentId, setStudentId] = useState<string>(() => {
    return localStorage.getItem('cmu_chat_student_id') || '';
  });
  const [fullName, setFullName] = useState<string>(() => {
    return localStorage.getItem('cmu_chat_full_name') || '';
  });
  const [dormitory, setDormitory] = useState<string>(() => {
    return localStorage.getItem('cmu_chat_dormitory') || 'หอพักนักศึกษา มช.';
  });

  const {
    messages,
    session,
    isConnected,
    isTypingRemote,
    unreadCount,
    sendMessage,
    sendTyping,
    markAsRead,
    toggleAi
  } = useChat({
    sessionId,
    role: 'user',
    userName: fullName.trim() || 'นักศึกษาหอพัก',
    studentId: studentId.trim(),
    dormitory: dormitory.trim()
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      markAsRead();
    }
  }, [messages, isOpen, isTypingRemote, markAsRead]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage.trim());
    setInputMessage('');
    sendTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    sendTyping(e.target.value.length > 0);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('cmu_chat_student_id', studentId);
    localStorage.setItem('cmu_chat_full_name', fullName);
    localStorage.setItem('cmu_chat_dormitory', dormitory);
    setShowProfileSetup(false);
  };

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleRequestHuman = () => {
    sendMessage('🙋‍♂️ ขออนุญาตติดต่อเจ้าหน้าที่หอพักโดยตรงครับ/ค่ะ');
    toggleAi(false, 'admin');
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end print:hidden">
      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div className="mb-3 w-[92vw] sm:w-[400px] h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#502175] via-[#6C3994] to-[#8648B8] text-white p-4 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white shadow-xs">
                  <Bot className="w-6 h-6 text-purple-200" />
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#6C3994] ${
                    isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  title={isConnected ? 'เชื่อมต่อสดเรียลไทม์' : 'กำลังเชื่อมต่อ'}
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm sm:text-base leading-tight">
                    ศูนย์ช่วยเหลือ & Live Chat หอพัก
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-purple-200 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>น้องช้าง AI & พี่แอดมิน มช.</span>
                  </span>
                  <span>•</span>
                  <span>{isConnected ? 'ออนไลน์เรียลไทม์' : 'กำลังเชื่อมต่อ'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowProfileSetup(!showProfileSetup)}
                className={`p-1.5 rounded-xl text-white/80 hover:text-white transition-colors ${
                  showProfileSetup ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
                title="ตั้งค่าข้อมูลนักศึกษา"
              >
                <User className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="ย่อหน้าต่าง"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mode Switcher Banner */}
          <div className="bg-purple-50/70 border-b border-purple-100/80 px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-purple-900 font-medium">
              {session?.mode === 'admin' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>โหมด: <strong>แอดมินเจ้าหน้าที่ดูแล</strong></span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#6C3994]" />
                  <span>โหมด: <strong>AI น้องช้างหอพัก (ตอบ 24 ชม.)</strong></span>
                </>
              )}
            </div>

            {session?.mode !== 'admin' && (
              <button
                onClick={handleRequestHuman}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100 text-[#6C3994] font-semibold text-[11px] border border-purple-200 transition-colors shadow-2xs"
              >
                <Headphones className="w-3 h-3" />
                <span>ขอคุยกับเจ้าหน้าที่</span>
              </button>
            )}
          </div>

          {/* Student Profile Quick Settings Box (Collapsible) */}
          {showProfileSetup && (
            <form
              onSubmit={handleSaveProfile}
              className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 text-xs animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#6C3994]" />
                  ข้อมูลผู้ติดต่อ (เพื่อให้เจ้าหน้าที่ตรวจสอบได้เร็วขึ้น)
                </span>
                <button
                  type="button"
                  onClick={() => setShowProfileSetup(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">รหัสนักศึกษา (9 หลัก)</label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="เช่น 660510xxx"
                    maxLength={9}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="เช่น สมชาย ใจดี"
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-purple-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">หอพักนักศึกษา</label>
                <select
                  value={dormitory}
                  onChange={(e) => setDormitory(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-purple-400 outline-none"
                >
                  {CMU_DORMITORIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-1 bg-[#6C3994] hover:bg-[#502175] text-white rounded-lg font-medium text-xs transition-colors"
              >
                บันทึกข้อมูล
              </button>
            </form>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {/* System Welcome Message */}
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 text-[#6C3994] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="max-w-[82%] bg-white rounded-2xl rounded-tl-xs p-3.5 border border-slate-200 shadow-2xs space-y-1.5 text-xs text-slate-800">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#6C3994]">
                  <Sparkles className="w-3 h-3" />
                  <span>น้องช้าง AI หอพัก มช.</span>
                </div>
                <p className="leading-relaxed">
                  สวัสดีครับ/ค่ะ! ยินดีต้อนรับสู่ระบบกิจกรรมหอพักนักศึกษา มช. 🐘💜
                </p>
                <p className="leading-relaxed text-slate-600">
                  ต้องการสอบถามเรื่องกิจกรรม, วันเปิดรับสมัคร, สถานที่จัด, การสะสมคะแนนหอพัก หรือต้องการติดต่อพี่เจ้าหน้าที่หอพัก พิมพ์สอบถามได้ทันทีเลยนะคะ
                </p>
              </div>
            </div>

            {/* Conversation History */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isAdmin = msg.sender === 'admin';
              const isAi = msg.sender === 'ai';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Sender Avatar */}
                  {!isUser && (
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white ${
                        isAdmin
                          ? 'bg-emerald-600 border border-emerald-700'
                          : 'bg-[#6C3994] border border-purple-800'
                      }`}
                    >
                      {isAdmin ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Bot className="w-3.5 h-3.5" />
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl p-3 text-xs shadow-2xs leading-relaxed space-y-1 ${
                      isUser
                        ? 'bg-[#6C3994] text-white rounded-tr-xs'
                        : isAdmin
                        ? 'bg-emerald-50/90 text-slate-800 border border-emerald-200 rounded-tl-xs'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 mb-1">
                        <span
                          className={`text-[10px] font-bold ${
                            isAdmin ? 'text-emerald-700' : 'text-[#6C3994]'
                          }`}
                        >
                          {isAdmin ? '👮 พี่เจ้าหน้าที่หอพัก' : '🤖 น้องช้าง AI หอพัก'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {isUser && (
                      <div className="flex items-center justify-end gap-1 text-[9px] text-purple-200 font-mono pt-0.5">
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <CheckCheck className="w-3 h-3 text-purple-200" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Remote Typing Indicator */}
            {isTypingRemote && isTypingRemote.isTyping && (
              <div className="flex items-center gap-2 text-slate-500 text-xs animate-pulse">
                <div className="w-6 h-6 rounded-lg bg-purple-100 text-[#6C3994] flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-2xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C3994] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C3994] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C3994] animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-slate-600 font-medium ml-1">
                    {isTypingRemote.sender === 'admin'
                      ? 'พี่เจ้าหน้าที่กำลังพิมพ์...'
                      : 'น้องช้าง AI กำลังคิดคำตอบ...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips (If less than 4 messages or user needs guidance) */}
          {messages.length <= 4 && (
            <div className="p-2.5 bg-slate-100/70 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 no-scrollbar">
              <button
                onClick={() => handleQuickQuestion('📅 มีกิจกรรมหอพักเปิดรับสมัครตอนนี้บ้างไหม?')}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-purple-50 text-slate-700 hover:text-[#6C3994] border border-slate-200 hover:border-purple-300 font-medium transition-colors"
              >
                📅 มีกิจกรรมเปิดรับสมัครตอนนี้บ้าง?
              </button>
              <button
                onClick={() => handleQuickQuestion('⭐ กฎและเกณฑ์การเก็บคะแนนหอพัก มช. เป็นอย่างไร?')}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-purple-50 text-slate-700 hover:text-[#6C3994] border border-slate-200 hover:border-purple-300 font-medium transition-colors"
              >
                ⭐ เกณฑ์คะแนนหอพัก
              </button>
              <button
                onClick={() => handleQuickQuestion('📍 สำนักงานหอพักนักศึกษา มช. อยู่ตรงไหนและติดต่ออย่างไร?')}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-purple-50 text-slate-700 hover:text-[#6C3994] border border-slate-200 hover:border-purple-300 font-medium transition-colors"
              >
                📍 ติดต่อสำนักงานหอพัก
              </button>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์คำถาม หรือข้อความคุยกับแอดมิน..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-slate-200 focus:border-[#6C3994] focus:ring-1 focus:ring-purple-300 outline-none transition-all placeholder:text-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={!inputMessage.trim()}
              className="p-2.5 bg-[#6C3994] hover:bg-[#502175] disabled:opacity-40 text-white rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              title="ส่งข้อความ"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button (Launcher) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-[#502175] via-[#6C3994] to-[#8648B8] text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/40"
        title="เปิด Live Chat และ AI ผู้ช่วยหอพัก มช."
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white animate-pulse" />
        </div>

        <div className="text-left hidden sm:block">
          <div className="text-xs font-bold leading-tight flex items-center gap-1">
            <span>Live Chat & AI ผู้ช่วย</span>
            <Sparkles className="w-3 h-3 text-amber-300" />
          </div>
          <div className="text-[10px] text-purple-200 leading-tight">
            แอดมิน & น้องช้าง AI พร้อมดูแล
          </div>
        </div>

        {/* Unread Counter Badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-md animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
