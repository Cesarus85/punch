import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js';

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

const sessionInit = {
  optionalFeatures: ['local-floor', 'hand-tracking']
};
document.body.appendChild(ARButton.createButton(renderer, sessionInit));

// dezentes Licht für sichtbare Meshes
const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(light);

// Resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

//
// --- Gemeinsame Ressourcen ---
const BALL_RADIUS = 0.12;
const FIST_RADIUS = 0.11;
const SPAWN_DISTANCE = 2.5;         // m vor dem Player
const SIDE_OFFSET = 0.5;            // m links/rechts
const HEIGHT_VARIATION = 0.25;      // m
const BALL_SPEED = 1.6;             // m/s
const SPAWN_INTERVAL = 0.65;        // s zwischen Spawns
const IMPACT_RADIUS = 0.35;         // m -> Miss, wenn Ball so nahe kommt
const PUNCH_SPEED = 0.6;            // m/s Mindestgeschwindigkeit der Faust

// geteilte Geometrie/Materialien
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 16, 12);
const ballMat = new THREE.MeshStandardMaterial({ color: 0x2aa1ff, metalness: 0.1, roughness: 0.6, transparent: true });

const fistGeo = new THREE.SphereGeometry(FIST_RADIUS, 16, 12);
const fistMat = new THREE.MeshStandardMaterial({ color: 0xffc043, metalness: 0.2, roughness: 0.7 });

//
// --- „Fäuste“ (Controller) ---
const controllers = [];
const fists = [];            // { mesh, ctrl, prevPos: Vector3, velocity: Vector3 }

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
const hudPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), hudMat);
hudPlane.name = 'scoreboard';
scene.add(hudPlane);

//
// --- Ball Pool/Logik ---
const balls = [];     // aktive
const pool = [];      // recycelte meshes

function getBallMesh() {
  const mesh = pool.pop() || new THREE.Mesh(ballGeo, ballMat.clone());
  mesh.visible = true;
  mesh.material.opacity = 1.0;
  return mesh;
}

function releaseBallMesh(mesh) {
  mesh.visible = false;
  mesh.parent && mesh.parent.remove(mesh);
  pool.push(mesh);
}

function spawnBall(sideSign /* -1 links, +1 rechts */) {
  // aktuelle Kopf-/Kameraorientierung
  const camWorldPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const camWorldQuat = new THREE.Quaternion().copy(camera.quaternion);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camWorldQuat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camWorldQuat).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();

  const heightOffset = (Math.random()*2 - 1) * HEIGHT_VARIATION;

  const spawnPos = new THREE.Vector3()
    .copy(camWorldPos)
    .addScaledVector(forward, SPAWN_DISTANCE)
    .addScaledVector(right, SIDE_OFFSET * sideSign)
    .addScaledVector(up, heightOffset);

  const dirToCam = new THREE.Vector3().subVectors(camWorldPos, spawnPos).normalize();
  const velocity = dirToCam.multiplyScalar(BALL_SPEED);

  const mesh = getBallMesh();
  mesh.position.copy(spawnPos);
  scene.add(mesh);

  balls.push({
    mesh,
    velocity,
    alive: true
  });
}

function hitBall(ball) {
  ball.alive = false;
  // kleiner „Auflösen“-Effekt (Fade)
  const mat = ball.mesh.material;
  mat.opacity = 0.25;
  setTimeout(() => releaseBallMesh(ball.mesh), 60);
  hits++;
  drawHUD();
}

function missBall(ball) {
  ball.alive = false;
  releaseBallMesh(ball.mesh);
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
  const ballPos = ball.mesh.getWorldPosition(new THREE.Vector3());
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

function updateHUDPose() {
  // Scoreboard rechts neben dem Spieler, leicht vorne/oben, auf Kamera blickend
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();

  hudPlane.position.copy(camPos)
    .addScaledVector(right, 0.6)
    .addScaledVector(forward, 0.5)
    .addScaledVector(up, 0.10);
  hudPlane.quaternion.copy(camera.quaternion); // immer zum Spieler ausgerichtet
}

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();

  updateFists(dt);
  updateHUDPose();

  // Spawner
  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnBall(sideSwitch);
    sideSwitch *= -1;
    spawnTimer = 0;
  }

  // Bälle bewegen und prüfen
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (!b.alive) { balls.splice(i,1); continue; }

    b.mesh.position.addScaledVector(b.velocity, dt);

    // Miss, wenn Ball nahe an Kopf vorbeikommt
    const distToHead = b.mesh.position.distanceTo(camPos);
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
      releaseBallMesh(b.mesh);
      balls.splice(i,1);
      continue;
    }
  }

  renderer.render(scene, camera);
});

// Session-Cleanup (optional)
renderer.xr.addEventListener('sessionend', () => {
  // alles in Pool zurück
  for (const b of balls) releaseBallMesh(b.mesh);
  balls.length = 0;
});
