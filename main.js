import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js?module';

import {
  BALL_RADIUS, FIST_RADIUS, SPAWN_DISTANCE, SIDE_OFFSET, SIDE_OFFSET_TIGHT,
  BALL_SPEED, SPAWN_INTERVAL, PUNCH_SPEED, SPAWN_MAX_BELOW, MISS_PLANE_OFFSET, SPAWN_BIAS,
  DRIFT_MIN_AMPLITUDE, DRIFT_MAX_AMPLITUDE, DRIFT_MIN_FREQ, DRIFT_MAX_FREQ,
  AUDIO_ENABLED, HAPTICS_ENABLED,
  HAZARD_ENABLED, HAZARD_PROB, HAZARD_RADIUS, HAZARD_SPEED, HAZARD_PENALTY,
  GAME_MODE, SPRINT_DURATION, COMBO_STEP, COMBO_MAX_MULT,
  DEBUG_HAZARD_RING_MS
} from './config.js';

import { createHUD } from './hud.js';
import { FistsManager } from './fists.js';
import { loadBall, isBallReady, makeBall, setOpacity } from './ball.js';
import { createHazard } from './hazard.js';
import { hitSound, missSound, penaltySound } from './audio.js';
import { createMenu } from './menu.js';

// ---------- Basis ----------
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

// ---------- Initial Pose ----------
let poseLocked = false;
const iPos = new THREE.Vector3(), iQuat = new THREE.Quaternion();
const iForward = new THREE.Vector3(), iUp = new THREE.Vector3(), iRight = new THREE.Vector3();

function lockInitialPose() {
  iPos.setFromMatrixPosition(camera.matrixWorld);
  iQuat.copy(camera.quaternion);
  iForward.set(0, 0, -1).applyQuaternion(iQuat).normalize();
  iUp.set(0, 1, 0).applyQuaternion(iQuat).normalize();
  iRight.crossVectors(iForward, iUp).normalize();
  poseLocked = true;

  hud.place({ iPos, iForward, iRight });
  hud.plane.visible = false; // HUD erst nach Countdown

  menu.placeAt(iPos, iForward, iUp);
  menu.setMode('prestart');
  menu.setVisible(true);
  setRayVisible(true);        // Raycasts nur im Menü
  game.menuActive = true;
  game.running = false;
}
renderer.xr.addEventListener('sessionstart', () => { poseLocked = false; });

// ---------- HUD ----------
const hud = createHUD(scene);
hud.plane.renderOrder = 10;
hud.plane.material.depthWrite = false;
hud.plane.material.depthTest  = false;
hud.plane.visible = false;

// ---------- Fäuste ----------
const fistsMgr = new FistsManager(renderer, scene, { showControllerModels: true, sphereVisRadius: 0.03 });

// ---------- Haptik ----------
function rumble(intensity = 0.8, durationMs = 60) {
  if (!HAPTICS_ENABLED) return;
  const session = renderer.xr.getSession?.(); if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad; if (!gp || !gp.hapticActuators) continue;
    const act = gp.hapticActuators[0]; if (!act) continue;
    if (typeof act.pulse === 'function') { try { act.pulse(intensity, durationMs); } catch {} }
    else if (typeof act.playEffect === 'function') {
      try { act.playEffect('dual-rumble', { startDelay: 0, duration: durationMs, weakMagnitude: intensity, strongMagnitude: intensity }); } catch {}
    }
  }
}

// ---------- Menü ----------
const DIFF_LABELS = ['Anfänger', 'Aufsteiger', 'Profi'];
const SPEED_LABELS = ['Langsam', 'Mittel', 'Schnell'];
const DIFFICULTY_DRIFT = { 'Anfänger': 1.00, 'Aufsteiger': 0.70, 'Profi': 0.25 };
const DOUBLE_STRAIGHT_PROB = 0.28;
const SPEED_PRESETS = { 'Langsam': 0.85, 'Mittel': 1.0, 'Schnell': 1.25 };

const menu = createMenu(DIFF_LABELS, SPEED_LABELS);
menu.group.visible = false;
scene.add(menu.group);

// ---------- Countdown ----------
let countdown = { active:false, time:0, plane:null, ctx:null, tex:null };
function ensureCountdownPlane() {
  if (countdown.plane) return;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true, depthWrite:false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), mat);
  plane.visible = false; scene.add(plane);
  countdown = { active:false, time:0, plane, ctx, tex };
}
function drawCountdown(n) {
  const { ctx, tex } = countdown;
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 180px system-ui, Arial';
  const text = String(n), tw = ctx.measureText(text).width;
  ctx.fillText(text, (ctx.canvas.width - tw)/2, 190);
  tex.needsUpdate = true;
}
function placeCountdown() {
  const pos = new THREE.Vector3().copy(iPos).addScaledVector(iForward, 1.0);
  const look = new THREE.Vector3().copy(pos).sub(iForward);
  countdown.plane.position.copy(pos);
  countdown.plane.lookAt(look);
}
function beginCountdown() {
  const sel = menu.getSelection();
  applyGamePreset(DIFF_LABELS[sel.difficultyIndex], SPEED_LABELS[sel.speedIndex]);
  hardResetRound();
  menu.setVisible(false);
  setRayVisible(false);
  game.menuActive = false;

  ensureCountdownPlane();
  placeCountdown();
  countdown.active = true;
  countdown.time = 3.999;
  drawCountdown(3);
}

// ---------- Game-State & Presets ----------
const game = { menuActive: true, running: false };
const tuning = {
  spawnInterval: SPAWN_INTERVAL,
  straightShare: 1.0,
  hazardProb: HAZARD_PROB,
  ballSpeed: BALL_SPEED,
  hazardSpeed: HAZARD_SPEED,
  driftMinAmp: DRIFT_MIN_AMPLITUDE, driftMaxAmp: DRIFT_MAX_AMPLITUDE,
  driftMinFreq: DRIFT_MIN_FREQ,     driftMaxFreq: DRIFT_MAX_FREQ
};
function applyGamePreset(diffName, speedName) {
  tuning.straightShare = DIFFICULTY_DRIFT[diffName] ?? 1.0;
  const sMul = SPEED_PRESETS[speedName] ?? 1.0;
  tuning.ballSpeed   = BALL_SPEED   * sMul;
  tuning.hazardSpeed = HAZARD_SPEED * sMul;
  tuning.spawnInterval = SPAWN_INTERVAL;
  tuning.hazardProb    = HAZARD_PROB;
  hud.set({ note: `${diffName} · ${speedName}` }); // erscheint nach Countdown
}

// ---------- Assets & Score ----------
await loadBall();
const balls = []; const hazards = [];
let hits = 0, misses = 0, score = 0, streak = 0;
let gameMode = GAME_MODE; let timeLeft = (gameMode === 'sprint60') ? SPRINT_DURATION : null;
const BEST_KEY = 'arpunch_best_sprint60';
let best = (gameMode === 'sprint60') ? (Number(localStorage.getItem(BEST_KEY)) || 0) : null;

function comboMultiplier(){ if (streak<=0) return 1; const m=1+Math.floor(streak/COMBO_STEP); return Math.min(COMBO_MAX_MULT,m); }
function updateHUD(note=''){ hud.set({ hits, misses, score, streak, mode: gameMode, timeLeft, best, note }); }

// ---------- Debug-Ring ----------
function flashSpawnRingAt(pos){
  if (!DEBUG_HAZARD_RING_MS) return;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 24), new THREE.MeshBasicMaterial({ color:0xffffff }));
  ring.position.copy(pos); const look = new THREE.Vector3().copy(pos).sub(iForward);
  ring.lookAt(look); scene.add(ring); setTimeout(()=>scene.remove(ring), DEBUG_HAZARD_RING_MS);
}

// ---------- Spawner ----------
function randRange(a,b){ return a + Math.random()*(b-a); }
function spawnBall(sideSign, { forceStraight=false } = {}){
  if (!isBallReady() || !poseLocked) return;
  const sideMag = Math.random() < 0.5 ? SIDE_OFFSET_TIGHT : SIDE_OFFSET;
  const heightOffset = -Math.random() * SPAWN_MAX_BELOW;
  const spawnPos = new THREE.Vector3().copy(iPos).addScaledVector(iForward, (SPAWN_DISTANCE - SPAWN_BIAS)).addScaledVector(iRight, sideMag*sideSign).addScaledVector(iUp, heightOffset);
  const obj = makeBall(); obj.position.copy(spawnPos); scene.add(obj);
  const velocity = new THREE.Vector3().copy(iForward).multiplyScalar(-tuning.ballSpeed);

  const spin = Math.random() < 0.5; let spinAxis=null, spinSpeed=0;
  if (spin){ spinAxis = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize(); spinSpeed = THREE.MathUtils.lerp(0.5,2.0,Math.random()); }
  const prevDot = new THREE.Vector3().subVectors(spawnPos, iPos).dot(iForward);

  let driftAmp=0, driftOmega=0, driftPhase=0;
  if (!forceStraight){ driftAmp = randRange(tuning.driftMinAmp, tuning.driftMaxAmp); const f = randRange(tuning.driftMinFreq, tuning.driftMaxFreq); driftOmega = 2*Math.PI*f; driftPhase = Math.random()*Math.PI*2; }

  balls.push({ obj, velocity, alive:true, spin, spinAxis, spinSpeed, prevDot, t:0, driftAmp, driftOmega, driftPhase, prevLateral:0 });
}
function spawnHazard(sideSign){
  if (!poseLocked) return null;
  const sideMag = Math.random() < 0.5 ? SIDE_OFFSET : SIDE_OFFSET_TIGHT;
  const heightOffset = -Math.random() * SPAWN_MAX_BELOW;
  const spawnPos = new THREE.Vector3().copy(iPos).addScaledVector(iForward, (SPAWN_DISTANCE - SPAWN_BIAS)).addScaledVector(iRight, sideMag*sideSign).addScaledVector(iUp, heightOffset);
  const obj = createHazard(); obj.position.copy(spawnPos); scene.add(obj);
  const velocity = new THREE.Vector3().copy(iForward).multiplyScalar(-tuning.hazardSpeed);
  const prevDot = new THREE.Vector3().subVectors(spawnPos, iPos).dot(iForward);
  hazards.push({ obj, velocity, alive:true, prevDot }); return spawnPos.clone();
}

// ---------- Events ----------
function onBallHit(b){ b.alive=false; setOpacity(b.obj,0.25); setTimeout(()=>scene.remove(b.obj),60); hits++; streak++; score+=comboMultiplier(); if(AUDIO_ENABLED)hitSound(); rumble(0.9,60); updateHUD(); }
function onBallMiss(b){ b.alive=false; scene.remove(b.obj); misses++; streak=0; if(AUDIO_ENABLED)missSound(); rumble(0.25,40); updateHUD(); }
function onHazardHit(h){ h.alive=false; scene.remove(h.obj); streak=0; score=Math.max(0, score-HAZARD_PENALTY); if(AUDIO_ENABLED)penaltySound(); rumble(1.0,80); updateHUD(); }

// ---------- Collision ----------
function fistsHit(ballPos, fists){
  for (const f of fists){ const d = new THREE.Vector3().subVectors(ballPos, f.pos); if (d.length() <= (BALL_RADIUS + FIST_RADIUS) && f.vel.length() >= PUNCH_SPEED && d.dot(f.vel) > 0) return true; }
  return false;
}
function fistsHitHazard(hPos, fists){
  for (const f of fists){ const d = new THREE.Vector3().subVectors(hPos, f.pos); if (d.length() <= (HAZARD_RADIUS + FIST_RADIUS) && f.vel.length() >= PUNCH_SPEED && d.dot(f.vel) > 0) return true; }
  return false;
}

// ---------- Round Control ----------
function hardResetRound(){
  for (const b of [...balls]) scene.remove(b.obj);
  for (const h of [...hazards]) scene.remove(h.obj);
  balls.length=0; hazards.length=0;
  hits=0; misses=0; score=0; streak=0;
  timeLeft = (gameMode==='sprint60') ? SPRINT_DURATION : null;
  updateHUD('');
}

// ---------- Controller Rays: nur im Menü sichtbar ----------
const raycaster = new THREE.Raycaster();
const ctrls = [renderer.xr.getController(0), renderer.xr.getController(1)];
const rayLines = [];
for (let i=0;i<ctrls.length;i++){
  const c = ctrls[i]; scene.add(c);
  const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1.7)]);
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ transparent:true, opacity:0.85 }));
  c.add(line); rayLines.push(line);
  c.addEventListener('selectstart', () => {
    if (!game.menuActive) return; // im Spiel deaktiviert
    const origin = new THREE.Vector3(), dir = new THREE.Vector3(0,0,-1);
    c.getWorldPosition(origin); dir.applyQuaternion(c.quaternion).normalize();
    raycaster.set(origin, dir);
    const hovered = menu.updateHover(raycaster);
    const action = menu.click(hovered);
    if (!action) return;
    if (action.action === 'start' || action.action === 'restart') beginCountdown();
    else if (action.action === 'resume') { menu.setVisible(false); setRayVisible(false); game.menuActive=false; hud.plane.visible=true; game.running=true; }
    else if (action.action === 'quit')   { hardResetRound(); menu.setMode('prestart'); /* im Menü bleiben */ }
  });
}
function setRayVisible(v){ rayLines.forEach(l=>l.visible = v); }

// ---------- Face-Button (untere Taste) zum Menü öffnen ----------
function isRisingEdgeFaceLower(gp, key, store){
  if (!gp || !gp.buttons || gp.buttons.length===0) return false;
  // Robust: prüfe mehrere Indizes (Quest: häufig 3/4; Fallback 2=Stick-Klick)
  const indices = [3,4,2].filter(i => i < gp.buttons.length);
  let pressed = false;
  for (const i of indices){ if (gp.buttons[i]?.pressed) { pressed = true; break; } }
  const prev = !!store[key]; store[key] = pressed;
  return (pressed && !prev);
}

// ---------- Game Loop ----------
const clock = new THREE.Clock();
let spawnTimer = 0, sideSwitch = 1;

function loop(){
  const dt = clock.getDelta();

  // Face-Button auf beiden Controllern: Menü öffnen (im Spiel)
  const session = renderer.xr.getSession?.();
  if (session){
    if (!loop._btnPrev) loop._btnPrev = {};
    for (const src of session.inputSources){
      const gp = src.gamepad;
      if (isRisingEdgeFaceLower(gp, `${src.handedness}:lower`, loop._btnPrev)){
        if (!game.menuActive){
          // Spiel pausieren -> Menü auf
          game.running = false;
          hardResetRound();
          hud.plane.visible = false;
          menu.placeAt(iPos, iForward, iUp);
          menu.setMode('ingame');
          menu.setVisible(true);
          setRayVisible(true);
          game.menuActive = true;
        }
      }
    }
  }

  if (renderer.xr.isPresenting && !poseLocked) {
    lockInitialPose();
    updateHUD('Konfigurieren & Starten');
  }

  // Menü-Hover nur im Menü
  if (game.menuActive) {
    // „Hover“ wird on-demand in selectstart gemacht – optional hier nicht nötig
  }

  // Countdown
  if (countdown.active){
    countdown.time -= dt; const n = Math.max(0, Math.ceil(countdown.time));
    drawCountdown(n); placeCountdown();
    if (countdown.time <= 0){
      countdown.active=false; countdown.plane.visible=false;
      hud.plane.visible = true; game.running = true; updateHUD('');
    } else {
      countdown.plane.visible = true;
    }
  }

  const fists = fistsMgr.update(dt);

  // Timer/Spawn nur wenn Spiel läuft
  let canSpawn = game.running;
  if (gameMode==='sprint60' && timeLeft!=null && game.running){
    timeLeft -= dt;
    if (timeLeft <= 0){
      timeLeft = 0; canSpawn=false;
      if (best!=null && score>best){ best=score; try{ localStorage.setItem(BEST_KEY,String(best)); }catch{} }
    }
  }

  // Spawner
  spawnTimer += dt;
  if (canSpawn && spawnTimer >= tuning.spawnInterval){
    spawnTimer = 0;
    const side = sideSwitch; sideSwitch *= -1;
    if (HAZARD_ENABLED && Math.random() < tuning.hazardProb){
      const pos = spawnHazard(side); if (pos) flashSpawnRingAt(pos);
    } else {
      const isStraight = Math.random() < tuning.straightShare;
      if (isStraight && Math.random() < DOUBLE_STRAIGHT_PROB){
        spawnBall(-1, { forceStraight:true });
        spawnBall(+1, { forceStraight:true });
      } else {
        spawnBall(side, { forceStraight:isStraight });
      }
    }
  }

  // Balls
  for (let i=balls.length-1; i>=0; i--){
    const b = balls[i]; if (!b.alive){ balls.splice(i,1); continue; }
    b.obj.position.addScaledVector(b.velocity, dt);
    if (b.driftAmp>0 && b.driftOmega>0){
      b.t += dt; const lateral = b.driftAmp * Math.sin(b.driftOmega*b.t + b.driftPhase);
      const delta = lateral - b.prevLateral; b.obj.position.addScaledVector(iRight, delta); b.prevLateral = lateral;
    }
    if (b.spin) b.obj.rotateOnAxis(b.spinAxis, b.spinSpeed*dt);
    const pos = b.obj.getWorldPosition(new THREE.Vector3());
    if (fistsHit(pos, fists)){ onBallHit(b); balls.splice(i,1); continue; }
    const dot = new THREE.Vector3().subVectors(b.obj.position, iPos).dot(iForward);
    if (b.prevDot > MISS_PLANE_OFFSET && dot <= MISS_PLANE_OFFSET){ onBallMiss(b); balls.splice(i,1); continue; }
    b.prevDot = dot; if (dot < -6.0){ b.alive=false; scene.remove(b.obj); balls.splice(i,1); }
  }

  // Hazards
  for (let i=hazards.length-1; i>=0; i--){
    const h = hazards[i]; if (!h.alive){ hazards.splice(i,1); continue; }
    h.obj.position.addScaledVector(h.velocity, dt);
    const ax=h.obj.userData.spinAxis, sp=h.obj.userData.spinSpeed; if (ax&&sp) h.obj.rotateOnAxis(ax, sp*dt);
    const pos = h.obj.getWorldPosition(new THREE.Vector3());
    if (fistsHitHazard(pos, fists)){ onHazardHit(h); hazards.splice(i,1); continue; }
    const dot = new THREE.Vector3().subVectors(h.obj.position, iPos).dot(iForward);
    if (h.prevDot > MISS_PLANE_OFFSET && dot <= MISS_PLANE_OFFSET){ h.alive=false; scene.remove(h.obj); hazards.splice(i,1); continue; }
    if (dot < -6.0){ h.alive=false; scene.remove(h.obj); hazards.splice(i,1); }
  }

  updateHUD(countdown.active ? '' : (game.menuActive ? 'Konfigurieren & Starten' : ''));
  renderer.render(scene, camera);
}

// ---------- Start ----------
async function start(){ try{ await loadBall(); }catch(e){ console.error('ball.glb konnte nicht geladen werden:', e); } renderer.setAnimationLoop(loop); }
renderer.xr.addEventListener('sessionend', () => {
  for (const b of balls) scene.remove(b.obj); for (const h of hazards) scene.remove(h.obj);
  balls.length=0; hazards.length=0; menu.setVisible(false); setRayVisible(false); game.menuActive=false; hud.plane.visible=false;
});
start();
