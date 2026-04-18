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
  inner_thighs: VRMHumanBoneName.Hips,
  groin: VRMHumanBoneName.Hips,
  penis: VRMHumanBoneName.Hips,
  testicles: VRMHumanBoneName.Hips,
  vagina: VRMHumanBoneName.Hips,
  vulva: VRMHumanBoneName.Hips,
  clitoris: VRMHumanBoneName.Hips,
  anus: VRMHumanBoneName.Hips,
  prostate: VRMHumanBoneName.Hips,
};

// Смещения (X, Y, Z) относительно мировых координат кости для разнесения перекрывающихся/специфичных точек
// Z+ направлен в спину (от камеры), Z- направлен на зрителя.
// Y+ вверх, X- вправо (зрителя), X+ влево (зрителя) - зависит от Math.PI поворота.
const POINT_OFFSETS: Record<string, [number, number, number]> = {
  shoulders: [0, 0.12, 0],          // Чуть выше груди
  nipples: [0, -0.05, 0.12],        // Ниже центра верхнегрудной кости и вперед
  chest: [0, 0.05, 0.12],           // Выше сосков, вперед
  belly: [0, -0.08, 0.15],          // Ниже центра позвоночника, наружу (живот)
  waist: [0, -0.08, 0],             // Талия сбоку (или просто ниже)
  back: [0, 0.05, -0.12],           // Назад от спины
  buttocks: [0, -0.05, -0.15],      // Вниз и назад от таза
  hips: [0, 0.05, -0.12],           // Внешняя часть бедер/таза (сзади/сбоку)
  inner_thighs: [0, -0.15, 0.05],   // Сильно вниз от таза (между ног и чуть вперед)
  
  // Интимные зоны (раскиданы)
  groin: [0, -0.06, 0.10],         
  penis: [0, -0.10, 0.15],         
  testicles: [0, -0.14, 0.12],     
  vagina: [0, -0.10, 0.08],        
  vulva: [0, -0.08, 0.10],         
  clitoris: [0, -0.06, 0.12],      
  anus: [0, -0.12, -0.06],          // Сильно вниз и назад (промежность)
  prostate: [0, -0.05, -0.02],      // Глубже внутри, сзади
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

function BoneMarker({ boneNode, offset = [0,0,0], children }: { boneNode: THREE.Object3D, offset?: [number, number, number], children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current && boneNode) {
      boneNode.getWorldPosition(ref.current.position);
      // У модели с rotation.y = Math.PI локальная Z-координата направлена на нас (или от нас).
      // Чтобы не заморачиваться со сложной математикой Quaternions, просто сдвигаем getWorldPosition напрямую 
      // (Мировые: Y-вверх. Камера смотрит на 0,0,0 с положения +Z). 
      // Так что Z- это ближе к нам, Z+ это глубже в экран.
      ref.current.position.x += offset[0];
      ref.current.position.y += offset[1];
      ref.current.position.z += offset[2];
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
          <BoneMarker key={pt.id} boneNode={boneNode} offset={POINT_OFFSETS[pt.id] || [0,0,0]}>
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
    <div style={{ width: '100%', height: '100%', minHeight: '600px', background: '#020617', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
       {/* Не-костяные точки раскидываем по углам и краям для эстетики */}
      {(() => {
        const unmapped = availablePoints.filter((pt: any) => !BONE_MAPPING[pt.id]);
        return unmapped.map((pt: any, i: number) => {
          // Раскидываем по кругу или по краям:
          // Четные слева, нечетные справа. По высоте распределяем.
          const isLeft = i % 2 === 0;
          const indexOnSide = Math.floor(i / 2);
          const topPosition = 20 + indexOnSide * 40; // 20px, 60px, 100px...
          
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