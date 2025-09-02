import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.1/examples/jsm/loaders/GLTFLoader.js?module';
import { BALL_RADIUS, BALL_URL } from './config.js';

const loader = new GLTFLoader();
let prefab = null;
let ready = false;
let scaleFactor = 1;

export function loadBall(){
  return new Promise((resolve, reject)=>{
    loader.load(
      BALL_URL,
      (gltf)=>{
        prefab = gltf.scene;

        // automatische Skalierung
        const box = new THREE.Box3().setFromObject(prefab);
        const size = new THREE.Vector3(); box.getSize(size);
        const maxDim = Math.max(size.x,size.y,size.z) || 1;
        scaleFactor = (2 * BALL_RADIUS) / maxDim;

        // WICHTIG: standardmäßig OPAK (kein Transparent!)
        makeOpaque(prefab);

        ready = true; resolve();
      },
      undefined, reject
    );
  });
}

export function isBallReady(){ return ready; }

export function makeBall(){
  const obj = prefab.clone(true);
  obj.visible = true;
  obj.scale.setScalar(scaleFactor);
  // Sicherstellen, dass der Klon opak ist
  makeOpaque(obj);
  setOpacity(obj, 1.0);
  return obj;
}

// --- Hilfsfunktionen ---

function traverseMats(obj, fn){
  obj.traverse(n=>{
    if (n.isMesh && n.material){
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(fn);
      n.material.needsUpdate = true;
    }
  });
}

function makeOpaque(obj){
  traverseMats(obj, (m)=>{
    m.transparent = false;
    m.opacity = 1.0;
    m.depthWrite = true;
    m.depthTest  = true;
    m.alphaTest  = 0.0;
    m.blending   = THREE.NormalBlending;
  });
}

export function setOpacity(obj, opacity){
  traverseMats(obj, (m)=>{
    if (opacity >= 1.0){
      // während des Flugs opak rendern
      m.transparent = false;
      m.depthWrite = true;
    } else {
      // nur für Fade-Out
      m.transparent = true;
      m.depthWrite = false; // vermeidet harte Kanten beim Ausblenden
    }
    m.opacity = opacity;
  });
}
