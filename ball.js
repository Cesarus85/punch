import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.1/examples/jsm/loaders/GLTFLoader.js?module';
import { BALL_RADIUS, BALL_URL } from './config.js';


const loader = new GLTFLoader();
let prefab = null;
let ready = false;
let scaleFactor = 1;


export function loadBall(){
return new Promise((resolve, reject)=>{
loader.load(
BALL_URL,
(gltf)=>{
prefab = gltf.scene;
const box = new THREE.Box3().setFromObject(prefab);
const size = new THREE.Vector3(); box.getSize(size);
const maxDim = Math.max(size.x,size.y,size.z)||1;
scaleFactor = (2*BALL_RADIUS)/maxDim;
prefab.traverse((n)=>{
if (n.isMesh && n.material){
if (Array.isArray(n.material)) n.material.forEach(m=> m.transparent = true);
else n.material.transparent = true;
}
});
ready = true; resolve();
}, undefined, reject
);
});
}


export function isBallReady(){ return ready; }


export function makeBall(){
const obj = prefab.clone(true);
obj.visible = true;
obj.scale.setScalar(scaleFactor);
setOpacity(obj, 1.0);
return obj;
}


export function setOpacity(obj, opacity){
obj.traverse((n)=>{
if (n.isMesh && n.material){
if (Array.isArray(n.material)) n.material.forEach(m=> m.opacity = opacity);
else n.material.opacity = opacity;
}
});
}
