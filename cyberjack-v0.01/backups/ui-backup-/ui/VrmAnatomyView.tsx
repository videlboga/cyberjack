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

// Смещения (X, Y, Z) относительно мировых координат кости для разнесения перекрывающихся/специфичных точек
// Z+ направлен в спину (от камеры), Z- направлен на зрителя.
// Y+ вверх, X- вправо (зрителя), X+ влево (зрителя) - зависит от Math.PI поворота.
const POINT_OFFSETS: Record<string, [number, number, number]> = {
  shoulders: [0, 0.12, 0],          // Чуть выше груди
  nipples: [0, -0.05, 0.12],        // Спереди (Z+)
  chest: [0, 0.05, 0.12],           // Спереди (Z+)
  belly: [0, -0.05, 0.15],          // Живот спереди (Z+)
  waist: [0, -0.08, 0],             // Талия
  back: [0, 0.05, -0.15],           // Спина сзади (Z-)
  buttocks: [0, -0.05, -0.16],      // Ягодицы сзади (Z-)
  hips: [0.12, 0.05, 0],            // Бедра (сбоку, Z=0). X+ = сдвиг влево (к правому краю экрана)
  
  inner_thighs: [-0.08, -0.1, 0.05], // От левой ноги сдвигаем вправо (X-), вниз (Y-) и чуть вперед (Z+)
  
  // Интимные зоны раскидываем так, чтобы они не слипались в одну кучу, а образовывали столбик или веер
  groin: [0, -0.04, 0.12],          // Самое высокое, спереди
  
  // Женские точки (чуть ниже)
  clitoris: [0.03, -0.07, 0.13],    // Сдвинем на пару мм вбок и вниз
  vulva: [-0.03, -0.09, 0.11],      // В другой бок и еще ниже
  vagina: [0, -0.12, 0.09],         // Еще ниже, ближе к центру
  
  // Мужские точки
  penis: [0, -0.08, 0.16],          // Спереди, выступает
  testicles: [0, -0.14, 0.13],      // Самое низкое спереди
  
  // Задние/внутренние
  anus: [0, -0.12, -0.10],          // Снизу и сзади (Z-)
  prostate: [0, -0.08, -0.03],      // Глубже внутри
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
        // Calculate point visibility based on the normal (approximate if point is on skin surface)
        const pointWorldPos = ref.current.position;
        const camDir = new THREE.Vector3().subVectors(pointWorldPos, camera.position).normalize();
        
        // Bone's direction normal transformed to world space
        const worldNormal = normalVec.clone().transformDirection(boneNode.matrixWorld).normalize();
        
        const dot = camDir.dot(worldNormal);
        // dot < 0 means the normal points towards the camera.
        // It should be visible if dot < 0.2 (allow some grazing angle visibility)
        const isVisible = dot < 0.2;
        wrapperRef.current.style.opacity = isVisible ? '1' : '0.1';
        wrapperRef.current.style.pointerEvents = isVisible ? 'auto' : 'none';
      }
    }
  });
  
  // Clone children to inject ref into the root div
  return (
    <group ref={ref}>
      {React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<any>, { 
        style: { ...((children as any).props.style || {}), opacity: 1, pointerEvents: 'auto' },
        ref: wrapperRef 
      }) : children}
    </group>
  );
}

function VrmModel({ vrmUrl, availablePoints, selectedPoint, onSelectPoint, activeContexts }: VrmAnatomyProps) {
  const [vrm, setVrm] = useState<any>(null);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const sceneRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!vrmUrl) return;
    loadVRM(vrmUrl).then(loadedVrm => {
      setVrm(loadedVrm);
      // Поворачиваем VRM лицом к камере
      loadedVrm.scene.rotation.y = 0; 
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
    <group ref={sceneRef}>
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

        
        // Callout directions depending on left/right side or X coord
        // We use pt.id to statically decide direction
        // Compute X dynamically from our point offsets, default to string analysis if 0
        const posX = POINT_OFFSETS[pt.id]?.[0] || 0;
        const isScreenRight = posX > 0 || (posX === 0 && pt.id.includes('left'));
        const calloutX = isScreenRight ? 100 : -100;
        const isLeftSide = !isScreenRight;
        
        const calloutY = -60;
        
        return (
          <BoneMarker key={pt.id} boneNode={boneNode} offset={POINT_OFFSETS[pt.id] || [0,0,0]}>
            <Html center zIndexRange={[100, 0]}>
              <div 
                className={`vrm-marker ${selectedPoint === pt.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPoint(pt.id);
                }}
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
                  }}>
                    {pointContexts.length}
                  </div>
                )}
                
                {/* Лейбл как Выноска (Callout) */}
                {(selectedPoint === pt.id || hoveredPoint === pt.id) && (
                  <>
                    {/* SVG линия от точки (0,0) к лейблу */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: 200, height: 200, overflow: 'visible', pointerEvents: 'none' }}>
                      <line 
                        x1={isLeftSide ? -7 : 7} y1={isLeftSide ? -7 : -7} 
                        x2={calloutX} y2={calloutY} 
                        stroke={selectedPoint === pt.id ? '#38bdf8' : '#93c5fd'} 
                        strokeWidth="2" 
                      />
                      <line 
                        x1={calloutX} y1={calloutY} 
                        x2={calloutX + (isLeftSide ? -100 : 100)} y2={calloutY} 
                        stroke={selectedPoint === pt.id ? '#38bdf8' : '#93c5fd'} 
                        strokeWidth="2" 
                      />
                    </svg>
                    
                    {/* Текстовый блок выноски */}
                    <div style={{
                      position: 'absolute', 
                      left: calloutX + (isLeftSide ? -100 : 10), 
                      top: calloutY - 26, 
                      width: 90,
                      background: '#0f172a', padding: '6px 10px', borderRadius: 6,
                      color: '#fff', fontSize: 13, border: '1px solid #334155',
                      pointerEvents: 'none', zIndex: 10,
                      boxShadow: '0 4px 6px #000000',
                      textAlign: isLeftSide ? 'right' as const : 'left' as const
                    }}>
                      {pt.label}
                    </div>
                  </>
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