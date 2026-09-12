import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

interface PreviewSettings {
  scalePercent: number;
  autoOrient: boolean;
  layerHeight: number;
  infillPercent: number;
  infillPattern: string;
  supportType: string;
  brimEnabled: boolean;
}

interface ThreeModelPreviewProps extends PreviewSettings {
  file: File | null;
}

interface PreviewRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  model: THREE.Object3D | null;
  brim: THREE.Mesh | null;
  basePosition: THREE.Vector3;
  baseQuaternion: THREE.Quaternion;
  baseScale: THREE.Vector3;
}

function disposeObject(object: THREE.Object3D | null) {
  object?.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material?.dispose());
  });
}

function removeBrim(runtime: PreviewRuntime) {
  if (!runtime.brim) return;
  runtime.scene.remove(runtime.brim);
  runtime.brim.geometry.dispose();
  const material = runtime.brim.material;
  if (Array.isArray(material)) material.forEach((item) => item.dispose());
  else material.dispose();
  runtime.brim = null;
}

function frameModel(runtime: PreviewRuntime, size: THREE.Vector3) {
  const target = new THREE.Vector3(0, Math.max(size.y / 2, 8), 0);
  const radius = Math.max(size.length() / 2, 40);
  const halfFov = THREE.MathUtils.degToRad(runtime.camera.fov / 2);
  const distance = (radius / Math.sin(halfFov)) * 1.15;
  const direction = new THREE.Vector3(1, 0.78, 1).normalize();

  runtime.camera.position.copy(target).addScaledVector(direction, distance);
  runtime.camera.near = Math.max(0.1, distance / 200);
  runtime.camera.far = Math.max(2000, distance * 20);
  runtime.camera.updateProjectionMatrix();
  runtime.controls.target.copy(target);
  runtime.controls.update();
}

function applyModelSettings(runtime: PreviewRuntime, settings: PreviewSettings, shouldFrame: boolean) {
  const object = runtime.model;
  if (!object) return null;

  removeBrim(runtime);
  object.position.copy(runtime.basePosition);
  object.quaternion.copy(runtime.baseQuaternion);
  object.scale.copy(runtime.baseScale);

  if (settings.autoOrient) {
    const initialSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    if (initialSize.x <= initialSize.y && initialSize.x <= initialSize.z) {
      object.rotateZ(Math.PI / 2);
    } else if (initialSize.z <= initialSize.x && initialSize.z <= initialSize.y) {
      object.rotateX(-Math.PI / 2);
    }
  }

  object.scale.multiplyScalar(settings.scalePercent / 100);
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error("模型內沒有可預覽的幾何資料");

  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
  object.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(object);
  const size = finalBox.getSize(new THREE.Vector3());

  if (settings.brimEnabled) {
    const brim = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(size.x + 10, 12), Math.max(size.z + 10, 12)),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      })
    );
    brim.rotation.x = -Math.PI / 2;
    brim.position.y = 0.15;
    runtime.scene.add(brim);
    runtime.brim = brim;
  }

  runtime.controls.target.set(0, Math.max(size.y / 2, 8), 0);
  if (shouldFrame) frameModel(runtime, size);

  return {
    dimensions: `${size.x.toFixed(1)} × ${size.z.toFixed(1)} × ${size.y.toFixed(1)} mm`,
    outOfBounds: size.x > 256 || size.z > 256 || size.y > 256,
  };
}

export function ThreeModelPreview({
  file,
  scalePercent,
  autoOrient,
  layerHeight,
  infillPercent,
  infillPattern,
  supportType,
  brimEnabled,
}: ThreeModelPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PreviewRuntime | null>(null);
  const loadSequenceRef = useRef(0);
  const settingsRef = useRef<PreviewSettings>({
    scalePercent,
    autoOrient,
    layerHeight,
    infillPercent,
    infillPattern,
    supportType,
    brimEnabled,
  });
  const [dimensions, setDimensions] = useState("尚未載入模型");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  settingsRef.current = {
    scalePercent,
    autoOrient,
    layerHeight,
    infillPercent,
    infillPattern,
    supportType,
    brimEnabled,
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth || 640;
    const height = host.clientHeight || 440;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef1f4");
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 3000);
    camera.position.set(330, 280, 330);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setError("瀏覽器無法啟動 3D 預覽，請確認 WebGL 已啟用");
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x737b84, 2.8));
    scene.add(new THREE.AmbientLight(0xffffff, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(180, 300, 120);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdbeafe, 1.8);
    fill.position.set(-180, 160, -120);
    scene.add(fill);

    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(256, 3, 256),
      new THREE.MeshStandardMaterial({ color: 0x383d43, metalness: 0.1, roughness: 0.86 })
    );
    bed.position.y = -2;
    scene.add(bed);
    scene.add(new THREE.GridHelper(256, 16, 0x9da3aa, 0x666d75));

    const buildVolume = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(256, 256, 256)),
      new THREE.LineBasicMaterial({ color: 0x69727c, transparent: true, opacity: 0.28 })
    );
    buildVolume.position.y = 128;
    scene.add(buildVolume);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 50, 0);
    controls.enableDamping = true;

    const runtime: PreviewRuntime = {
      scene,
      camera,
      renderer,
      controls,
      model: null,
      brim: null,
      basePosition: new THREE.Vector3(),
      baseQuaternion: new THREE.Quaternion(),
      baseScale: new THREE.Vector3(1, 1, 1),
    };
    runtimeRef.current = runtime;

    let animationId = 0;
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
      loadSequenceRef.current += 1;
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      controls.dispose();
      removeBrim(runtime);
      if (runtime.model) runtime.scene.remove(runtime.model);
      disposeObject(runtime.model);
      bed.geometry.dispose();
      (bed.material as THREE.Material).dispose();
      buildVolume.geometry.dispose();
      (buildVolume.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const sequence = ++loadSequenceRef.current;

    removeBrim(runtime);
    if (runtime.model) {
      runtime.scene.remove(runtime.model);
      disposeObject(runtime.model);
      runtime.model = null;
    }

    if (!file) {
      setDimensions("尚未載入模型");
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setDimensions("讀取模型中…");

    const loadModel = async () => {
      try {
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (extension !== "stl" && extension !== "3mf") throw new Error("只支援 STL 或 3MF 預覽");

        const buffer = await file.arrayBuffer();
        if (sequence !== loadSequenceRef.current || runtimeRef.current !== runtime) return;

        let object: THREE.Object3D;
        if (extension === "stl") {
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          object = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: 0x4f9ddd, roughness: 0.52, metalness: 0.02, side: THREE.DoubleSide })
          );
        } else {
          object = new ThreeMFLoader().parse(buffer);
          let meshCount = 0;
          object.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            meshCount += 1;
            child.geometry.computeVertexNormals();
            const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
            oldMaterials.forEach((material) => material?.dispose());
            child.material = new THREE.MeshStandardMaterial({
              color: 0x4f9ddd,
              roughness: 0.52,
              metalness: 0.02,
              side: THREE.DoubleSide,
            });
          });
          if (meshCount === 0) throw new Error("3MF 內沒有可預覽的模型");
        }

        if (sequence !== loadSequenceRef.current || runtimeRef.current !== runtime) {
          disposeObject(object);
          return;
        }

        runtime.model = object;
        runtime.basePosition.copy(object.position);
        runtime.baseQuaternion.copy(object.quaternion);
        runtime.baseScale.copy(object.scale);
        runtime.scene.add(object);

        const result = applyModelSettings(runtime, settingsRef.current, true);
        if (!result) throw new Error("模型載入失敗");
        setDimensions(result.dimensions);
        setError(result.outOfBounds ? "模型超出 P1S 256 × 256 × 256 mm 成形範圍" : "");
      } catch (loadError) {
        if (sequence === loadSequenceRef.current) {
          setError(loadError instanceof Error ? loadError.message : "無法預覽此模型");
          setDimensions("預覽載入失敗");
        }
      } finally {
        if (sequence === loadSequenceRef.current) setLoading(false);
      }
    };

    void loadModel();
  }, [file]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime?.model) return;
    try {
      const result = applyModelSettings(runtime, settingsRef.current, false);
      if (!result) return;
      setDimensions(result.dimensions);
      setError(result.outOfBounds ? "模型超出 P1S 256 × 256 × 256 mm 成形範圍" : "");
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "預覽更新失敗");
    }
  }, [scalePercent, autoOrient, brimEnabled]);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
      <div className="relative">
        <div ref={hostRef} className="h-[440px] w-full" />
        {!file && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/20 text-center">
            <div>
              <div className="text-base font-medium text-slate-300">上傳 STL 或 3MF 查看模型</div>
              <div className="mt-1 text-sm text-slate-500">可拖曳旋轉，滾輪縮放</div>
            </div>
          </div>
        )}
        {loading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/65">
            <div className="text-sm font-mono text-sky-300 animate-pulse">LOADING_MODEL_PREVIEW…</div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-mono">
          <span className="text-slate-400">P1S / 256³ mm · {dimensions}</span>
          <span className={error ? "text-rose-300" : "text-emerald-300"}>
            {error || (autoOrient ? "AUTO_ORIENT_PREVIEW" : "MODEL_IN_BOUNDS")}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">Scale {scalePercent}%</span>
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">Layer {layerHeight} mm</span>
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">Infill {infillPercent}% · {infillPattern}</span>
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">Support {supportType}</span>
          <span className={`rounded-md border px-2 py-1 ${brimEnabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-400"}`}>Brim {brimEnabled ? "ON" : "OFF"}</span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Scale、Auto orient 與 Brim 會更新 3D 畫面；Layer、Infill、Support 為切片內部設定，最終結果以伺服器切片為準。
        </p>
      </div>
    </div>
  );
}
