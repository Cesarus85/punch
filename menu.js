// Menü-Overlay mit eindeutiger Hover-Steuerung und größerem Layout
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

function makeButton(label, w=0.40, h=0.14) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite:false });
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { label, w, h, selected:false, hover:false, kind:null, index:-1, _ctx:ctx, _tex:tex, disabled:false };
  drawButton(mesh);
  return mesh;
}

function drawButton(btn) {
  const { _ctx:ctx, _tex:tex, label, selected, hover, disabled } = btn.userData;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);

  ctx.fillStyle = disabled ? '#444c' : (selected ? '#1e88e5' : '#222c');
  ctx.fillRect(0,0,W,H);

  if (hover && !disabled) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 10;
    ctx.strokeRect(6,6,W-12,H-12);
  }

  ctx.fillStyle = disabled ? '#bbb' : '#fff';
  ctx.font = 'bold 96px system-ui, Arial';
  const tw = ctx.measureText(label).width;
  ctx.fillText(label, (W - tw)/2, H*0.66);

  tex.needsUpdate = true;
}

function makePanelBG(w=1.40, h=1.00) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent:true, opacity:0.62, depthWrite:false });
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  return new THREE.Mesh(geo, mat);
}

export function createMenu(diffLabels, speedLabels) {
  const group = new THREE.Group();
  group.name = 'menuOverlay';

  const panel = makePanelBG(1.40, 1.00);
  panel.name = 'menuPanel';
  group.add(panel);

  // Titel
  const title = makeButton('Spiel-Einstellungen', 1.30, 0.16);
  title.userData.kind = 'title';
  title.position.set(0, 0.36, 0.001);
  drawButton(title);
  group.add(title);

  // Diff/Speed
  const diffButtons = diffLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.40, 0.14);
    b.userData.kind = 'difficulty';
    b.userData.index = i;
    return b;
  });
  const speedButtons = speedLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.40, 0.14);
    b.userData.kind = 'speed';
    b.userData.index = i;
    return b;
  });

  // Control-Buttons
  const startBtn   = makeButton('Starten',    1.30, 0.16); startBtn.userData.kind = 'start';
  const resumeBtn  = makeButton('Fortsetzen', 0.62, 0.14); resumeBtn.userData.kind = 'resume';
  const restartBtn = makeButton('Neu starten',0.62, 0.14); restartBtn.userData.kind = 'restart';
  const quitBtn    = makeButton('Beenden',    1.30, 0.14); quitBtn.userData.kind = 'quit';

  // Layout
  const rowY_diff  = 0.16, rowY_speed = -0.02;
  const rowY_ctrl1 = -0.24, rowY_ctrl2 = -0.40, rowY_ctrl3 = -0.56;
  const positionsX = [-0.46, 0, 0.46];

  diffButtons.forEach((b, i) => { b.position.set(positionsX[i], rowY_diff, 0.001); group.add(b); });
  speedButtons.forEach((b, i) => { b.position.set(positionsX[i], rowY_speed, 0.001); group.add(b); });

  resumeBtn.position.set(-0.33, rowY_ctrl1, 0.001);
  restartBtn.position.set(+0.33, rowY_ctrl1, 0.001);
  startBtn.position.set(0, rowY_ctrl2, 0.001);
  quitBtn.position.set(0, rowY_ctrl3, 0.001);
  group.add(resumeBtn, restartBtn, startBtn, quitBtn);

  // Auswahl
  let selDiff = 0, selSpeed = 1;
  diffButtons[selDiff].userData.selected = true; drawButton(diffButtons[selDiff]);
  speedButtons[selSpeed].userData.selected = true; drawButton(speedButtons[selSpeed]);

  const interactives = [...diffButtons, ...speedButtons, startBtn, resumeBtn, restartBtn, quitBtn];

  // Modus: 'prestart' | 'ingame'
  let mode = 'prestart';
  function setMode(m) {
    mode = m;
    const pre = (mode === 'prestart');
    startBtn.userData.disabled   = !pre;  drawButton(startBtn);
    resumeBtn.userData.disabled  = pre;   drawButton(resumeBtn);
    restartBtn.userData.disabled = pre;   drawButton(restartBtn);
    quitBtn.userData.disabled    = false; drawButton(quitBtn);
  }
  setMode('prestart');

  // Hover: zentral gesteuert -> genau EIN Button
  let hoveredBtn = null;
  function clearHover() {
    if (hoveredBtn) { hoveredBtn.userData.hover = false; drawButton(hoveredBtn); hoveredBtn = null; }
  }
  function setHover(btn) {
    if (hoveredBtn === btn) return;
    if (hoveredBtn) { hoveredBtn.userData.hover = false; drawButton(hoveredBtn); }
    hoveredBtn = (btn && !btn.userData.disabled && btn.userData.kind !== 'title') ? btn : null;
    if (hoveredBtn) { hoveredBtn.userData.hover = true; drawButton(hoveredBtn); }
  }

  function setVisible(v) { group.visible = v; if (!v) clearHover(); }
  function placeAt(pos, forward) {
    const target = new THREE.Vector3().copy(pos).add(forward);
    group.position.copy(pos).addScaledVector(forward, 1.25);
    group.lookAt(target);
  }

  function getRayTargets() { return [panel, ...interactives]; }

  function click(btn) {
    if (!btn || btn.userData.disabled) return null;
    const { kind, index } = btn.userData;
    if (kind === 'difficulty') {
      diffButtons.forEach(b => { b.userData.selected = false; drawButton(b); });
      btn.userData.selected = true; drawButton(btn); selDiff = index; return { action:'set-difficulty', value: selDiff };
    }
    if (kind === 'speed') {
      speedButtons.forEach(b => { b.userData.selected = false; drawButton(b); });
      btn.userData.selected = true; drawButton(btn); selSpeed = index; return { action:'set-speed', value: selSpeed };
    }
    if (kind === 'start')   return { action:'start' };
    if (kind === 'resume')  return { action:'resume' };
    if (kind === 'restart') return { action:'restart' };
    if (kind === 'quit')    return { action:'quit' };
    return null;
  }

  function getSelection() { return { difficultyIndex: selDiff, speedIndex: selSpeed }; }

  return { group, panel, interactives, getRayTargets, setVisible, placeAt, setMode, setHover, click, getSelection };
}
