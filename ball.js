// ball.js
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.1/examples/jsm/loaders/GLTFLoader.js?module';
import { BALL_RADIUS, BALL_URL, DISSOLVE_DURATION } from './config.js';

export const MAX_POOL_BALLS = 64;

const loader = new GLTFLoader();
let ready = false;
let ballMesh = null;
let instAttr = null;
let dissolveAttr = null;
const freeIdx = [];
const _m = new THREE.Matrix4();

export function loadBall(){
  return new Promise((resolve, reject) => {
    loader.load(
      BALL_URL,
      (gltf) => {
        let mesh = null;
        gltf.scene.traverse((n)=>{ if(n.isMesh && !mesh) mesh = n; });
        if(!mesh){ reject(new Error('no mesh in ball gltf')); return; }

        const geom = mesh.geometry.clone();
        const mat  = mesh.material.clone();

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3(); box.getSize(size);
        const maxDim = Math.max(size.x,size.y,size.z) || 1;
        const scale = (2*BALL_RADIUS)/maxDim;
        geom.applyMatrix4(new THREE.Matrix4().makeScale(scale,scale,scale));

        scrubMaterial(mat);

        ballMesh = new THREE.InstancedMesh(geom, mat, MAX_POOL_BALLS);
        ballMesh.frustumCulled = false;
        ballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const arr = new Float32Array(MAX_POOL_BALLS*4);
        instAttr = new THREE.InstancedBufferAttribute(arr, 4);
        ballMesh.geometry.setAttribute('instData', instAttr);
        const dissArr = new Float32Array(MAX_POOL_BALLS).fill(-1);
        dissolveAttr = new THREE.InstancedBufferAttribute(dissArr, 1);
        ballMesh.geometry.setAttribute('dissolve', dissolveAttr);

        for(let i=0;i<MAX_POOL_BALLS;i++){
          freeIdx.push(i);
          _m.makeTranslation(0,-999,0);
          ballMesh.setMatrixAt(i,_m);
        }
        ballMesh.instanceMatrix.needsUpdate = true;

        ballMesh.material.onBeforeCompile = (shader)=>{
          shader.uniforms.uTime = { value: 0 };
          shader.uniforms.uDissolveDuration = { value: DISSOLVE_DURATION };
          shader.vertexShader = `attribute vec4 instData;\nattribute float dissolve;\nuniform float uTime;\nvarying float vDissolve;\n` + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `\nvec3 transformed = vec3(position);\nfloat drift = abs(instData.y) * sin(instData.z * uTime + instData.w);\nif(instData.y >= 0.0){\n  transformed.x += drift;\n}else{\n  transformed.y += drift;\n}\nfloat angle = instData.x * uTime;\nmat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));\ntransformed.xz = rot * transformed.xz;\nvDissolve = dissolve;\n`
          );
          shader.fragmentShader = `uniform float uTime;\nuniform float uDissolveDuration;\nvarying float vDissolve;\n` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>\nfloat d = (vDissolve < 0.0) ? 0.0 : clamp((uTime - vDissolve) / uDissolveDuration, 0.0, 1.0);\ngl_FragColor.a *= (1.0 - d);\n`
          );
          ballMesh.material.userData.shader = shader;
        };

        ready = true;
        resolve();
      },
      undefined,
      (err) => reject(err)
    );
  });
}

export function isBallReady(){ return ready; }
export function getBallMesh(){ return ballMesh; }
export function getBallAttribute(){ return instAttr; }
export function getDissolveAttribute(){ return dissolveAttr; }

export function allocBall(){
  return freeIdx.pop();
}

export function freeBall(idx){
  if(idx===undefined || idx===null) return;
  _m.makeTranslation(0,-999,0);
  ballMesh.setMatrixAt(idx,_m);
  const aIndex = idx*4;
  instAttr.array[aIndex] = instAttr.array[aIndex+1] = instAttr.array[aIndex+2] = instAttr.array[aIndex+3] = 0;
  instAttr.needsUpdate = true;
  if(dissolveAttr){
    dissolveAttr.array[idx] = -1;
    dissolveAttr.needsUpdate = true;
  }
  ballMesh.instanceMatrix.needsUpdate = true;
  freeIdx.push(idx);
}

export function dissolveBall(idx, startTime){
  if(!dissolveAttr) return;
  dissolveAttr.array[idx] = startTime;
  dissolveAttr.needsUpdate = true;
}

function scrubMaterial(m){
  if (m.isMeshPhysicalMaterial){
    m.transmission = 0.0;
    m.thickness = 0.0;
    m.attenuationDistance = 1e9;
    m.ior = 1.0;
    m.sheen = 0.0;
    m.clearcoat = 0.0;
  }
  m.transparent = false;
  m.opacity = 1.0;
  m.alphaMap = null;
  m.alphaTest = 0.0;
  m.depthWrite = true;
  m.depthTest  = true;
  m.blending   = THREE.NormalBlending;
  m.side = THREE.FrontSide;
  m.needsUpdate = true;
}
