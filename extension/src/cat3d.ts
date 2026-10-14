// The 3D cat: toon-shaded Three.js geometry and mood animations.
// Unchanged from the original apart from types.

import * as THREE from "three";

export type Mood = "idle" | "alert" | "excited" | "sleep";

export function createCat(size: number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.2, 3.8);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xffd6a5, 0.4);
  fill.position.set(-2, -1, 2);
  scene.add(fill);

  const mat = (c: number) => new THREE.MeshToonMaterial({ color: c });
  const cat = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, color: number, setup?: (m: THREE.Mesh) => void) => {
    const m = new THREE.Mesh(geo, mat(color));
    setup?.(m);
    cat.add(m);
  };

  add(new THREE.SphereGeometry(0.55, 32, 32), 0xf4a261, (m) => { m.scale.set(1, 1.1, 0.85); m.position.y = -0.1; });
  add(new THREE.SphereGeometry(0.42, 32, 32), 0xf4a261, (m) => { m.position.y = 0.62; });
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.13, 0.28, 3), 0xf4a261, (m) => { m.position.set(s * 0.28, 0.98, 0); m.rotation.z = s * 0.18; });
    add(new THREE.ConeGeometry(0.07, 0.18, 3), 0xffb5c8, (m) => { m.position.set(s * 0.28, 0.98, 0.04); m.rotation.z = s * 0.18; });
    add(new THREE.SphereGeometry(0.075, 16, 16), 0x1a1a2e, (m) => { m.position.set(s * 0.16, 0.68, 0.35); });
    add(new THREE.SphereGeometry(0.028, 8, 8), 0xffffff, (m) => { m.position.set(s * 0.16 + 0.03, 0.7, 0.42); });
  }
  add(new THREE.SphereGeometry(0.04, 8, 8), 0xffb5c8, (m) => { m.position.set(0, 0.6, 0.41); });
  add(new THREE.SphereGeometry(0.3, 32, 32), 0xfde8d0, (m) => { m.scale.set(0.9, 1, 0.3); m.position.set(0, -0.08, 0.5); });
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0.5, -0.65, 0),
    new THREE.Vector3(0.8, -0.3, 0), new THREE.Vector3(0.6, 0.1, 0),
  ]);
  add(new THREE.TubeGeometry(tailCurve, 20, 0.07, 8, false), 0xf4a261);
  for (const x of [-0.28, 0.28]) {
    add(new THREE.SphereGeometry(0.13, 16, 16), 0xf4a261, (m) => { m.scale.set(1, 0.6, 1); m.position.set(x, -0.65, 0.3); });
  }
  scene.add(cat);

  let mood: Mood = "idle";
  let frame = 0;
  let raf = 0;

  const animate = () => {
    raf = requestAnimationFrame(animate);
    frame++;
    const t = frame * 0.04;
    if (mood === "sleep") {
      cat.rotation.set(0, 0, Math.sin(t * 0.4) * 0.06);
      cat.position.y = Math.sin(t * 0.4) * 0.04 - 0.05;
    } else if (mood === "alert") {
      cat.rotation.set(0, Math.sin(t * 6) * 0.35, Math.sin(t * 7) * 0.12);
      cat.position.y = Math.abs(Math.sin(t * 5)) * 0.18;
    } else if (mood === "excited") {
      cat.rotation.set(0, Math.sin(t * 2) * 0.2, Math.sin(t * 4) * 0.15);
      cat.position.y = Math.abs(Math.sin(t * 4)) * 0.22;
    } else {
      cat.rotation.set(0, Math.sin(t * 0.7) * 0.12, Math.sin(t * 0.5) * 0.04);
      cat.position.y = Math.sin(t * 1.2) * 0.06;
    }
    renderer.render(scene, camera);
  };
  animate();

  return {
    canvas: renderer.domElement,
    setMood: (m: Mood) => { mood = m; },
    getMood: () => mood,
    dispose: () => { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
