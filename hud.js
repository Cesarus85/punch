import * as THREE from './three.js';
import { HUD_PLANE_W, HUD_PLANE_H, HUD_FORWARD, HUD_RIGHT, HUD_TILT_DEG } from './config.js';

export function createHUD(scene){
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 384; // etwas größer für mehr Infos
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(HUD_PLANE_W, HUD_PLANE_H), mat);
  plane.name = 'scoreboard';
  scene.add(plane);

  const state = {
    hits: 0, misses: 0, score: 0, streak: 0,
    mode: 'endless', timeLeft: null, best: null,
    note: '' // kurze Hinweise wie "Zeit!"
  };

  let hazardFlashActive = false;
  let hazardFlashTimeout;

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Hintergrund
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Titelzeile
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px system-ui, Arial';
    ctx.fillText('AR Punch', 24, 56);

    // Mode / Timer / Best
    ctx.font = 'bold 32px system-ui, Arial';
    const modeTxt = state.mode === 'sprint60' ? 'Mode: Sprint 60s' : 'Mode: Endless';
    ctx.fillText(modeTxt, 24, 104);
    if (state.timeLeft !== null) {
      ctx.fillStyle = state.timeLeft <= 5 ? '#ffcc00' : '#cfe8ff';
      ctx.fillText(`Time: ${Math.max(0, Math.ceil(state.timeLeft))}s`, 300, 104);
      ctx.fillStyle = '#ffffff';
    }
    if (state.best !== null) {
      ctx.fillStyle = '#a7ff83';
      ctx.fillText(`Best: ${state.best}`, 530, 104);
      ctx.fillStyle = '#ffffff';
    }

    // Scorezeile
    ctx.font = 'bold 60px system-ui, Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${state.score}`, 24, 180);

    // Hits / Misses / Streak
    ctx.font = 'bold 36px system-ui, Arial';
    ctx.fillStyle = '#7fdcff';
    ctx.fillText(`Hits: ${state.hits}`, 24, 240);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(`Misses: ${state.misses}`, 220, 240);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`Streak: ${state.streak}`, 430, 240);

    // Note
    if (state.note) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 34px system-ui, Arial';
      ctx.fillText(state.note, 24, 308);
    }

    if (hazardFlashActive){
      ctx.fillStyle = 'rgba(255,0,0,0.35)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    tex.needsUpdate = true;
  }
  draw();

  function set(partial){
    Object.assign(state, partial);
    draw();
  }

  function place(initial){
    const { iPos, iForward, iRight } = initial;
    const y = HUD_PLANE_H/2 + 0.02; // 2 cm über Boden
    const pos = new THREE.Vector3()
      .copy(iPos)
      .addScaledVector(iForward, HUD_FORWARD)
      .addScaledVector(iRight, HUD_RIGHT);

    plane.position.set(pos.x, y, pos.z);
    const lookTarget = new THREE.Vector3().copy(plane.position).sub(iForward);
    plane.lookAt(lookTarget);
    plane.rotateX(THREE.MathUtils.degToRad(HUD_TILT_DEG));
  }

  function flashHazard(){
    hazardFlashActive = true;
    draw();
    clearTimeout(hazardFlashTimeout);
    hazardFlashTimeout = setTimeout(()=>{
      hazardFlashActive = false;
      draw();
    }, 300);
  }

  return { plane, set, place, flashHazard };
}
