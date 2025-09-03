// ball.js
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.1/examples/jsm/loaders/GLTFLoader.js?module';
import { BALL_RADIUS, BALL_URL } from './config.js';

export const MAX_POOL_BALLS = 64;

const loader = new GLTFLoader();
let ready = false;
let ballMesh = null;
let instAttr = null;
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
        ballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const arr = new Float32Array(MAX_POOL_BALLS*4);
        instAttr = new THREE.InstancedBufferAttribute(arr, 4);
        ballMesh.geometry.setAttribute('instData', instAttr);

        for(let i=0;i<MAX_POOL_BALLS;i++){
          freeIdx.push(i);
          _m.makeTranslation(0,-999,0);
          ballMesh.setMatrixAt(i,_m);
        }
        ballMesh.instanceMatrix.needsUpdate = true;

        ballMesh.material.onBeforeCompile = (shader)=>{
          shader.uniforms.uTime = { value: 0 };
          shader.vertexShader = `
attribute vec4 instData;
uniform float uTime;
` + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
vec3 transformed = vec3(position);
float drift = abs(instData.y) * sin(instData.z * uTime + instData.w);
if(instData.y >= 0.0){
  transformed.x += drift;
}else{
  transformed.y += drift;
}
float angle = instData.x * uTime;
mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
transformed.xz = rot * transformed.xz;
`
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
  ballMesh.instanceMatrix.needsUpdate = true;
  freeIdx.push(idx);
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
