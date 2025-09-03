import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { HAZARD_RADIUS, HAZARD_COLOR, HAZARD_EMISSIVE_INTENSITY } from './config.js';

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
    shader.vertexShader = `attribute vec4 instData;\nuniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `\nvec3 transformed = vec3(position);\nfloat drift = instData.y * sin(instData.z * uTime + instData.w);\ntransformed.x += drift;\nfloat angle = instData.x * uTime;\nmat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));\ntransformed.xz = rot * transformed.xz;\n`
    );
    m.userData.shader = shader;
  };
  return m;
}

const geo = new THREE.IcosahedronGeometry(HAZARD_RADIUS, 1);
const mesh = new THREE.InstancedMesh(geo, makeMaterial(), MAX_HAZARDS);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

const arr = new Float32Array(MAX_HAZARDS*4);
const instAttr = new THREE.InstancedBufferAttribute(arr, 4);
mesh.geometry.setAttribute('instData', instAttr);

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
export function allocHazard(){ return freeIdx.pop(); }
export function freeHazard(idx){
  if(idx===undefined || idx===null) return;
  _m.makeTranslation(0,-999,0);
  mesh.setMatrixAt(idx,_m);
  const aIdx = idx*4;
  instAttr.array[aIdx]=instAttr.array[aIdx+1]=instAttr.array[aIdx+2]=instAttr.array[aIdx+3]=0;
  instAttr.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  freeIdx.push(idx);
}
