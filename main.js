import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js?module';

import {
  // Core
  BALL_RADIUS, FIST_RADIUS, SPAWN_DISTANCE, SIDE_OFFSET, SIDE_OFFSET_TIGHT, TIGHT_PROB,
  BALL_SPEED, SPAWN_INTERVAL, PUNCH_SPEED, SPAWN_MAX_BELOW, MISS_PLANE_OFFSET, SPAWN_BIAS,
  // Drift
  DRIFT_ENABLED, DRIFT_MIN_AMPLITUDE, DRIFT_MAX_AMPLITUDE, DRIFT_MIN_FREQ, DRIFT_MAX_FREQ,
  // Feedback
  AUDIO_ENABLED, HAPTICS_ENABLED,
  // Hazards
  HAZARD_ENABLED, HAZARD_PROB, HAZARD_RADIUS, HAZARD_SPEED, HAZARD_PENALTY,
  // Modes
  GAME_MODE, SPRINT_DURATION, COMBO_STEP, COMBO_MAX_MULT,
  // Debug/Control
  FORCE_HAZARD_EVERY_N, DEBUG_HAZARD_RING_MS
} from './config.js';

import { createHUD } from './hud.js';
import { FistsManager } from './fists.js';
import { loadBall, isBallReady, makeBall, setOpacity } from './ball.js';
import { createHazard } from './hazard.js';
import { hitSound, missSound, penaltySound } from './audio.js';

// ---------- Basis Setup ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

document.body.appendChild(ARButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'hand-tracking']
}));

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Initial Pose Lock ----------
let poseLocked = false;
const iPos = new THREE.Vector3();
const iQuat = new THREE.Quaternion();
const iForward = new THREE.Vector3();
const iUp = new THREE.Vector3();
const iRight = new THREE.Vector3();

function lockInitialPose() {
  iPos.setFromMatrixPosition(camera.matrixWorld);
  iQuat.copy(camera.quaternion);
  iForward.set(0, 0, -1).applyQuaternion(iQuat).normalize();
  iUp.set(0, 1, 0).applyQuaternion(iQuat).normalize();
  iRight.crossVectors(iForward, iUp).normalize();
  poseLocked = true;
  hud.place({ iPos, iForward, iRight });
}

renderer.xr.addEventListener('sessionstart', () => { poseLocked = false; });

// ---------- HUD ----------
const hud = createHUD(scene);
hud.plane.renderOrder = 10;
hud.plane.material.depthWrite = false;
hud.plane.material.depthTest  = false;

// ---------- Fäuste ----------
const fistsMgr = new FistsManager(renderer, scene);

// ---------- Haptik ----------
function rumble(intensity = 0.8, durationMs = 60) {
  if (!HAPTICS_ENABLED) return;
  const session = renderer.xr.getSession?.();
  if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad;
    if (!gp || !gp.hapticActuators) continue;
    const act = gp.hapticActuators[0];
    if (!act) continue;
    if (typeof act.pulse === 'function') {
      try { act.pulse(intensity, durationMs); } catch {}
    } else if (typeof act.playEffect === 'function') {
      try {
        act.playEffect('dual-rumble', {
          startDelay: 0, duration: durationMs,
          weakMagnitude: intensity, strongMagnitude: intensity
        });
      } catch {}
    }
  }
}

// ---------- Ball/Hazard Assets ----------
await loadBall();

const balls   = []; // { obj, velocity, alive, spin, spinAxis, spinSpeed, prevDot, t, driftAmp, driftOmega, driftPhase, prevLateral }
const hazards = []; // { obj, velocity, alive, prevDot }

// ---------- Score/Combo/Timer ----------
let hits = 0, misses = 0, score = 0, streak = 0;
let gameMode = GAME_MODE; // 'endless' | 'sprint60'
let timeLeft = (gameMode === 'sprint60') ? SPRINT_DURATION : null;
const BEST_KEY = 'arpunch_best_sprint60';
let best = (gameMode === 'sprint60') ? (Number(localStorage.getItem(BEST_KEY)) || 0) : null;

function comboMultiplier() {
  if (streak <= 0) return 1;
  const mult = 1 + Math.floor(streak / COMBO_STEP);
  return Math.min(COMBO_MAX_MULT, mult);
}

function updateHUD(note = '') {
  hud.set({ hits, misses, score, streak, mode: gameMode, timeLeft, best, note });
}

// ---------- Helpers ----------
function randRange(a, b) { return a + Math.random() * (b - a); }

// Debug-Ring genau an gegebener Position
function flashSpawnRingAt(pos) {
  if (!DEBUG_HAZARD_RING_MS || DEBUG_HAZARD_RING_MS <= 0) return;
  const ringG = new THREE.TorusGeometry(0.12, 0.012, 8, 24);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ring = new THREE.Mesh(ringG, ringM);
  ring.position.copy(pos);
  const lookTarget = new THREE.Vector3().copy(ring.position).sub(iForward);
  ring.lookAt(lookTarget);
  scene.add(ring);
  setTimeout(() => scene.remove(ring), DEBUG_HAZARD_RING_MS);
}

// ---------- Spawner ----------
function spawnBall(sideSign) {
  if (!isBallReady() || !poseLocked) return;

  const sideMag = Math.random() < TIGHT_PROB ? SIDE_OFFSET_TIGHT : SIDE_OFFSET;
  const heightOffset = -Math.random() * SPAWN_MAX_BELOW; // [0, -0.70]

  const spawnPos = new THREE.Vector3()
    .copy(iPos)
    .addScaledVector(iForward, (SPAWN_DISTANCE - SPAWN_BIAS))
    .addScaledVector(iRight, sideMag * sideSign)
    .addScaledVector(iUp, heightOffset);

  const velocity = new THREE.Vector3().copy(iForward).multiplyScalar(-BALL_SPEED);

  const obj = makeBall();
  obj.position.copy(spawnPos);
  scene.add(obj);

  const spin = Math.random() < 0.5;
  let spinAxis = null, spinSpeed = 0;
  if (spin) {
    spinAxis = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize();
    spinSpeed = THREE.MathUtils.lerp(0.5, 2.0, Math.random()); // rad/s
  }

  const prevDot = new THREE.Vector3().subVectors(spawnPos, iPos).dot(iForward);

  const driftAmp   = DRIFT_ENABLED ? randRange(DRIFT_MIN_AMPLITUDE, DRIFT_MAX_AMPLITUDE) : 0.0;
  const driftFreq  = DRIFT_ENABLED ? randRange(DRIFT_MIN_FREQ, DRIFT_MAX_FREQ) : 0.0;
  const driftOmega = DRIFT_ENABLED ? (2 * Math.PI * driftFreq) : 0.0;
  const driftPhase = Math.random() * Math.PI * 2;

  balls.push({
    obj, velocity, alive: true, spin, spinAxis, spinSpeed,
    prevDot, t: 0,
    driftAmp, driftOmega, driftPhase, prevLateral: 0
  });
}

function spawnHazard(sideSign) {
  if (!poseLocked) return null;

  const sideMag = Math.random() < 0.5 ? SIDE_OFFSET : SIDE_OFFSET_TIGHT;
  const heightOffset = -Math.random() * SPAWN_MAX_BELOW;

  const spawnPos = new THREE.Vector3()
    .copy(iPos)
    .addScaledVector(iForward, (SPAWN_DISTANCE - SPAWN_BIAS))
    .addScaledVector(iRight, sideMag * sideSign)
    .addScaledVector(iUp, heightOffset);

  const velocity = new THREE.Vector3().copy(iForward).multiplyScalar(-HAZARD_SPEED);

  const obj = createHazard();
  obj.position.copy(spawnPos);
  scene.add(obj);

  const prevDot = new THREE.Vector3().subVectors(spawnPos, iPos).dot(iForward);

  hazards.push({ obj, velocity, alive: true, prevDot });
  return spawnPos.clone(); // für Debug-Ring
}

// ---------- Events ----------
function onBallHit(b) {
  b.alive = false;
  setOpacity(b.obj, 0.25);
  setTimeout(() => { scene.remove(b.obj); }, 60);

  hits++;
  streak++;
  const mult = comboMultiplier();
  score += 1 * mult;

  if (AUDIO_ENABLED) hitSound();
  rumble(0.9, 60);
  updateHUD();
}

function onBallMiss(b) {
  b.alive = false;
  scene.remove(b.obj);

  misses++;
  streak = 0;
  if (AUDIO_ENABLED) missSound();
  rumble(0.25, 40);
  updateHUD();
}

function onHazardHit(h) {
  h.alive = false;
  scene.remove(h.obj);

  streak = 0;
  score = Math.max(0, score - HAZARD_PENALTY);
  if (AUDIO_ENABLED) penaltySound();
  rumble(1.0, 80);
  updateHUD();
}

// ---------- Collision ----------
function fistsHit(ballPos, fists) {
  for (const f of fists) {
    const toBall = new THREE.Vector3().subVectors(ballPos, f.pos);
    const dist = toBall.length();
    if (dist <= (BALL_RADIUS + FIST_RADIUS)) {
      if (f.vel.length() >= PUNCH_SPEED && toBall.dot(f.vel) > 0) {
        return true;
      }
    }
  }
  return false;
}

function fistsHitHazard(hPos, fists) {
  for (const f of fists) {
    const toHaz = new THREE.Vector3().subVectors(hPos, f.pos);
    const dist = toHaz.length();
    if (dist <= (HAZARD_RADIUS + FIST_RADIUS)) {
      if (f.vel.length() >= PUNCH_SPEED && toHaz.dot(f.vel) > 0) {
        return true;
      }
    }
  }
  return false;
}

// ---------- Game Loop ----------
const clock = new THREE.Clock();
let spawnTimer = 0;
let sideSwitch = 1;    // +1, -1, +1, ...
let spawnCount = 0;    // für erzwungene Hazards

function loop() {
  const dt = clock.getDelta();

  if (renderer.xr.isPresenting && !poseLocked) {
    lockInitialPose();
    if (gameMode === 'sprint60') {
      timeLeft = SPRINT_DURATION;
    } else {
      timeLeft = null;
    }
    updateHUD();
  }

  const fists = fistsMgr.update(dt); // [{pos, vel}, ...]

  // Timer & Spawn-Freigabe
  let canSpawn = true;
  if (gameMode === 'sprint60' && timeLeft !== null) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      canSpawn = false;
      if (best !== null && score > best) {
        best = score;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch {}
      }
    }
  }

  // Spawner
  spawnTimer += dt;
  if (canSpawn && spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer = 0;
    spawnCount++;
    const side = sideSwitch; sideSwitch *= -1;

    const forceHaz = (typeof FORCE_HAZARD_EVERY_N === 'number'
                      && FORCE_HAZARD_EVERY_N > 0
                      && (spawnCount % FORCE_HAZARD_EVERY_N === 0));

    if (HAZARD_ENABLED && (forceHaz || Math.random() < HAZARD_PROB)) {
      const pos = spawnHazard(side);
      if (pos) flashSpawnRingAt(pos);
    } else {
      spawnBall(side);
    }
  }

  // --- Balls ---
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (!b.alive) { balls.splice(i, 1); continue; }

    // Vorwärts
    b.obj.position.addScaledVector(b.velocity, dt);

    // Drift
    if (DRIFT_ENABLED && b.driftAmp > 0 && b.driftOmega > 0) {
      b.t += dt;
      const lateral = b.driftAmp * Math.sin(b.driftOmega * b.t + b.driftPhase);
      const deltaLat = lateral - b.prevLateral;
      b.obj.position.addScaledVector(iRight, deltaLat);
      b.prevLateral = lateral;
    }

    // Rotation
    if (b.spin) b.obj.rotateOnAxis(b.spinAxis, b.spinSpeed * dt);

    // Treffer
    const ballPos = b.obj.getWorldPosition(new THREE.Vector3());
    if (fistsHit(ballPos, fists)) { onBallHit(b); balls.splice(i, 1); continue; }

    // Miss: initiale Ebene überschritten?
    const currDot = new THREE.Vector3().subVectors(b.obj.position, iPos).dot(iForward);
    if (b.prevDot > MISS_PLANE_OFFSET && currDot <= MISS_PLANE_OFFSET) {
      onBallMiss(b); balls.splice(i, 1); continue;
    }
    b.prevDot = currDot;

    // Safety
    if (currDot < -6.0) {
      b.alive = false; scene.remove(b.obj); balls.splice(i, 1); continue;
    }
  }

  // --- Hazards ---
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (!h.alive) { hazards.splice(i, 1); continue; }

    h.obj.position.addScaledVector(h.velocity, dt);
    // dezente Eigenrotation
    const ax = h.obj.userData.spinAxis, sp = h.obj.userData.spinSpeed;
    if (ax && sp) h.obj.rotateOnAxis(ax, sp * dt);

    const hPos = h.obj.getWorldPosition(new THREE.Vector3());
    if (fistsHitHazard(hPos, fists)) { onHazardHit(h); hazards.splice(i, 1); continue; }

    const currDot = new THREE.Vector3().subVectors(h.obj.position, iPos).dot(iForward);
    // Hazard erreicht/überschreitet Ebene -> neutral entfernen
    if (h.prevDot > MISS_PLANE_OFFSET && currDot <= MISS_PLANE_OFFSET) {
      h.alive = false; scene.remove(h.obj); hazards.splice(i, 1); continue;
    }
    h.prevDot = currDot;

    if (currDot < -6.0) {
      h.alive = false; scene.remove(h.obj); hazards.splice(i, 1); continue;
    }
  }

  updateHUD(timeLeft === 0 ? 'Zeit!' : '');
  renderer.render(scene, camera);
}

// ---------- Start ----------
async function start() {
  try { await loadBall(); } catch (e) { console.error('ball.glb konnte nicht geladen werden:', e); }
  renderer.setAnimationLoop(loop);
}

renderer.xr.addEventListener('sessionend', () => {
  for (const b of balls) scene.remove(b.obj);
  for (const h of hazards) scene.remove(h.obj);
  balls.length = 0; hazards.length = 0;
});

start();
