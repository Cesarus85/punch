import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
spinSpeed = THREE.MathUtils.lerp(0.5, 2.0, Math.random());
}


const prevDot = new THREE.Vector3().subVectors(spawnPos, iPos).dot(iForward);


balls.push({ obj, velocity, alive:true, spin, spinAxis, spinSpeed, prevDot });
}


function hitBall(b){
b.alive = false;
setOpacity(b.obj, 0.25);
setTimeout(()=>{ scene.remove(b.obj); }, 60);
hits++; hud.set(hits, misses);
}


function missBall(b){
b.alive = false;
scene.remove(b.obj);
misses++; hud.set(hits, misses);
}


// --- Collision ---
function fistsBallCollision(ballPos, fists){
for (const f of fists){
const toBall = new THREE.Vector3().subVectors(ballPos, f.pos);
const dist = toBall.length();
if (dist <= (BALL_RADIUS + FIST_RADIUS)){
if (f.vel.length() >= PUNCH_SPEED && toBall.dot(f.vel) > 0){
return true;
}
}
}
return false;
}


// --- Loop ---
const clock = new THREE.Clock();
let spawnTimer = 0; let sideSwitch = 1;


renderer.setAnimationLoop(()=>{
const dt = clock.getDelta();


if (renderer.xr.isPresenting && !poseLocked){
lockInitialPose();
}


const fists = fistsMgr.update(dt); // [{pos, vel}, ...]


spawnTimer += dt;
if (spawnTimer >= SPAWN_INTERVAL){
spawnBall(sideSwitch); sideSwitch *= -1; spawnTimer = 0;
}


for (let i = balls.length-1; i>=0; i--){
const b = balls[i];
if (!b.alive){ balls.splice(i,1); continue; }


// Bewegung & optional Spin
b.obj.position.addScaledVector(b.velocity, dt);
if (b.spin) b.obj.rotateOnAxis(b.spinAxis, b.spinSpeed * dt);


// Treffer zuerst prüfen
const ballPos = b.obj.getWorldPosition(new THREE.Vector3());
if (fistsBallCollision(ballPos, fists)){
hitBall(b); balls.splice(i,1); continue;
}


// Miss: Ebene (initiale Körper-Ebene) überschritten?
const currDot = new THREE.Vector3().subVectors(b.obj.position, iPos).dot(iForward);
if (b.prevDot > MISS_PLANE_OFFSET && currDot <= MISS_PLANE_OFFSET){
missBall(b); balls.splice(i,1); continue;
}
b.prevDot = currDot;


// Safety: weit hinter der Ebene -> entfernen
if (currDot < -6.0){
b.alive = false; scene.remove(b.obj); balls.splice(i,1); continue;
}
}


renderer.render(scene, camera);
});


renderer.xr.addEventListener('sessionend', ()=>{
for (const b of balls){ scene.remove(b.obj); }
balls.length = 0;
});
