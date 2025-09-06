// Robustes Menü mit Hit-Plane, 2D-Picking und Zeitmodi
import * as THREE from './three.js';
import { setBodyConfig } from './config.js';

// Hidden input element for capturing keyboard text input
const hidden = document.createElement('input');
hidden.type = 'text';
hidden.style.position = 'absolute';
hidden.style.opacity = '0';
hidden.style.pointerEvents = 'none';
document.body.appendChild(hidden);

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
function makeButton(label, w=0.36, h=0.12) {
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
  ctx.font = `600 72px 'Segoe UI', system-ui, Arial`;
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

function makeInputField(label, w=0.50, h=0.12) {
  const mesh = makeCanvasPlane(w, h);
  mesh.userData.kind = null;
  mesh.userData.label = label;
  mesh.userData.text = '';
  mesh.userData.hover = false;
  mesh.userData.focus = false;
  mesh.userData.disabled = false;
  drawInputField(mesh);
  return mesh;
}

function drawInputField(field) {
  const { _ctx:ctx, _tex:tex, label, text, hover, focus } = field.userData;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);

  const labelFont = `600 64px 'Segoe UI', system-ui, Arial`;
  ctx.font = labelFont;
  ctx.fillStyle = '#fff';
  const labelWidth = ctx.measureText(label).width;
  const padding = 20;
  const boxX = labelWidth + padding*2;
  const boxY = 16;
  const boxW = W - boxX - padding;
  const boxH = H - boxY*2;

  // label
  ctx.fillText(label, padding, H*0.66);

  // box background
  ctx.fillStyle = 'rgba(50, 60, 75, 0.9)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // border
  ctx.strokeStyle = focus ? '#00e5ff' : (hover ? '#ffffff' : '#888');
  ctx.lineWidth = (focus || hover) ? 6 : 4;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // text
  ctx.fillStyle = '#fff';
  ctx.font = `600 60px 'Segoe UI', system-ui, Arial`;
  ctx.fillText(text, boxX + 10, H*0.66);

  tex.needsUpdate = true;
}
function makePanelBG(w=2.40, h=1.80) {
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

export function createMenu(diffLabels, speedLabels, timeLabels, ddaLabels, beatLabels) {
  const group = new THREE.Group();
  group.name = 'menuOverlay';

  const panel = makePanelBG(2.40, 1.80);
  group.add(panel);

  // Unsichtbare Hit-Plane knapp vor den Buttons für Ray-Treffer/Laser
  const hitPlane = new THREE.Mesh(
    // Breitere Fläche, damit auch rechts platzierte Buttons erfasst werden
    new THREE.PlaneGeometry(4.0, 2.0, 1, 1),
    new THREE.MeshBasicMaterial({ transparent:true, opacity:0.0, depthWrite:false })
  );
  hitPlane.position.set(0, 0, 0.006);
  hitPlane.name = 'menuHitPlane';
  group.add(hitPlane);

  // Logo und Spielname
  const rowY_logo = 0.70;
  const rowY_title = 0.52;
  
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
  const beatLabelMesh  = makeLabel(); drawLabel(beatLabelMesh,  'Taktbindung');
  const timeLabelMesh  = makeLabel(); drawLabel(timeLabelMesh,  'Zeiteinstellungen');

  // Buttons
  const diffButtons = diffLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.36, 0.12);
    b.userData.kind = 'difficulty'; b.userData.index = i;
    return b;
  });
  const speedButtons = speedLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.36, 0.12);
    b.userData.kind = 'speed'; b.userData.index = i;
    return b;
  });
  const ddaButtons = ddaLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.36, 0.12);
    b.userData.kind = 'dda'; b.userData.index = i;
    return b;
  });
  const beatButtons = beatLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.36, 0.12);
    b.userData.kind = 'beat'; b.userData.index = i;
    return b;
  });
  const timeButtons = timeLabels.map((lbl, i) => {
    const b = makeButton(lbl, 0.36, 0.12);
    b.userData.kind = 'time'; b.userData.index = i;
    return b;
  });

  // Panel und Buttons für Musikauswahl
  const songPanel = makePanelBG(0.60, 1.00);
  group.add(songPanel);
  let songButtons = [];
  let selSong = -1;
  let selSongUrl = null;
  let selectedTrack = null;
  const timeDirs = ['1_min','3_min','5_min'];
  async function loadSongsForTime(idx){
    songButtons.forEach(b => group.remove(b));
    songButtons = [];
    selSong = -1;
    selSongUrl = null;
    selectedTrack = null;
    const dir = timeDirs[idx];
    try {
      const res = await fetch(`./assets/music/${dir}/manifest.json`);
      const list = await res.json();
      const buttonHeight = 0.12;
      const margin = 0.02;
      const panelHeight = songPanel.geometry.parameters.height;
      const panelTop = songPanel.position.y + panelHeight/2;
      const panelBottom = songPanel.position.y - panelHeight/2;
      const topY = panelTop - buttonHeight/2 - margin;
      const bottomY = panelBottom + buttonHeight/2 + margin;
      const step = list.length > 1 ? (topY - bottomY) / (list.length - 1) : 0;
      const startY = list.length > 1 ? topY : (topY + bottomY) / 2;
      list.forEach((item,i) => {
        const b = makeButton(item.name || item.file || item, 0.36, buttonHeight);
        b.userData.kind = 'song';
        b.userData.index = i;
        b.userData.url = `./assets/music/${dir}/${item.file || item}`;
        const y = startY - step*i;
        // Align each song button with the song panel's X coordinate
        b.position.set(songPanelX, y, 0.007);
        group.add(b);
        songButtons.push(b);
        drawButton(b);
      });
      setSelected(songButtons, -1);
    } catch(err){
      console.error('loadSongsForTime', err);
    }
    updateStartDisabled();
  }

  const startBtn   = makeButton('Starten',    0.60, 0.12); startBtn.userData.kind = 'start';
  startBtn.userData.disabled = true; // initially disabled
  const resumeBtn  = makeButton('Fortsetzen', 0.60, 0.12); resumeBtn.userData.kind = 'resume';
  const restartBtn = makeButton('Neu starten',0.60, 0.12); restartBtn.userData.kind = 'restart';
  const quitBtn    = makeButton('Beenden',    0.60, 0.12); quitBtn.userData.kind = 'quit';
  // Werte für Körperkonfiguration
  let heightVal = parseFloat(sessionStorage.getItem('height'));   // m
  let shoulderVal = parseFloat(sessionStorage.getItem('shoulderWidth')); // m
  const storedGender = sessionStorage.getItem('gender');
  if (storedGender === 'male' && isNaN(shoulderVal)) shoulderVal = 0.47;
  if (storedGender === 'female' && isNaN(shoulderVal)) shoulderVal = 0.36;
  if (isNaN(heightVal)) heightVal = NaN;
  if (isNaN(shoulderVal)) shoulderVal = NaN;

  // Eingabefeld für Größe und Geschlechter-Buttons
  const heightField = makeInputField('Größe', 0.50, 0.12); heightField.userData.kind = 'height';
  const genderMaleBtn = makeButton('Männlich', 0.36, 0.12); genderMaleBtn.userData.kind = 'gender'; genderMaleBtn.userData.gender = 'male';
  const genderFemaleBtn = makeButton('Weiblich', 0.36, 0.12); genderFemaleBtn.userData.kind = 'gender'; genderFemaleBtn.userData.gender = 'female';
  const genderButtons = [genderMaleBtn, genderFemaleBtn];
  let selGender = storedGender === 'male' ? 0 : storedGender === 'female' ? 1 : -1;

  function updateHeightField(){
    heightField.userData.text = isNaN(heightVal) ? '' : heightVal.toFixed(2);
    drawInputField(heightField);
  }

  genderButtons.forEach(b=>drawButton(b));

  let startDisabled = true;
  function updateStartDisabled(){
    startDisabled = isNaN(heightVal) || isNaN(shoulderVal) || selectedTrack === null;
    startBtn.userData.disabled = startDisabled || mode !== 'prestart';
    drawButton(startBtn);
  }

  updateHeightField();

  let activeInput = null;
  function setActiveInput(field){
    if (activeInput === field) return;
    if (activeInput){
      activeInput.userData.focus = false;
      drawInputField(activeInput);
      hidden.value = '';
      hidden.blur();
    }
    activeInput = field;
    if (activeInput){
      hidden.value = activeInput.userData.text;
      hidden.focus();
      activeInput.userData.focus = true;
      drawInputField(activeInput);
    }
  }

  hidden.addEventListener('input', () => {
    if (!activeInput) return;
    activeInput.userData.text = hidden.value;
    drawInputField(activeInput);
  });

  hidden.addEventListener('blur', () => {
    if (!activeInput) return;
    const val = parseFloat(hidden.value.replace(',', '.'));
    if (!isNaN(val)){
      if (activeInput === heightField){
        heightVal = val;
        sessionStorage.setItem('height', val.toString());
        updateHeightField();
      }
      updateStartDisabled();
    }
  });

  function handleKeydown(e){
    if (!activeInput) return;
    if (e.key === 'Enter'){
      const val = parseFloat(hidden.value.replace(',', '.'));
      if (!isNaN(val)){
        if (activeInput === heightField){
          heightVal = val;
          sessionStorage.setItem('height', val.toString());
          updateHeightField();
        }
        updateStartDisabled();
      }
      setActiveInput(null);
    }
  }

  hidden.addEventListener('keydown', handleKeydown);

  // Layout mit mehr Abstand zwischen Reihen
  const rowY_diff   = 0.30;
  const rowY_speed  = 0.10;
  const rowY_dda    = -0.10;
  const rowY_beat   = -0.30;
  const rowY_time   = -0.50;
  const rowY_body   = -0.65; // Größe/Geschlecht
  const rowY_diffLbl  = rowY_diff  + 0.12;
  const rowY_speedLbl = rowY_speed + 0.12;
  const rowY_ddaLbl   = rowY_dda   + 0.12;
  const rowY_beatLbl  = rowY_beat  + 0.12;
  const rowY_timeLbl  = rowY_time  + 0.10;
  const rowY_ctrl   = -0.80; // Steuer-Buttons
  const getPositionsX = (count, spacing = 0.70) => {
    const start = -(spacing * (count - 1)) / 2;
    return Array.from({ length: count }, (_, i) => start + i * spacing);
  };
  // Position the song selection panel with a small gap to the right of the main menu
  const songPanelX = 1.55;
  songPanel.position.set(songPanelX, rowY_time + 0.10, 0.006);

  diffLabelMesh.position.set(0, rowY_diffLbl, 0.007);  group.add(diffLabelMesh);
  speedLabelMesh.position.set(0, rowY_speedLbl, 0.007); group.add(speedLabelMesh);
  ddaLabelMesh.position.set(0, rowY_ddaLbl, 0.007);    group.add(ddaLabelMesh);
  beatLabelMesh.position.set(0, rowY_beatLbl, 0.007);  group.add(beatLabelMesh);
  timeLabelMesh.position.set(0, rowY_timeLbl, 0.007);  group.add(timeLabelMesh);

  const diffPosX = getPositionsX(diffButtons.length);
  diffButtons.forEach((b,i)=>{ b.position.set(diffPosX[i], rowY_diff, 0.007); group.add(b); });

  const speedPosX = getPositionsX(speedButtons.length);
  speedButtons.forEach((b,i)=>{ b.position.set(speedPosX[i], rowY_speed, 0.007); group.add(b); });

  const ddaPosX = getPositionsX(ddaButtons.length);
  ddaButtons.forEach((b,i)=>{ b.position.set(ddaPosX[i], rowY_dda, 0.007); group.add(b); });

  const beatPosX = getPositionsX(beatButtons.length);
  beatButtons.forEach((b,i)=>{ b.position.set(beatPosX[i], rowY_beat, 0.007); group.add(b); });

  const timePosX = getPositionsX(timeButtons.length);
  timeButtons.forEach((b,i)=>{ b.position.set(timePosX[i], rowY_time, 0.007); group.add(b); });

  // Größe und Geschlecht
  const bodyPosX = getPositionsX(3);
  heightField.position.set(bodyPosX[0], rowY_body, 0.007);
  genderMaleBtn.position.set(bodyPosX[1], rowY_body, 0.007);
  genderFemaleBtn.position.set(bodyPosX[2], rowY_body, 0.007);
  group.add(heightField, genderMaleBtn, genderFemaleBtn);

  const ctrlPosX = getPositionsX(3);
  resumeBtn.position.set(ctrlPosX[0], rowY_ctrl, 0.007);
  restartBtn.position.set(ctrlPosX[2], rowY_ctrl, 0.007);
  startBtn.position.set(ctrlPosX[0], rowY_ctrl, 0.007);
  quitBtn.position.set(ctrlPosX[1], rowY_ctrl, 0.007);
  group.add(resumeBtn, restartBtn, startBtn, quitBtn);

  // Auswahlzustand
  const ls = (typeof window !== 'undefined') ? window.localStorage : null;
  const loadIdx = (key, max, def) => {
    const v = parseInt(ls?.getItem(key), 10);
    return Number.isInteger(v) && v >= 0 && v < max ? v : def;
  };

  let selDiff = loadIdx('selDiff', diffLabels.length, 0);
  let selSpeed = loadIdx('selSpeed', speedLabels.length, 1);
  let selTime  = loadIdx('selTime', 3, 0);
  let selBeat  = loadIdx('selBeat',  beatLabels.length, 1);
  let selDda = 2; // DDA 100%
  const setSelected = (arr, idx) => arr.forEach((b,i)=>{ b.userData.selected=(i===idx); drawButton(b); });
  setSelected(diffButtons, selDiff);
  setSelected(speedButtons, selSpeed);
  setSelected(timeButtons, selTime);
  setSelected(ddaButtons, selDda);
  setSelected(beatButtons, selBeat);
  ls?.setItem('selDiff', selDiff.toString());
  ls?.setItem('selSpeed', selSpeed.toString());
  ls?.setItem('selTime', selTime.toString());
  ls?.setItem('selBeat', selBeat.toString());
  if (selGender >= 0) setSelected(genderButtons, selGender);
  loadSongsForTime(selTime);

  // Modus: 'prestart' | 'ingame'
  let mode = 'prestart';
  function setMode(m){
    mode = m;
    const pre = (mode==='prestart');
    if (pre){
      selectedTrack = null;
      selSong = -1;
      selSongUrl = null;
      setSelected(songButtons, -1);
    }
    startBtn.visible   = pre;
    resumeBtn.visible  = !pre;
    restartBtn.visible = !pre;
    quitBtn.visible    = true;
    updateStartDisabled();
    resumeBtn.userData.disabled  = pre;   drawButton(resumeBtn);
    restartBtn.userData.disabled = pre;   drawButton(restartBtn);
    quitBtn.userData.disabled    = false; drawButton(quitBtn);
  }
  setMode('prestart');
  updateStartDisabled();

  // Hover zentral
  let hoveredBtn = null, hoverTimer = null;
  function drawElement(o){
    if (o.userData.kind==='height') drawInputField(o);
    else drawButton(o);
  }
  function clearHover(){
    if (hoverTimer){ clearTimeout(hoverTimer); hoverTimer = null; }
    if (hoveredBtn){ hoveredBtn.userData.hover=false; drawElement(hoveredBtn); hoveredBtn=null; }
  }
  function setHover(btn){
    if (hoveredBtn === btn) return;
    if (!btn){
      if (hoveredBtn && !hoverTimer){ hoverTimer = setTimeout(clearHover, 200); }
      return;
    }
    if (hoverTimer){ clearTimeout(hoverTimer); hoverTimer=null; }
    if (hoveredBtn){ hoveredBtn.userData.hover=false; drawElement(hoveredBtn); }
    hoveredBtn = (btn.visible && !btn.userData.disabled && btn.userData.kind!=='title') ? btn : null;
    if (hoveredBtn){ hoveredBtn.userData.hover=true; drawElement(hoveredBtn); }
  }

  function setVisible(v){
    group.visible = v;
    if(!v) clearHover();
  }
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
      ...diffButtons, ...speedButtons, ...ddaButtons, ...beatButtons, ...timeButtons,
      ...songButtons,
      heightField, ...genderButtons,
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
    if (kind==='difficulty'){
      selDiff=index; setSelected(diffButtons, selDiff); ls?.setItem('selDiff', selDiff.toString());
      const lbl = diffLabels[index];
      const diffName = lbl === 'Jab-Only'
        ? 'JabOnly'
        : lbl === 'Doppelfaust'
          ? 'Doppelfaust'
          : lbl;
      return { action:'set-difficulty', value: selDiff, diffName };
    }
    if (kind==='speed'){ selSpeed=index; setSelected(speedButtons, selSpeed); ls?.setItem('selSpeed', selSpeed.toString()); return { action:'set-speed', value: selSpeed }; }
    if (kind==='dda'){ selDda=index; setSelected(ddaButtons, selDda); return { action:'set-dda', value: selDda }; }
    if (kind==='beat'){ selBeat=index; setSelected(beatButtons, selBeat); ls?.setItem('selBeat', selBeat.toString()); return { action:'set-beat', value: selBeat }; }
    if (kind==='time'){ selTime=index; setSelected(timeButtons, selTime); ls?.setItem('selTime', selTime.toString()); loadSongsForTime(selTime); return { action:'set-time', value: selTime }; }
    if (kind==='song'){
      selSong=index;
      selSongUrl=btn.userData.url;
      selectedTrack = btn.userData.url;
      setSelected(songButtons, selSong);
      updateStartDisabled();
      return { action:'set-song', value: selSong };
    }
    if (kind==='height'){ setActiveInput(heightField); return null; }
    if (kind==='gender'){
      shoulderVal = (btn.userData.gender==='male') ? 0.47 : 0.36;
      sessionStorage.setItem('shoulderWidth', shoulderVal.toString());
      sessionStorage.setItem('gender', btn.userData.gender);
      selGender = btn.userData.gender==='male' ? 0 : 1;
      setSelected(genderButtons, selGender);
      updateStartDisabled();
      return null;
    }
    if (kind==='start'){
      const height = heightVal;
      const shoulder = shoulderVal;
      setBodyConfig({ height, shoulderWidth: shoulder });
      return { action:'start', songUrl: selSongUrl };
    }
    if (kind==='resume')  return { action:'resume' };
    if (kind==='restart') return { action:'restart', songUrl: selSongUrl };
    if (kind==='quit')    return { action:'quit' };
    return null;
  }

  function getSelection(){ return { difficultyIndex: selDiff, speedIndex: selSpeed, timeIndex: selTime, ddaIndex: selDda, beatIndex: selBeat, songUrl: selSongUrl }; }
  
  function updateAnimation(currentTime) {
    if (panel.userData.material && panel.userData.material.uniforms) {
      panel.userData.material.uniforms.uTime.value = currentTime * 0.001;
    }
  }

  return { group, panel, hitPlane, setVisible, placeAt, setMode, setHover, pickButtonAtWorldPoint, click, getSelection, updateAnimation };
}
