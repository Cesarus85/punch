import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js?module';

import {
  BALL_RADIUS, FIST_RADIUS, SPAWN_DISTANCE, SIDE_OFFSET, SIDE_OFFSET_TIGHT, TIGHT_PROB,
  BALL_SPEED, SPAWN_INTERVAL, PUNCH_SPEED, SPAWN_MAX_BELOW, MISS_PLANE_OFFSET,
  HUD_PLANE_H, SPAWN_BIAS,
  DRIFT_ENABLED, DRIFT_MIN_AMPLITUDE, DRIFT_MAX_AMPLITUDE, DRIFT_MIN_FREQ, DRIFT_MAX_FREQ,
  AUDIO_ENABLED, HAPTICS_ENABLED
} from './config.js';

import { createHUD } from './hud.js';
import { FistsManager } from './fists.js';
import { loadBall, isBallReady, makeBall, setOpacity } from './ball.js';
import { hitSound, missSound } from './audio.js';

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
let hits = 0, misses = 0;
// HUD-Depth aus (kleiner Stabilitäts-Boost)
hud.plane.renderOrder = 10;
hud.plane.material.depthWrite = false;
hud.plane.material.depthTest  = false;

// ---------- Fäuste (Controller + Hände) ----------
const fistsMgr = new FistsManager(renderer, scene);

// ---------- Haptics ----------
function rumble(intensity = 0.8, durationMs = 60) {
  if (!HAPTICS_ENABLED) return;
  const session = renderer.xr.getSession?.();
  if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad;
    if (!gp || !gp.hapticActuators) continue;
    const act = gp.hapticActuators[0];
    if (!act) continue;
    // Browser-Varianten
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

// ---------- Ball Handling ----------
await loadBall();
const balls = []; // { obj, velocity, alive, spin, spinAxis, spinSpeed, prevDot, t, driftAmp, driftOmega, driftPhase, prevLateral }

function randRange(a, b) { return a + Math.random() * (b - a); }

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

  // Zufallsrotation: mal ja, mal nein
  const spin = Math.random() < 0.5;
  let spinAxis = null, spinSpeed = 0;
  if (spin) {
    spinAxis = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize();
    spinSpeed = THREE.MathUtils.lerp(0.5, 2.0, Math.random()); // rad/s
  }

  const prevDot = new THREE.Vector3().subVectors(spawnPos, iPos).dot(iForward);

  // Sinus-Drift (seitlich) – pro Ball eigene Parameter
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

function hitBall(b) {
  b.alive = false;
  // optional Fade-Out (Materiale sind unique → kein globales Blinken)
  setOpacity(b.obj, 0.25);
  setTimeout(() => { scene.remove(b.obj); }, 60);
  hits++; hud.set(hits, misses);
  if (AUDIO_ENABLED) hitSound();
  rumble(0.9, 60);
}

function missBall(b) {
  b.alive = false;
  scene.remove(b.obj);
  misses++; hud.set(hits, misses);
  if (AUDIO_ENABLED) missSound();
  rumble(0.25, 40);
}

// ---------- Collision ----------
function fistsBallCollision(ballPos, fists) {
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

// ---------- Game Loop ----------
const clock = new THREE.Clock();
let spawnTimer = 0;
let sideSwitch = 1; // +1, -1, +1, ...

function loop() {
  const dt = clock.getDelta();

  if (renderer.xr.isPresenting && !poseLocked) {
    lockInitialPose();
  }

  const fists = fistsMgr.update(dt); // [{pos, vel}, ...]

  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnBall(sideSwitch);
    sideSwitch *= -1;
    spawnTimer = 0;
  }

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (!b.alive) { balls.splice(i, 1); continue; }

    // Vorwärtsbewegung
    b.obj.position.addScaledVector(b.velocity, dt);

    // Seitendrift (additiv, differenziell, damit keine „Doppelsumme“)
    if (DRIFT_ENABLED && b.driftAmp > 0 && b.driftOmega > 0) {
      b.t += dt;
      const lateral = b.driftAmp * Math.sin(b.driftOmega * b.t + b.driftPhase);
      const deltaLat = lateral - b.prevLateral;
      b.obj.position.addScaledVector(iRight, deltaLat);
      b.prevLateral = lateral;
    }

    // Optional: Rotation
    if (b.spin) b.obj.rotateOnAxis(b.spinAxis, b.spinSpeed * dt);

    // Treffer zuerst prüfen
    const ballPos = b.obj.getWorldPosition(new THREE.Vector3());
    if (fistsBallCollision(ballPos, fists)) {
      hitBall(b); balls.splice(i, 1); continue;
    }

    // Miss: initiale Ebene überschritten?
    const currDot = new THREE.Vector3().subVectors(b.obj.position, iPos).dot(iForward);
    if (b.prevDot > MISS_PLANE_OFFSET && currDot <= MISS_PLANE_OFFSET) {
      missBall(b); balls.splice(i, 1); continue;
    }
    b.prevDot = currDot;

    // Safety: weit hinter Ebene -> entfernen
    if (currDot < -6.0) {
      b.alive = false; scene.remove(b.obj); balls.splice(i, 1); continue;
    }
  }

  renderer.render(scene, camera);
}

// ---------- Start ----------
async function start() {
  try { await loadBall(); } catch (e) { console.error('ball.glb konnte nicht geladen werden:', e); }
  renderer.setAnimationLoop(loop);
}

renderer.xr.addEventListener('sessionend', () => {
  for (const b of balls) scene.remove(b.obj);
  balls.length = 0;
});

start();
