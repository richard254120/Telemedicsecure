/**
 * HospitalClinicalSplash — High-Tech Clinical Telemetry & Hospital Opening Animation.
 *
 * Designed specifically for a professional hospital & clinical medicine platform:
 *  • Real-time ICU / CCU grade ECG (P-Q-R-S-T) phosphor heartbeat monitor wave
 *  • Holographic pulsing Medical Cross with cardiac resonance shockwaves
 *  • Live medical telemetry HUD (72 BPM Sinus, SpO₂ 99%, 118/76 mmHg, Temp 36.8°C)
 *  • Phosphor medical grid oscilloscope with laser sweep head
 *  • Floating cellular & biometric data particles
 *  • Instant bypass on click or Escape key, with session-safe auto-fade.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, ShieldCheck, HeartPulse, Zap } from 'lucide-react';

interface Props {
  onDone: () => void;
}

export default function HospitalClinicalSplash({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fading, setFading] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [bpm, setBpm] = useState(72);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Instant skip on click or keypress
  const triggerExit = useCallback(() => {
    setFading(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        triggerExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerExit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c = ctx;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    // ── Animation constants & state ───────────────────────────────────────────
    let rafId = 0;
    let frame = 0;
    let globalAlpha = 0;

    // ECG sweep variables
    let sweepX = 0;
    const sweepSpeed = 3.6; // px per frame
    const ecgBuffer: number[] = [];

    // Shockwave rings emitted from center cross on each R-peak
    interface Shockwave {
      r: number;
      maxR: number;
      alpha: number;
      color: string;
    }
    const shockwaves: Shockwave[] = [];

    // Ambient floating particles
    interface BioParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      color: string;
    }
    const particles: BioParticle[] = [];
    const PARTICLE_COUNT = 45;
    const PARTICLE_COLORS = ['#06b6d4', '#10b981', '#38bdf8', '#818cf8', '#34d399'];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.5,
        size: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      });
    }

    // ── ECG wave generator (P-Q-R-S-T cardiac cycle) ─────────────────────────
    // Cycle repeats every 240 pixels (corresponds to ~72 BPM sweep rhythm)
    const CYCLE_LENGTH = 240;
    function getEcgDeflection(xPos: number): number {
      const pos = ((xPos % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;

      // Baseline: 0
      // P wave: atrial depolarization (soft positive bump)
      if (pos >= 40 && pos < 70) {
        const p = (pos - 40) / 30;
        return -Math.sin(p * Math.PI) * 14;
      }
      // PR interval: flat
      if (pos >= 70 && pos < 95) return 0;
      // Q wave: small negative dip
      if (pos >= 95 && pos < 105) {
        const q = (pos - 95) / 10;
        return Math.sin(q * Math.PI) * 12;
      }
      // R wave: huge positive ventricular depolarization spike
      if (pos >= 105 && pos < 120) {
        const r = (pos - 105) / 15;
        return -Math.sin(r * Math.PI) * 85;
      }
      // S wave: sharp negative deflection
      if (pos >= 120 && pos < 132) {
        const s = (pos - 120) / 12;
        return Math.sin(s * Math.PI) * 22;
      }
      // ST segment: flat
      if (pos >= 132 && pos < 150) return 0;
      // T wave: ventricular repolarization (medium positive dome)
      if (pos >= 150 && pos < 190) {
        const t = (pos - 150) / 40;
        return -Math.sin(t * Math.PI) * 24;
      }
      // Isoelectric baseline
      return 0;
    }

    // ── Main animation loop ──────────────────────────────────────────────────
    function tick() {
      frame++;
      if (globalAlpha < 1) globalAlpha = Math.min(1, globalAlpha + 0.04);

      const width = W();
      const height = H();
      const centerY = height * 0.62; // ECG line placed across the lower-mid

      // Soft persistence dark background
      c.save();
      c.fillStyle = '#030712';
      c.fillRect(0, 0, width, height);
      c.restore();

      // 1. ── Clinical Oscilloscope Grid ──────────────────────────────────────
      c.save();
      c.globalAlpha = 0.08 * globalAlpha;
      c.strokeStyle = '#06b6d4';
      c.lineWidth = 0.6;

      const gridSize = 32;
      for (let x = 0; x < width; x += gridSize) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, height);
        c.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(width, y);
        c.stroke();
      }

      // Stronger 5-block major grid lines
      c.globalAlpha = 0.16 * globalAlpha;
      c.lineWidth = 1;
      for (let x = 0; x < width; x += gridSize * 5) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, height);
        c.stroke();
      }
      for (let y = 0; y < height; y += gridSize * 5) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(width, y);
        c.stroke();
      }
      c.restore();

      // 2. ── Center Clinical Hub / Rotating Telemetry Rings ───────────────────
      const hubX = width / 2;
      const hubY = height * 0.38;

      c.save();
      c.globalAlpha = globalAlpha;

      // Ambient radial backlight
      const bgGlow = c.createRadialGradient(hubX, hubY, 10, hubX, hubY, 220);
      bgGlow.addColorStop(0, 'rgba(6, 182, 212, 0.18)');
      bgGlow.addColorStop(0.4, 'rgba(16, 185, 129, 0.08)');
      bgGlow.addColorStop(1, 'rgba(3, 7, 18, 0)');
      c.fillStyle = bgGlow;
      c.beginPath();
      c.arc(hubX, hubY, 220, 0, Math.PI * 2);
      c.fill();

      // Outer rotating notched reticle ring
      c.save();
      c.translate(hubX, hubY);
      c.rotate(frame * 0.008);
      c.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      c.lineWidth = 1.5;
      c.setLineDash([8, 12, 2, 12]);
      c.beginPath();
      c.arc(0, 0, 110, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      // Counter-rotating inner degree ring
      c.save();
      c.translate(hubX, hubY);
      c.rotate(-frame * 0.006);
      c.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      c.lineWidth = 1;
      c.setLineDash([4, 16]);
      c.beginPath();
      c.arc(0, 0, 88, 0, Math.PI * 2);
      c.stroke();

      // Cardinal clinical tick marks
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        c.beginPath();
        c.moveTo(Math.cos(angle) * 78, Math.sin(angle) * 78);
        c.lineTo(Math.cos(angle) * 98, Math.sin(angle) * 98);
        c.strokeStyle = '#10b981';
        c.lineWidth = 2;
        c.stroke();
      }
      c.restore();

      // Central Shield / Medical Cross Emblem
      c.save();
      c.translate(hubX, hubY);

      // Core glow circle
      const coreGlow = c.createRadialGradient(0, 0, 5, 0, 0, 56);
      coreGlow.addColorStop(0, '#06b6d4');
      coreGlow.addColorStop(0.5, '#0e7490');
      coreGlow.addColorStop(1, '#083344');
      c.fillStyle = coreGlow;
      c.shadowColor = '#06b6d4';
      c.shadowBlur = 28;
      c.beginPath();
      c.arc(0, 0, 52, 0, Math.PI * 2);
      c.fill();

      // Outer rim
      c.strokeStyle = '#67e8f9';
      c.lineWidth = 2.5;
      c.shadowBlur = 14;
      c.beginPath();
      c.arc(0, 0, 52, 0, Math.PI * 2);
      c.stroke();

      // Draw the iconic 3D Medical Cross in pure radiant white & cyan
      const crossSize = 22;
      const crossThick = 9;

      c.shadowColor = '#ffffff';
      c.shadowBlur = 18;
      c.fillStyle = '#ffffff';
      c.beginPath();
      // Horizontal bar
      c.roundRect(-crossSize, -crossThick, crossSize * 2, crossThick * 2, 4);
      c.fill();
      // Vertical bar
      c.beginPath();
      c.roundRect(-crossThick, -crossSize, crossThick * 2, crossSize * 2, 4);
      c.fill();

      c.restore();
      c.restore();

      // 3. ── Shockwaves emitted on heart contraction ───────────────────────────
      c.save();
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.r += 3.2;
        sw.alpha *= 0.96;
        if (sw.alpha <= 0.02 || sw.r >= sw.maxR) {
          shockwaves.splice(i, 1);
          continue;
        }

        c.beginPath();
        c.arc(hubX, hubY, sw.r, 0, Math.PI * 2);
        c.strokeStyle = sw.color;
        c.globalAlpha = sw.alpha * globalAlpha;
        c.lineWidth = 2;
        c.shadowColor = sw.color;
        c.shadowBlur = 12;
        c.stroke();
      }
      c.restore();

      // 4. ── ECG Heartbeat Sweep Waveform ──────────────────────────────────────
      sweepX += sweepSpeed;
      if (sweepX > width) sweepX = 0;

      // Trigger heart contraction shockwave precisely when crossing R-wave peak
      const posInCycle = ((sweepX % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
      if (posInCycle >= 110 && posInCycle <= 114) {
        shockwaves.push({
          r: 54,
          maxR: 320,
          alpha: 0.9,
          color: '#22d3ee',
        });
        setPulsePhase(p => p + 1);
      }

      // Record buffer point
      const currentY = centerY + getEcgDeflection(sweepX);
      ecgBuffer[Math.floor(sweepX)] = currentY;

      // Draw active ECG waveform line across the screen
      c.save();
      c.globalAlpha = globalAlpha;

      // Draw faint baseline reference guide
      c.beginPath();
      c.moveTo(0, centerY);
      c.lineTo(width, centerY);
      c.strokeStyle = 'rgba(6, 182, 212, 0.12)';
      c.lineWidth = 1;
      c.setLineDash([4, 6]);
      c.stroke();
      c.setLineDash([]);

      // Draw continuous medical trace with fading phosphor persistence
      c.lineWidth = 2.4;
      c.lineCap = 'round';
      c.lineJoin = 'round';

      c.beginPath();
      let started = false;

      // Render trace with distance-based alpha relative to sweep head
      for (let x = 0; x < width; x += 2) {
        const yVal = ecgBuffer[x] ?? (centerY + getEcgDeflection(x));

        // Distance behind sweep head
        let distBehind = sweepX - x;
        if (distBehind < 0) distBehind += width;

        // Fading intensity: bright near head, dimmer further back
        const trailIntensity = Math.max(0, 1 - distBehind / (width * 0.92));

        if (!started) {
          c.moveTo(x, yVal);
          started = true;
        } else {
          c.lineTo(x, yVal);
        }
      }

      // Multi-layer clinical glow
      c.strokeStyle = '#06b6d4';
      c.shadowColor = '#06b6d4';
      c.shadowBlur = 14;
      c.stroke();

      // Core laser line
      c.lineWidth = 1.4;
      c.strokeStyle = '#a5f3fc';
      c.shadowColor = '#ffffff';
      c.shadowBlur = 6;
      c.stroke();

      // ── Bright scanning head dot with leading phosphor bloom
      c.beginPath();
      c.arc(sweepX, currentY, 4.5, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.shadowColor = '#22d3ee';
      c.shadowBlur = 24;
      c.fill();

      // Vertical scanner bar
      const gradBar = c.createLinearGradient(sweepX, centerY - 60, sweepX, centerY + 60);
      gradBar.addColorStop(0, 'rgba(34, 211, 238, 0)');
      gradBar.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
      gradBar.addColorStop(1, 'rgba(34, 211, 238, 0)');
      c.strokeStyle = gradBar;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sweepX, centerY - 70);
      c.lineTo(sweepX, centerY + 70);
      c.stroke();

      c.restore();

      // 5. ── Ambient Biometric Nanoparticles ──────────────────────────────────
      c.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fillStyle = p.color;
        c.globalAlpha = p.alpha * globalAlpha * 0.6;
        c.shadowColor = p.color;
        c.shadowBlur = 8;
        c.fill();
      }
      c.restore();

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    // Natural 3.6s presentation before soft fade out
    const autoExitTimer = setTimeout(() => {
      setFading(true);
    }, 3400);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(autoExitTimer);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Soft fade transition
  useEffect(() => {
    if (!fading) return;
    const interval = setInterval(() => {
      setOpacity(prev => {
        const next = prev - 0.05;
        if (next <= 0) {
          clearInterval(interval);
          onDone();
          return 0;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [fading, onDone]);

  // Subtle live variation on heart rate
  useEffect(() => {
    const id = setInterval(() => {
      setBpm(70 + Math.floor(Math.sin(Date.now() / 2000) * 3));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      onClick={triggerExit}
      style={{ opacity }}
      className="fixed inset-0 z-[9999] bg-[#030712] cursor-pointer select-none overflow-hidden font-mono"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Top Left: Hospital Facility & Status HUD ─────────────────────── */}
      <div className="absolute top-6 left-6 md:top-8 md:left-8 z-10 flex flex-col gap-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold text-emerald-400 tracking-wider text-[11px] uppercase">
            Hospital Telemetry Network • Online
          </span>
        </div>
        <div className="text-[10px] text-slate-500 tracking-wider uppercase font-semibold">
          Station: Main Clinical Operating Command
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-[10px] font-bold">
            LEAD II • REAL-TIME ECG
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            E2EE ENCRYPTED
          </span>
        </div>
      </div>

      {/* ── Top Right: Real-time Clinical Vitals Monitor ───────────────────── */}
      <div className="absolute top-6 right-6 md:top-8 md:right-8 z-10 text-right flex flex-col items-end gap-1">
        <div className="flex items-baseline gap-2 bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-2xl shadow-xl backdrop-blur-sm">
          <HeartPulse className="w-4 h-4 text-rose-500 animate-pulse" />
          <span className="text-2xl font-black text-white tracking-tight">{bpm}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase">BPM</span>
          <span className="text-[10px] text-emerald-400 font-bold ml-1.5">• SINUS</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium pt-1">
          <span>SpO₂: <strong className="text-cyan-300">99%</strong></span>
          <span>•</span>
          <span>BP: <strong className="text-emerald-300">118/76</strong></span>
          <span>•</span>
          <span>TEMP: <strong className="text-amber-300">36.8°C</strong></span>
        </div>
      </div>

      {/* ── Center Bottom: Platform Title & Animated Loading Bar ──────────── */}
      <div className="absolute inset-x-0 bottom-10 md:bottom-12 z-10 flex flex-col items-center gap-3 px-4 text-center pointer-events-none">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
          <h1 className="text-base md:text-lg font-black tracking-[0.25em] text-white uppercase">
            TeleMedSecure
          </h1>
          <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
            Clinical OS
          </span>
        </div>

        <p className="text-[11px] text-slate-400 font-medium tracking-wide max-w-md">
          Autonomous Hospital Stations • Laboratory • Radiology • Triage • Pharmacy
        </p>

        {/* Dynamic medical scanning loading bar */}
        <div className="w-56 h-1 rounded-full bg-slate-800 overflow-hidden relative mt-1">
          <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-500 via-emerald-400 to-indigo-500 rounded-full w-full animate-[shimmer_1.8s_infinite]" />
        </div>

        {/* Skip hint */}
        <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1">
          Click anywhere or press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">ESC</kbd> to enter
        </p>
      </div>
    </div>
  );
}

