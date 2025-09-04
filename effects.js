import * as THREE from './three.js';

let overlay;
function ensureOverlay(){
  if (!overlay){
    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 250ms'; //vorher 150
    overlay.style.zIndex = '9999';
    document.body.appendChild(overlay);
  }
}
function flash(color){
  ensureOverlay();
  overlay.style.background = color;
  overlay.style.opacity = '1';
  requestAnimationFrame(()=>{ overlay.style.opacity = '0'; });
}
export function flashHit(){
  flash('rgba(0,255,0,0.35)');
}
export function flashMiss(){
  flash('rgba(255,255,100,0.35)');
}

// Hazard flash overlay with red edges and quick fade-out
let hazardOverlay;
function ensureHazardOverlay(){
  if (!hazardOverlay){
    hazardOverlay = document.createElement('div');
    hazardOverlay.style.position = 'fixed';
    hazardOverlay.style.top = '0';
    hazardOverlay.style.left = '0';
    hazardOverlay.style.width = '100%';
    hazardOverlay.style.height = '100%';
    hazardOverlay.style.pointerEvents = 'none';
    hazardOverlay.style.opacity = '0';
    hazardOverlay.style.transition = 'opacity 300ms'; //vorher 100ms
    hazardOverlay.style.background = 'rgba(255,0,0,0.4)';
    hazardOverlay.style.boxShadow = '0 0 0 200px rgba(255,0,0,0.6) inset';
    hazardOverlay.style.zIndex = '10000';
    document.body.appendChild(hazardOverlay);
  }
}

function startHazardFlash(){
  ensureHazardOverlay();
  hazardOverlay.style.transition = 'none';
  hazardOverlay.style.opacity = '1';
  void hazardOverlay.offsetWidth;
  hazardOverlay.style.transition = 'opacity 300ms';
  hazardOverlay.style.opacity = '0';
}

export const hazardFlash = { start: startHazardFlash };

// Plane-based hazard flash effect
let hazardPlane;
export function createHazardPlane(camera){
  if (!hazardPlane){
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    hazardPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    hazardPlane.renderOrder = 9999;
  }
  hazardPlane.position.set(0, 0, -0.4); // weiter vor die Kamera
  if (hazardPlane.parent) {
    hazardPlane.parent.remove(hazardPlane);
  }
  camera.add(hazardPlane);
  if (camera.near > 0.01) {
    camera.near = 0.01;
    camera.updateProjectionMatrix();
  }
}

export function flashHazardPlane(){
  if (!hazardPlane) return;
  hazardPlane.material.opacity = 0.4;
  setTimeout(() => hazardPlane.material.opacity = 0, 300);
}
