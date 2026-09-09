import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

export function ThreeModelPreview({ file, scalePercent, autoOrient }: { file: File | null; scalePercent: number; autoOrient: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<string>("Upload a model to inspect its size");
  const [error, setError] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    const width = host.clientWidth || 640;
    const height = host.clientHeight || 440;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07101f");
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
    camera.position.set(330, 280, 330);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x111827, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(180, 300, 120);
    scene.add(key);

    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(256, 3, 256),
      new THREE.MeshStandardMaterial({ color: 0x142235, metalness: 0.15, roughness: 0.8 })
    );
    bed.position.y = -2;
    scene.add(bed);
    const grid = new THREE.GridHelper(256, 16, 0x34d399, 0x26364a);
    scene.add(grid);
    const buildVolume = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(256, 256, 256)),
      new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.22 })
    );
    buildVolume.position.y = 128;
    scene.add(buildVolume);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 50, 0);
    controls.enableDamping = true;
    let model: THREE.Object3D | null = null;
    let animationId = 0;

    const placeModel = (object: THREE.Object3D) => {
      model = object;
      if (autoOrient) {
        // Browser-side preview heuristic: put the shortest bounding-box axis on
        // the bed's vertical axis. Bambu Studio still performs the authoritative
        // mesh-aware orientation when the job is sliced on the server.
        const initialSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
        if (initialSize.x <= initialSize.y && initialSize.x <= initialSize.z) {
          object.rotateZ(Math.PI / 2);
        } else if (initialSize.z <= initialSize.x && initialSize.z <= initialSize.y) {
          object.rotateX(-Math.PI / 2);
        }
      }
      object.scale.setScalar(scalePercent / 100);
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      object.position.x -= center.x;
      object.position.z -= center.z;
      object.position.y -= box.min.y;
      scene.add(object);
      const finalBox = new THREE.Box3().setFromObject(object);
      const size = finalBox.getSize(new THREE.Vector3());
      setDimensions(`${size.x.toFixed(1)} × ${size.z.toFixed(1)} × ${size.y.toFixed(1)} mm`);
      setError(size.x > 256 || size.z > 256 || size.y > 256 ? "Model exceeds the P1S build volume" : "");
    };

    if (file) {
      const url = URL.createObjectURL(file);
      const extension = file.name.split(".").pop()?.toLowerCase();
      const onError = () => {
        URL.revokeObjectURL(url);
        setError("Unable to preview this model. You can still try server-side slicing.");
      };
      if (extension === "stl") {
        new STLLoader().load(url, (geometry) => {
          geometry.computeVertexNormals();
          placeModel(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.55, metalness: 0.05 })));
          URL.revokeObjectURL(url);
        }, undefined, onError);
      } else {
        new ThreeMFLoader().load(url, (group) => {
          group.traverse((child) => {
            if (child instanceof THREE.Mesh) child.material = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.55 });
          });
          placeModel(group);
          URL.revokeObjectURL(url);
        }, undefined, onError);
      }
    }

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = host.clientWidth || width;
      const nextHeight = host.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(host);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      controls.dispose();
      model?.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [file, scalePercent, autoOrient]);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
      <div ref={hostRef} className="h-[440px] w-full" />
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 text-xs font-mono">
        <span className="text-slate-400">P1S / 256³ mm · {dimensions}</span>
        <span className={error ? "text-rose-300" : "text-emerald-300"}>{error || (autoOrient ? "AUTO_ORIENT_PREVIEW" : "MODEL_IN_BOUNDS")}</span>
      </div>
    </div>
  );
}
