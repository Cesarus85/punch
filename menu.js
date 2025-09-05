// Robustes Menü mit Hit-Plane, 2D-Picking und Zeitmodi
import * as THREE from './three.js';
import { BODY_CAPSULE_HEIGHT, BODY_CAPSULE_RADIUS, setBodyConfig } from './config.js';

function makeCanvasPlane(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ 
    map: tex, 
    transparent: true, 
    depthWrite: false,
    depthTest: false,
    fog: false
  });
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData._ctx = ctx;
  mesh.userData._tex = tex;
  mesh.renderOrder = 100;
  return mesh;
}
function drawTitle(mesh, text) {
  const ctx = mesh.userData._ctx, tex = mesh.userData._tex;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  
  // Gradient für Titel
  const gradient = ctx.createLinearGradient(0, 0, W, 0);
  gradient.addColorStop(0, '#00e5ff');
  gradient.addColorStop(0.5, '#ffffff');
  gradient.addColorStop(1, '#00e5ff');
  
  let size = 110;
  while (size >= 60) {
    ctx.font = `bold ${size}px 'Segoe UI', system-ui, Arial`;
    const tw = ctx.measureText(text).width;
    if (tw <= W - 80) break;
    size -= 4;
  }
  
  const tw = ctx.measureText(text).width;
  const x = (W - tw)/2;
  const y = H*0.70;
  
  // Schatten
  ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  
  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);
  
  ctx.shadowColor = 'transparent';
  tex.needsUpdate = true;
}
function drawGameName(mesh, text) {
  const ctx = mesh.userData._ctx, tex = mesh.userData._tex;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  
  // Verkeilte/schräge Transformation
  ctx.save();
  ctx.transform(1, 0, -0.15, 1, 0, 0); // Schräg nach rechts geneigt
  
  let size = 140;
  while (size >= 80) {
    ctx.font = `bold italic ${size}px 'Impact', 'Arial Black', system-ui`;
    const tw = ctx.measureText(text).width;
    if (tw <= W - 80) break;
    size -= 4;
  }
  
  const tw = ctx.measureText(text).width;
  const x = (W - tw)/2;
  const y = H*0.70;
  
  // Gradient für dynamischen Look
  const gradient = ctx.createLinearGradient(x, y-size*0.7, x+tw, y);
  gradient.addColorStop(0, '#ff6b35');
  gradient.addColorStop(0.5, '#f7931e');
  gradient.addColorStop(1, '#ffcc02');
  
  // Schatten für Tiefe
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  
  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);
  
  ctx.restore();
  ctx.shadowColor = 'transparent';
  tex.needsUpdate = true;
}
function drawLabel(mesh, text) {
  const ctx = mesh.userData._ctx, tex = mesh.userData._tex;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  
  let size = 80;
  while (size >= 40) {
    ctx.font = `600 ${size}px 'Segoe UI', system-ui, Arial`;
    const tw = ctx.measureText(text).width;
    if (tw <= W - 80) break;
    size -= 4;
  }
  
  const tw = ctx.measureText(text).width;
  const x = (W - tw)/2;
  const y = H*0.70;
  
  // Subtiler Schatten
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 1;
  
  ctx.fillStyle = '#e8f4fd';
  ctx.fillText(text, x, y);
  
  ctx.shadowColor = 'transparent';
  tex.needsUpdate = true;
}
function makeLabel(w=1.20, h=0.10) {
  const mesh = makeCanvasPlane(w, h);
  mesh.userData.kind = 'label';
  return mesh;
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
  const cornerRadius = 32;
  
  ctx.clearRect(0,0,W,H);
  
  // Abgerundetes Rechteck zeichnen
  function roundRect(x, y, width, height, radius, fill = true, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
  
  // Button-Hintergrund mit Verlauf
  if (disabled) {
    ctx.fillStyle = 'rgba(60, 60, 60, 0.4)';
  } else if (selected) {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(30, 136, 229, 0.9)');
    ctx.fillStyle = gradient;
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(70, 80, 95, 0.85)');
    gradient.addColorStop(1, 'rgba(50, 60, 75, 0.9)');
    ctx.fillStyle = gradient;
  }
  
  roundRect(8, 8, W-16, H-16, cornerRadius, true, false);
  
  // Hover-Effekt
  if (hover && !disabled) {
    ctx.strokeStyle = selected ? '#ffffff' : '#00e5ff';
    ctx.lineWidth = 6;
    ctx.shadowColor = selected ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 229, 255, 0.8)';
    ctx.shadowBlur = 15;
    roundRect(8, 8, W-16, H-16, cornerRadius, false, true);
    ctx.shadowColor = 'transparent';
  }
  
  // Text
  ctx.fillStyle = disabled ? '#999' : '#fff';
  ctx.font = `600 96px 'Segoe UI', system-ui, Arial`;
  const tw = ctx.measureText(label).width;
  const x = (W - tw)/2;
  const y = H*0.66;
  
  if (!disabled) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
  }
  
  ctx.fillText(label, x, y);
  ctx.shadowColor = 'transparent';
  tex.needsUpdate = true;
}
function makePanelBG(w=1.80, h=2.70) {
  // Erstelle Shader-Material für glasartigen Hintergrund
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      
      void main() {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(vUv, center);
        
        // Subtiler animierter Gradient
        float wave = sin(uTime * 0.5 + dist * 8.0) * 0.02;
        float alpha = 0.75 + wave;
        
        // Hellerer glasartiger Effekt mit blauem Schimmer
        vec3 baseColor = vec3(0.18, 0.22, 0.35);
        vec3 accentColor = vec3(0.0, 0.9, 1.0);
        
        // Randverlauf
        float edgeGlow = 1.0 - smoothstep(0.0, 0.1, dist);
        vec3 color = mix(baseColor, baseColor + accentColor * 0.25, edgeGlow);
        
        gl_FragColor = vec4(color, alpha * 0.75);
      }
    `
  });
  
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const m = new THREE.Mesh(geo, mat);
  m.name = 'menuPanel';
  m.userData.material = mat;
  m.renderOrder = 99;
  return m;
}

export function createMenu(diffLabels, speedLabels, timeLabels, ddaLabels) {
  const group = new THREE.Group();
  group.name = 'menuOverlay';

  const panel = makePanelBG(1.80, 2.70);
  group.add(panel);

  // Unsichtbare Hit-Plane knapp vor den Buttons für Ray-Treffer/Laser
  const hitPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.80, 2.70, 1, 1),
    new THREE.MeshBasicMaterial({ transparent:true, opacity:0.0, depthWrite:false })
  );
  hitPlane.position.z = 0.006;
  hitPlane.name = 'menuHitPlane';
  group.add(hitPlane);

  // Logo und Spielname
  const rowY_logo = 1.15;
  const rowY_title = 0.85;
  
  // Logo laden und anzeigen
  const logoTexture = new THREE.TextureLoader().load('./pics/sa_logo.png');
  logoTexture.minFilter = THREE.LinearFilter;
  logoTexture.magFilter = THREE.LinearFilter;
  const logoMaterial = new THREE.MeshBasicMaterial({ 
    map: logoTexture, 
    transparent: true, 
    depthWrite: false, 
    depthTest: false 
  });
  const logoGeometry = new THREE.PlaneGeometry(0.45, 0.18);
  const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);
  logoMesh.position.set(-0.25, rowY_logo, 0.007);
  logoMesh.renderOrder = 101;
  group.add(logoMesh);
  
  // Spielname "Punch-Ball"
  const gameNamePlane = makeCanvasPlane(0.9, 0.20);
  gameNamePlane.userData.kind = 'gamename';
  drawGameName(gameNamePlane, 'Punch-Ball');
  gameNamePlane.position.set(0.30, rowY_logo, 0.007);
  group.add(gameNamePlane);
  
  // Titel "Spieleinstellungen"
  const title = makeCanvasPlane(1.48, 0.16);
  title.userData.kind = 'title';
  drawTitle(title, 'Spieleinstellungen');
  title.position.set(0, rowY_title, 0.007);
  group.add(title);

  // Labels
  const diffLabelMesh  = makeLabel(); drawLabel(diffLabelMesh,  'Schwierigkeit');
  const speedLabelMesh = makeLabel(); drawLabel(speedLabelMesh, 'Geschwindigkeit');
  const ddaLabelMesh   = makeLabel(); drawLabel(ddaLabelMesh,   'Variable Schwierigkeitsanpassung');
  const timeLabelMesh  = makeLabel(); drawLabel(timeLabelMesh,  'Zeiteinstellungen');

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

  // Layout mit mehr Abstand zwischen Reihen
  const rowY_diff   = 0.55;
  const rowY_speed  = 0.25;
  const rowY_dda    = -0.05;
  const rowY_time   = -0.35;
  const rowY_diffLbl  = rowY_diff  + 0.18;
  const rowY_speedLbl = rowY_speed + 0.18;
  const rowY_ddaLbl   = rowY_dda   + 0.18;
  const rowY_timeLbl  = rowY_time  + 0.18;
  const rowY_ctrl1  = -0.65; // resume/restart
  const rowY_ctrl2  = -0.85; // start
  const rowY_ctrl3  = -1.05; // quit
  const positionsX  = [-0.50, 0, 0.50];

  diffLabelMesh.position.set(0, rowY_diffLbl, 0.007);  group.add(diffLabelMesh);
  speedLabelMesh.position.set(0, rowY_speedLbl, 0.007); group.add(speedLabelMesh);
  ddaLabelMesh.position.set(0, rowY_ddaLbl, 0.007);    group.add(ddaLabelMesh);
  timeLabelMesh.position.set(0, rowY_timeLbl, 0.007);  group.add(timeLabelMesh);

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
    group.position.copy(pos).addScaledVector(forward, 1.5);
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
    ].filter(o => o.visible && !o.userData.disabled && o.userData.kind!=='label');
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
    if (kind==='start'){
      try {
        const hStr = window.prompt('Bitte Körpergröße in Metern eingeben:', BODY_CAPSULE_HEIGHT.toString());
        const sStr = window.prompt('Bitte Schulterbreite in Metern eingeben:', (BODY_CAPSULE_RADIUS*2).toString());
        const height = parseFloat(hStr);
        const shoulder = parseFloat(sStr);
        if (!isNaN(height) || !isNaN(shoulder)) {
          setBodyConfig({
            height: isNaN(height) ? undefined : height,
            shoulderWidth: isNaN(shoulder) ? undefined : shoulder
          });
        }
      } catch (e) {
        // prompt not available; ignore and keep defaults
      }
      return { action:'start' };
    }
    if (kind==='resume')  return { action:'resume' };
    if (kind==='restart') return { action:'restart' };
    if (kind==='quit')    return { action:'quit' };
    return null;
  }

  function getSelection(){ return { difficultyIndex: selDiff, speedIndex: selSpeed, timeIndex: selTime, ddaIndex: selDda }; }
  
  function updateAnimation(currentTime) {
    if (panel.userData.material && panel.userData.material.uniforms) {
      panel.userData.material.uniforms.uTime.value = currentTime * 0.001;
    }
  }

  return { group, panel, hitPlane, setVisible, placeAt, setMode, setHover, pickButtonAtWorldPoint, click, getSelection, updateAnimation };
}
