import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getEquipmentState } from '../../simulation/routes';
import type { EquipmentRoute } from '../../simulation/routes';
import { useSimulationStore } from '../../store/simulationStore';
import { isHeavyEquipmentNear } from '../../simulation/agentPositions';

interface OperatorModelProps {
  route: EquipmentRoute;
  vestColor?: string;
  hatColor?: string;
}

export function OperatorModel({ route, vestColor = '#f5d700', hatColor = '#f5d700' }: OperatorModelProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const legRef        = useRef<THREE.Group>(null);
  const clipboardRef  = useRef<THREE.Mesh>(null);
  const statusDotRef  = useRef<THREE.Mesh>(null);
  const currentAngle  = useRef(0);
  const walkCycle     = useRef(0);

  useFrame((_, delta) => {
    const { currentTime } = useSimulationStore.getState();
    const state = getEquipmentState(route, currentTime);
    if (!groupRef.current) return;

    // Yield: hold position when heavy equipment (forklift/PJ) is within 3 units.
    // The operator stands still until the machine clears — realistic safety behavior.
    if (isHeavyEquipmentNear(state.x, state.z)) {
      if (legRef.current)       legRef.current.position.y    = 0;
      if (clipboardRef.current) clipboardRef.current.visible = true;
      return;
    }

    // y = -0.16 keeps feet on the floor when the group is scaled to 2.0
    // (leg capsule bottom sits at local y=0.08; 0.08 × 2.0 − 0.16 = 0 world y)
    groupRef.current.position.set(state.x, -0.13, state.z);

    const diff    = state.angle - currentAngle.current;
    const wrapped = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    currentAngle.current += wrapped * Math.min(1, delta * 6);
    groupRef.current.rotation.y = currentAngle.current;

    if (legRef.current) {
      if (state.isMoving) {
        walkCycle.current += delta * 5;
        legRef.current.position.y = 0.06 * Math.abs(Math.sin(walkCycle.current));
      } else {
        legRef.current.position.y = 0;
      }
    }

    if (clipboardRef.current)  clipboardRef.current.visible  = !state.isMoving;

    if (statusDotRef.current) {
      const mat = statusDotRef.current.material as THREE.MeshStandardMaterial;
      mat.color.set(state.isMoving ? '#22c55e' : '#e5e7eb');
      mat.emissive.set(state.isMoving ? '#22c55e' : '#aaaaaa');
      mat.emissiveIntensity = state.isMoving ? 1.0 : 0.1;
    }
  });

  return (
    <group ref={groupRef} scale={[1.65, 1.65, 1.65]}>
      {/* Legs */}
      <group ref={legRef}>
        {([-0.14, 0.14] as const).map((ox, i) => (
          <mesh key={i} position={[ox, 0.44, 0]}>
            <capsuleGeometry args={[0.1, 0.52, 4, 8]} />
            <meshStandardMaterial color="#3a3a5a" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Torso */}
      <mesh position={[0, 0.96, 0]}>
        <capsuleGeometry args={[0.17, 0.4, 4, 8]} />
        <meshStandardMaterial color={vestColor} roughness={0.6} />
      </mesh>
      {([0.2, -0.2] as const).map((zOff, i) => (
        <mesh key={`vs-${i}`} position={[0, 0.96, zOff]}>
          <torusGeometry args={[0.18, 0.025, 6, 16, Math.PI * 2]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.4} />
        </mesh>
      ))}

      {/* Arms */}
      {([-0.3, 0.3] as const).map((ox, i) => (
        <mesh key={`arm-${i}`} position={[ox, 1.0, 0]} rotation={[0, 0, ox > 0 ? 0.32 : -0.32]}>
          <capsuleGeometry args={[0.065, 0.38, 4, 8]} />
          <meshStandardMaterial color={vestColor} roughness={0.6} />
        </mesh>
      ))}

      {/* Head */}
      <mesh position={[0, 1.58, 0]}>
        <sphereGeometry args={[0.17, 14, 14]} />
        <meshStandardMaterial color="#c8a880" roughness={0.88} />
      </mesh>

      {/* Hard hat */}
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color={hatColor} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.64, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.03, 16]} />
        <meshStandardMaterial color={hatColor === '#f5d700' ? '#e8c800' : hatColor} roughness={0.5} />
      </mesh>

      {/* Status dot */}
      <mesh ref={statusDotRef} position={[0, 2.12, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#e5e7eb" emissive="#aaaaaa" emissiveIntensity={0.1} />
      </mesh>

      {/* Clipboard — always mounted, visibility driven by ref */}
      <mesh ref={clipboardRef} position={[0.22, 0.88, 0.14]} rotation={[0.1, 0.3, 0.2]} visible={false}>
        <boxGeometry args={[0.14, 0.22, 0.03]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
      </mesh>
    </group>
  );
}
