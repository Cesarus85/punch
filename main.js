import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js?module';

import {
  BALL_RADIUS, FIST_RADIUS, SPAWN_DISTANCE, SIDE_OFFSET, SIDE_OFFSET_TIGHT, TIGHT_PROB,
  BALL_SPEED, SPAWN_INTERVAL, PUNCH_SPEED, SPAWN_MAX_BELOW, MISS_PLANE_OFFSET
} from './config.js';

import { createHUD } from './hud.js';
import { FistsManager } from './fists.js';
import { loadBall, isBallReady, makeBall, setOpacity } from './ball.js';

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

// ---------- Fäuste (Controller + Hände) ----------
const fistsMgr = new FistsManager(renderer, scene);

// ---------- Ball Handling ----------
const balls = []; // { obj, velocity, alive, spin, spinAxis, spinSpeed, prevDot }

function spawnBall(sideSign) {
  if (!isBallReady() || !poseLocked) return;

  const sideMag = Math.random() < TIGHT_PROB ? SIDE_OFFSET_TIGHT : SIDE_OFFSET;
  const heightOffset = -Math.random() * SPAWN_MAX_BELOW; // [0, -0.70]

  const spawnPos = new THREE.Vector3()
    .copy(iPos)
    .addScaledVector(iForward, SPAWN_DISTANCE)
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

  balls.push({ obj, velocity, alive: true, spin, spinAxis, spinSpeed, prevDot });
}

function hitBall(b) {
  b.alive = false;
  setOpacity(b.obj, 0.25);
  setTimeout(() => { scene.remove(b.obj); }, 60);
  hits++; hud.set(hits, misses);
}

function missBall(b) {
  b.alive = false;
  scene.remove(b.obj);
  misses++; hud.set(hits, misses);
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

    b.obj.position.addScaledVector(b.velocity, dt);
    if (b.spin) b.obj.rotateOnAxis(b.spinAxis, b.spinSpeed * dt);

    const ballPos = b.obj.getWorldPosition(new THREE.Vector3());

    // Treffer zuerst prüfen
    if (fistsBallCollision(ballPos, fists)) {
      hitBall(b); balls.splice(i, 1); continue;
    }

    // Miss: initiale Ebene (durch iPos, senkrecht zu iForward) überschritten?
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
  try {
    await loadBall(); // GLB einmalig laden & skalieren
  } catch (e) {
    console.error('ball.glb konnte nicht geladen werden:', e);
  }
  renderer.setAnimationLoop(loop);
}

renderer.xr.addEventListener('sessionend', () => {
  for (const b of balls) scene.remove(b.obj);
  balls.length = 0;
});

start();
