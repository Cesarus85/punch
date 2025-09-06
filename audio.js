import { AUDIO_ENABLED, MUSIC_ENABLED, setBpm } from './config.js';
import { resetBeats } from './beat.js';

let ctx = null;
let musicSource = null;

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
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

function getPeaksAtThreshold(data, threshold){
  const peaks = [];
  for (let i = 0; i < data.length; i++){
    if (data[i] > threshold){
      peaks.push(i);
      i += 10000; // skip forward to avoid multiple detections
    }
  }
  return peaks;
}

function countIntervalsBetweenNearbyPeaks(peaks){
  const intervals = [];
  for (let i = 0; i < peaks.length; i++){
    for (let j = i + 1; j < peaks.length && j < i + 10; j++){
      intervals.push(peaks[j] - peaks[i]);
    }
  }
  return intervals;
}

function groupNeighborsByTempo(intervals, sampleRate){
  const tempoCounts = {};
  intervals.forEach(interval => {
    let theoreticalTempo = 60 * sampleRate / interval;
    while (theoreticalTempo < 90) theoreticalTempo *= 2;
    while (theoreticalTempo > 180) theoreticalTempo /= 2;
    const tempo = Math.round(theoreticalTempo);
    tempoCounts[tempo] = (tempoCounts[tempo] || 0) + 1;
  });
  return Object.entries(tempoCounts).map(([tempo, count]) => ({ tempo: +tempo, count }))
    .sort((a,b) => b.count - a.count);
}

function estimateBpm(buffer){
  const data = buffer.getChannelData(0);
  const peaks = getPeaksAtThreshold(data, 0.9);
  const intervals = countIntervalsBetweenNearbyPeaks(peaks);
  const groups = groupNeighborsByTempo(intervals, buffer.sampleRate);
  return groups.length ? groups[0].tempo : 120;
}

export async function playMusic(url){
  if (!AUDIO_ENABLED || !MUSIC_ENABLED) return;
  if (!ensureCtx()) return;
  if (musicSource){ musicSource.stop(); musicSource.disconnect(); }
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buf);
    const bpm = estimateBpm(audioBuffer);
    setBpm(bpm);
    resetBeats();
    musicSource = ctx.createBufferSource();
    musicSource.buffer = audioBuffer;
    musicSource.connect(ctx.destination);
    musicSource.start();
  } catch(err){
    console.error('playMusic failed', err);
  }
}

export function pauseMusic(){
  if (ctx && ctx.state === 'running'){ ctx.suspend(); }
}

export function resumeMusic(){
  if (ctx && ctx.state === 'suspended'){ ctx.resume(); }
}

export function stopMusic(){
  if (musicSource){
    try{ musicSource.stop(); }catch{}
    musicSource.disconnect();
    musicSource = null;
  }
}
