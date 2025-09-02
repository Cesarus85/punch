import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js?module';


import {
BALL_RADIUS, FIST_RADIUS, SPAWN_DISTANCE, SIDE_OFFSET, SIDE_OFFSET_TIGHT, TIGHT_PROB,
BALL_SPEED, SPAWN_INTERVAL, PUNCH_SPEED, SPAWN_MAX_BELOW, MISS_PLANE_OFFSET,
HUD_PLANE_H
} from './config.js';


import { createHUD } from './hud.js';
import { FistsManager } from './fists.js';
import { loadBall, isBallReady, makeBall, setOpacity } from './ball.js';


// --- Basis Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);


document.body.appendChild(ARButton.createButton(renderer, {
optionalFeatures: ['local-floor', 'hand-tracking']
}));


scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
window.addEventListener('resize', ()=>{
renderer.setSize(window.innerWidth, window.innerHeight);
});


// --- Initial Pose Lock ---
let poseLocked = false;
const iPos = new THREE.Vector3();
const iQuat = new THREE.Quaternion();
const iForward = new THREE.Vector3();
const iUp = new THREE.Vector3();
const iRight = new THREE.Vector3();


function lockInitialPose(){
iPos.setFromMatrixPosition(camera.matrixWorld);
iQuat.copy(camera.quaternion);
iForward.set(0,0,-1).applyQuaternion(iQuat).normalize();
});
