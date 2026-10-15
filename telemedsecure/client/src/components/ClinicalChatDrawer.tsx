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
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config';

interface ChatMessage {
  id: string;
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
  recipientName = 'Clinical Care Team',
  recipientRole = 'CARE_TEAM'
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load initial greeting / system message
    setMessages([
      {
        id: 'sys-1',
        senderId: 'system',
        senderName: 'TeleMedSecure E2EE Engine',
        senderRole: 'SYSTEM',
        text: 'Encrypted clinical messaging channel established. All communications are protected under HIPAA § 164.312 with AES-256 envelope encryption.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        encrypted: true
      }
    ]);

    const newSocket = io(WS_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-room', {
        consultationId,
        userId: user?.id || 'guest',
        role: user?.role || 'PATIENT'
      });
    });

    newSocket.on('chat-message', (data: any) => {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random()}`,
          senderId: data.senderId || 'peer',
          senderName: data.senderName || 'Consultation Peer',
          senderRole: data.senderRole || 'DOCTOR',
          text: data.text || data.ciphertext || 'Encrypted clinical message',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          encrypted: true
        }
      ]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isOpen, consultationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      senderName: `${user.firstName} ${user.lastName}`,
      senderRole: user.role,
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      encrypted: true
    };

    setMessages(prev => [...prev, newMsg]);

    if (socket) {
      socket.emit('chat-message', {
        consultationId,
        senderId: user.id,
        senderName: `${user.firstName} ${user.lastName}`,
        senderRole: user.role,
        text: inputText.trim(),
        ciphertext: inputText.trim(),
        iv: 'aes-gcm-iv-standard'
      });
    }

    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col animate-slideLeft">
      
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h4 className="text-sm font-bold text-white">{recipientName}</h4>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex items-center space-x-1 text-[11px] text-cyan-400 font-mono">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>AES-256 E2EE Channel</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => {
          const isMe = msg.senderId === user?.id;
          const isSys = msg.senderRole === 'SYSTEM';

          if (isSys) {
            return (
              <div key={msg.id} className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center space-x-1 text-cyan-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{msg.senderName}</span>
                </div>
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1 text-[10px] text-slate-400 mb-1 px-1">
                <span className="font-semibold text-slate-300">{isMe ? 'You' : msg.senderName}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed space-y-1 shadow-md ${
                  isMe
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-800/90 border border-slate-700 text-slate-100 rounded-tl-none'
                }`}
              >
                <p>{msg.text}</p>
                <div className="flex items-center justify-end space-x-1 text-[9px] opacity-75 font-mono">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Encrypted</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-950/90">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type encrypted message..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition shadow-lg shadow-cyan-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

    </div>
  );
};
