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
const SIDE_OFFSET = 0.5;        // m links/rechts
const BALL_SPEED = 1.6;         // m/s
const SPAWN_INTERVAL = 0.65;    // s zwischen Spawns
const IMPACT_RADIUS = 0.35;     // m -> Miss, wenn Ball so nahe kommt
const PUNCH_SPEED = 0.6;        // m/s Mindestgeschwindigkeit der Faust

// Spawn-Höhenbegrenzung: nie über Headset, bis zu 0.70 m darunter (relativ zur INITIALEN Up-Achse)
const SPAWN_MAX_BELOW = 0.70;   // m

// Scoreboard-Positionierung (am Boden, leicht nach oben geneigt)
const HUD_FORWARD = 1.0;        // m vor initialer Position
const HUD_TILT_DEG = 20;        // Grad Neigung nach oben
const HUD_PLANE_W = 0.50;
const HUD_PLANE_H = 0.25;       // Unterkante steht auf y=0, daher liegt Center bei HUD_PLANE_H/2

// GLB-Ball
const BALL_URL = './assets/ball.glb'; // ggf. anpassen

//
// --- „Initial Pose Lock“ ---
let poseLocked = false;
let iPos = new THREE.Vector3();       // initiale Position (Kopf)
let iQuat = new THREE.Quaternion();   // initiale Orientierung
let iForward = new THREE.Vector3();   // vorwärts (aus iQuat)
let iUp = new THREE.Vector3();        // oben (aus iQuat)
let iRight = new THREE.Vector3();     // rechts (iForward x iUp)

function lockInitialPose() {
  iPos.setFromMatrixPosition(camera.matrixWorld);
  iQuat.copy(camera.quaternion);

  iForward.set(0, 0, -1).applyQuaternion(iQuat).normalize();
  iUp.set(0, 1, 0).applyQuaternion(iQuat).normalize();
  iRight.crossVectors(iForward, iUp).normalize();

  poseLocked = true;
  // Scoreboard platzieren, sobald wir die Pose kennen
  placeHUDOnFloorInitial();
}

renderer.xr.addEventListener('sessionstart', () => {
  poseLocked = false;
});

//
// --- Ressourcen für Fäuste ---
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

  // Unterkante auf Boden (y ~ 0) -> Center auf HUD_PLANE_H/2
  const y = HUD_PLANE_H / 2 + 0.02; // 2cm über Boden

  // Position: ein Stück vor der initialen Position, entlang initialer Vorwärtsrichtung
  hudPlane.position.set(
    iPos.x + iForward.x * HUD_FORWARD,
    y,
    iPos.z + iForward.z * HUD_FORWARD
  );

  // Orientierung: zum Spieler (entlang -iForward) blicken, dann leicht nach oben neigen
  const lookTarget = new THREE.Vector3().copy(hudPlane.position).sub(iForward);
  hudPlane.lookAt(lookTarget);
  // leichte Neigung nach oben (Top weg vom Spieler)
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

    // Bounding-Box für automatische Skalierung
    const box = new THREE.Box3().setFromObject(ballPrefab);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    ballScaleFactor = (2 * BALL_RADIUS) / maxDim;

    // Materialien transparent erlauben (für Fade-Out)
    ballPrefab.traverse((n) => {
      if (n.isMesh && n.material) {
        if (Array.isArray(n.material)) {
          n.material.forEach(m => { m.transparent = true; });
        } else {
          n.material.transparent = true;
        }
      }
    });

    ballPrefabReady = true;
    console.log('[AR Punch] ball.glb geladen. ScaleFactor =', ballScaleFactor.toFixed(3));
  },
  undefined,
  (err) => {
    console.error('Fehler beim Laden von ball.glb:', err);
  }
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
// --- Ball Pool/Logik (GLB-Objekte) ---
const balls = []; // aktive: { obj, velocity, alive, spin, spinAxis, spinSpeed }
const pool = [];  // recycelte Object3D-Instanzen

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

  // Höhe max. Headset (0), min. bis 0.70 m darunter (negativ) — alles relativ zur INITIALEN Up-Achse
  const heightOffset = -Math.random() * SPAWN_MAX_BELOW; // [0, -0.70]

  const spawnPos = new THREE.Vector3()
    .copy(iPos)
    .addScaledVector(iForward, SPAWN_DISTANCE)
    .addScaledVector(iRight, SIDE_OFFSET * sideSign)
    .addScaledVector(iUp, heightOffset);

  // Flugrichtung: konstant auf den Spieler zu (entlang -initialForward), NICHT zur aktuellen Kopfposition „homing“
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

  balls.push({
    obj,
    velocity,
    alive: true,
    spin,
    spinAxis,
    spinSpeed
  });
}

function hitBall(ball) {
  ball.alive = false;
  setObjectOpacity(ball.obj, 0.25);         // kurzer „Auflösen“-Effekt
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
  // Weltposition/Velocity berechnen
  for (const f of fists) {
    const worldPos = new THREE.Vector3();
    f.mesh.getWorldPosition(worldPos);
    // v = (p - prev)/dt
    f.velocity.copy(worldPos).sub(f.prevPos).multiplyScalar(1 / Math.max(dt, 1e-4));
    f.prevPos.copy(worldPos);
  }
}

function fistsBallCollision(ball) {
  // Treffer nur wenn Faust ausreichend schnell und in Richtung Ball
  const ballPos = ball.obj.getWorldPosition(new THREE.Vector3());
  for (const f of fists) {
    const fistPos = f.mesh.getWorldPosition(new THREE.Vector3());
    const toBall = new THREE.Vector3().subVectors(ballPos, fistPos);
    const dist = toBall.length();
    if (dist <= (BALL_RADIUS + FIST_RADIUS)) {
      const v = f.velocity;
      if (v.length() >= PUNCH_SPEED && toBall.dot(v) > 0) { // bewegt sich Richtung Ball
        return true;
      }
    }
  }
  return false;
}

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();

  // Einmalig: initiale Pose kurz nach Start festhalten
  if (renderer.xr.isPresenting && !poseLocked) {
    // eine Frame-Latenz abwarten, damit camera.matrixWorld valide ist
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
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (!b.alive) { balls.splice(i,1); continue; }

    // Translation (konstante Richtung)
    b.obj.position.addScaledVector(b.velocity, dt);

    // Optional: Rotation
    if (b.spin) b.obj.rotateOnAxis(b.spinAxis, b.spinSpeed * dt);

    // Miss, wenn Ball nahe an Kopf vorbeikommt
    const distToHead = b.obj.position.distanceTo(camPos);
    if (distToHead <= IMPACT_RADIUS) {
      missBall(b);
      balls.splice(i,1);
      continue;
    }

    // Treffer?
    if (fistsBallCollision(b)) {
      hitBall(b);
      balls.splice(i,1);
      continue;
    }

    // Safety: weit hinter Spieler -> weg
    if (distToHead > 6.0) {
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
