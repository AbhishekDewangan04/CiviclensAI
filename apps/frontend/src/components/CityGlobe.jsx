import React, { useEffect, useRef } from "react";
import * as THREE from "three";

// Four live node pins around the holographic city sphere.
// 2 emerald = resolved, 1 amber = pending, 1 rose = emergency.
const PINS = [
  { color: 0x10b981, lat: 22, lng: 25, phase: 0 },
  { color: 0xf59e0b, lat: -14, lng: 115, phase: 1.3 },
  { color: 0xf43f5e, lat: 42, lng: -72, phase: 2.6 },
  { color: 0x10b981, lat: -36, lng: -42, phase: 3.9 },
];

export default function CityGlobe({ sectionRef, className = "" }) {
  const mountRef = useRef(null);
  const tilt = useRef({ x: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 320;
    const height = mount.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Holographic wireframe city mesh.
    const globeGeo = new THREE.IcosahedronGeometry(1.7, 3);
    const globe = new THREE.Mesh(
      globeGeo,
      new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true, transparent: true, opacity: 0.2 })
    );
    group.add(globe);

    // Faint solid core so the wireframe reads as a sphere.
    const coreGeo = new THREE.SphereGeometry(1.62, 48, 48);
    group.add(new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x0b1120, transparent: true, opacity: 0.6 })));

    // Orbit rings — latitude / longitude guides.
    const ringGeo = new THREE.TorusGeometry(1.74, 0.006, 12, 128);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.38 });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
    ring2.rotation.x = Math.PI / 2;
    const ring3 = new THREE.Mesh(ringGeo, ringMat.clone());
    ring3.material.opacity = 0.16;
    ring3.rotation.x = Math.PI / 2.4;
    ring3.rotation.z = Math.PI / 3;
    group.add(ring1, ring2, ring3);

    // Floating node pins, attached to the globe so they orbit with it.
    const pins = PINS.map((p) => {
      const phi = ((90 - p.lat) * Math.PI) / 180;
      const theta = ((p.lng + 180) * Math.PI) / 180;
      const r = 1.8;
      const x = -r * Math.sin(phi) * Math.cos(theta);
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = r * Math.cos(phi);

      const pinGroup = new THREE.Group();
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 16, 16),
        new THREE.MeshBasicMaterial({ color: p.color })
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 16, 16),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.3 })
      );
      pinGroup.add(dot, halo);
      pinGroup.position.set(x, y, z);
      pinGroup.userData = { phase: p.phase, halo };
      group.add(pinGroup);
      return pinGroup;
    });

    // Desktop tilt toward the cursor across the hero area.
    const finePointer = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
    const onMove = (event) => {
      if (!finePointer) return;
      const el = sectionRef?.current || mount;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      tilt.current.tx = ny * 0.35;
      tilt.current.ty = nx * 0.45;
    };
    window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf;
    const animate = () => {
      const t = clock.getElapsedTime();
      group.position.y = Math.sin(t * 0.8) * 0.12; // gentle bob
      group.rotation.y = t * 0.18 + tilt.current.ty; // continuous orbit + cursor offset
      tilt.current.x += (tilt.current.tx - tilt.current.x) * 0.06; // smooth tilt
      group.rotation.x = tilt.current.x;
      pins.forEach((pg) => {
        const s = 1 + Math.sin(t * 2.2 + pg.userData.phase) * 0.35;
        pg.scale.setScalar(s);
        pg.userData.halo.material.opacity = 0.16 + Math.abs(Math.sin(t * 2.2 + pg.userData.phase)) * 0.26;
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      ro.disconnect();
      renderer.dispose();
      [globeGeo, coreGeo, ringGeo].forEach((g) => g.dispose());
      pins.forEach((pg) => pg.children.forEach((c) => { c.geometry.dispose(); c.material.dispose(); }));
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [sectionRef]);

  return <div ref={mountRef} className={className} />;
}