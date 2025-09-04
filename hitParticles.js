import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { HIT_PARTICLE_COUNT } from './config.js';

export class HitParticles {
  constructor(){
    const count = HIT_PARTICLE_COUNT;
    this.count = count;
    const positions = new Float32Array(count*3);
    const velocities = new Float32Array(count*3);
    const life = new Float32Array(count);
    for(let i=0;i<count;i++) positions[i*3+1] = -999;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    this.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities,3));
    this.geometry.setAttribute('life', new THREE.BufferAttribute(life,1));
    this.geometry.computeBoundingSphere();
    this.material = new THREE.PointsMaterial({ color:0xffffff, size:0.02, transparent:true, depthWrite:false });
    this.points = new THREE.Points(this.geometry, this.material);
    this.positions = positions;
    this.velocities = velocities;
    this.life = life;
    this._cursor = 0;
  }
  update(dt){
    const p=this.positions, v=this.velocities, l=this.life;
    for(let i=0;i<this.count;i++){
      if(l[i] > 0){
        l[i] -= dt;
        p[3*i]   += v[3*i]*dt;
        p[3*i+1] += v[3*i+1]*dt;
        p[3*i+2] += v[3*i+2]*dt;
      } else {
        p[3*i+1] = -999;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.life.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
  burst(pos){
    for(let i=0;i<this.count;i++){
      const idx = (this._cursor++) % this.count;
      const off = idx*3;
      this.positions[off] = pos.x;
      this.positions[off+1] = pos.y;
      this.positions[off+2] = pos.z;
      const dir = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize();
      const speed = Math.random()*1.5 + 0.5;
      this.velocities[off] = dir.x*speed;
      this.velocities[off+1] = dir.y*speed;
      this.velocities[off+2] = dir.z*speed;
      this.life[idx] = 1.0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.velocity.needsUpdate = true;
    this.geometry.attributes.life.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}
