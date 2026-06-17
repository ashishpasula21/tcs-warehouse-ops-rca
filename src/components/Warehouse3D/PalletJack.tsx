import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getEquipmentState } from '../../simulation/routes';
import type { EquipmentRoute } from '../../simulation/routes';
import { useSimulationStore } from '../../store/simulationStore';
import { updateAgentPos } from '../../simulation/agentPositions';

interface PalletJackProps {
  route: EquipmentRoute;
  beaconColor: string;
}

export function PalletJack({ route, beaconColor }: PalletJackProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const palletRef    = useRef<THREE.Group>(null);
  const currentAngle = useRef(0);

  useFrame((_, delta) => {
    const { currentTime } = useSimulationStore.getState();
    const state = getEquipmentState(route, currentTime);
    if (!groupRef.current) return;

    // y=0.14 keeps wheels on floor at scale 1.4 (wheel local y=-0.1; 0.1×1.4=0.14)
    groupRef.current.position.set(state.x, 0.14, state.z);
    updateAgentPos(route.id, state.x, state.z);

    const diff    = state.angle - currentAngle.current;
    const wrapped = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    currentAngle.current += wrapped * Math.min(1, delta * 6);
    groupRef.current.rotation.y = currentAngle.current;

    if (palletRef.current) palletRef.current.visible = state.isLoaded;
  });

  return (
    <group ref={groupRef} scale={[1.4, 1.4, 1.4]}>
      <pointLight position={[0, -0.2, 0]} color={beaconColor} intensity={0.5} distance={4} />

      {/* Tiller */}
      <mesh position={[0, 0.95, 0.7]}>
        <boxGeometry args={[0.85, 1.35, 0.1]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.6, 0.72]}>
        <boxGeometry args={[0.8, 0.1, 0.12]} />
        <meshStandardMaterial color="#333" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Pump body */}
      <mesh position={[0, 0.22, 0.55]}>
        <boxGeometry args={[0.65, 0.42, 0.7]} />
        <meshStandardMaterial color="#cc2200" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.38, 0.3]}>
        <boxGeometry args={[0.45, 0.3, 0.3]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Forks */}
      {([-0.36, 0.36] as const).map((ox, i) => (
        <mesh key={i} position={[ox, 0.12, -0.35]}>
          <boxGeometry args={[0.14, 0.09, 1.9]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.85} roughness={0.2} />
        </mesh>
      ))}

      {/* Pallet load — visibility driven by ref */}
      <group ref={palletRef} visible={false}>
        <mesh position={[0, 0.48, -0.32]}>
          <boxGeometry args={[1.1, 0.15, 1.3]} />
          <meshStandardMaterial color="#8a6a3a" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.88, -0.32]}>
          <boxGeometry args={[1.0, 0.7, 1.2]} />
          <meshStandardMaterial color="#c8924a" roughness={0.88} />
        </mesh>
      </group>

      {/* Wheels */}
      {([[-0.3, -0.1, 0.65], [0.3, -0.1, 0.65], [0, -0.1, -1.15]] as const).map(([wx, wy, wz], i) => (
        <mesh key={i} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.15, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
      ))}

      {/* Beacon */}
      <mesh position={[0, 1.95, 0.7]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color={beaconColor} emissive={beaconColor} emissiveIntensity={2.0} />
      </mesh>
    </group>
  );
}
