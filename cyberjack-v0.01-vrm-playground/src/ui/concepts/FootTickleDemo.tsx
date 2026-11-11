import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * FootTickleDemo — реактивная анимация ступней (щекотка) на готовых клипах.
 *
 * Модель: Evanescia_Feet_Motion.glb — ноги до бёдер, риг 32 кости, 9 клипов.
 *
 * Взаимодействие:
 *   1. Клик по ступне — импульс (Quick_Flinch / Toe_Clench).
 *   2. Холд (зажать) — реакция: луп Tremor с нарастающим весом.
 *   3. Кнопка «Валики» — два валика со щетинками выезжают снизу, прижимаются
 *      к подошвам (контакт гарантирован: центр = подошва − радиус), начинают
 *      вращаться; ступни отвечают усиливающейся реакцией (Mixed_Reaction).
 *
 * Камера фиксированная: ступни в центре кадра, вид сверху-спереди.
 */

type Side = "left" | "right";

const CLIPS = {
  LOOP_01_Tremor: 2.0,
  LOOP_02_Toe_Curl_Extend: 3.0,
  LOOP_03_Toe_Splay: 3.0,
  LOOP_04_Ankle_Flex: 4.0,
  LOOP_05_Ankle_Circle: 4.0,
  LOOP_06_Mixed_Reaction: 4.0,
  IMPULSE_01_Quick_Flinch: 1.6,
  IMPULSE_02_Toe_Clench: 2.0,
  IMPULSE_03_Spread_Recover: 2.4,
} as const;

type ClipName = keyof typeof CLIPS;

const ROLLER_RADIUS = 0.05;
const ROLLER_LEN = 0.13;
const APPROACH_SEC = 1.2;
const RETRACT_SEC = 0.6;

// Детализированный валик: сердечник, ободы, щетинки 2×12 радиально, ручка.
function makeRoller(): { group: THREE.Group; spinner: THREE.Group } {
  const group = new THREE.Group();
  const spinner = new THREE.Group();
  group.add(spinner);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    roughness: 0.5,
    metalness: 0.4,
  });
  const bristleMat = new THREE.MeshStandardMaterial({
    color: 0xd8c8a0,
    roughness: 0.9,
    metalness: 0,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x2d333d,
    roughness: 0.4,
    metalness: 0.5,
  });

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(ROLLER_RADIUS * 0.7, ROLLER_RADIUS * 0.7, ROLLER_LEN, 20),
    coreMat,
  );
  core.rotation.z = Math.PI / 2;
  spinner.add(core);

  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(ROLLER_RADIUS, ROLLER_RADIUS, 0.012, 20),
      capMat,
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.x = (sx * ROLLER_LEN) / 2;
    spinner.add(cap);
  }

  // Плотный мелкий ворс: InstancedMesh коротких волосков по всей поверхности.
  // Ряды по X × плотная сетка по окружности; волоски радиально наружу.
  const hairLen = ROLLER_RADIUS * 0.28; // длина ворсинки
  const hairCountX = 26; // вдоль оси
  const hairCountC = 28; // по окружности
  const total = hairCountX * hairCountC;
  const hairGeo = new THREE.CylinderGeometry(
    hairLen * 0.08,
    hairLen * 0.03,
    hairLen,
    3,
  );
  hairGeo.translate(0, hairLen / 2, 0); // основание в нуле, рост вверх (+Y)
  const hairs = new THREE.InstancedMesh(hairGeo, bristleMat, total);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  let idx = 0;
  for (let i = 0; i < hairCountX; i++) {
    const bx = (i / (hairCountX - 1) - 0.5) * ROLLER_LEN;
    for (let j = 0; j < hairCountC; j++) {
      const theta = ((j + 0.5) / hairCountC) * Math.PI * 2;
      const rr = ROLLER_RADIUS * 0.99;
      dir.set(0, Math.cos(theta), Math.sin(theta));
      q.setFromUnitVectors(up, dir);
      pos.set(bx, Math.cos(theta) * rr, Math.sin(theta) * rr);
      // Лёгкая случайная вариация длины/наклона — живой ворс.
      const jitter = 0.85 + ((i * 7 + j * 13) % 10) / 10 * 0.3;
      scl.set(1, jitter, 1);
      m.compose(pos, q, scl);
      hairs.setMatrixAt(idx++, m);
    }
  }
  hairs.instanceMatrix.needsUpdate = true;
  spinner.add(hairs);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.22, 10),
    new THREE.MeshStandardMaterial({ color: 0x333a45, roughness: 0.5 }),
  );
  handle.position.set(0, -0.1, 0.03);
  handle.rotation.x = 0.35;
  group.add(handle);

  return { group, spinner };
}

type RollerRig = {
  group: THREE.Group;
  spinner: THREE.Group;
  restX: number;
  restY: number;
  restZ: number;
  startY: number;
  startZ: number;
  restRotX: number;
};

export function FootTickleDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("загрузка…");
  const [rollerActive, setRollerActive] = useState(false);

  const stateRef = useRef<{
    mixer: THREE.AnimationMixer;
    actions: Record<ClipName, THREE.AnimationAction>;
    rollers: { left: RollerRig; right: RollerRig };
    phase: "idle" | "approach" | "spin" | "retract";
    phaseT: number;
    spinAngle: number;
    impulse: (side: Side) => void;
    startHold: (side: Side) => void;
    endHold: () => void;
    startRollers: () => void;
    stopRollers: () => void;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1e);

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.01,
      100,
    );

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.5, 1, 0.8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8899cc, 0.6);
    rim.position.set(-0.6, 0.3, -0.6);
    scene.add(rim);

    const model = new THREE.Group();
    scene.add(model);

    const rollerLeft = makeRoller();
    const rollerRight = makeRoller();
    rollerLeft.group.visible = false;
    rollerRight.group.visible = false;
    scene.add(rollerLeft.group);
    scene.add(rollerRight.group);

    const holdState = { side: null as Side | null, intensity: 0 };

    const loader = new GLTFLoader();
    loader.load(
      "/models/evanescia_feet_motion.glb",
      (gltf) => {
        const root = gltf.scene;
        model.add(root);

        const skinMat = new THREE.MeshStandardMaterial({
          color: 0xe8b8a0,
          roughness: 0.6,
          metalness: 0,
        });
        root.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            (node as THREE.Mesh).material = skinMat;
          }
        });

        // Жёсткие координаты из Blender-замеров (Y-up glTF): подошвы на y≈0
        // (POSITION min y = 0.0008), высота модели 0..0.835.
        model.scale.setScalar(2.2); // фиксированный масштаб
        model.position.set(0, 0, 0); // центрируем по X/Z — уже в glb
        // Наклон модели назад на ~20° вокруг X (пальцы от камеры, подошва к камере).
        const TILT = THREE.MathUtils.degToRad(20);
        model.rotation.x = -TILT;

        // Фиксированная камера: низко и спереди — видны подошвы (модель стоит,
        // подошвы смотрят вниз, пальцы в -Z). Ступни в центре кадра.
        const feet = new THREE.Vector3(0, 0.16, -0.15);
        camera.position.set(0, -0.05, 0.8);
        camera.lookAt(feet);

        // Валики: прижаты к подошвам. Модель наклонена на TILT назад вокруг X,
        // подошва (плоскость y=0, z∈[−0.07..0.115]) повёрнута: точка (0,z) →
        // (y' = z·sin T, z' = z·cos T). Центр стопы z=0.02:
        const soleY = 0.02 * Math.sin(TILT); // подъём центра подошвы
        const soleZ = 0.02 * Math.cos(TILT); // к камере
        const footX = 0.163; // центр ступни по X (наклон вокруг X не меняет X)
        const mkRig = (xSign: number): RollerRig => ({
          ...makeRoller(),
          restX: xSign * footX,
          restY: soleY - ROLLER_RADIUS - 0.012, // прижим с учётом ворса
          restZ: soleZ,
          startY: soleY - 0.5,
          startZ: soleZ + 0.35,
          restRotX: 0.15,
        });
        const leftRig = mkRig(1);
        const rightRig = mkRig(-1);
        // Валики скрыты до нажатия кнопки.
        leftRig.group.visible = false;
        rightRig.group.visible = false;
        scene.add(leftRig.group);
        scene.add(rightRig.group);

        const mixer = new THREE.AnimationMixer(root);
        const actions = {} as Record<ClipName, THREE.AnimationAction>;
        for (const clip of gltf.animations) {
          const name = clip.name as ClipName;
          if (name in CLIPS) {
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            actions[name] = action;
          }
        }

        const state = {
          mixer,
          actions,
          rollers: { left: leftRig, right: rightRig },
          phase: "idle" as "idle" | "approach" | "spin" | "retract",
          phaseT: 0,
          spinAngle: 0,
          impulse: (side: Side) => {
            const name: ClipName =
              Math.random() < 0.5 ? "IMPULSE_01_Quick_Flinch" : "IMPULSE_02_Toe_Clench";
            const a = actions[name];
            a.reset();
            a.setLoop(THREE.LoopOnce, 1);
            a.clampWhenFinished = true;
            a.play();
          },
          startHold: (side: Side) => {
            holdState.side = side;
            holdState.intensity = 0;
            const a = actions["LOOP_01_Tremor"];
            a.reset();
            a.setLoop(THREE.LoopRepeat, Infinity);
            a.setEffectiveWeight(0);
            a.play();
          },
          endHold: () => {
            holdState.side = null;
            holdState.intensity = 0;
            actions["LOOP_01_Tremor"].fadeOut(0.3);
          },
          startRollers: () => {
            state.phase = "approach";
            state.phaseT = 0;
            state.spinAngle = 0;
            leftRig.group.visible = true;
            rightRig.group.visible = true;
            leftRig.group.position.set(leftRig.restX, leftRig.startY, leftRig.startZ);
            rightRig.group.position.set(rightRig.restX, rightRig.startY, rightRig.startZ);
            setRollerActive(true);
          },
          stopRollers: () => {
            if (state.phase === "spin") {
              state.phase = "retract";
              state.phaseT = 0;
              actions["LOOP_06_Mixed_Reaction"].fadeOut(0.4);
            } else if (state.phase === "approach") {
              state.phase = "retract";
              state.phaseT = 0;
            }
          },
        };
        stateRef.current = state;

        setStatus(
          `готово · 9 клипов · камера y=${feet.y.toFixed(2)} · валики x=±${footX.toFixed(3)}`,
        );
      },
      undefined,
      (err) => {
        console.error("GLB load error", err);
        setStatus("ошибка загрузки GLB");
      },
    );

    // Raycast: клик = импульс, зажатие = холд.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let holding = false;
    const sideFromEvent = (e: PointerEvent): Side | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(model, true);
      if (hits.length === 0) return null;
      return hits[0].point.x < 0 ? "left" : "right";
    };
    const onPointerDown = (e: PointerEvent) => {
      const side = sideFromEvent(e);
      if (!side) return;
      holding = true;
      stateRef.current?.impulse(side);
      stateRef.current?.startHold(side);
    };
    const onPointerUp = () => {
      if (holding) {
        holding = false;
        stateRef.current?.endHold();
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      const s = stateRef.current;
      if (s) {
        // Холд: наращиваем дрожь.
        if (holdState.side !== null) {
          holdState.intensity = Math.min(1, holdState.intensity + dt * 0.8);
          s.actions["LOOP_01_Tremor"].setEffectiveWeight(holdState.intensity);
        }

        // Валики: конечный автомат.
        if (s.phase !== "idle") {
          s.phaseT += dt;
          s.spinAngle += dt * 6;
          for (const [rig, xSign] of [
            [s.rollers.left, 1],
            [s.rollers.right, -1],
          ] as const) {
            const { restY, restZ, startY, startZ, restRotX, restX } = rig;
            if (s.phase === "approach") {
              const p = Math.min(1, s.phaseT / APPROACH_SEC);
              const ease = 1 - Math.pow(1 - p, 3);
              rig.group.position.set(
                restX,
                startY + (restY - startY) * ease,
                startZ + (restZ - startZ) * ease,
              );
              rig.group.rotation.x = restRotX * ease;
              if (p >= 1) {
                // Контакт: усиливающаяся реакция.
                s.phase = "spin";
                s.phaseT = 0;
                const a = s.actions["LOOP_06_Mixed_Reaction"];
                a.reset();
                a.setLoop(THREE.LoopRepeat, Infinity);
                a.setEffectiveWeight(0);
                a.play();
              }
            } else if (s.phase === "spin") {
              rig.group.position.set(restX, restY, restZ);
              rig.group.rotation.x = restRotX;
              rig.spinner.rotation.x = s.spinAngle;
              const w = Math.min(1, s.phaseT / 1.5);
              s.actions["LOOP_06_Mixed_Reaction"].setEffectiveWeight(w);
            } else if (s.phase === "retract") {
              const p = Math.min(1, s.phaseT / RETRACT_SEC);
              const ease = p * p;
              rig.group.position.set(
                restX,
                restY + (startY - restY) * ease,
                restZ + (startZ - restZ) * ease,
              );
              rig.spinner.rotation.x = s.spinAngle * (1 - ease);
              if (p >= 1) {
                rig.group.visible = false;
                s.phase = "idle";
                setRollerActive(false);
              }
            }
          }
          // Фаза approach завершается один раз — переключение внутри ветки.
        }
        s.mixer.update(dt);
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "20px",
        background: "#141417",
        minHeight: "100vh",
        fontFamily: "monospace",
        color: "#e8e8ea",
      }}
    >
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <h1 style={{ fontSize: "18px", margin: 0 }}>Ступни · реакция на щекотку</h1>
        <span style={{ fontSize: "12px", color: "#9a9aa2" }}>{status}</span>
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: "520px",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid #333",
          cursor: "crosshair",
        }}
      />
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            const s = stateRef.current;
            if (!s) return;
            if (rollerActive) s.stopRollers();
            else s.startRollers();
          }}
        >
          {rollerActive ? "Убрать валики" : "Валики-щётки"}
        </button>
      </div>
      <div style={{ fontSize: "11px", color: "#777" }}>
        Клик по ступне = импульс · зажать = реакция · кнопка = валики.
      </div>
    </div>
  );
}