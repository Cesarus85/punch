import * as THREE from './three.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.1/examples/jsm/loaders/GLTFLoader.js?module';
import { HAZARD_RADIUS, DRIFT_ENABLED, DISSOLVE_DURATION, HAZARD_URL } from './config.js';

export const MAX_HAZARDS = 32;

function makeMaterial(m){
  // m.color = new THREE.Color(HAZARD_COLOR);
  m.metalness = 0.1;
  m.roughness = 0.6;
  // m.emissive = new THREE.Color(HAZARD_COLOR);
  // m.emissiveIntensity = HAZARD_EMISSIVE_INTENSITY;
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
      driftChunk = `float drift = abs(instData.z) * sin(instData.w * uTime);\n`+
                   `if(instData.z >= 0.0){\n  transformed.x += drift;\n}else{\n  transformed.y += drift;\n}\n`;
    }
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `\nvec3 transformed = vec3(position);\n` + driftChunk +
      `float angle = instData.x * uTime;\nmat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));\n`+
      `transformed.yz = rot * transformed.yz;\nvDissolve = dissolve;\n`
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

const loader = new GLTFLoader();
let ready = false;
let mesh = null;
let instAttr = null;
let dissolveAttr = null;
const freeIdx = [];
const _m = new THREE.Matrix4();

export function loadHazard(){
  return new Promise((resolve, reject) => {
    if (ready){ resolve(); return; }
    loader.load(
      HAZARD_URL,
      (gltf) => {
        let srcMesh = null;
        gltf.scene.traverse((n)=>{ if(n.isMesh && !srcMesh) srcMesh = n; });
        if(!srcMesh){ reject(new Error('no mesh in hazard gltf')); return; }

        const geom = srcMesh.geometry.clone();
        const mat  = makeMaterial(srcMesh.material.clone());

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3(); box.getSize(size);
        const maxDim = Math.max(size.x,size.y,size.z) || 1;
        const scale = (2*HAZARD_RADIUS)/maxDim;
        geom.applyMatrix4(new THREE.Matrix4().makeScale(scale,scale,scale));

        mesh = new THREE.InstancedMesh(geom, mat, MAX_HAZARDS);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const arr = new Float32Array(MAX_HAZARDS*4);
        instAttr = new THREE.InstancedBufferAttribute(arr, 4);
        mesh.geometry.setAttribute('instData', instAttr);
        const dissArr = new Float32Array(MAX_HAZARDS).fill(-1);
        dissolveAttr = new THREE.InstancedBufferAttribute(dissArr, 1);
        mesh.geometry.setAttribute('dissolve', dissolveAttr);

        for(let i=0;i<MAX_HAZARDS;i++){
          freeIdx.push(i);
          _m.makeTranslation(0,-999,0);
          mesh.setMatrixAt(i,_m);
        }
        mesh.instanceMatrix.needsUpdate = true;

        ready = true;
        resolve();
      },
      undefined,
      (err) => reject(err)
    );
  });
}

export function isHazardReady(){ return ready; }
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
