import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Pip cells on a 3x3 grid (0..8). Face order follows the box geometry: +x, -x, +y, -y, +z, -z,
// so opposite faces add up to 7 like a real die.
const FACE_PIPS: number[][] = [
  [0, 4, 8], // 3
  [0, 2, 6, 8], // 4
  [0, 8], // 2
  [0, 2, 4, 6, 8], // 5
  [4], // 1
  [0, 2, 3, 5, 6, 8], // 6
];

const TEX = 512;

function pipCenters(pips: number[]) {
  const step = TEX * 0.26;
  return pips.map((cell) => ({
    x: TEX / 2 + ((cell % 3) - 1) * step,
    y: TEX / 2 + (Math.floor(cell / 3) - 1) * step,
  }));
}

/** Glossy black face with white pips shaded as if pressed into the surface. */
function drawColor(pips: number[]) {
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const g = c.getContext("2d")!;
  g.fillStyle = "#050506";
  g.fillRect(0, 0, TEX, TEX);
  const r = TEX * 0.092;
  for (const { x, y } of pipCenters(pips)) {
    // dark rim = the wall of the hole
    g.beginPath();
    g.arc(x, y, r * 1.12, 0, Math.PI * 2);
    g.fillStyle = "#020203";
    g.fill();
    // white paint, shadowed on the upper-left inner wall
    const grad = g.createRadialGradient(x + r * 0.28, y + r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.62, "#f1f1f3");
    grad.addColorStop(0.88, "#b9bcc4");
    grad.addColorStop(1, "#6d7079");
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.fill();
  }
  return c;
}

/** Height map: flat face = white, pips sink down into a shallow bowl. */
function drawBump(pips: number[]) {
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, TEX, TEX);
  const r = TEX * 0.103;
  for (const { x, y } of pipCenters(pips)) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "#3a3a3a");
    grad.addColorStop(0.7, "#5a5a5a");
    grad.addColorStop(1, "#ffffff");
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.fill();
  }
  return c;
}

export function Cube3D({ size = 96, className }: { size?: number; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const box = Math.round(size * 1.7);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoundedBoxGeometry } =
        await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
      const { RoomEnvironment } =
        await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(box, box);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.domElement.style.width = `${box}px`;
      renderer.domElement.style.height = `${box}px`;
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0.35, 4.3);
      camera.lookAt(0, 0, 0);

      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2.5, 3, 3);
      const rim = new THREE.DirectionalLight(0xfff1d6, 1.2);
      rim.position.set(-3, 1.5, -2);
      scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.15));

      const textures: InstanceType<typeof THREE.Texture>[] = [];
      const materials = FACE_PIPS.map((pips) => {
        const map = new THREE.CanvasTexture(drawColor(pips));
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const bump = new THREE.CanvasTexture(drawBump(pips));
        textures.push(map, bump);
        return new THREE.MeshPhysicalMaterial({
          map,
          bumpMap: bump,
          bumpScale: 2.2,
          roughness: 0.16,
          metalness: 0.05,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          envMapIntensity: 0.45,
        });
      });

      const geometry = new RoundedBoxGeometry(1, 1, 1, 10, 0.12);
      const die = new THREE.Mesh(geometry, materials);
      die.rotation.set(-0.45, 0.6, 0);
      scene.add(die);

      let raf = 0;
      let last = performance.now();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = (t: number) => {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        if (!reduce) {
          die.rotation.x += dt * 0.55;
          die.rotation.y += dt * 0.8;
          die.rotation.z = Math.sin(t / 2200) * 0.18;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        geometry.dispose();
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [box]);

  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      style={{ height: box + 8 }}
    >
      <motion.div
        ref={mountRef}
        style={{ width: box, height: box }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute bottom-2 h-3 rounded-[50%] bg-foreground/10 blur-md"
        style={{ width: size * 0.85 }}
        animate={{ scaleX: [1, 0.82, 1], opacity: [0.9, 0.55, 0.9] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
