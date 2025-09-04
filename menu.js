// Robustes Menü mit Hit-Plane, 2D-Picking und Zeitmodi
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

function makeCanvasPlane(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite:false });
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData._ctx = ctx;
  mesh.userData._tex = tex;
  return mesh;
}
function drawTitle(mesh, text) {
  const ctx = mesh.userData._ctx, tex = mesh.userData._tex;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#ffffff';
  let size = 110;
  while (size >= 60) {
    ctx.font = `bold ${size}px system-ui, Arial`;
    const tw = ctx.measureText(text).width;
    if (tw <= W - 80) break;
    size -= 4;
  }
  const tw = ctx.measureText(text).width;
  ctx.fillText(text, (W - tw)/2, H*0.70);
  tex.needsUpdate = true;
}
function makeButton(label, w=0.42, h=0.14) {
  const mesh = makeCanvasPlane(w, h);
  mesh.userData.label = label;
  mesh.userData.kind = null;
  mesh.userData.index = -1;
  mesh.userData.selected = false;
  mesh.userData.hover = false;
  mesh.userData.disabled = false;
  drawButton(mesh);
  return mesh;
}
function drawButton(btn) {
  const { _ctx:ctx, _tex:tex, label, selected, hover, disabled } = btn.userData;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = disabled ? '#444c' : '#222c';
  ctx.fillRect(0,0,W,H);
  if (selected && !disabled) {
    ctx.fillStyle = '#1e88e5aa';
    ctx.fillRect(0,0,W,H);
  }
  if (hover && !disabled) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.strokeRect(6,6,W-12,H-12);
  }
  ctx.fillStyle = disabled ? '#bbb' : '#fff';
  ctx.font = 'bold 96px system-ui, Arial';
  const tw = ctx.measureText(label).width;
  ctx.fillText(label, (W - tw)/2, H*0.66);
  tex.needsUpdate = true;
}
function makePanelBG(w=1.60, h=1.50) { // größer, damit alle Buttons sicher drin sind
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent:true, opacity:0.64, depthWrite:false });
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const m = new THREE.Mesh(geo, mat);
  m.name = 'menuPanel';
  return m;
}

export function createMenu(diffLabels, speedLabels, timeLabels, ddaLabels) {
  const group = new THREE.Group();
  group.name = 'menuOverlay';

  const panel = makePanelBG(1.60, 1.80);
  group.add(panel);

  // Unsichtbare Hit-Plane knapp vor den Buttons für Ray-Treffer/Laser
  const hitPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.60, 1.80, 1, 1),
    new THREE.MeshBasicMaterial({ transparent:true, opacity:0.0, depthWrite:false })
  );
  hitPlane.position.z = 0.006;
  hitPlane.name = 'menuHitPlane';
  group.add(hitPlane);

  // Titel
  const title = makeCanvasPlane(1.48, 0.16);
  title.userData.kind = 'title';
  drawTitle(title, 'Spieleinstellungen');
  title.position.set(0, 0.56, 0.007);
  group.add(title);

  // Buttons
  const diffButtons = diffLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.42, 0.14);
    b.userData.kind = 'difficulty'; b.userData.index = i;
    return b;
  });
  const speedButtons = speedLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.42, 0.14);
    b.userData.kind = 'speed'; b.userData.index = i;
    return b;
  });
  const timeButtons = timeLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.42, 0.14);
    b.userData.kind = 'time'; b.userData.index = i;
    return b;
  });
  const ddaButtons = ddaLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.42, 0.14);
    b.userData.kind = 'dda'; b.userData.index = i;
    return b;
  });

  const startBtn   = makeButton('Starten',    1.48, 0.16); startBtn.userData.kind = 'start';
  const resumeBtn  = makeButton('Fortsetzen', 0.70, 0.14); resumeBtn.userData.kind = 'resume';
  const restartBtn = makeButton('Neu starten',0.70, 0.14); restartBtn.userData.kind = 'restart';
  const quitBtn    = makeButton('Beenden',    1.48, 0.14); quitBtn.userData.kind = 'quit';

  // Layout (alle bei z ~ 0.007)
  const rowY_diff   = 0.34;
  const rowY_speed  = 0.14;
  const rowY_dda    = -0.06;
  const rowY_time   = -0.26;
  const rowY_ctrl1  = -0.50; // resume/restart
  const rowY_ctrl2  = -0.68; // start
  const rowY_ctrl3  = -0.86; // quit
  const positionsX  = [-0.50, 0, 0.50];

  diffButtons.forEach((b,i)=>{ b.position.set(positionsX[i], rowY_diff,  0.007); group.add(b); });
  speedButtons.forEach((b,i)=>{ b.position.set(positionsX[i], rowY_speed, 0.007); group.add(b); });
  ddaButtons.forEach((b,i)=>{ b.position.set(positionsX[i], rowY_dda,   0.007); group.add(b); });
  timeButtons.forEach((b,i)=>{  b.position.set(positionsX[i], rowY_time,  0.007); group.add(b); });

  resumeBtn.position.set(-0.35, rowY_ctrl1, 0.007);
  restartBtn.position.set(+0.35, rowY_ctrl1, 0.007);
  startBtn.position.set(0, rowY_ctrl2, 0.007);
  quitBtn.position.set(0, rowY_ctrl3, 0.007);
  group.add(resumeBtn, restartBtn, startBtn, quitBtn);

  // Auswahlzustand
  let selDiff = 0, selSpeed = 1, selTime = 0, selDda = 2; // Endlos default, DDA 100%
  const setSelected = (arr, idx) => arr.forEach((b,i)=>{ b.userData.selected=(i===idx); drawButton(b); });
  setSelected(diffButtons, selDiff);
  setSelected(speedButtons, selSpeed);
  setSelected(timeButtons, selTime);
  setSelected(ddaButtons, selDda);

  // Modus: 'prestart' | 'ingame'
  let mode = 'prestart';
  function setMode(m){
    mode = m;
    const pre = (mode==='prestart');
    startBtn.visible   = pre;
    resumeBtn.visible  = !pre;
    restartBtn.visible = !pre;
    quitBtn.visible    = true;
    startBtn.userData.disabled   = !pre;  drawButton(startBtn);
    resumeBtn.userData.disabled  = pre;   drawButton(resumeBtn);
    restartBtn.userData.disabled = pre;   drawButton(restartBtn);
    quitBtn.userData.disabled    = false; drawButton(quitBtn);
  }
  setMode('prestart');

  // Hover zentral
  let hoveredBtn = null;
  function clearHover(){ if (hoveredBtn){ hoveredBtn.userData.hover=false; drawButton(hoveredBtn); hoveredBtn=null; } }
  function setHover(btn){
    if (hoveredBtn === btn) return;
    if (hoveredBtn){ hoveredBtn.userData.hover=false; drawButton(hoveredBtn); }
    hoveredBtn = (btn && btn.visible && !btn.userData.disabled && btn.userData.kind!=='title') ? btn : null;
    if (hoveredBtn){ hoveredBtn.userData.hover=true; drawButton(hoveredBtn); }
  }

  function setVisible(v){ group.visible=v; if(!v) clearHover(); }
  function placeAt(pos, forward){
    const target = new THREE.Vector3().copy(pos).add(forward);
    group.position.copy(pos).addScaledVector(forward, 1.25);
    group.lookAt(target);
  }

  // 2D-Picking: worldPoint -> local -> Buttonrechtecke
  function pickButtonAtWorldPoint(worldPoint){
    const local = worldPoint.clone();
    group.worldToLocal(local);
    const x=local.x, y=local.y;
    const candidates = [
      ...diffButtons, ...speedButtons, ...ddaButtons, ...timeButtons,
      startBtn, resumeBtn, restartBtn, quitBtn
    ].filter(o => o.visible && !o.userData.disabled);
    for (const b of candidates){
      const w=b.geometry.parameters.width, h=b.geometry.parameters.height;
      const bx=b.position.x, by=b.position.y;
      if (Math.abs(x-bx)<=w/2 && Math.abs(y-by)<=h/2) return b;
    }
    return null;
  }

  function click(btn){
    if (!btn || !btn.visible || btn.userData.disabled) return null;
    const { kind, index } = btn.userData;
    if (kind==='difficulty'){ selDiff=index; setSelected(diffButtons, selDiff); return { action:'set-difficulty', value: selDiff }; }
    if (kind==='speed'){ selSpeed=index; setSelected(speedButtons, selSpeed); return { action:'set-speed', value: selSpeed }; }
    if (kind==='dda'){ selDda=index; setSelected(ddaButtons, selDda); return { action:'set-dda', value: selDda }; }
    if (kind==='time'){ selTime=index; setSelected(timeButtons, selTime); return { action:'set-time', value: selTime }; }
    if (kind==='start')   return { action:'start' };
    if (kind==='resume')  return { action:'resume' };
    if (kind==='restart') return { action:'restart' };
    if (kind==='quit')    return { action:'quit' };
    return null;
  }

  function getSelection(){ return { difficultyIndex: selDiff, speedIndex: selSpeed, timeIndex: selTime, ddaIndex: selDda }; }

  return { group, panel, hitPlane, setVisible, placeAt, setMode, setHover, pickButtonAtWorldPoint, click, getSelection };
}
