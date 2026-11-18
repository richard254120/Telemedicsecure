/**
 * InfinityTrail — Full-screen canvas splash animation.
 *
 * Shows once per session when the site opens. A luminous particle trail
 * traces the lemniscate of Bernoulli (∞ path), builds to full brightness,
 * then the whole screen fades out revealing the app beneath.
 *
 * Skipped on subsequent same-session navigations via sessionStorage flag.
 */
import React, { useEffect, useRef, useState } from 'react';

// ── Lemniscate parametric path ─────────────────────────────────────────────
// x = a·cos(t) / (1 + sin²(t))
// y = a·sin(t)·cos(t) / (1 + sin²(t))
function lemniscate(t: number, a: number): [number, number] {
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const denom = 1 + sin * sin;
  return [(a * cos) / denom, (a * sin * cos) / denom];
}

interface Particle {
  x: number;
  y: number;
  age: number;       // 0 = just born; life = max age
  life: number;      // total frames it lives
  size: number;
  speed: number;
}

export default function InfinityTrail({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fading, setFading] = useState(false);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill canvas to viewport
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Capture ctx in a non-null local so closures see it without null checks
    const c = ctx;

    const W = () => canvas.width;
    const H = () => canvas.height;

    // ── State ────────────────────────────────────────────────────────────────
    const TRAIL_LEN  = 120;   // ghost particles kept per head
    const SPEED      = 0.028; // t increment per frame
    const NUM_HEADS  = 3;     // simultaneous heads on the path (phase-offset)

    type TrailPoint = { x: number; y: number; alpha: number };
    const trails: TrailPoint[][] = Array.from({ length: NUM_HEADS }, () => []);
    const particles: Particle[]  = [];

    let t = 0;
    let frame = 0;
    let rafId = 0;

    // Palette — cyan/indigo/purple glow
    const COLORS = ['#00e5ff', '#3b82f6', '#818cf8', '#a78bfa', '#06b6d4'];
    const HEAD_COLOR = '#ffffff';

    function spawnParticle(x: number, y: number) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.random() * 6;
      particles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        age:   0,
        life:  20 + Math.random() * 30,
        size:  1 + Math.random() * 3,
        speed: 0.3 + Math.random() * 0.6,
      });
    }

    function drawGlow(
      cx: number, cy: number,
      radius: number, color: string, alpha: number,
    ) {
      const grad = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', 'rgba('));
      // Simpler: just use globalAlpha
      c.save();
      c.globalAlpha = alpha;
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.fillStyle = color;
      c.shadowColor = color;
      c.shadowBlur  = radius * 2;
      c.fill();
      c.restore();
    }

    // Build up "fade" alpha at start
    let globalAlpha = 0;

    function tick() {
      frame++;

      // Fade in over first 30 frames
      if (globalAlpha < 1) globalAlpha = Math.min(1, globalAlpha + 0.033);

      const cx = W() / 2;
      const cy = H() / 2;
      const a  = Math.min(W(), H()) * 0.26; // lemniscate scale

      // ── Background — dark fade (not full clear, so trails persist briefly)
      c.save();
      c.globalAlpha = 0.18;
      c.fillStyle = '#020617'; // slate-950
      c.fillRect(0, 0, W(), H());
      c.restore();

      // ── Update heads ──────────────────────────────────────────────────────
      for (let h = 0; h < NUM_HEADS; h++) {
        const phase = (h / NUM_HEADS) * Math.PI * 2;
        const [lx, ly] = lemniscate(t + phase, a);
        const wx = cx + lx;
        const wy = cy + ly;

        // Push new trail point
        trails[h].unshift({ x: wx, y: wy, alpha: 1 });
        if (trails[h].length > TRAIL_LEN) trails[h].pop();

        // Spawn glow particles at head
        if (frame % 2 === 0) spawnParticle(wx, wy);

        // ── Draw trail ──────────────────────────────────────────────────────
        c.save();
        c.globalAlpha = globalAlpha;
        for (let i = 0; i < trails[h].length; i++) {
          const pt    = trails[h][i];
          const frac  = 1 - i / TRAIL_LEN;        // 1 at head, 0 at tail
          const color = COLORS[Math.floor(h * 1.5 + i * 0.04) % COLORS.length];
          const r     = 1.5 + frac * 4;

          c.beginPath();
          c.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          c.fillStyle = color;
          c.shadowColor = color;
          c.shadowBlur  = 12 * frac;
          c.globalAlpha = globalAlpha * frac * 0.85;
          c.fill();
        }
        c.restore();

        // ── Head bright dot ─────────────────────────────────────────────────
        c.save();
        c.globalAlpha = globalAlpha;

        // Outer halo
        c.beginPath();
        c.arc(wx, wy, 18, 0, Math.PI * 2);
        const halo = c.createRadialGradient(wx, wy, 0, wx, wy, 18);
        halo.addColorStop(0,   'rgba(165,180,252,0.5)');
        halo.addColorStop(0.4, 'rgba(99,102,241,0.25)');
        halo.addColorStop(1,   'rgba(0,0,0,0)');
        c.fillStyle   = halo;
        c.shadowColor = '#818cf8';
        c.shadowBlur  = 30;
        c.fill();

        // Core dot
        c.beginPath();
        c.arc(wx, wy, 4.5, 0, Math.PI * 2);
        c.fillStyle   = HEAD_COLOR;
        c.shadowColor = '#a5f3fc';
        c.shadowBlur  = 20;
        c.fill();
        c.restore();
      }

      // ── Update & draw loose particles ─────────────────────────────────────
      c.save();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age++;
        p.y -= p.speed;
        p.x += (Math.random() - 0.5) * 0.6;
        if (p.age >= p.life) { particles.splice(i, 1); continue; }

        const frac  = 1 - p.age / p.life;
        const color = COLORS[i % COLORS.length];
        c.beginPath();
        c.arc(p.x, p.y, p.size * frac, 0, Math.PI * 2);
        c.fillStyle   = color;
        c.shadowColor = color;
        c.shadowBlur  = 8;
        c.globalAlpha = globalAlpha * frac * 0.7;
        c.fill();
      }
      c.restore();

      // ── Full ∞ ghost outline (faint) ───────────────────────────────────────
      if (frame % 3 === 0) {
        c.save();
        c.globalAlpha = 0.06 * globalAlpha;
        c.strokeStyle = '#818cf8';
        c.lineWidth   = 1;
        c.shadowColor = '#818cf8';
        c.shadowBlur  = 6;
        c.beginPath();
        const steps = 300;
        for (let s = 0; s <= steps; s++) {
          const tt = (s / steps) * Math.PI * 2;
          const [lx, ly] = lemniscate(tt, a);
          if (s === 0) c.moveTo(cx + lx, cy + ly);
          else         c.lineTo(cx + lx, cy + ly);
        }
        c.closePath();
        c.stroke();
        c.restore();
      }

      t += SPEED;
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    // ── Schedule exit ──────────────────────────────────────────────────────
    const exitTimer = setTimeout(() => setFading(true), 2800);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(exitTimer);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ── CSS fade-out phase ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!fading) return;
    const step = () => {
      setOpacity(prev => {
        const next = prev - 0.04;
        if (next <= 0) { onDone(); return 0; }
        return next;
      });
    };
    const id = setInterval(step, 16);
    return () => clearInterval(id);
  }, [fading, onDone]);

  return (
    <div
      style={{ opacity, transition: 'none' }}
      className="fixed inset-0 z-[9999] bg-slate-950"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Brand label */}
      <div
        className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-3 pointer-events-none"
        style={{ opacity: Math.min(1, opacity * 2) }}
      >
        <p className="text-xs font-bold tracking-[0.35em] uppercase text-indigo-300/70">
          TeleMedSecure
        </p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
