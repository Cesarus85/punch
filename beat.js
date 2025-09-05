import { BEAT_DURATION } from './config.js';

const listeners = { 1:new Set(), 2:new Set(), 4:new Set() };
const timers = { 1:0, 2:0, 4:0 };

export function onBeat(subdivision, fn){
  if (!listeners[subdivision]) return () => {};
  listeners[subdivision].add(fn);
  return () => listeners[subdivision].delete(fn);
}

export function updateBeats(dt){
  for (const sub of [1,2,4]){
    const interval = BEAT_DURATION / sub;
    timers[sub] += dt;
    while (timers[sub] >= interval){
      timers[sub] -= interval;
      listeners[sub].forEach(cb => cb());
    }
  }
}
