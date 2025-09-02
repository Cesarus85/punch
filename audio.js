let ctx = null;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }
  return ctx;
}

function blip(freq = 600, durMs = 80, type = 'triangle', gain = 0.06) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime;
  const t1 = t0 + durMs / 1000;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  vol.gain.setValueAtTime(gain, t0);
  vol.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(vol).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t1);
}

export function hitSound()  { blip(700, 90, 'triangle', 0.08); }
export function missSound() { blip(420, 70, 'sine',     0.05); }
// Penalty = tiefer + leicht länger
export function penaltySound(){ blip(220, 120, 'sawtooth', 0.08); }
