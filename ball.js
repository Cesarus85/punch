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

        // Basismaterialien opak und „entschärft“
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
  // Tiefenklon + MATERIALIEN JE INSTANZ KLONEN
  const obj = prefab.clone(true);
  makeMaterialsUnique(obj);     // <-- wichtig!
  obj.visible = true;
  obj.scale.setScalar(scaleFactor);
  scrubMaterials(obj);          // opak, keine Transmission/AlphaTest
  setOpacity(obj, 1.0);         // sicherheitshalber volle Deckkraft
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
      // nur beim Ausblenden
      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;
      m.depthTest  = true;
      m.alphaTest  = 0.0;
      m.blending   = THREE.NormalBlending;
    }
    m.needsUpdate = true;
  });
}

// ---------- Helfer ----------
function traverseMats(obj, fn){
  obj.traverse((n)=>{
    if (n.isMesh && n.material){
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(fn);
    }
  });
}

function makeMaterialsUnique(obj){
  obj.traverse((n)=>{
    if (n.isMesh && n.material){
      if (Array.isArray(n.material)){
        n.material = n.material.map(m => m.clone());
      } else {
        n.material = n.material.clone();
      }
      // Texturen bleiben per Referenz geteilt (ok), aber Materialinstanz ist unique
    }
  });
}

function scrubMaterials(obj){
  traverseMats(obj, (m)=>{
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
  });
}
