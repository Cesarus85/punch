import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { HAZARD_RADIUS, HAZARD_COLOR, HAZARD_EMISSIVE_INTENSITY } from './config.js';

// ONE material (kein Array), opak + emissive → sehr sichtbar, unabhängig vom Licht
function makeMaterial(){
  const m = new THREE.MeshStandardMaterial({
    color: HAZARD_COLOR,
    metalness: 0.1,
    roughness: 0.6,
    emissive: new THREE.Color(HAZARD_COLOR),
    emissiveIntensity: HAZARD_EMISSIVE_INTENSITY
  });
  m.transparent = false;
  m.opacity = 1.0;
  m.depthWrite = true;
  m.depthTest = true;
  m.side = THREE.FrontSide;
  return m;
}

// gut sichtbare Grundform
const geo = new THREE.IcosahedronGeometry(HAZARD_RADIUS, 1);

export function createHazard(){
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = true;
  // leichte Eigenrotation für „Lebendigkeit“
  mesh.userData.spinAxis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
  mesh.userData.spinSpeed = THREE.MathUtils.lerp(0.4, 1.5, Math.random());
  return mesh;
}
