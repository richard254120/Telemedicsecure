/**
 * ConsultationCallAlert — Real-time Clinical Audio/Visual Call & Schedule Arrival Banner.
 *
 * Provides real-time synchronization between Patient, Doctor, and Nurse:
 *  1. Flashes and beeps when a scheduled consultation appointment time arrives.
 *  2. High-urgency alert if a doctor forgot about a consultation and the patient
 *     is ALREADY waiting inside the call room.
 *  3. Audio telemetry synthesized via Web Audio API (medical pager pulse / chime).
 *  4. Direct 1-click "Join Call Room" entry with live elapsed wait timer.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE, WS_URL } from '../config';
import { io, Socket } from 'socket.io-client';
import {
  Video,
  AlertTriangle,
  Clock,
  Volume2,
  VolumeX,
  X,
  ArrowRight,
  ShieldAlert,
  HeartPulse,
  UserCheck,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export interface CallAlertData {
  id: string; // consultationId or alert key
  consultationId: string;
  type: 'PATIENT_IN_CALL' | 'DOCTOR_IN_CALL' | 'SCHEDULED_TIME_DUE';
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  scheduledAt: string;
  joinedAt?: string;
  message: string;
  dismissed?: boolean;
}

// ── Web Audio API Synthesizer (No external mp3 assets needed) ──────────────────
class ClinicalAlertSound {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Double urgent pulse for patient waiting in call (880Hz / A5)
  playUrgentPulse() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Beep 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Beep 2
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046, now + 0.18); // C6
      gain2.gain.setValueAtTime(0, now + 0.18);
      gain2.gain.linearRampToValueAtTime(0.2, now + 0.20);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.35);
    } catch {
      // AudioContext not permitted yet
    }
  }

  // Harmonic medical appointment chime (E5 -> A5 -> C6)
  playScheduledChime() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freqs = [659.25, 880.0, 1046.5]; // E5, A5, C6
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {
      // AudioContext not permitted
    }
  }

  startUrgentBeeping() {
    this.stopBeeping();
    this.playUrgentPulse();
    this.intervalId = setInterval(() => {
      this.playUrgentPulse();
    }, 4000);
  }

  startScheduledBeeping() {
    this.stopBeeping();
    this.playScheduledChime();
    this.intervalId = setInterval(() => {
      this.playScheduledChime();
    }, 12000); // repeats gently every 12 seconds
  }

  stopBeeping() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) this.stopBeeping();
  }
}

const alertSound = new ClinicalAlertSound();

export default function ConsultationCallAlert() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [activeAlerts, setActiveAlerts] = useState<CallAlertData[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  // Toggle audio mute
  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      alertSound.setMuted(next);
      return next;
    });
  };

  // Dismiss a specific alert
  const dismissAlert = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  };

  // Join the consultation call immediately
  const handleJoinCall = (consultationId: string) => {
    alertSound.stopBeeping();
    navigate(`/call/${consultationId}`);
  };

  // ── Polling & REST Synchronization ──────────────────────────────────────────
  const checkAlertsFromApi = useCallback(async () => {
    if (!user) return;
    try {
      const headers = { ...getAuthHeaders(), Accept: 'application/json' };
      const res = await fetch(`${API_BASE}/consultations/call-alerts`, { headers });
      if (!res.ok) return;

      const data = await res.json();
      const now = new Date(data.serverTime || new Date());
      const newAlerts: CallAlertData[] = [];

      // 1. Process waiting rooms where someone is waiting
      if (Array.isArray(data.waitingRooms)) {
        for (const room of data.waitingRooms) {
          if (user.role === 'DOCTOR' && room.doctorId === user.id && room.hasPatient) {
            newAlerts.push({
              id: `room-${room.consultationId}`,
              consultationId: room.consultationId,
              type: 'PATIENT_IN_CALL',
              patientId: room.patientId,
              patientName: room.patientName,
              doctorId: room.doctorId,
              doctorName: room.doctorName,
              scheduledAt: room.scheduledAt,
              joinedAt: room.joinedAt,
              message: `Patient ${room.patientName} is waiting in the Consultation Call Room!`,
            });
          } else if (user.role === 'PATIENT' && room.patientId === user.id && room.hasDoctor) {
            newAlerts.push({
              id: `room-${room.consultationId}`,
              consultationId: room.consultationId,
              type: 'DOCTOR_IN_CALL',
              patientId: room.patientId,
              patientName: room.patientName,
              doctorId: room.doctorId,
              doctorName: room.doctorName,
              scheduledAt: room.scheduledAt,
              joinedAt: room.joinedAt,
              message: `${room.doctorName} is in your Consultation Call Room ready to connect!`,
            });
          } else if (user.role === 'NURSE' && room.hasPatient) {
            newAlerts.push({
              id: `room-${room.consultationId}`,
              consultationId: room.consultationId,
              type: 'PATIENT_IN_CALL',
              patientId: room.patientId,
              patientName: room.patientName,
              doctorId: room.doctorId,
              doctorName: room.doctorName,
              scheduledAt: room.scheduledAt,
              joinedAt: room.joinedAt,
              message: `Patient ${room.patientName} is in Call Room (${room.doctorName})`,
            });
          }
        }
      }

      // 2. Process consultations whose scheduled time has ARRIVED (within -10m to +45m)
      if (Array.isArray(data.dueConsultations)) {
        for (const c of data.dueConsultations) {
          const schedTime = new Date(c.scheduledAt).getTime();
          const diffMs = now.getTime() - schedTime;
          const diffMin = diffMs / (60 * 1000);

          // If consultation time is reached: starting within 5 minutes or up to 45 mins past scheduled
          if (diffMin >= -5 && diffMin <= 45 && c.status !== 'COMPLETED' && c.status !== 'CANCELLED') {
            // Only add if not already covered by an active waiting room alert
            const alreadyInWaiting = newAlerts.some(a => a.consultationId === c.id);
            if (!alreadyInWaiting) {
              const targetName = user.role === 'PATIENT'
                ? `Dr. ${c.doctor?.firstName || ''} ${c.doctor?.lastName || ''}`.trim()
                : `${c.patient?.firstName || ''} ${c.patient?.lastName || ''}`.trim();

              newAlerts.push({
                id: `due-${c.id}`,
                consultationId: c.id,
                type: 'SCHEDULED_TIME_DUE',
                patientId: c.patientId,
                patientName: `${c.patient?.firstName || ''} ${c.patient?.lastName || ''}`.trim(),
                doctorId: c.doctorId,
                doctorName: `Dr. ${c.doctor?.firstName || ''} ${c.doctor?.lastName || ''}`.trim(),
                scheduledAt: c.scheduledAt,
                message: diffMin > 0
                  ? `Scheduled consultation with ${targetName} is due now (${Math.floor(diffMin)}m past scheduled start)!`
                  : `Scheduled consultation with ${targetName} is starting now!`,
              });
            }
          }
        }
      }

      setActiveAlerts(newAlerts);
    } catch (err) {
      console.warn('Call alerts polling hiccup:', err);
    }
  }, [user, getAuthHeaders]);

  // ── WebSocket Integration ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    checkAlertsFromApi();

    const socket: Socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register-user', { userId: user.id, role: user.role });
    });

    // Real-time call alert pushed from server
    socket.on('consultation-call-alert', (alert: any) => {
      setActiveAlerts(prev => {
        const id = `room-${alert.consultationId}`;
        const existing = prev.filter(a => a.consultationId !== alert.consultationId);
        return [{
          id,
          consultationId: alert.consultationId,
          type: alert.type || 'PATIENT_IN_CALL',
          patientId: alert.patientId,
          patientName: alert.patientName,
          doctorId: alert.doctorId,
          doctorName: alert.doctorName,
          scheduledAt: alert.scheduledAt,
          joinedAt: alert.joinedAt || new Date().toISOString(),
          message: alert.message,
        }, ...existing];
      });
    });

    // When consultation ends or participant leaves
    socket.on('consultation-call-ended', (data: { consultationId: string }) => {
      setActiveAlerts(prev => prev.filter(a => a.consultationId !== data.consultationId));
    });

    socket.on('patient-left-call', (data: { consultationId: string }) => {
      setActiveAlerts(prev => prev.filter(a => !(a.consultationId === data.consultationId && a.type === 'PATIENT_IN_CALL')));
    });

    // Polling interval every 15s to catch exact scheduled clock time arrival
    const intervalId = setInterval(checkAlertsFromApi, 15000);

    return () => {
      socket.disconnect();
      clearInterval(intervalId);
      alertSound.stopBeeping();
    };
  }, [user, checkAlertsFromApi]);

  // ── Audio Management based on Active Alerts ────────────────────────────────
  useEffect(() => {
    const unacknowledged = activeAlerts.filter(a => !dismissedIds.has(a.id));

    if (unacknowledged.length === 0) {
      alertSound.stopBeeping();
      return;
    }

    // Has patient in call -> Urgent beeping pulse
    const hasUrgent = unacknowledged.some(a => a.type === 'PATIENT_IN_CALL');
    if (hasUrgent) {
      alertSound.startUrgentBeeping();
    } else {
      // Scheduled time due -> Periodic harmonic chime
      alertSound.startScheduledBeeping();
    }

    return () => {
      alertSound.stopBeeping();
    };
  }, [activeAlerts, dismissedIds]);

  // Visible alerts (unacknowledged by current session)
  const visibleAlerts = activeAlerts.filter(a => !dismissedIds.has(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="w-full space-y-3 mb-6 transition-all duration-300">
      {visibleAlerts.map(alert => {
        const isUrgent = alert.type === 'PATIENT_IN_CALL';
        const isDoctorReady = alert.type === 'DOCTOR_IN_CALL';

        return (
          <div
            key={alert.id}
            className={`relative overflow-hidden rounded-2xl border shadow-2xl p-4 sm:p-5 transition-all ${
              isUrgent
                ? 'bg-gradient-to-r from-red-950/90 via-slate-900/95 to-rose-950/80 border-red-500/80 animate-pulse'
                : isDoctorReady
                ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-teal-950/80 border-emerald-500/80'
                : 'bg-gradient-to-r from-cyan-950/90 via-slate-900/95 to-blue-950/80 border-cyan-500/80 animate-pulse'
            }`}
          >
            {/* Ambient Background Glow Bar */}
            <div
              className={`absolute top-0 left-0 bottom-0 w-2.5 ${
                isUrgent ? 'bg-red-500' : isDoctorReady ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}
            />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pl-3">
              {/* Left Details */}
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-3 rounded-2xl shrink-0 flex items-center justify-center border shadow-lg ${
                    isUrgent
                      ? 'bg-red-500/20 border-red-500/50 text-red-400'
                      : isDoctorReady
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  }`}
                >
                  {isUrgent ? (
                    <HeartPulse className="w-6 h-6 animate-ping" />
                  ) : isDoctorReady ? (
                    <UserCheck className="w-6 h-6" />
                  ) : (
                    <Clock className="w-6 h-6 animate-spin" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border font-mono ${
                        isUrgent
                          ? 'bg-red-500 text-white border-red-400 animate-bounce'
                          : isDoctorReady
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-cyan-500 text-black border-cyan-400'
                      }`}
                    >
                      {isUrgent
                        ? '🚨 PATIENT WAITING IN CALL'
                        : isDoctorReady
                        ? '👨‍⚕️ DOCTOR READY IN CALL'
                        : '⏰ APPOINTMENT TIME REACHED'}
                    </span>

                    <span className="text-[11px] font-mono text-slate-400">
                      ID: #{alert.consultationId.slice(0, 8)}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                    {alert.message}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <span className="flex items-center gap-1 font-semibold text-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Scheduled: {new Date(alert.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {alert.joinedAt && (
                      <span className="flex items-center gap-1 text-amber-300 font-mono text-[11px] font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Patient joined at {new Date(alert.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right CTA Actions */}
              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                {/* Audio Mute / Unmute */}
                <button
                  type="button"
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute alert beeping' : 'Mute alert beeping'}
                  className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
                </button>

                {/* Dismiss */}
                <button
                  type="button"
                  onClick={() => dismissAlert(alert.id)}
                  title="Dismiss alert"
                  className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Main Action Button */}
                <button
                  type="button"
                  onClick={() => handleJoinCall(alert.consultationId)}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-xl transition flex items-center gap-2 ${
                    isUrgent
                      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 shadow-red-600/30'
                      : isDoctorReady
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/30'
                  }`}
                >
                  <Video className="w-4 h-4 animate-bounce" />
                  <span>Enter Call Room Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

