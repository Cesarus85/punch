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
    overlay.style.transition = 'opacity 150ms';
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
    hazardOverlay.style.transition = 'opacity 100ms';
    hazardOverlay.style.boxShadow = '0 0 0 20px rgba(255,0,0,0.9) inset';
    hazardOverlay.style.background = 'transparent';
    hazardOverlay.style.zIndex = '10000';
    document.body.appendChild(hazardOverlay);
  }
}

function startHazardFlash(){
  ensureHazardOverlay();
  hazardOverlay.style.opacity = '1';
  requestAnimationFrame(()=>{ hazardOverlay.style.opacity = '0'; });
}

export const hazardFlash = { start: startHazardFlash };
