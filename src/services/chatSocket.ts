import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, ChatSession } from '../types';

interface UseChatOptions {
  sessionId: string;
  role: 'user' | 'admin';
  userName?: string;
  studentId?: string;
  dormitory?: string;
}

export function useChat({
  sessionId,
  role,
  userName = 'นักศึกษาหอพัก',
  studentId = '',
  dormitory = ''
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]); // For admin
  const [isConnected, setIsConnected] = useState(false);
  const [isTypingRemote, setIsTypingRemote] = useState<{ sender: string; isTyping: boolean } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect WebSocket
  const connectSocket = useCallback(() => {
    if (!sessionId) return;
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat?sessionId=${encodeURIComponent(sessionId)}&role=${role}&name=${encodeURIComponent(userName)}`;
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'init_user') {
            if (Array.isArray(data.messages)) {
              setMessages(data.messages);
            }
            if (data.session) {
              setSession(data.session);
              setUnreadCount(data.session.unreadUserCount || 0);
            }
          } else if (data.type === 'init_admin') {
            if (Array.isArray(data.sessions)) {
              setAllSessions(data.sessions);
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
              setSession(data.session);
              setAllSessions((prevSessions) => {
                const idx = prevSessions.findIndex((s) => s.id === data.session.id);
                if (idx >= 0) {
                  const updated = [...prevSessions];
                  updated[idx] = data.session;
                  return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
                }
                return [data.session, ...prevSessions];
              });
            }

            if (role === 'user' && newMsg.sender !== 'user') {
              setUnreadCount((prev) => prev + 1);
            }
          } else if (data.type === 'typing') {
            if (data.sessionId === sessionId) {
              setIsTypingRemote({ sender: data.sender, isTyping: !!data.isTyping });
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              if (data.isTyping) {
                typingTimeoutRef.current = setTimeout(() => {
                  setIsTypingRemote(null);
                }, 4000);
              }
            }
          } else if (data.type === 'session_updated') {
            if (data.session?.id === sessionId) {
              setSession(data.session);
            }
            setAllSessions((prev) => {
              const idx = prev.findIndex((s) => s.id === data.session.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = data.session;
                return next;
              }
              return [data.session, ...prev];
            });
          }
        } catch (e) {
          console.warn('WS message parse error in client:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;
        // Auto-reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectSocket();
          }, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
      setIsConnected(false);
    }
  }, [sessionId, role, userName]);

  // Initial connect & cleanup
  useEffect(() => {
    connectSocket();

    // Initial REST sync as fallback
    fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
        if (data.session) {
          setSession(data.session);
        }
      })
      .catch(() => {});

    if (role === 'admin') {
      fetch('/api/chat/sessions')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setAllSessions(data);
        })
        .catch(() => {});
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [sessionId, role, connectSocket]);

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const payload = {
        type: 'send_message',
        sessionId,
        text: text.trim(),
        sender: role,
        senderName: userName,
        studentId,
        dormitory
      };

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
      } else {
        // Fallback to REST API
        try {
          const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.message) {
            setMessages((prev) => [...prev, data.message]);
          }
        } catch (e) {
          console.error('REST fallback send message failed:', e);
        }
      }
    },
    [sessionId, role, userName, studentId, dormitory]
  );

  // Send typing event
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'typing',
            sessionId,
            sender: role,
            isTyping
          })
        );
      }
    },
    [sessionId, role]
  );

  // Mark messages as read
  const markAsRead = useCallback(() => {
    setUnreadCount(0);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'mark_read',
          sessionId,
          by: role
        })
      );
    } else {
      fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ by: role })
      }).catch(() => {});
    }
  }, [sessionId, role]);

  // Admin toggles AI
  const toggleAi = useCallback(
    (enabled: boolean, mode?: 'ai' | 'admin') => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'toggle_ai',
            sessionId,
            enabled,
            mode: mode || (enabled ? 'ai' : 'admin')
          })
        );
      } else {
        fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiAutoReply: enabled, mode })
        }).catch(() => {});
      }
    },
    [sessionId]
  );

  return {
    messages,
    session,
    allSessions,
    isConnected,
    isTypingRemote,
    unreadCount,
    sendMessage,
    sendTyping,
    markAsRead,
    toggleAi,
    setAllSessions
  };
}
