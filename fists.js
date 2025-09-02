import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/XRControllerModelFactory.js?module';

// Options:
//  - showControllerModels: true => echte Controller-Modelle (wenn verfügbar)
//  - sphereVisRadius: Visual-Radius der gelben Kugeln (nur falls keine Modelle)
export class FistsManager {
  constructor(renderer, scene, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.opts = Object.assign({ showControllerModels: true, sphereVisRadius: 0.03 }, opts);

    this.controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
    this.grips = [renderer.xr.getControllerGrip(0), renderer.xr.getControllerGrip(1)];
    this.hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)];

    this.prev = [new THREE.Vector3(), new THREE.Vector3()];
    this.vel = [new THREE.Vector3(), new THREE.Vector3()];
    this.tmp = new THREE.Vector3();

    // Visuals
    if (this.opts.showControllerModels) {
      const factory = new XRControllerModelFactory();
      for (let i=0;i<this.grips.length;i++){
        const grip = this.grips[i];
        if (!grip) continue;
        const model = factory.createControllerModel(grip);
        grip.add(model);
        scene.add(grip);
      }
    } else {
      // kleine gelbe Kugeln als Visuals
      this.spheres = [];
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      for (let i=0;i<this.controllers.length;i++){
        const s = new THREE.Mesh(new THREE.SphereGeometry(this.opts.sphereVisRadius, 16, 12), mat.clone());
        this.controllers[i].add(s);
        this.spheres.push(s);
        scene.add(this.controllers[i]);
      }
    }

    // init pos
    for (let i=0;i<2;i++) this.prev[i].set(0,0,0);
    this._initialized = false;
  }

  _getControllerPos(i, out){
    const ctrl = this.controllers[i];
    if (ctrl && ctrl.visible) {
      ctrl.getWorldPosition(out);
      return true;
    }
    // Fallback: Grip (besseres Tracking für Modelle)
    const grip = this.grips[i];
    if (grip) { grip.getWorldPosition(out); return true; }

    // Fallback Hands: index knuckle
    const hand = this.hands[i];
    if (hand && hand.joints && hand.joints['index-finger-metacarpal']) {
      hand.joints['index-finger-metacarpal'].getWorldPosition(out);
      return true;
    }
    return false;
  }

  update(dt) {
    const fists = [];
    const alpha = THREE.MathUtils.clamp(dt * 12.0, 0, 1); // smoothing

    for (let i=0;i<2;i++){
      const pos = new THREE.Vector3();
      if (!this._getControllerPos(i, pos)) continue;

      if (!this._initialized) {
        this.prev[i].copy(pos);
      }

      // Velocity (exponential smoothing)
      const v = this.tmp.copy(pos).sub(this.prev[i]).multiplyScalar(1/Math.max(1e-4, dt));
      this.vel[i].lerp(v, alpha);
      this.prev[i].copy(pos);

      fists.push({ pos: pos.clone(), vel: this.vel[i].clone() });
    }
    this._initialized = true;
    return fists;
  }
}
