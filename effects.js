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

// VR-kompatible Hazard flash Vignette mit 3D-Quad
import * as THREE from './three.js';

let hazardVignette = null;
let vignetteStartTime = 0;
let vignetteActive = false;

function createHazardVignette() {
  // Erstelle ein großes Quad vor der Kamera für die Vignette
  const vignetteGeometry = new THREE.PlaneGeometry(4, 4);
  
  // Shader für radiale rote Vignette mit Fade-out
  const vignetteMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.0 },
      uTime: { value: 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      
      void main() {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(vUv, center);
        
        // Vignette-Effekt: stärker an den Rändern
        float vignette = 1.0 - smoothstep(0.0, 0.8, dist);
        float edgeGlow = smoothstep(0.6, 1.0, dist);
        
        vec3 color = vec3(1.0, 0.0, 0.0); // Rot
        float alpha = (vignette * 0.4 + edgeGlow * 0.8) * uOpacity;
        
        gl_FragColor = vec4(color, alpha);
      }
    `
  });

  hazardVignette = new THREE.Mesh(vignetteGeometry, vignetteMaterial);
  hazardVignette.renderOrder = 1000; // Sehr hoch, damit es über allem anderen gerendert wird
  hazardVignette.visible = false;
  
  return hazardVignette;
}

function updateVignettePosition(camera) {
  if (!hazardVignette || !camera || !hazardVignette.visible) return;
  
  // Positioniere das Quad direkt vor der Kamera
  const cameraPosition = new THREE.Vector3();
  const cameraQuaternion = new THREE.Quaternion();
  camera.getWorldPosition(cameraPosition);
  camera.getWorldQuaternion(cameraQuaternion);
  
  // Setze die Vignette etwas vor die Kamera
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);
  hazardVignette.position.copy(cameraPosition).add(forward.multiplyScalar(1.5));
  hazardVignette.quaternion.copy(cameraQuaternion);
}

function updateVignetteAnimation(currentTime) {
  if (!vignetteActive || !hazardVignette) return;
  
  const elapsed = (currentTime - vignetteStartTime) / 1000.0;
  const fadeDuration = 0.3; // 300ms fade-out
  
  if (elapsed >= fadeDuration) {
    hazardVignette.visible = false;
    hazardVignette.material.uniforms.uOpacity.value = 0.0;
    vignetteActive = false;
    return;
  }
  
  // Fade-out Animation
  const opacity = Math.max(0, 1.0 - (elapsed / fadeDuration));
  hazardVignette.material.uniforms.uOpacity.value = opacity;
}

function startHazardFlash(){
  // Fallback für DOM-Overlay wenn nicht in VR
  if (!hazardVignette) {
    ensureHazardOverlay();
    hazardOverlay.style.transition = 'none';
    hazardOverlay.style.opacity = '1';
    void hazardOverlay.offsetWidth;
    hazardOverlay.style.transition = 'opacity 300ms';
    hazardOverlay.style.opacity = '0';
    return;
  }
  
  // VR-Modus: 3D Vignette verwenden
  hazardVignette.visible = true;
  hazardVignette.material.uniforms.uOpacity.value = 1.0;
  vignetteStartTime = performance.now();
  vignetteActive = true;
}

// Fallback DOM-Overlay für Desktop-Browser
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
    hazardOverlay.style.transition = 'opacity 300ms';
    hazardOverlay.style.background = 'rgba(255,0,0,0.4)';
    hazardOverlay.style.boxShadow = '0 0 0 200px rgba(255,0,0,0.6) inset';
    hazardOverlay.style.zIndex = '10000';
    document.body.appendChild(hazardOverlay);
  }
}

export const hazardFlash = { 
  start: startHazardFlash,
  initVR: (scene, camera) => {
    if (!hazardVignette) {
      hazardVignette = createHazardVignette();
      scene.add(hazardVignette);
    }
  },
  updateVR: (camera, currentTime) => {
    updateVignettePosition(camera);
    updateVignetteAnimation(currentTime);
  }
};
