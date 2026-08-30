import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Интерактивная 3D-карта станции Омникрон.
 *
 * Рендерит GLB-модель станции в «чертёжном» стиле (Sobel edge detection по
 * ID-буферу: каждый меш получает уникальный цвет, границы между объектами
 * становятся чёрными линиями на белом фоне). Поверх — HTML-маркеры точек
 * интереса (POI), привязанные к кольцам станции. Клик по маркеру открывает
 * карточку с живыми данными: контракты фракции, входящие события, снабжение.
 */

type StationPoi = {
  id: string;
  name: string;
  ring: string;
  angle: number;
  desc: string;
  kind: "supply" | "faction" | "market" | "inbox";
  factionId?: string;
  badge?: number;
  actions: { label: string; onClick: () => void }[];
};

const RINGS = [
  { id: "eye", name: "Центр / Око", radius: 1.6, minor: 0.0 },
  { id: "scholarium", name: "Внутреннее кольцо", radius: 4.0, minor: 0.35 },
  { id: "archive", name: "Срединное кольцо", radius: 6.5, minor: 0.5 },
  { id: "cultivation", name: "Внешнее кольцо", radius: 9.0, minor: 0.7 },
  { id: "perimeter", name: "Обшивка / Периметр", radius: 11.0, minor: 0.4 },
] as const;

const ringById = (id: string) => RINGS.find((r) => r.id === id);

const MODULE_SCALE = 2.2;
const SPOKE_SCALE = 2.0;
const OUTER_SPOKE_SCALE = 4.0;

function assignIds(root: THREE.Object3D) {
  let id = 0;
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      id++;
      const r = ((id % 16) * 16) / 255;
      const g = ((Math.floor(id / 16) % 16) * 16) / 255;
      const b = ((Math.floor(id / 256) % 16) * 16) / 255;
      (node as THREE.Mesh).material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(r, g, b),
      });
      if (/^Module_/.test(node.name)) node.scale.multiplyScalar(MODULE_SCALE);
      if (/^Spoke_/.test(node.name)) {
        node.scale.y *= SPOKE_SCALE;
        node.scale.z *= SPOKE_SCALE;
      }
      if (/^OuterSpoke_/.test(node.name)) {
        node.scale.y *= OUTER_SPOKE_SCALE;
        node.scale.z *= OUTER_SPOKE_SCALE;
      }
    }
  });
}

export function Station3D({
  pois,
  onOpenInbox,
  onOpenContracts,
  onOpenSupply,
}: {
  pois: StationPoi[];
  onOpenInbox: () => void;
  onOpenContracts: () => void;
  onOpenSupply: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [openPoi, setOpenPoi] = useState<StationPoi | null>(null);
  const [markers, setMarkers] = useState<StationPoi[]>(pois);
  const stateRef = useRef<{
    station: THREE.Group;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    rt: THREE.WebGLRenderTarget;
    edgeMat: THREE.ShaderMaterial;
    quadScene: THREE.Scene;
    quadCam: THREE.OrthographicCamera;
    rotY: number;
    rotX: number;
    zoom: number;
    autoRotate: boolean;
    dragging: boolean;
    lastX: number;
    lastY: number;
    markerEls: { poi: StationPoi; el: HTMLDivElement }[];
    openPoi: StationPoi | null;
    cardEl: HTMLDivElement | null;
  } | null>(null);

  // Keep markers in sync with props.
  useEffect(() => {
    setMarkers(pois);
  }, [pois]);

  // Init three.js scene once.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    camera.position.set(0, 12, 26);
    camera.lookAt(0, 0, 0);

    const station = new THREE.Group();
    scene.add(station);

    const rt = new THREE.WebGLRenderTarget(
      container.clientWidth,
      container.clientHeight,
    );

    const edgeMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        resolution: {
          value: new THREE.Vector2(
            container.clientWidth,
            container.clientHeight,
          ),
        },
        threshold: { value: 0.05 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tColor;
        uniform vec2 resolution;
        uniform float threshold;
        varying vec2 vUv;
        float diff(vec3 a, vec3 b) {
          return max(max(abs(a.r-b.r), abs(a.g-b.g)), abs(a.b-b.b));
        }
        void main() {
          vec2 texel = 1.0 / resolution;
          vec3 c0 = texture2D(tColor, vUv + vec2(-texel.x,  texel.y)).rgb;
          vec3 c1 = texture2D(tColor, vUv + vec2(0.0,       texel.y)).rgb;
          vec3 c2 = texture2D(tColor, vUv + vec2( texel.x,  texel.y)).rgb;
          vec3 c3 = texture2D(tColor, vUv + vec2(-texel.x,  0.0)).rgb;
          vec3 c4 = texture2D(tColor, vUv).rgb;
          vec3 c5 = texture2D(tColor, vUv + vec2( texel.x,  0.0)).rgb;
          vec3 c6 = texture2D(tColor, vUv + vec2(-texel.x, -texel.y)).rgb;
          vec3 c7 = texture2D(tColor, vUv + vec2(0.0,      -texel.y)).rgb;
          vec3 c8 = texture2D(tColor, vUv + vec2( texel.x, -texel.y)).rgb;
          float d0 = diff(c0, c4);
          float d1 = diff(c1, c4);
          float d2 = diff(c2, c4);
          float d3 = diff(c3, c4);
          float d5 = diff(c5, c4);
          float d6 = diff(c6, c4);
          float d7 = diff(c7, c4);
          float d8 = diff(c8, c4);
          float maxDiff = max(max(max(d0, d1), max(d2, d3)), max(max(d5, d6), max(d7, d8)));
          float line = step(threshold, maxDiff);
          gl_FragColor = vec4(mix(vec3(1.0), vec3(0.0), line), 1.0);
        }
      `,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMat);
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const loader = new GLTFLoader();
    loader.load(
      "/models/station.glb",
      (gltf) => {
        const model = gltf.scene;
        assignIds(model);
        station.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 20 / maxDim;
        station.scale.setScalar(scale);
        station.position.sub(center.multiplyScalar(scale));
      },
      undefined,
      (err) => console.error("Station GLB load error", err),
    );

    const state: {
      station: THREE.Group;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      rt: THREE.WebGLRenderTarget;
      edgeMat: THREE.ShaderMaterial;
      quadScene: THREE.Scene;
      quadCam: THREE.OrthographicCamera;
      rotY: number;
      rotX: number;
      zoom: number;
      autoRotate: boolean;
      dragging: boolean;
      lastX: number;
      lastY: number;
      markerEls: { poi: StationPoi; el: HTMLDivElement }[];
      openPoi: StationPoi | null;
      cardEl: HTMLDivElement | null;
    } = {
      station,
      camera,
      renderer,
      rt,
      edgeMat,
      quadScene,
      quadCam,
      rotY: 0,
      rotX: 0.35,
      zoom: 1,
      autoRotate: true,
      dragging: false,
      lastX: 0,
      lastY: 0,
      markerEls: [],
      openPoi: null,
      cardEl: null,
    };
    stateRef.current = state;

    // Pointer handlers.
    const onPointerDown = (e: PointerEvent) => {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.autoRotate = false;
    };
    const onPointerUp = () => {
      state.dragging = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (state.dragging) {
        state.rotY += (e.clientX - state.lastX) * 0.005;
        state.rotX = Math.max(
          0.05,
          Math.min(1.4, state.rotX + (e.clientY - state.lastY) * 0.003),
        );
        state.lastX = e.clientX;
        state.lastY = e.clientY;
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      state.zoom = Math.max(
        0.4,
        Math.min(3, state.zoom * (e.deltaY > 0 ? 0.9 : 1.1)),
      );
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      rt.setSize(w, h);
      edgeMat.uniforms.resolution.value.set(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (state.autoRotate) state.rotY += dt * 0.15;
      station.rotation.y = state.rotY;
      station.rotation.x = state.rotX;
      const dist = 26 / state.zoom;
      camera.position.set(0, 12 / state.zoom, dist);
      camera.lookAt(0, 0, 0);

      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      edgeMat.uniforms.tColor.value = rt.texture;
      renderer.render(quadScene, quadCam);

      // Project markers.
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const { poi, el } of state.markerEls) {
        const p = projectPoi(poi, state, w, h);
        if (!p) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "flex";
        el.style.left = p.x + "px";
        el.style.top = p.y + "px";
      }

      // Position card.
      if (state.openPoi && state.cardEl) {
        const p = projectPoi(state.openPoi, state, w, h);
        if (p) {
          state.cardEl.style.left =
            Math.min(p.x + 18, container.clientWidth - 270) + "px";
          state.cardEl.style.top =
            Math.min(p.y - 20, container.clientHeight - 220) + "px";
        }
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      rt.dispose();
      edgeMat.dispose();
    };
  }, []);

  // Rebuild marker DOM when markers change.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const container = containerRef.current;
    if (!container) return;
    // Clear old markers.
    for (const { el } of state.markerEls) el.remove();
    state.markerEls = markers.map((poi) => {
      const div = document.createElement("div");
      div.className = "station3d-marker";
      div.innerHTML = `<span class="dot"></span><span class="label">${poi.name}${
        poi.badge != null ? ` · ${poi.badge}` : ""
      }</span>`;
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpenPoi(poi);
        state.openPoi = poi;
        state.autoRotate = false;
        state.markerEls.forEach((m) =>
          m.el.classList.toggle("active", m.poi.id === poi.id),
        );
      });
      container.appendChild(div);
      return { poi, el: div };
    });
  }, [markers]);

  // Sync openPoi into state ref for the animation loop.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.openPoi = openPoi;
    state.cardEl = containerRef.current?.querySelector(
      ".station3d-card",
    ) as HTMLDivElement | null;
  }, [openPoi]);

  return (
    <div className="station3d" ref={containerRef}>
      <canvas ref={canvasRef} className="station3d-canvas" />
      <div className="station3d-hud">
        <small>ОМНИКРОН · СТАНЦИЯ</small>
        <h1>Интерактивная карта</h1>
        <div className="station3d-tips">
          <span>
            <b>drag</b> вращение
          </span>
          <span>
            <b>wheel</b> зум
          </span>
          <span>
            <b>click</b> карточка
          </span>
        </div>
      </div>
      <div className="station3d-legend">
        {RINGS.map((r) => (
          <div className="row" key={r.id}>
            <span className="dot" />
            {r.name}
          </div>
        ))}
      </div>
      {openPoi && (
        <div className="station3d-card">
          <span
            className="close"
            onClick={() => {
              setOpenPoi(null);
              const state = stateRef.current;
              if (state) {
                state.openPoi = null;
                state.markerEls.forEach((m) =>
                  m.el.classList.remove("active"),
                );
              }
            }}
          >
            ✕
          </span>
          <small>{ringById(openPoi.ring)?.name.toUpperCase()}</small>
          <h3>{openPoi.name}</h3>
          <p>{openPoi.desc}</p>
          <div className="station3d-card-actions">
            {openPoi.actions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  action.onClick();
                  setOpenPoi(null);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function projectPoi(
  poi: StationPoi,
  state: {
    station: THREE.Group;
    camera: THREE.PerspectiveCamera;
  },
  width: number,
  height: number,
) {
  const ring = ringById(poi.ring);
  if (!ring) return null;
  const a = (poi.angle * Math.PI) / 180;
  const R = ring.radius;
  const y = ring.minor + 0.35;
  const world = new THREE.Vector3(R * Math.cos(a), y, R * Math.sin(a));
  state.station.localToWorld(world);
  const v = world.project(state.camera);
  if (v.z > 1) return null;
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
  };
}
