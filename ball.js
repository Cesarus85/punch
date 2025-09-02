// ball.js
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.1/examples/jsm/loaders/GLTFLoader.js?module';
import { BALL_RADIUS, BALL_URL } from './config.js';

const loader = new GLTFLoader();
let prefab = null;
let ready = false;
let scaleFactor = 1;

export function loadBall() {
  return new Promise((resolve, reject) => {
    loader.load(
      BALL_URL,
      (gltf) => {
        prefab = gltf.scene;

        // auf BALL_RADIUS skalieren
        const box = new THREE.Box3().setFromObject(prefab);
        const size = new THREE.Vector3(); box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        scaleFactor = (2 * BALL_RADIUS) / maxDim;

        // Materialien "härten": opak, keine Transmission/Alpha/Mask
        scrubMaterials(prefab);

        ready = true;
        resolve();
      },
      undefined,
      (err) => reject(err)
    );
  });
}

export function isBallReady(){ return ready; }

export function makeBall(){
  const obj = prefab.clone(true);
  obj.visible = true;
  obj.scale.setScalar(scaleFactor);
  // sicherstellen, dass Klone auch "gehärtet" sind
  scrubMaterials(obj);
  setOpacity(obj, 1.0);
  return obj;
}

export function setOpacity(obj, opacity){
  traverseMats(obj, (m)=>{
    if (opacity >= 1.0){
      m.transparent = false;
      m.opacity = 1.0;
      m.depthWrite = true;
      m.depthTest  = true;
      m.alphaTest  = 0.0;
      m.blending   = THREE.NormalBlending;
    } else {
      // nur für Fade-Out
      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;      // weicheres Ausblenden
      m.depthTest  = true;
      m.alphaTest  = 0.0;
      m.blending   = THREE.NormalBlending;
    }
    m.needsUpdate = true;
  });
}

// ---- helpers ----
function traverseMats(obj, fn){
  obj.traverse((n)=>{
    if (n.isMesh && n.material){
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(fn);
    }
  });
}

function scrubMaterials(obj){
  traverseMats(obj, (m)=>{
    // GLTF kann MeshStandard/Physical etc. liefern
    if (m.isMeshPhysicalMaterial){
      // Transmission/Glas ausschalten
      m.transmission = 0.0;
      m.thickness = 0.0;
      m.attenuationDistance = 1e9;
      m.ior = 1.0;
      m.sheen = 0.0;
      m.clearcoat = 0.0;
    }
    // Alpha/Blend/Mask neutralisieren
    m.transparent = false;
    m.opacity = 1.0;
    m.alphaMap = null;
    m.alphaTest = 0.0;
    m.depthWrite = true;
    m.depthTest  = true;
    m.blending   = THREE.NormalBlending;
    m.side = THREE.FrontSide; // bei Bedarf: DoubleSide
    m.needsUpdate = true;
  });
}
