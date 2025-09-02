import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js?module';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.1/examples/jsm/loaders/GLTFLoader.js?module';

//
// --- Basis Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

const sessionInit = { optionalFeatures: ['local-floor', 'hand-tracking'] };
document.body.appendChild(ARButton.createButton(renderer, sessionInit));

// Licht
const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(light);

// Resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

//
// --- Tuning-Parameter ---
const BALL_RADIUS = 0.12;
const FIST_RADIUS = 0.11;
const SPAWN_DISTANCE = 2.5;     // m vor initialer Blickrichtung
const SIDE_OFFSET = 0.5;        // m links/rechts (normal)
const SIDE_OFFSET_TIGHT = 0.25; // m links/rechts (eng)
const TIGHT_PROB = 0.45;        // Wahrscheinlichkeit für "eng"
const BALL_SPEED = 1.6;         // m/s
const SPAWN_INTERVAL = 0.65;    // s zwischen Spawns
const PUNCH_SPEED = 0.6;        // m/s Mindestgeschwindigkeit der Faust

// Spawn-Höhenbegrenzung relativ zur INITIALEN Up-Achse
const SPAWN_MAX_BELOW = 0.70;   // m (max 70 cm unter Headset, nie darüber)

// "Miss"-Erkennung: Ebene an der initialen Körper-Position
// Wenn der Ball diese Ebene erreicht/überschreitet (ohne Treffer) -> Miss.
const MISS_PLANE_OFFSET = 0.02; // m vor der Ebene (kleiner Puffer; 0.00 = exakt Ebene)

// Scoreboard-Positionierung (am Boden, leicht nach oben geneigt)
const HUD_FORWARD = 1.0;        // m vor initialer Position
const HUD_TILT_DEG = 20;        // Grad Neigung nach oben
const HUD_PLANE_W = 0.50;
const HUD_PLANE_H = 0.25;       // Unterkante steht auf y=0, Center = HUD_PLANE_H/2

// GLB-Ball
const BALL_URL = './assets/ball.glb'; // ggf. anpassen

//
// --- „Initial Pose Lock“ ---
let poseLocked = false;
let iPos = new THREE.Vector3();       // initiale Kopfposition
let iQuat = new THREE.Quaternion();   // initiale Orientierung
let iForward = new THREE.Vector3();   // vorwärts
let iUp = new THREE.Vector3();        // oben
let iRight = new THREE.Vector3();     // rechts

function lockInitialPose() {
  iPos.setFromMatrixPosition(camera.matrixWorld);
  iQuat.copy(camera.quaternion);

  iForward.set(0, 0, -1).applyQuaternion(iQuat).normalize();
  iUp.set(0, 1, 0).applyQuaternion(iQuat).normalize();
  iRight.crossVectors(iForward, iUp).normalize();

  poseLocked = true;
  placeHUDOnFloorInitial();
}

renderer.xr.addEventListener('sessionstart', () => {
  poseLocked = false;
});

//
// --- Fäuste (Controller) ---
const fistGeo = new THREE.SphereGeometry(FIST_RADIUS, 16, 12);
const fistMat = new THREE.MeshStandardMaterial({ color: 0xffc043, metalness: 0.2, roughness: 0.7 });

const controllers = [];
const fists = []; // { mesh, ctrl, prevPos: Vector3, velocity: Vector3 }

function addController(i) {
  const ctrl = renderer.xr.getControllerGrip(i);
  scene.add(ctrl);

  const fist = new THREE.Mesh(fistGeo, fistMat);
  fist.name = `fist_${i}`;
  ctrl.add(fist);

  fists.push({
    mesh: fist,
    ctrl,
    prevPos: new THREE.Vector3(),
    velocity: new THREE.Vector3()
  });

  controllers.push(ctrl);
}
addController(0);
addController(1);

//
// --- Scoreboard (CanvasTexture auf Plane) ---
let hits = 0, misses = 0;

const hudCanvas = document.createElement('canvas');
hudCanvas.width = 512; hudCanvas.height = 256;
const hudCtx = hudCanvas.getContext('2d');

function drawHUD() {
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  hudCtx.fillStyle = 'rgba(0,0,0,0.4)';
  hudCtx.fillRect(0,0,hudCanvas.width,hudCanvas.height);
  hudCtx.fillStyle = '#ffffff';
  hudCtx.font = 'bold 64px system-ui, Arial';
  hudCtx.fillText(`Hits: ${hits}`, 30, 110);
  hudCtx.fillStyle = '#ff6b6b';
  hudCtx.fillText(`Misses: ${misses}`, 30, 200);
  hudTex.needsUpdate = true;
}
const hudTex = new THREE.CanvasTexture(hudCanvas);
hudTex.minFilter = THREE.LinearFilter;
drawHUD();

const hudMat = new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, side: THREE.DoubleSide });
const hudPlane = new THREE.Mesh(new THREE.PlaneGeometry(HUD_PLANE_W, HUD_PLANE_H), hudMat);
hudPlane.name = 'scoreboard';
scene.add(hudPlane);

// Boden-Platzierung relativ zur INITIALEN Pose
function placeHUDOnFloorInitial() {
  if (!poseLocked) return;

  const y = HUD_PLANE_H / 2 + 0.02; // 2 cm über Boden
  hudPlane.position.set(
    iPos.x + iForward.x * HUD_FORWARD,
    y,
    iPos.z + iForward.z * HUD_FORWARD
  );

  // Schild blickt zum Spieler (entlang -iForward) und wird leicht nach oben geneigt
  const lookTarget = new THREE.Vector3().copy(hudPlane.position).sub(iForward);
  hudPlane.lookAt(lookTarget);
  hudPlane.rotateX(THREE.MathUtils.degToRad(HUD_TILT_DEG));
}

//
// --- GLB Ball laden & skalieren ---
const loader = new GLTFLoader();

let ballPrefab = null;
let ballPrefabReady = false;
let ballScaleFactor = 1;

loader.load(
  BALL_URL,
  (gltf) => {
    ballPrefab = gltf.scene;

    // automatische Skalierung auf BALL_RADIUS
    const box = new THREE.Box3().setFromObject(ballPrefab);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    ballScaleFactor = (2 * BALL_RADIUS) / maxDim;

    // Transparenz für Fade-Out
    ballPrefab.traverse((n) => {
      if (n.isMesh && n.material) {
        if (Array.isArray(n.material)) n.material.forEach(m => { m.transparent = true; });
        else n.material.transparent = true;
      }
    });

    ballPrefabReady = true;
    console.log('[AR Punch] ball.glb geladen. ScaleFactor =', ballScaleFactor.toFixed(3));
  },
  undefined,
  (err) => console.error('Fehler beim Laden von ball.glb:', err)
);

function setObjectOpacity(obj, opacity) {
  obj.traverse((n) => {
    if (n.isMesh && n.material) {
      if (Array.isArray(n.material)) n.material.forEach(m => { m.opacity = opacity; });
      else n.material.opacity = opacity;
    }
  });
}

//
// --- Ball Pool/Logik ---
const balls = []; // { obj, velocity, alive, spin, spinAxis, spinSpeed, prevDot }
const pool = [];

function getBallObject() {
  let obj = pool.pop();
  if (!obj) obj = ballPrefab.clone(true);
  obj.visible = true;
  obj.scale.setScalar(ballScaleFactor);
  setObjectOpacity(obj, 1.0);
  return obj;
}

function releaseBallObject(obj) {
  obj.visible = false;
  obj.parent && obj.parent.remove(obj);
  pool.push(obj);
}

function spawnBall(sideSign /* -1 links, +1 rechts */) {
  if (!ballPrefabReady || !poseLocked) return;

  // eng oder normal?
  const sideMag = Math.random() < TIGHT_PROB ? SIDE_OFFSET_TIGHT : SIDE_OFFSET;

  // Höhe: max Headset, bis zu 0.70 m darunter (relativ zur initialen Up-Achse)
  const heightOffset = -Math.random() * SPAWN_MAX_BELOW; // [0, -0.70]

  // Spawnposition relativ zur INITIALEN Pose
  const spawnPos = new THREE.Vector3()
    .copy(iPos)
    .addScaledVector(iForward, SPAWN_DISTANCE)
    .addScaledVector(iRight, sideMag * sideSign)
    .addScaledVector(iUp, heightOffset);

  // konstante Flugrichtung auf den Spieler zu (kein Homing)
  const velocity = new THREE.Vector3().copy(iForward).multiplyScalar(-BALL_SPEED);

  const obj = getBallObject();
  obj.position.copy(spawnPos);
  scene.add(obj);

  // Zufallsrotation: mal ja, mal nein
  const spin = Math.random() < 0.5;
  let spinAxis = null, spinSpeed = 0;
  if (spin) {
    spinAxis = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize();
    spinSpeed = THREE.MathUtils.lerp(0.5, 2.0, Math.random()); // rad/s
  }

  // prevDot: projektierte Distanz entlang iForward von iPos aus (bei Spawn ~ SPAWN_DISTANCE)
  const prevDot = new THREE.Vector3().subVectors(spawnPos, iPos).dot(iForward);

  balls.push({
    obj,
    velocity,
    alive: true,
    spin,
    spinAxis,
    spinSpeed,
    prevDot
  });
}

function hitBall(ball) {
  ball.alive = false;
  setObjectOpacity(ball.obj, 0.25);
  setTimeout(() => releaseBallObject(ball.obj), 60);
  hits++;
  drawHUD();
}

function missBall(ball) {
  ball.alive = false;
  releaseBallObject(ball.obj);
  misses++;
  drawHUD();
}

//
// --- Update Loop ---
const clock = new THREE.Clock();
let spawnTimer = 0;
let sideSwitch = 1; // alterniert +1 / -1

function updateFists(dt) {
  for (const f of fists) {
    const worldPos = new THREE.Vector3();
    f.mesh.getWorldPosition(worldPos);
    f.velocity.copy(worldPos).sub(f.prevPos).multiplyScalar(1 / Math.max(dt, 1e-4));
    f.prevPos.copy(worldPos);
  }
}

function fistsBallCollision(ball) {
  const ballPos = ball.obj.getWorldPosition(new THREE.Vector3());
  for (const f of fists) {
    const fistPos = f.mesh.getWorldPosition(new THREE.Vector3());
    const toBall = new THREE.Vector3().subVectors(ballPos, fistPos);
    const dist = toBall.length();
    if (dist <= (BALL_RADIUS + FIST_RADIUS)) {
      const v = f.velocity;
      if (v.length() >= PUNCH_SPEED && toBall.dot(v) > 0) { // Faust bewegt sich zum Ball
        return true;
      }
    }
  }
  return false;
}

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();

  // Initialpose einmalig locken (nach Start)
  if (renderer.xr.isPresenting && !poseLocked) {
    lockInitialPose();
  }

  updateFists(dt);

  // Spawner
  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnBall(sideSwitch);
    sideSwitch *= -1;
    spawnTimer = 0;
  }

  // Bälle bewegen, drehen und prüfen
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (!b.alive) { balls.splice(i,1); continue; }

    // Bewegung
    b.obj.position.addScaledVector(b.velocity, dt);

    // Rotation (optional)
    if (b.spin) b.obj.rotateOnAxis(b.spinAxis, b.spinSpeed * dt);

    // --- Treffer zuerst prüfen (gleicher Frame vorrangig) ---
    if (fistsBallCollision(b)) {
      hitBall(b);
      balls.splice(i,1);
      continue;
    }

    // --- Miss prüfen: Ebene überschritten? ---
    // Projektionsdistanz entlang initialer Vorwärtsachse relativ zu iPos
    const currDot = new THREE.Vector3().subVectors(b.obj.position, iPos).dot(iForward);
    // Vorher vor der Ebene ( > MISS_PLANE_OFFSET ), jetzt auf/über Ebene ( <= MISS_PLANE_OFFSET )?
    if (b.prevDot > MISS_PLANE_OFFSET && currDot <= MISS_PLANE_OFFSET) {
      missBall(b);
      balls.splice(i,1);
      continue;
    }
    b.prevDot = currDot;

    // Safety: sehr weit weg hinter der Ebene -> weg (falls irgendwas durchrutscht)
    if (currDot < -6.0) {
      b.alive = false;
      releaseBallObject(b.obj);
      balls.splice(i,1);
      continue;
    }
  }

  renderer.render(scene, camera);
});

// Session-Cleanup
renderer.xr.addEventListener('sessionend', () => {
  for (const b of balls) releaseBallObject(b.obj);
  balls.length = 0;
});
