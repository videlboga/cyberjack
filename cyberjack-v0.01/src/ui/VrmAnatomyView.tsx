import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMHumanBoneName } from '@pixiv/three-vrm';

interface VrmAnatomyProps {
  vrmUrl?: string; // URL к файлу VRM
  availablePoints: { id: string, label: string }[];
  selectedPoint: string;
  onSelectPoint: (pointId: string) => void;
  activeContexts: any[];
}

// Связываем наши ID точек (из БД) с костями VRM
const BONE_MAPPING: Record<string, VRMHumanBoneName> = {
  head: VRMHumanBoneName.Head,
  neck: VRMHumanBoneName.Neck,
  chest: VRMHumanBoneName.UpperChest,
  belly: VRMHumanBoneName.Spine,
  buttocks: VRMHumanBoneName.Hips, // У VRM нет костей ягодиц, берем Hips (таз)
  hips: VRMHumanBoneName.Hips,
  left_arm: VRMHumanBoneName.LeftUpperArm, // Можно спуститься к LeftLowerArm
  right_arm: VRMHumanBoneName.RightUpperArm,
  left_hand: VRMHumanBoneName.LeftHand,
  right_hand: VRMHumanBoneName.RightHand,
  left_leg: VRMHumanBoneName.LeftUpperLeg,
  right_leg: VRMHumanBoneName.RightUpperLeg,
  knees: VRMHumanBoneName.LeftLowerLeg, // Условно цепляемся к одной или обеим
  feet: VRMHumanBoneName.LeftFoot, 
  face: VRMHumanBoneName.Head, // Вместе с головой
  lips: VRMHumanBoneName.Jaw, // Челюсть
  // Интимные точки (привязываем к Hips)
  vagina: VRMHumanBoneName.Hips, 
  vulva: VRMHumanBoneName.Hips,
  clitoris: VRMHumanBoneName.Hips,
  anus: VRMHumanBoneName.Hips,
  // ...остальные точки кидаем на таз или грудь по умолчанию
};

// Храним загруженные модели в кеше, чтобы не грузить по 10 раз
const loadVRM = (url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';

    loader.register((parser: any) => {
      // pixiv/three-vrm plugin
      return new VRMLoaderPlugin(parser);
    });

    loader.load(
      url,
      (gltf: any) => {
        const vrm = gltf.userData.vrm;
        // Отключаем фрустум-куллинг, чтобы меши из-за анимаций не пропадали
        vrm.scene.traverse((obj: any) => {
          obj.frustumCulled = false;
        });
        resolve(vrm);
      },
      undefined,
      (error: any) => reject(error)
    );
  });
};

function BoneMarker({ boneNode, children }: { boneNode: THREE.Object3D, children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current && boneNode) {
      boneNode.getWorldPosition(ref.current.position);
    }
  });
  return <group ref={ref}>{children}</group>;
}

function VrmModel({ vrmUrl, availablePoints, selectedPoint, onSelectPoint, activeContexts }: VrmAnatomyProps) {
  const [vrm, setVrm] = useState<any>(null);

  useEffect(() => {
    if (!vrmUrl) return;
    loadVRM(vrmUrl).then(loadedVrm => {
      setVrm(loadedVrm);
      // Поворачиваем VRM лицом к камере
      loadedVrm.scene.rotation.y = Math.PI; 
    }).catch(err => {
      console.error('Failed to load VRM:', err);
    });
  }, [vrmUrl]);

  useFrame((state, delta) => {
    if (vrm) vrm.update(delta);
  });

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
    <group>
      <primitive object={vrm.scene} />

      {/* Отрисовываем DOM-плашки (точки + контексты) поверх 3D */}
      {availablePoints.map(pt => {
        // Пропускаем абстрактные или общие точки (general, pose_lying_down, mind_state)
        const targetBone = BONE_MAPPING[pt.id];
        if (!targetBone) return null;

        const boneNode = vrm.humanoid?.getRawBoneNode(targetBone);
        if (!boneNode) return null;

        // Ищем активные эффекты, привязанные конкретно к этой точке
        const pointContexts = activeContexts.filter(c => c.pointId === pt.id || c.targetPoint === pt.id);

        return (
          <BoneMarker key={pt.id} boneNode={boneNode}>
            <Html center zIndexRange={[100, 0]}>
              <div 
                className={`vrm-marker ${selectedPoint === pt.id ? 'active' : ''}`}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onSelectPoint(pt.id); 
                }}
                style={{
                  position: 'relative',
                  width: 24, height: 24, 
                  borderRadius: '50%',
                  background: selectedPoint === pt.id ? 'rgba(56, 189, 248, 0.7)' : 'rgba(30, 41, 59, 0.5)',
                  border: `2px solid ${selectedPoint === pt.id ? '#38bdf8' : '#64748b'}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: pointContexts.length > 0 ? '0 0 10px rgba(239, 68, 68, 0.6)' : 'none'
                }}
              >
                {pointContexts.length > 0 && (
                  <div style={{
                    position: 'absolute', top: -10, right: -10,
                    background: '#ef4444', color: '#fff', fontSize: 10,
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {pointContexts.length}
                  </div>
                )}
                
                {/* Лейбл при наведении или клике */}
                {selectedPoint === pt.id && (
                  <div style={{
                    position: 'absolute', left: '120%', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(15, 23, 42, 0.9)', padding: '4px 8px', borderRadius: 4,
                    whiteSpace: 'nowrap', color: '#fff', fontSize: 12, border: '1px solid #334155',
                    pointerEvents: 'none'
                  }}>
                    {pt.label}
                  </div>
                )}
              </div>
            </Html>
          </BoneMarker>
        );
      })}
    </group>
  );
}

export function VrmAnatomyView({ subjectState, activeContexts, availablePoints, selectedPoint, onSelectPoint }: any) {
  // URL можно брать из профиля персонажа (character.profileUrl) или хардкодить демо-модель
  const modelUrl = '/models/base.vrm';

  return (
    <div style={{ width: '100%', height: '500px', background: '#020617', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
       {/* Панель с fallback'ами для общих точек (general, mind_state), которые не привязать к костям */}
       <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 200 }}>
         {availablePoints.filter((pt: any) => !BONE_MAPPING[pt.id]).map((pt: any) => (
            <button 
              key={pt.id}
              onClick={() => onSelectPoint(pt.id)}
              style={{
                background: selectedPoint === pt.id ? '#38bdf8' : '#1e293b',
                color: selectedPoint === pt.id ? '#000' : '#bac4d4',
                border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer'
              }}
            >
              {pt.label}
            </button>
         ))}
       </div>

       <Canvas camera={{ position: [0, 1.2, 2.5], fov: 40 }}>
         <ambientLight intensity={0.7} />
         <directionalLight position={[2, 2, 2]} intensity={1} />
         <VrmModel 
            vrmUrl={modelUrl} 
            availablePoints={availablePoints} 
            selectedPoint={selectedPoint}
            onSelectPoint={onSelectPoint}
            activeContexts={activeContexts}
         />
         <OrbitControls target={[0, 1.0, 0]} minDistance={0.5} maxDistance={4} enablePan={false} />
       </Canvas>
    </div>
  );
}