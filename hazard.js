import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { HAZARD_RADIUS, HAZARD_COLOR } from './config.js';

function makeMaterial(){
  const m = new THREE.MeshStandardMaterial({
    color: HAZARD_COLOR, metalness: 0.1, roughness: 0.6
  });
  m.transparent = false;
  m.opacity = 1.0;
  m.depthWrite = true;
  m.depthTest = true;
  m.side = THREE.FrontSide;
  return m;
}

// Icosahedron -> „spiky“ genug um anders als Ball auszusehen
const geo = new THREE.IcosahedronGeometry(HAZARD_RADIUS, 1);

export function createHazard(){
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geo, [mat]); // Array, falls später Multi-Mat
  mesh.visible = true;
  // optional: dezente Eigenrotation
  mesh.userData.spinAxis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
  mesh.userData.spinSpeed = THREE.MathUtils.lerp(0.4, 1.5, Math.random());
  return mesh;
}
