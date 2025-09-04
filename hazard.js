import * as THREE from './three.js';
import { HAZARD_RADIUS, HAZARD_COLOR, HAZARD_EMISSIVE_INTENSITY, DRIFT_ENABLED, DISSOLVE_DURATION } from './config.js';

export const MAX_HAZARDS = 32;

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
  m.onBeforeCompile = (shader)=>{
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uDissolveDuration = { value: DISSOLVE_DURATION };
    shader.vertexShader = `attribute vec4 instData;\nattribute float dissolve;\nuniform float uTime;\nvarying float vDissolve;\n` + shader.vertexShader;
    let driftChunk = '';
    if (DRIFT_ENABLED){
      driftChunk = `float drift = abs(instData.y) * sin(instData.z * uTime + instData.w);\n`+
                   `if(instData.y >= 0.0){\n  transformed.x += drift;\n}else{\n  transformed.y += drift;\n}\n`;
    }
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `\nvec3 transformed = vec3(position);\n` + driftChunk +
      `float angle = instData.x * uTime;\nmat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));\ntransformed.xz = rot * transformed.xz;\nvDissolve = dissolve;\n`
    );
    shader.fragmentShader = `uniform float uTime;\nuniform float uDissolveDuration;\nvarying float vDissolve;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>\nfloat d = (vDissolve < 0.0) ? 0.0 : clamp((uTime - vDissolve) / uDissolveDuration, 0.0, 1.0);\ngl_FragColor.a *= (1.0 - d);\n`
    );
    m.userData.shader = shader;
  };
  return m;
}

const geo = new THREE.IcosahedronGeometry(HAZARD_RADIUS, 1);
const mesh = new THREE.InstancedMesh(geo, makeMaterial(), MAX_HAZARDS);
mesh.frustumCulled = false;
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

const arr = new Float32Array(MAX_HAZARDS*4);
const instAttr = new THREE.InstancedBufferAttribute(arr, 4);
mesh.geometry.setAttribute('instData', instAttr);
const dissArr = new Float32Array(MAX_HAZARDS).fill(-1);
const dissolveAttr = new THREE.InstancedBufferAttribute(dissArr, 1);
mesh.geometry.setAttribute('dissolve', dissolveAttr);

const freeIdx = [];
const _m = new THREE.Matrix4();
for(let i=0;i<MAX_HAZARDS;i++){
  freeIdx.push(i);
  _m.makeTranslation(0,-999,0);
  mesh.setMatrixAt(i,_m);
}
mesh.instanceMatrix.needsUpdate = true;

export function getHazardMesh(){ return mesh; }
export function getHazardAttribute(){ return instAttr; }
export function getDissolveAttribute(){ return dissolveAttr; }
export function allocHazard(){ return freeIdx.pop(); }
export function freeHazard(idx){
  if(idx===undefined || idx===null) return;
  _m.makeTranslation(0,-999,0);
  mesh.setMatrixAt(idx,_m);
  const aIdx = idx*4;
  instAttr.array[aIdx]=instAttr.array[aIdx+1]=instAttr.array[aIdx+2]=instAttr.array[aIdx+3]=0;
  instAttr.needsUpdate = true;
  if(dissolveAttr){
    dissolveAttr.array[idx] = -1;
    dissolveAttr.needsUpdate = true;
  }
  mesh.instanceMatrix.needsUpdate = true;
  freeIdx.push(idx);
}

export function dissolveHazard(idx, startTime){
  if(!dissolveAttr) return;
  dissolveAttr.array[idx] = startTime;
  dissolveAttr.needsUpdate = true;
}
