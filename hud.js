import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { HUD_PLANE_W, HUD_PLANE_H, HUD_FORWARD, HUD_RIGHT, HUD_TILT_DEG } from './config.js';


export function createHUD(scene){
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 256;
const ctx = canvas.getContext('2d');
const tex = new THREE.CanvasTexture(canvas);
tex.minFilter = THREE.LinearFilter;


const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
const plane = new THREE.Mesh(new THREE.PlaneGeometry(HUD_PLANE_W, HUD_PLANE_H), mat);
plane.name = 'scoreboard';
scene.add(plane);


let hits = 0, misses = 0;


function draw(){
ctx.clearRect(0,0,canvas.width,canvas.height);
ctx.fillStyle = 'rgba(0,0,0,0.4)';
ctx.fillRect(0,0,canvas.width,canvas.height);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 64px system-ui, Arial';
ctx.fillText(`Hits: ${hits}`, 30, 110);
ctx.fillStyle = '#ff6b6b';
ctx.fillText(`Misses: ${misses}`, 30, 200);
tex.needsUpdate = true;
}
draw();


function set(h, m){ hits = h; misses = m; draw(); }


// Feste Platzierung relativ zur INITIALEN Pose
function place(initial){
const { iPos, iForward, iRight } = initial;
const y = HUD_PLANE_H/2 + 0.02; // 2 cm über Boden
const pos = new THREE.Vector3()
.copy(iPos)
.addScaledVector(iForward, HUD_FORWARD)
.addScaledVector(iRight, HUD_RIGHT);


plane.position.set(pos.x, y, pos.z);


// zum Spieler blicken (entlang -iForward) und leicht nach oben neigen
const lookTarget = new THREE.Vector3().copy(plane.position).sub(iForward);
plane.lookAt(lookTarget);
plane.rotateX(THREE.MathUtils.degToRad(HUD_TILT_DEG));
}


return { plane, set, place };
}
