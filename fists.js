import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { FIST_RADIUS } from './config.js';


class Fist {
constructor(getter){
this.getter = getter; // () => Vector3 (aktuelle Weltposition)
this.prev = new THREE.Vector3();
this.vel = new THREE.Vector3();
this.initialized = false;
}
update(dt){
const p = this.getter();
if (!this.initialized){ this.prev.copy(p); this.initialized = true; }
this.vel.copy(p).sub(this.prev).multiplyScalar(1/Math.max(dt,1e-4));
this.prev.copy(p);
return { pos: p, vel: this.vel };
}
}


export class FistsManager {
constructor(renderer, scene){
this.renderer = renderer;
this.scene = scene;
this.fists = []; // Array<Fist>


// Controller-Fäuste (sichtbare kleine Sphären optional)
const fistGeo = new THREE.SphereGeometry(FIST_RADIUS, 16, 12);
const fistMat = new THREE.MeshStandardMaterial({ color: 0xffc043, metalness: 0.2, roughness: 0.7 });


for (let i=0;i<2;i++){
const grip = renderer.xr.getControllerGrip(i);
scene.add(grip);
const mesh = new THREE.Mesh(fistGeo, fistMat);
mesh.visible = true; // bei Bedarf auf false setzen
grip.add(mesh);
this.fists.push(new Fist(() => mesh.getWorldPosition(new THREE.Vector3())));
}


// Hand‑Tracking (optional): mittlere Knöchel als Faustzentrum (wenn verfügbar)
for (let i=0;i<2;i++){
const hand = renderer.xr.getHand(i);
scene.add(hand);
// Getter nutzt vorhandene Joints; Fallback: Hand-Wurzel
const getter = () => {
// Auswahl mehrerer Joints für stabilen Mittelwert
const names = [
'index-finger-metacarpal',
'middle-finger-metacarpal',
'ring-finger-metacarpal'
];
const acc = new THREE.Vector3();
let n = 0;
for (const name of names){
const j = hand.joints && hand.joints[name];
if (j){ acc.add(j.getWorldPosition(new THREE.Vector3())); n++; }
}
if (n>0){ return acc.multiplyScalar(1/n); }
return hand.getWorldPosition(new THREE.Vector3());
};
this.fists.push(new Fist(getter));
}
}


update(dt){
const out = [];
for (const f of this.fists){ out.push(f.update(dt)); }
return out; // [{pos, vel}, ...]
}
}
