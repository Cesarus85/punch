import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js?module';

import {
  BALL_RADIUS, FIST_RADIUS, SPAWN_DISTANCE, SIDE_OFFSET, SIDE_OFFSET_TIGHT,
  BALL_SPEED, SPAWN_INTERVAL, PUNCH_SPEED, SPAWN_MAX_BELOW, MISS_PLANE_OFFSET, SPAWN_BIAS,
  DRIFT_MIN_AMPLITUDE, DRIFT_MAX_AMPLITUDE, DRIFT_MIN_FREQ, DRIFT_MAX_FREQ,
  AUDIO_ENABLED, HAPTICS_ENABLED,
  HAZARD_ENABLED, HAZARD_PROB, HAZARD_RADIUS, HAZARD_SPEED, HAZARD_PENALTY,
  DEBUG_HAZARD_RING_MS,
  MIN_SPAWN_DISTANCE
} from './config.js';

import { createHUD } from './hud.js';
import { FistsManager } from './fists.js';
import { loadBall, isBallReady, getBallMesh, getBallAttribute, allocBall, freeBall } from './ball.js';
import { createHazard } from './hazard.js';
import { hitSound, missSound, penaltySound } from './audio.js';
import { createMenu } from './menu.js';
import { pickPattern } from './patterns.js'; // << NEU

/* ============================ Renderer ============================ */
const renderer = new THREE.WebGLRenderer({
  alpha: true, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
document.body.appendChild(renderer.domElement);
document.body.appendChild(ARButton.createButton(renderer, { optionalFeatures: ['local-floor','hand-tracking'] }));
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
window.addEventListener('resize', ()=>renderer.setSize(window.innerWidth, window.innerHeight));

renderer.xr.addEventListener('sessionstart', ()=>{
  poseLocked = false;
  renderer.setPixelRatio(1.2);
  if (renderer.xr.setFoveation) renderer.xr.setFoveation(1.0);
  if (renderer.xr.setFramebufferScaleFactor) renderer.xr.setFramebufferScaleFactor(0.85);
});

/* =================== Initial Pose (feste Blickrichtung) =================== */
let poseLocked = false;
const iPos = new THREE.Vector3(), iQuat = new THREE.Quaternion();
const iForward = new THREE.Vector3(), iUp = new THREE.Vector3(), iRight = new THREE.Vector3();

function lockInitialPose(){
  iPos.setFromMatrixPosition(camera.matrixWorld);
  iQuat.copy(camera.quaternion);
  iForward.set(0,0,-1).applyQuaternion(iQuat).normalize();
  iUp.set(0,1,0).applyQuaternion(iQuat).normalize();
  iRight.crossVectors(iForward, iUp).normalize();
  poseLocked = true;

  hud.place({ iPos, iForward, iRight });
  hud.plane.visible = false;

  menu.placeAt(iPos, iForward);
  menu.setMode('prestart');
  menu.setVisible(true);
  setLasersVisible(true);

  game.menuActive = true;
  game.running = false;
}
renderer.xr.addEventListener('sessionstart', ()=>{ poseLocked=false; });

/* ========================= HUD + Back Button ========================= */
const hud = createHUD(scene);
hud.plane.renderOrder = 10;
hud.plane.material.depthWrite = false;
hud.plane.material.depthTest  = false;
hud.plane.visible = false;

function makeUIButton(label, w=0.60, h=0.16){
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true, depthWrite:false });
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { _ctx:ctx, _tex:tex, label, hover:false };
  drawUIButton(mesh); return mesh;
}
function drawUIButton(btn){
  const { _ctx:ctx, _tex:tex, label, hover } = btn.userData;
  const W=ctx.canvas.width, H=ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#222c'; ctx.fillRect(0,0,W,H);
  if (hover){ ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.strokeRect(6,6,W-12,H-12); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 96px system-ui, Arial';
  const tw = ctx.measureText(label).width; ctx.fillText(label, (W-tw)/2, H*0.66);
  tex.needsUpdate = true;
}
const backBtn = makeUIButton('Zurück zum Menü', 0.58, 0.14);
scene.add(backBtn); backBtn.material.depthTest = false; backBtn.renderOrder = 11; backBtn.visible = false;

const BACK_BTN_OFFSET_M = 0.24;
function placeBackButton(){
  hud.plane.updateMatrixWorld();
  _v1.setFromMatrixPosition(hud.plane.matrixWorld);
  const upLocal  = _v2.set(0,1,0).applyQuaternion(hud.plane.quaternion);
  const fwdLocal = _v3.set(0,0,1).applyQuaternion(hud.plane.quaternion);
  backBtn.position.copy(_v1).addScaledVector(upLocal, -BACK_BTN_OFFSET_M).addScaledVector(fwdLocal, 0.012);
  backBtn.quaternion.copy(hud.plane.quaternion);
}

/* ======================== Fäuste / Haptik ======================== */
const fistsMgr = new FistsManager(renderer, scene, { showControllerModels:true, sphereVisRadius:0.03 });
function rumble(intensity=0.8, durationMs=60){
  if (!HAPTICS_ENABLED) return;
  const s = renderer.xr.getSession?.(); if (!s) return;
  for (const src of s.inputSources){
    const gp = src.gamepad; const act = gp?.hapticActuators?.[0]; if (!act) continue;
    if (typeof act.pulse === 'function'){ try{ act.pulse(intensity,durationMs); }catch{} }
    else if (typeof act.playEffect === 'function'){ try{ act.playEffect('dual-rumble',{startDelay:0,duration:durationMs,weakMagnitude:intensity,strongMagnitude:intensity}); }catch{} }
  }
}

/* =================== Menü / Presets / Zeitmodi =================== */
const DIFF_LABELS = ['Anfänger','Aufsteiger','Profi'];
const SPEED_LABELS = ['Langsam','Mittel','Schnell'];
const TIME_LABELS  = ['Endlos','1:00','3:00','5:00'];

const DIFFICULTY_STRAIGHT_SHARE = { 'Anfänger':1.00, 'Aufsteiger':0.70, 'Profi':0.25 };
const SPEED_PRESETS = { 'Langsam':0.85, 'Mittel':1.0, 'Schnell':1.25 };

// Extreme (immer gerade)
const WIDE_EXT_M = 0.20, DEEP_EXT_M = 0.20;
const EXT_PROB = { 'Anfänger':{wide:0.05,deep:0.05}, 'Aufsteiger':{wide:0.12,deep:0.12}, 'Profi':{wide:0.22,deep:0.22} };

// Vertikale S-Kurve: sanfter Downtrend
const VDRIFT_BIAS_MIN = 0.05, VDRIFT_BIAS_MAX = 0.15;

const menu = createMenu(DIFF_LABELS, SPEED_LABELS, TIME_LABELS);
menu.group.visible = false; scene.add(menu.group);

/* ====================== Countdown (throttled) ====================== */
let countdown = { active:false, time:0, plane:null, ctx:null, tex:null, lastDrawn:-1 };
function ensureCountdownPlane(){
  if (countdown.plane) return;
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=256;
  const ctx=canvas.getContext('2d'); const tex=new THREE.CanvasTexture(canvas); tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false });
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.3), mat); plane.visible=false; scene.add(plane);
  countdown={ active:false, time:0, plane, ctx, tex, lastDrawn:-1 };
}
function drawCountdown(n){
  if (countdown.lastDrawn === n) return;
  countdown.lastDrawn = n;
  const {ctx,tex}=countdown; ctx.clearRect(0,0,512,256);
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,512,256);
  ctx.fillStyle='#fff'; ctx.font='bold 180px system-ui, Arial';
  const s=String(n), tw=ctx.measureText(s).width; ctx.fillText(s,(512-tw)/2,190);
  tex.needsUpdate=true;
}
function placeCountdown(){
  _v1.copy(iPos).addScaledVector(iForward,1.0);
  _v2.copy(_v1).sub(iForward);
  countdown.plane.position.copy(_v1); countdown.plane.lookAt(_v2);
}
function beginCountdown(){
  const sel = menu.getSelection();
  applyGamePreset(DIFF_LABELS[sel.difficultyIndex], SPEED_LABELS[sel.speedIndex], TIME_LABELS[sel.timeIndex]);
  hardResetRound(); menu.setVisible(false); setLasersVisible(false); hideBackToMenuButton();
  game.menuActive=false; ensureCountdownPlane(); placeCountdown();
  countdown.active=true; countdown.time=3.999; countdown.lastDrawn=-1; drawCountdown(3);
}

/* =================== Game-State / Tuning + DDA =================== */
const game = { menuActive:true, running:false };

const tuning = {
  spawnInterval: SPAWN_INTERVAL,
  straightShare: 1.0,
  ballSpeed: BALL_SPEED,
  hazardSpeed: HAZARD_SPEED,
  hazardProb: HAZARD_PROB,
  driftMinAmp: DRIFT_MIN_AMPLITUDE, driftMaxAmp: DRIFT_MAX_AMPLITUDE,
  driftMinFreq: DRIFT_MIN_FREQ,     driftMaxFreq: DRIFT_MAX_FREQ,
  wideProb: 0.0, deepProb: 0.0
};

let currentDiffName = 'Aufsteiger';
let baseSpawnInterval = SPAWN_INTERVAL;
let baseStraightShare = 1.0;
let baseHazardProb = HAZARD_PROB;

const DDA_CFG = {
  enabled: true,
  interval: 12.0,      // alle 12 s anpassen
  spawnMinMul: 0.60,   // schneller: bis 60% des Basis-Intervalls
  spawnMaxMul: 1.30,   // langsamer: bis 130% des Basis-Intervalls
  straightMin: 0.15,   // nie weniger als 15% gerade
  straightMax: 1.00,   // max 100% gerade
  hazMin: 0.05,        // min Hazard-Wahrscheinlichkeit
  hazMax: 0.40,        // max Hazard-Wahrscheinlichkeit
  goodAcc: 0.90,       // über 90% Treffer
  badAcc:  0.70,       // unter 70% Treffer
  minEvents: 8         // mind. 8 (hits+misses) in Fenster
};
let ddaTimer = 0;
let lastDdaHits = 0, lastDdaMisses = 0, lastDdaHazHits = 0;

let gameMode = 'endless'; // 'endless' | 'time60' | 'time180' | 'time300'
let timeLeft = null;

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function applyGamePreset(diffName, speedName, timeLabel){
  currentDiffName = diffName;
  baseSpawnInterval = SPAWN_INTERVAL;
  baseStraightShare = DIFFICULTY_STRAIGHT_SHARE[diffName] ?? 1.0;
  baseHazardProb    = HAZARD_PROB;

  // auf Basiswerte zurück
  tuning.spawnInterval = baseSpawnInterval;
  tuning.straightShare = baseStraightShare;
  const ext = EXT_PROB[diffName] ?? EXT_PROB['Aufsteiger'];
  tuning.wideProb = ext.wide; tuning.deepProb = ext.deep;

  const sMul = SPEED_PRESETS[speedName] ?? 1.0;
  tuning.ballSpeed   = BALL_SPEED   * sMul;
  tuning.hazardSpeed = HAZARD_SPEED * sMul;
  tuning.hazardProb  = baseHazardProb;

  if (timeLabel==='Endlos'){ gameMode='endless'; timeLeft=null; }
  else if (timeLabel==='1:00'){ gameMode='time60'; timeLeft=60; }
  else if (timeLabel==='3:00'){ gameMode='time180'; timeLeft=180; }
  else if (timeLabel==='5:00'){ gameMode='time300'; timeLeft=300; }
  else { gameMode='endless'; timeLeft=null; }

  // DDA Reset
  ddaTimer = 0;
  lastDdaHits = hits; lastDdaMisses = misses; lastDdaHazHits = hazardHits;

  hud.set({ note: `${diffName} · ${speedName} · ${timeLabel}` });
}

/* ======================== Assets & Score ======================== */
await loadBall();
const balls=[], hazards=[];
let hits=0, misses=0, score=0, streak=0, hazardHits=0;
function comboMultiplier(){ if (streak<=0) return 1; const m=1+Math.floor(streak/5); return Math.min(4, m); }
function updateHUD(note=''){ hud.set({ hits, misses, score, streak, mode:gameMode, timeLeft, best:null, note }); }

/* ===================== Debug-Ring (optional) ===================== */
let _debugRing=null, _debugRingTimer=0;
function ensureDebugRing(){
  if (_debugRing || !DEBUG_HAZARD_RING_MS) return;
  _debugRing = new THREE.Mesh(new THREE.TorusGeometry(0.12,0.012,8,24), new THREE.MeshBasicMaterial({ color:0xffffff }));
  scene.add(_debugRing); _debugRing.visible = false;
}
function flashSpawnRingAt(pos){
  if (!DEBUG_HAZARD_RING_MS) return;
  ensureDebugRing();
  _debugRing.position.copy(pos);
  _v1.copy(pos).sub(iForward); _debugRing.lookAt(_v1);
  _debugRing.visible = true; _debugRingTimer = DEBUG_HAZARD_RING_MS/1000;
}

/* ======================= Object Pooling ======================= */
const hazardPool = [];
const MAX_POOL_HAZ = 32;
function getPooledHazard(){ return hazardPool.pop() || createHazard(); }
function recycleHazard(mesh){ if (!mesh) return; mesh.visible=false; mesh.position.set(0,-999,0); if (hazardPool.length<MAX_POOL_HAZ) hazardPool.push(mesh); }

/* =========================== Spawner =========================== */
const MAX_ACTIVE_BODIES = 40;
function randRange(a,b){ return a + Math.random()*(b-a); }

const MAX_SPAWN_TRIES = 5;
function isSpawnPosClear(p){
  const minDistSq = MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE;
  for (const b of balls){
    if (b.position.distanceToSquared(p) < minDistSq) return false;
  }
  for (const h of hazards){
    if (h.obj.position.distanceToSquared(p) < minDistSq) return false;
  }
  return true;
}

function spawnBall(sideSign,{style='auto'}={}){
  if (!isBallReady() || !poseLocked) return false;

  for (let attempt=0; attempt<MAX_SPAWN_TRIES; attempt++){
    const side = (attempt%2===0 ? sideSign : -sideSign);

    let sideMag = Math.random() < 0.5 ? SIDE_OFFSET_TIGHT : SIDE_OFFSET;
    let heightOffset = -Math.random() * SPAWN_MAX_BELOW;

    // Extra breit/tief (nie beides)
    let extWide = Math.random() < tuning.wideProb;
    let extDeep = Math.random() < tuning.deepProb;
    if (extWide && extDeep){ if (Math.random() < 0.5) extDeep=false; else extWide=false; }
    if (extWide) sideMag += WIDE_EXT_M;
    if (extDeep) heightOffset -= DEEP_EXT_M;

    const forward = (SPAWN_DISTANCE - SPAWN_BIAS);
    _v1.copy(iPos).addScaledVector(iForward, forward).addScaledVector(iRight, sideMag*side).addScaledVector(iUp, heightOffset);

    if (!isSpawnPosClear(_v1)) continue;

    const idx = allocBall();
    if (idx === undefined) continue;
    const velocity = _v2.copy(iForward).multiplyScalar(-tuning.ballSpeed);

    const spinSpeed = (Math.random()<0.5?-1:1) * THREE.MathUtils.lerp(0.5,2.0,Math.random());

    const prevDot = _v4.subVectors(_v1, iPos).dot(iForward);

    // --- Drift-Setup je nach gewünschtem Stil ---
    let driftAmp=0, driftOmega=0, driftPhase=0, driftAxisIdx=0, driftBiasRate=0;
    const explicitStraight = (style==='straight');
    const explicitSH = (style==='s-h');
    const explicitSV = (style==='s-v');

    let mustBeStraight = explicitStraight || extWide || extDeep;
    if (!mustBeStraight){
      if (style==='auto'){ mustBeStraight = Math.random()<tuning.straightShare; }
    }

    if (!mustBeStraight){
      driftAmp = randRange(tuning.driftMinAmp, tuning.driftMaxAmp);
      const f = randRange(tuning.driftMinFreq, tuning.driftMaxFreq);
      driftOmega = 2*Math.PI*f; driftPhase = Math.random()*Math.PI*2;

      if (explicitSV){ driftAxisIdx = 1; driftBiasRate = randRange(VDRIFT_BIAS_MIN, VDRIFT_BIAS_MAX); }
      else if (explicitSH){ driftAxisIdx = 0; }
      else {
        driftAxisIdx = Math.random()<0.5 ? 0 : 1;
        if (driftAxisIdx===1) driftBiasRate = randRange(VDRIFT_BIAS_MIN, VDRIFT_BIAS_MAX);
      }
    }

    balls.push({ index: idx, basePos: _v1.clone(), position: _v1.clone(), velocity: velocity.clone(), alive:true, prevDot,
                 t:0, driftAmp, driftOmega, driftPhase, driftAxisIdx, driftBiasRate });

    _m1.makeTranslation(_v1.x, _v1.y, _v1.z);
    getBallMesh().setMatrixAt(idx, _m1);
    getBallMesh().instanceMatrix.needsUpdate = true;

    const attr = getBallAttribute();
    const aIndex = idx*4;
    attr.array[aIndex+0] = spinSpeed;
    attr.array[aIndex+1] = (driftAxisIdx===1 ? -driftAmp : driftAmp);
    attr.array[aIndex+2] = driftOmega;
    attr.array[aIndex+3] = driftPhase;
    attr.needsUpdate = true;
    return true;
  }

  return false;
}

function spawnHazard(sideSign){
  if (!poseLocked) return null;

  for (let attempt=0; attempt<MAX_SPAWN_TRIES; attempt++){
    const side = (attempt%2===0 ? sideSign : -sideSign);
    const sideMag = Math.random() < 0.5 ? SIDE_OFFSET : SIDE_OFFSET_TIGHT;
    const heightOffset = -Math.random() * SPAWN_MAX_BELOW;
    _v1.copy(iPos).addScaledVector(iForward, (SPAWN_DISTANCE - SPAWN_BIAS)).addScaledVector(iRight, sideMag*side).addScaledVector(iUp, heightOffset);

    if (!isSpawnPosClear(_v1)) continue;

    const obj = getPooledHazard(); obj.visible = true; obj.position.copy(_v1); scene.add(obj);
    const velocity = _v2.copy(iForward).multiplyScalar(-tuning.hazardSpeed);
    const prevDot = _v3.subVectors(obj.position, iPos).dot(iForward);
    hazards.push({ obj, velocity: velocity.clone(), alive:true, prevDot });
    return _v1.clone();
  }

  return null;
}

/* =================== Körperkapsel & Events =================== */
// Capsule Head→Hip
const BODY_CAPSULE_HEIGHT = 1.10, BODY_CAPSULE_RADIUS = 0.28;
const _bpHead = new THREE.Vector3(), _bpHip  = new THREE.Vector3();
const _bpAB   = new THREE.Vector3(), _bpAP   = new THREE.Vector3();
const _bpClosest = new THREE.Vector3(), _bpTmp  = new THREE.Vector3();

function hazardHitsBody(point){
  camera.getWorldPosition(_bpHead);
  _bpHip.copy(_bpHead).addScaledVector(iUp, -BODY_CAPSULE_HEIGHT);
  _bpAB.subVectors(_bpHip, _bpHead); _bpAP.subVectors(point, _bpHead);
  const abLen2 = _bpAB.lengthSq(); let t = abLen2>1e-6 ? _bpAP.dot(_bpAB)/abLen2 : 0;
  t = Math.max(0, Math.min(1, t));
  _bpClosest.copy(_bpHead).addScaledVector(_bpAB, t);
  const dist = _bpTmp.subVectors(point, _bpClosest).length();
  return dist <= (HAZARD_RADIUS + BODY_CAPSULE_RADIUS);
}

let _lastHitAt = 0;
function onBallHit(b){
  b.alive=false; freeBall(b.index);
  hits++; streak++; score+=comboMultiplier();
  const now=performance.now(); if (AUDIO_ENABLED && now-_lastHitAt>40){ hitSound(); _lastHitAt=now; }
  rumble(0.9,60); updateHUD();
}
function onBallMiss(b){
  b.alive=false; freeBall(b.index);
  misses++; streak=0; if (AUDIO_ENABLED) missSound(); rumble(0.25,40); updateHUD();
}
function onHazardHit(h){
  h.alive=false; scene.remove(h.obj); recycleHazard(h.obj);
  hazardHits++; streak=0; score=Math.max(0, score-HAZARD_PENALTY);
  if (AUDIO_ENABLED) penaltySound(); rumble(1.0,80); updateHUD();
}

/* ======================= Collision Helpers ======================= */
function fistsHit(p,fists){
  for(const f of fists){
    _v5.subVectors(p, f.pos);
    if (_v5.length() <= (BALL_RADIUS+FIST_RADIUS) && f.vel.length()>=PUNCH_SPEED && _v5.dot(f.vel)>0) return true;
  } return false;
}
function fistsHitHazard(p,fists){
  for(const f of fists){
    _v5.subVectors(p, f.pos);
    if (_v5.length() <= (HAZARD_RADIUS+FIST_RADIUS) && f.vel.length()>=PUNCH_SPEED && _v5.dot(f.vel)>0) return true;
  } return false;
}

/* ========================= Round Control ========================= */
function hardResetRound(){
  for (const b of [...balls]){ freeBall(b.index); }
  for (const h of [...hazards]){ scene.remove(h.obj); recycleHazard(h.obj); }
  balls.length=0; hazards.length=0; hits=0; misses=0; score=0; streak=0; hazardHits=0;
  updateHUD('');
}
function clearActiveObjectsKeepScore(){
  for (const b of [...balls]){ freeBall(b.index); }
  for (const h of [...hazards]){ scene.remove(h.obj); recycleHazard(h.obj); }
  balls.length=0; hazards.length=0;
}

/* ==================== Controller Rays & Menü ==================== */
const raycaster = new THREE.Raycaster();
const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
const lasers = [];
function makeLaser(){
  const baseLen=2.0, geo=new THREE.CylinderGeometry(0.005,0.005,baseLen,12);
  const mat=new THREE.MeshBasicMaterial({ color:0x00e5ff, transparent:true, opacity:0.95, depthTest:false });
  const m=new THREE.Mesh(geo,mat); m.rotation.x=Math.PI/2; m.position.z=-(baseLen/2);
  m.userData.baseLen=baseLen; m.visible=false; return m;
}
function setLaserDistance(laser, dist){
  const base=laser.userData.baseLen, d=Math.max(0.05, Math.min(dist, base));
  laser.scale.set(1, d/base, 1); laser.position.z = -(d/2);
}
function setLasersVisible(v){ lasers.forEach(l=>l.visible=v); }
for (const c of controllers){
  scene.add(c); const laser = makeLaser(); c.add(laser); lasers.push(laser);
  c.addEventListener('selectstart', ()=>{
    if (backBtn.visible){
      const hit = intersectMesh(c, backBtn);
      if (hit){
        hideBackToMenuButton(); hud.plane.visible = false;
        menu.placeAt(iPos, iForward); menu.setMode('prestart'); menu.setVisible(true); setLasersVisible(true);
        game.menuActive = true; return;
      }
    }
    if (!game.menuActive) return;
    const hit = intersectHitPlane(c); if (!hit) return;
    const btn = menu.pickButtonAtWorldPoint(hit.point);
    const action = menu.click(btn); if (!action) return;
    if (action.action==='start'){ beginCountdown(); }
    else if (action.action==='resume'){ closeMenuResume(); }
    else if (action.action==='restart'){ beginCountdown(); }
    else if (action.action==='quit'){ const s=renderer.xr.getSession?.(); if (s) s.end(); }
  });
}
function intersectHitPlane(controller){
  const origin=_v6.set(0,0,0), dir=_v7.set(0,0,-1);
  controller.getWorldPosition(origin); dir.applyQuaternion(controller.quaternion).normalize();
  raycaster.set(origin, dir); return raycaster.intersectObject(menu.hitPlane, false)[0] || null;
}
function intersectMesh(controller, mesh){
  const origin=_v6.set(0,0,0), dir=_v7.set(0,0,-1);
  controller.getWorldPosition(origin); dir.applyQuaternion(controller.quaternion).normalize();
  raycaster.set(origin, dir); return raycaster.intersectObject(mesh, false)[0] || null;
}

/* ======================= A/X Pause/Resume ======================= */
function isRisingEdgeAX(gp, key, store){
  if (!gp || !gp.buttons) return false;
  const pressed = !!(gp.buttons[3]?.pressed) || !!(gp.buttons[4]?.pressed);
  const prev = !!store[key]; store[key]=pressed; return pressed && !prev;
}
let _pausedSpawnTimer = 0;
function openMenuIngame(){
  game.running=false; hud.plane.visible=false; _pausedSpawnTimer = spawnTimer;
  clearActiveObjectsKeepScore(); hideBackToMenuButton();
  menu.placeAt(iPos, iForward); menu.setMode('ingame'); menu.setVisible(true); setLasersVisible(true); game.menuActive=true;
}
function closeMenuResume(){
  menu.setVisible(false); setLasersVisible(false);
  game.menuActive=false; game.running=true; hud.plane.visible=true; hideBackToMenuButton();
  spawnTimer = _pausedSpawnTimer;
}
function showBackToMenuButton(){
  backBtn.visible = true; placeBackButton(); setLasersVisible(true);
  menu.setVisible(false); game.menuActive = false; hud.plane.visible = true;
}
function hideBackToMenuButton(){ backBtn.visible = false; backBtn.userData.hover = false; drawUIButton(backBtn); }

/* ============================= Loop ============================= */
const clock = new THREE.Clock();
let spawnTimer=0;

// Temp-Vektoren
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3(), _v7 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
let elapsed = 0;

/* ---- Pattern-Engine State ---- */
let curPattern = null;
let curStepIdx = 0;

// Hole oder erneuere das aktuelle Pattern basierend auf Schwierigkeit
function ensurePattern(){
  if (!curPattern || curStepIdx >= curPattern.steps.length){
    curPattern = pickPattern(currentDiffName);
    curStepIdx = 0;
  }
}

function loop(){
  const dt = clock.getDelta();
  elapsed += dt;
  const shader = getBallMesh()?.material?.userData?.shader;
  if (shader) shader.uniforms.uTime.value = elapsed;

  // A/X Face-Buttons
  const session = renderer.xr.getSession?.();
  if (session){
    if (!loop._btnPrev) loop._btnPrev = {};
    for (const src of session.inputSources){
      const gp=src.gamepad; if (!gp) continue;
      if (isRisingEdgeAX(gp, `${src.handedness}:AX`, loop._btnPrev)){
        if (game.running && !game.menuActive) openMenuIngame();
        else if (game.menuActive)            closeMenuResume();
      }
    }
  }

  if (renderer.xr.isPresenting && !poseLocked){ lockInitialPose(); updateHUD('Konfigurieren & Starten'); }

  // Menü / Back-Button Hover + Laser
  if (game.menuActive){
    let bestHit=null;
    for (let i=0;i<controllers.length;i++){
      const c=controllers[i]; const hit = intersectHitPlane(c);
      if (hit){ setLaserDistance(lasers[i], hit.distance); lasers[i].visible=true; if (!bestHit || hit.distance<bestHit.distance){ bestHit=hit; } }
      else { lasers[i].visible=false; }
    }
    menu.setHover(bestHit ? menu.pickButtonAtWorldPoint(bestHit.point) : null);
  } else if (backBtn.visible){
    placeBackButton();
    let bestHit=null;
    for (let i=0;i<controllers.length;i++){
      const c=controllers[i]; const hit = intersectMesh(c, backBtn);
      if (hit){ setLaserDistance(lasers[i], hit.distance); lasers[i].visible=true; if (!bestHit || hit.distance<bestHit.distance){ bestHit=hit; } }
      else { lasers[i].visible=false; }
    }
    backBtn.userData.hover = !!bestHit; drawUIButton(backBtn);
  } else { setLasersVisible(false); }

  // Countdown
  if (countdown.active){
    countdown.time -= dt; const n=Math.max(0,Math.ceil(countdown.time));
    drawCountdown(n); placeCountdown();
    if (countdown.time<=0){ countdown.active=false; countdown.plane.visible=false; hud.plane.visible=true; game.running=true; updateHUD(''); }
    else { countdown.plane.visible=true; }
  }

  const fists = fistsMgr.update(dt);

  // Zeitmodus
  let canSpawn = game.running;
  if (game.running && timeLeft!=null){
    timeLeft -= dt;
    if (timeLeft <= 0){
      timeLeft = 0; canSpawn = false; game.running = false;
      clearActiveObjectsKeepScore(); showBackToMenuButton();
    }
  }

  /* ---------- DDA: alle 12s justieren ---------- */
  if (DDA_CFG.enabled && !game.menuActive){
    ddaTimer += dt;
    if (ddaTimer >= DDA_CFG.interval){
      const dHits = hits - lastDdaHits;
      const dMiss = misses - lastDdaMisses;
      const dHaz  = hazardHits - lastDdaHazHits;
      const total = dHits + dMiss;

      if (total >= DDA_CFG.minEvents){
        const acc = dHits / Math.max(1, total);
        if (acc >= DDA_CFG.goodAcc && dHaz <= 1){
          // Spieler performt sehr gut → anziehen
          tuning.spawnInterval = clamp(tuning.spawnInterval * 0.92, baseSpawnInterval*DDA_CFG.spawnMinMul, baseSpawnInterval*DDA_CFG.spawnMaxMul);
          tuning.straightShare = clamp(tuning.straightShare * 0.92, DDA_CFG.straightMin, DDA_CFG.straightMax);
          tuning.hazardProb    = clamp(tuning.hazardProb + 0.02, DDA_CFG.hazMin, DDA_CFG.hazMax);
        } else if (acc <= DDA_CFG.badAcc || dHaz >= 2){
          // eher schwierig → abmildern
          tuning.spawnInterval = clamp(tuning.spawnInterval * 1.08, baseSpawnInterval*DDA_CFG.spawnMinMul, baseSpawnInterval*DDA_CFG.spawnMaxMul);
          tuning.straightShare = clamp(tuning.straightShare * 1.06, DDA_CFG.straightMin, DDA_CFG.straightMax);
          tuning.hazardProb    = clamp(tuning.hazardProb - 0.02, DDA_CFG.hazMin, DDA_CFG.hazMax);
        }
      }
      lastDdaHits = hits; lastDdaMisses = misses; lastDdaHazHits = hazardHits; ddaTimer = 0;
    }
  }

  // Spawner: Pattern-getrieben
  spawnTimer += dt;
  if (canSpawn && (balls.length + hazards.length) < MAX_ACTIVE_BODIES && spawnTimer >= tuning.spawnInterval){
    spawnTimer = 0;

    // 1) Balls nach Pattern
    ensurePattern();
    const step = curPattern.steps[curStepIdx++];
    if (step && step.items){
      let budget = MAX_ACTIVE_BODIES - (balls.length + hazards.length);
      for (const it of step.items){
        if (budget <= 0) break;
        spawnBall(it.side, { style: it.style || 'auto' });
        budget--;
      }
    }

    // 2) Hazard ggf. zusätzlich
    if (HAZARD_ENABLED && Math.random()<tuning.hazardProb){
      const side = Math.random()<0.5 ? -1 : +1;
      const pos = spawnHazard(side);
      if (pos) flashSpawnRingAt(pos);
    }
  }

  // Debug-Ring-Timer
  if (_debugRing && _debugRing.visible){ _debugRingTimer -= dt; if (_debugRingTimer <= 0){ _debugRing.visible = false; } }

  // Balls – Update
  for (let i=balls.length-1;i>=0;i--){
    const b=balls[i]; if(!b.alive){ balls.splice(i,1); continue; }
    b.basePos.addScaledVector(b.velocity, dt);
    if (b.driftAmp>0 && b.driftOmega>0){
      b.t+=dt; const lat=b.driftAmp*Math.sin(b.driftOmega*b.t+b.driftPhase);
      const axisVec = (b.driftAxisIdx===1) ? iUp : iRight;
      b.position.copy(b.basePos).addScaledVector(axisVec, lat);
      if (b.driftAxisIdx===1 && b.driftBiasRate>0){ b.basePos.addScaledVector(iUp, -b.driftBiasRate*dt); }
    } else {
      b.position.copy(b.basePos);
    }

    _m1.makeTranslation(b.basePos.x, b.basePos.y, b.basePos.z);
    getBallMesh().setMatrixAt(b.index, _m1);

    const p = b.position;
    if (fistsHit(p,fists)){ onBallHit(b); balls.splice(i,1); continue; }

    const dot = _v2.subVectors(b.position, iPos).dot(iForward);
    if (b.prevDot>MISS_PLANE_OFFSET && dot<=MISS_PLANE_OFFSET){ onBallMiss(b); balls.splice(i,1); continue; }
    b.prevDot=dot;
    if (dot<-6.0){ b.alive=false; freeBall(b.index); balls.splice(i,1); }
  }
  getBallMesh().instanceMatrix.needsUpdate = true;

  // Hazards – Update (inkl. Körpertreffer)
  for (let i=hazards.length-1;i>=0;i--){
    const h=hazards[i]; if(!h.alive){ hazards.splice(i,1); continue; }
    h.obj.position.addScaledVector(h.velocity, dt);
    const ax=h.obj.userData.spinAxis, sp=h.obj.userData.spinSpeed;
    if(ax&&sp) h.obj.rotateOnAxis(ax, sp*dt);

    const p = h.obj.getWorldPosition(_v1);
    if (fistsHitHazard(p,fists) || hazardHitsBody(p)){ onHazardHit(h); hazards.splice(i,1); continue; }

    const dot = _v2.subVectors(h.obj.position, iPos).dot(iForward);
    if (h.prevDot>MISS_PLANE_OFFSET && dot<=MISS_PLANE_OFFSET){ h.alive=false; scene.remove(h.obj); recycleHazard(h.obj); hazards.splice(i,1); continue; }
    if (dot<-6.0){ h.alive=false; scene.remove(h.obj); recycleHazard(h.obj); hazards.splice(i,1); }
  }

  updateHUD(countdown.active ? '' : (game.menuActive ? 'Konfigurieren & Starten' : (backBtn.visible ? 'Zeit abgelaufen' : '')));
  renderer.render(scene, camera);
}

/* ========================= Start/Shutdown ========================= */
async function start(){ try{ await loadBall(); scene.add(getBallMesh()); }catch(e){ console.error('ball.glb konnte nicht geladen werden:', e); } renderer.setAnimationLoop(loop); }
renderer.xr.addEventListener('sessionend', ()=>{
  for (const b of balls){ freeBall(b.index); }
  for (const h of hazards){ scene.remove(h.obj); recycleHazard(h.obj); }
  balls.length=0; hazards.length=0;
  if (_debugRing){ scene.remove(_debugRing); _debugRing=null; }
  menu.setVisible(false); setLasersVisible(false); hideBackToMenuButton();
  game.menuActive=false; hud.plane.visible=false;
});
start();
