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
