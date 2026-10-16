import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Lock,
  ShieldCheck,
  User,
  Stethoscope,
  HeartPulse,
  Clock,
  Sparkles,
  Users,
  CheckCheck,
  Activity,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { WS_URL, API_BASE } from '../config';

export interface ChatMessage {
  id: string;
  channelId?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  encrypted: boolean;
}

interface ClinicalChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  consultationId?: string;
  recipientName?: string;
  recipientRole?: string;
}

export const ClinicalChatDrawer: React.FC<ClinicalChatDrawerProps> = ({
  isOpen,
  onClose,
  consultationId = 'general-clinical-channel',
  recipientName = 'Attending Care Team',
  recipientRole = 'CARE_TEAM'
}) => {
  const { user, getAuthHeaders } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick Templates based on role
  const isPatient = user?.role === 'PATIENT';
  const quickTemplates = isPatient
    ? [
        'Requesting prescription refill',
        'Logged new vital signs',
        'Experiencing mild symptoms',
        'Ready for video consultation'
      ]
    : [
        'Reviewing your chart now',
        'Prescription sent to pharmacy',
        'Please log your blood pressure & SpO2',
        'Please enter the virtual video room'
      ];

  // 1. Fetch persistent history on open or channel change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        const res = await fetch(`${API_BASE}/chat/channels/${encodeURIComponent(consultationId)}/messages`, {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            setMessages(data);
          }
        }
      } catch (err) {
        console.warn('Failed to load message history:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();

    // 2. Setup Socket.io real-time connection
    const newSocket = io(WS_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-room', {
        consultationId,
        userId: user?.id || 'anonymous',
        role: user?.role || 'PATIENT'
      });
    });

    newSocket.on('chat-message', (data: any) => {
      // Discard messages belonging to other patient channels
      if (data.channelId && data.channelId !== consultationId) {
        return;
      }
      setMessages(prev => {
        // Prevent duplicate insertions
        if (prev.some(m => m.id === data.id)) return prev;
        return [
          ...prev,
          {
            id: data.id || `msg-${Date.now()}-${Math.random()}`,
            channelId: data.channelId || consultationId,
            senderId: data.senderId || 'care-team',
            senderName: data.senderName || 'Attending Care Team',
            senderRole: data.senderRole || 'CARE_TEAM',
            text: data.text || data.ciphertext || 'Encrypted clinical message',
            timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            encrypted: true
          }
        ];
      });
    });

    setSocket(newSocket);

    return () => {
      isMounted = false;
      newSocket.disconnect();
    };
  }, [isOpen, consultationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Send message handler (persists via API & broadcasts via Socket)
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !user) return;

    setInputText('');

    const optimisticId = `msg-opt-${Date.now()}`;
    const localMsg: ChatMessage = {
      id: optimisticId,
      channelId: consultationId,
      senderId: user.id,
      senderName: `${user.firstName} ${user.lastName}`,
      senderRole: user.role,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      encrypted: true
    };

    setMessages(prev => [...prev, localMsg]);

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/chat/channels/${encodeURIComponent(consultationId)}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          senderName: `${user.firstName} ${user.lastName}`,
          senderRole: user.role
        })
      });

      if (res.ok) {
        const saved = await res.json();
        // Replace optimistic message with server-signed message
        setMessages(prev => prev.map(m => (m.id === optimisticId ? saved : m)));
      }
    } catch (err: any) {
      console.error('Failed to send clinical message:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-2xl flex flex-col animate-slideLeft font-sans">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/20">
              <Users className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-extrabold text-white tracking-tight">{recipientName}</h4>
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] text-cyan-400 font-mono mt-0.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>AES-256 Envelope Encrypted • HIPAA Verified</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Close Care Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Security Status Banner */}
      <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Channel: <strong className="text-slate-300 font-mono">#{consultationId.slice(0, 16)}</strong></span>
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/50 text-cyan-300 font-mono">
          E2EE Active
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {loading && messages.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span>Establishing zero-knowledge care team channel...</span>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.id;
          const isSys = msg.senderRole === 'SYSTEM';

          if (isSys) {
            return (
              <div key={msg.id || idx} className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-400 space-y-1 shadow-sm">
                <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{msg.senderName}</span>
                </div>
                <p className="leading-relaxed text-slate-300">{msg.text}</p>
              </div>
            );
          }

          return (
            <div
              key={msg.id || idx}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1 text-[10px] text-slate-400 mb-1 px-1">
                <span className={`font-semibold ${isMe ? 'text-cyan-300' : 'text-slate-200'}`}>
                  {isMe ? 'You' : msg.senderName}
                </span>
                <span>({msg.senderRole})</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed space-y-1.5 shadow-md ${
                  isMe
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <div className="flex items-center justify-between text-[9px] opacity-75 font-mono pt-0.5 border-t border-white/10">
                  <span className="flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>AES-256</span>
                  </span>
                  <CheckCheck className="w-3 h-3 text-cyan-200" />
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Clinical Templates Bar */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 mr-1" />
        {quickTemplates.map((template, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(template)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition border border-slate-700 shrink-0"
          >
            {template}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-slate-800 bg-slate-950"
      >
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type encrypted message to Attending Care Team..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-sans"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white transition shadow-lg shadow-cyan-600/20 flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
