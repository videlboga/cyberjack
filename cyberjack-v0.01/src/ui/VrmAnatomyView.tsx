
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMHumanBoneName } from '@pixiv/three-vrm';
import { clothingModelMap } from './clothingModelMap';

interface Props {
  vrmUrl?: string | null;
  availablePoints: { id: string, label: string }[];
  selectedPoint: string;
  onSelectPoint: (id: string) => void;
  activeContexts: any[];
  poseUrl?: string | null;
}

const BONE_MAPPING: Record<string, VRMHumanBoneName> = {
  head: VRMHumanBoneName.Head,
  face: VRMHumanBoneName.Head,
  lips: VRMHumanBoneName.Jaw,
  neck: VRMHumanBoneName.Neck,
  shoulders: VRMHumanBoneName.UpperChest,
  chest: VRMHumanBoneName.UpperChest,
  nipples: VRMHumanBoneName.UpperChest,
  belly: VRMHumanBoneName.Spine,
  waist: VRMHumanBoneName.Spine,
  back: VRMHumanBoneName.Spine,
  buttocks: VRMHumanBoneName.Hips,
  hips: VRMHumanBoneName.Hips,
  left_arm: VRMHumanBoneName.LeftUpperArm,
  right_arm: VRMHumanBoneName.RightUpperArm,
  left_hand: VRMHumanBoneName.LeftHand,
  right_hand: VRMHumanBoneName.RightHand,
  left_leg: VRMHumanBoneName.LeftUpperLeg,
  right_leg: VRMHumanBoneName.RightUpperLeg,
  knees: VRMHumanBoneName.LeftLowerLeg,
  feet: VRMHumanBoneName.LeftFoot,
  inner_thighs: VRMHumanBoneName.LeftUpperLeg,
  groin: VRMHumanBoneName.Hips,
  penis: VRMHumanBoneName.Hips,
  testicles: VRMHumanBoneName.Hips,
  vagina: VRMHumanBoneName.Hips,
  vulva: VRMHumanBoneName.Hips,
  clitoris: VRMHumanBoneName.Hips,
  anus: VRMHumanBoneName.Hips,
  prostate: VRMHumanBoneName.Hips,
};

const POINT_OFFSETS: Record<string, [number, number, number]> = {
  shoulders: [0, 0.12, 0],
  nipples: [0, -0.05, 0.12],
  chest: [0, 0.05, 0.12],
  belly: [0, -0.05, 0.15],
  waist: [0, -0.08, 0],
  back: [0, 0.05, -0.15],
  buttocks: [0, -0.05, -0.16],
  hips: [0.12, 0.05, 0],
  inner_thighs: [-0.08, -0.1, 0.05],
  groin: [0, -0.04, 0.12],
  clitoris: [0.03, -0.07, 0.13],
  vulva: [-0.03, -0.09, 0.11],
  vagina: [0, -0.12, 0.09],
  penis: [0, -0.08, 0.16],
  testicles: [0, -0.14, 0.13],
  anus: [0, -0.12, -0.10],
  prostate: [0, -0.08, -0.03],
};

const loadVRM = (url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';

    loader.register((parser: any) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf: any) => {
        const vrm = gltf.userData.vrm;
        vrm.scene.traverse((obj: any) => { obj.frustumCulled = false; });
        resolve(vrm);
      },
      undefined,
  (err: any) => reject(err)
    );
  });
};

function BoneMarker({ boneNode, offset = [0,0,0], content }: { boneNode: THREE.Object3D, offset?: [number, number, number], content: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const offsetVec = useMemo(() => new THREE.Vector3(offset[0], offset[1], offset[2]), [offset]);
  const normalVec = useMemo(() => {
    let v = new THREE.Vector3(offset[0], offset[1], offset[2]);
    if (v.length() < 0.001) v.set(0, 0, 1);
    return v.normalize();
  }, [offset]);

  useFrame(({ camera }) => {
    if (ref.current && boneNode) {
      ref.current.position.copy(offsetVec);
      ref.current.applyMatrix4(boneNode.matrixWorld);
      if (wrapperRef.current) {
        const pointWorldPos = ref.current.position;
        const camDir = new THREE.Vector3().subVectors(pointWorldPos, camera.position).normalize();
        const worldNormal = normalVec.clone().transformDirection(boneNode.matrixWorld).normalize();
        const dot = camDir.dot(worldNormal);
        const isVisible = dot < 0.2;
        wrapperRef.current.style.opacity = isVisible ? '1' : '0.1';
        wrapperRef.current.style.pointerEvents = isVisible ? 'auto' : 'none';
      }
    }
  });

  return (
    <group ref={ref}>
      <Html center>
        <div ref={wrapperRef as any} style={{ display: 'inline-block' }}>{content}</div>
      </Html>
    </group>
  );
}

function VrmModel({ vrmUrl, availablePoints, selectedPoint, onSelectPoint, activeContexts, poseUrl }: Props) {
  const [vrm, setVrm] = useState<any>(null);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const sceneRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!vrmUrl) return;
    loadVRM(vrmUrl).then(loadedVrm => {
      setVrm(loadedVrm);
      loadedVrm.scene.rotation.y = 0;
    }).catch(err => console.error('Failed to load VRM:', err));
  }, [vrmUrl]);

  const applyPoseData = async (pUrl?: string | null) => {
    if (!vrm || !pUrl) return;
    try {
      const res = await fetch(pUrl);
      const text = await res.text();
      let poseObj: any = null;
      try { poseObj = JSON.parse(text); } catch (e) { /* not JSON */ }
      if (!poseObj) {
        console.warn('Pose file is not JSON; provide JSON mapping or convert VPD to JSON.');
        return;
      }

      for (const [boneName, data] of Object.entries(poseObj)) {
        try {
          let node: THREE.Object3D | undefined;
          try { node = (vrm as any).humanoid?.getBoneNode(boneName as any); } catch {}
          if (!node) node = vrm.scene.getObjectByName(boneName as string) as THREE.Object3D | undefined;
          if (!node) continue;
          if ((data as any).rot && Array.isArray((data as any).rot) && (data as any).rot.length === 4) {
            const [x, y, z, w] = (data as any).rot as number[];
            node.quaternion.set(x, y, z, w);
          } else if ((data as any).euler && Array.isArray((data as any).euler) && (data as any).euler.length === 3) {
            const [ex, ey, ez] = (data as any).euler as number[];
            node.rotation.set(ex, ey, ez);
          }
          if ((data as any).pos && Array.isArray((data as any).pos) && (data as any).pos.length === 3) {
            const [px, py, pz] = (data as any).pos as number[];
            node.position.set(px, py, pz);
          }
        } catch (err) {
          console.warn('Failed to apply pose for bone', boneName, err);
        }
      }
    } catch (err) {
      console.error('Failed to fetch or apply pose:', err);
    }
  };

  useEffect(() => {
    const handler = (ev: any) => { try { const url = ev?.detail?.poseUrl; applyPoseData(url); } catch (e) {} };
    window.addEventListener('applyPose', handler as EventListener);
    return () => window.removeEventListener('applyPose', handler as EventListener);
  }, [vrm]);

  useEffect(() => { if (vrm && poseUrl) applyPoseData(poseUrl); }, [vrm, poseUrl]);

  useFrame((state, delta) => { if (vrm) vrm.update(delta); });

  if (!vrm) {
    return (
      <group>
        <mesh>
          <boxGeometry args={[1, 2, 1]} />
          <meshStandardMaterial color="#475569" wireframe />
        </mesh>
        <Html center>
          <div style={{ color: '#fff', fontSize: 12 }}>Loading 3D model...</div>
        </Html>
      </group>
    );
  }

  return (
    <group ref={sceneRef}>
      <primitive object={vrm.scene} />
      {availablePoints.map(pt => {
        const targetBone = BONE_MAPPING[pt.id];
        if (!targetBone) return null;
        const boneNode = vrm.humanoid?.getRawBoneNode(targetBone);
        if (!boneNode) return null;
        const pointContexts = activeContexts.filter(c => c.pointId === pt.id || c.targetPoint === pt.id);
        const posX = POINT_OFFSETS[pt.id]?.[0] || 0;
        const isScreenRight = posX > 0 || (posX === 0 && pt.id.includes('left'));
        const calloutX = isScreenRight ? 100 : -100;
        const isLeftSide = !isScreenRight;
        const calloutY = -60;

        const markerContent = (
          <>
            <div
              className={`vrm-marker ${selectedPoint === pt.id ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onSelectPoint(pt.id); }}
              onPointerEnter={() => setHoveredPoint(pt.id)}
              onPointerLeave={() => setHoveredPoint(null)}
              style={{
                position: 'relative',
                width: (selectedPoint === pt.id || hoveredPoint === pt.id) ? 14 : 10,
                height: (selectedPoint === pt.id || hoveredPoint === pt.id) ? 14 : 10,
                borderRadius: '50%',
                background: selectedPoint === pt.id ? '#38bdf8' : hoveredPoint === pt.id ? '#60a5fa' : '#1e293b',
                border: `2px solid ${selectedPoint === pt.id ? '#38bdf8' : hoveredPoint === pt.id ? '#93c5fd' : '#64748b'}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                opacity: (selectedPoint === pt.id || hoveredPoint === pt.id) ? 1 : 0.6,
                boxShadow: pointContexts.length > 0 ? '0 0 10px #ef4444' : 'none'
              }}
            >
              {pointContexts.length > 0 && (
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#ef4444', color: '#fff', fontSize: 9,
                  width: 14, height: 14, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: (selectedPoint === pt.id || hoveredPoint === pt.id) ? 'scale(1)' : 'scale(0.8)',
                  transition: 'transform 0.2s'
                }}>{pointContexts.length}</div>
              )}

              {(selectedPoint === pt.id || hoveredPoint === pt.id) && (
                <>
                  <svg style={{ position: 'absolute', top: 0, left: 0, width: 200, height: 200, overflow: 'visible', pointerEvents: 'none' }}>
                    <line x1={isLeftSide ? -7 : 7} y1={isLeftSide ? -7 : -7} x2={calloutX} y2={calloutY} stroke={selectedPoint === pt.id ? '#38bdf8' : '#93c5fd'} strokeWidth="2" />
                    <line x1={calloutX} y1={calloutY} x2={calloutX + (isLeftSide ? -100 : 100)} y2={calloutY} stroke={selectedPoint === pt.id ? '#38bdf8' : '#93c5fd'} strokeWidth="2" />
                  </svg>
                  <div style={{
                    position: 'absolute',
                    left: calloutX + (isLeftSide ? -100 : 10),
                    top: calloutY - 26,
                    width: 90,
                    background: '#0f172a', padding: '6px 10px', borderRadius: 6,
                    color: '#fff', fontSize: 13, border: '1px solid #334155', pointerEvents: 'none', zIndex: 10,
                    boxShadow: '0 4px 6px #000000', textAlign: isLeftSide ? 'right' as const : 'left' as const
                  }}>{pt.label}</div>
                </>
              )}
            </div>
          </>
        );

        return (
          <BoneMarker key={pt.id} boneNode={boneNode} offset={POINT_OFFSETS[pt.id] || [0,0,0]} content={markerContent} />
        );
      })}
    </group>
  );
}

export default function VrmAnatomyView({ vrmUrl = null, availablePoints, selectedPoint, onSelectPoint, activeContexts, poseUrl }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Resolve model url: explicit prop vrmUrl preferred, otherwise fallback to clothingModelMap.base
  let modelUrl = vrmUrl || clothingModelMap.base || '/models/base.vrm';

  // When poseUrl changes, dispatch applyPose event in case VrmModel listens
  useEffect(() => {
    if (!poseUrl) return;
    const evt = new CustomEvent('applyPose', { detail: { poseUrl } });
    window.dispatchEvent(evt as any);
  }, [poseUrl]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', background: '#020617', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      {/* Non-bone points rendered as buttons */}
      {(() => {
        const unmapped = availablePoints.filter((pt: any) => !BONE_MAPPING[pt.id]);
        return unmapped.map((pt: any, i: number) => {
          const isLeft = i % 2 === 0;
          const indexOnSide = Math.floor(i / 2);
          const topPosition = 20 + indexOnSide * 40;
          return (
            <button
              key={pt.id}
              onClick={() => onSelectPoint(pt.id)}
              style={{
                position: 'absolute',
                top: `${topPosition}px`,
                [isLeft ? 'left' : 'right']: '16px',
                zIndex: 10,
                background: selectedPoint === pt.id ? '#38bdf8' : '#1e293b',
                color: selectedPoint === pt.id ? '#000' : '#bac4d4',
                border: '1px solid #334155',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: selectedPoint === pt.id ? '0 0 8px rgba(56, 189, 248, 0.5)' : 'none',
                transition: 'all 0.2s',
                minWidth: '100px',
                textAlign: 'center'
              }}
            >
              {pt.label}
            </button>
          );
        });
      })()}

      {mounted ? (
        <Canvas camera={{ position: [0, 1.2, 2.5], fov: 40 }}>
          {/* @ts-ignore */}
          <ambientLight intensity={0.7} />
          {/* @ts-ignore */}
          <directionalLight position={[2, 2, 2]} intensity={1} />
          <VrmModel
            vrmUrl={modelUrl}
            availablePoints={availablePoints}
            selectedPoint={selectedPoint}
            onSelectPoint={onSelectPoint}
            activeContexts={activeContexts}
            poseUrl={poseUrl}
          />
          <OrbitControls target={[0, 1.0, 0]} minDistance={0.5} maxDistance={4} enablePan={false} />
        </Canvas>
      ) : (
        <div style={{ width: '100%', height: '100%', minHeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Загрузка 3D...</div>
      )}
    </div>
  );
}