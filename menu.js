// Menü-Overlay mit Raycast-Buttons
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

function makeButton(label, w=0.30, h=0.12) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite:false });
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { label, w, h, selected:false, hover:false, kind:null, index:-1, _ctx:ctx, _tex:tex };
  drawButton(mesh);
  return mesh;
}

function drawButton(btn) {
  const { _ctx:ctx, _tex:tex, label, selected, hover } = btn.userData;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);

  // Hintergrund
  ctx.fillStyle = selected ? '#1e88e5' : '#222a';
  ctx.fillRect(0,0,W,H);

  // Hover-Rahmen
  if (hover) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 10;
    ctx.strokeRect(6,6,W-12,H-12);
  }

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 90px system-ui, Arial';
  const tw = ctx.measureText(label).width;
  ctx.fillText(label, (W - tw)/2, H*0.65);

  tex.needsUpdate = true;
}

function makePanelBG(w=0.9, h=0.6) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent:true, opacity:0.55, depthWrite:false });
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const m = new THREE.Mesh(geo, mat);
  return m;
}

export function createMenu(diffLabels, speedLabels) {
  const group = new THREE.Group();
  group.name = 'menuOverlay';

  const panel = makePanelBG(1.0, 0.68);
  group.add(panel);

  // Titel
  const title = makeButton('Spiel-Einstellungen', 0.9, 0.14);
  title.userData.kind = 'title';
  title.userData.hover = false;
  drawButton(title);
  title.position.set(0, 0.22, 0.001);
  group.add(title);

  // Buttons
  const diffButtons = diffLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.28, 0.12);
    b.userData.kind = 'difficulty';
    b.userData.index = i;
    return b;
  });
  const speedButtons = speedLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.28, 0.12);
    b.userData.kind = 'speed';
    b.userData.index = i;
    return b;
  });
  const startBtn = makeButton('Starten', 0.9, 0.14);
  startBtn.userData.kind = 'start';

  // Layout
  const rowY1 = 0.08;   // Diff
  const rowY2 = -0.10;  // Speed

  // horizontale Verteilung
  const positionsX = [-0.32, 0, 0.32];

  diffButtons.forEach((b, i) => {
    b.position.set(positionsX[i], rowY1, 0.001);
    group.add(b);
  });

  speedButtons.forEach((b, i) => {
    b.position.set(positionsX[i], rowY2, 0.001);
    group.add(b);
  });

  startBtn.position.set(0, -0.28, 0.001);
  group.add(startBtn);

  // Auswahlzustand
  let selDiff = 0;  // Standard: Anfänger
  let selSpeed = 1; // Standard: Mittel
  diffButtons[selDiff].userData.selected = true; drawButton(diffButtons[selDiff]);
  speedButtons[selSpeed].userData.selected = true; drawButton(speedButtons[selSpeed]);

  const interactives = [...diffButtons, ...speedButtons, startBtn];

  function setVisible(v) { group.visible = v; }
  function placeAt(pos, forward, up) {
    const target = new THREE.Vector3().copy(pos).add(forward);
    group.position.copy(pos).addScaledVector(forward, 1.2).addScaledVector(up, 0.0);
    group.lookAt(target);
  }

  function updateHover(raycaster) {
    interactives.forEach(b => { if (b.userData.kind !== 'title') { b.userData.hover=false; drawButton(b); }});
    const hits = raycaster.intersectObjects(interactives, false);
    if (hits.length) {
      const b = hits[0].object;
      if (b.userData.kind !== 'title') {
        b.userData.hover = true; drawButton(b);
        return b;
      }
    }
    return null;
  }

  function click(mesh) {
    if (!mesh) return null;
    const { kind, index } = mesh.userData;
    if (kind === 'difficulty') {
      diffButtons.forEach(b => { b.userData.selected = false; drawButton(b); });
      mesh.userData.selected = true; drawButton(mesh);
      selDiff = index;
      return { action:'set-difficulty', value: selDiff };
    }
    if (kind === 'speed') {
      speedButtons.forEach(b => { b.userData.selected = false; drawButton(b); });
      mesh.userData.selected = true; drawButton(mesh);
      selSpeed = index;
      return { action:'set-speed', value: selSpeed };
    }
    if (kind === 'start') {
      return { action:'start' };
    }
    return null;
  }

  function getSelection() {
    return { difficultyIndex: selDiff, speedIndex: selSpeed };
  }

  return { group, interactives, setVisible, placeAt, updateHover, click, getSelection };
}
