import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ShiftEvent } from '../../data/shiftEvents';

interface Props {
  event: ShiftEvent;
}

export function EventIndicator({ event }: Props) {
  const ringRef   = useRef<THREE.Mesh>(null);
  const beamRef   = useRef<THREE.Mesh>(null);
  const ring2Ref  = useRef<THREE.Mesh>(null);
  const ring3Ref  = useRef<THREE.Mesh>(null);
  const phase     = useRef(Math.random() * Math.PI * 2);

  const isProblem = event.type === 'problem';
  const color     = isProblem ? '#ef4444' : '#22c55e';
  const emissive  = isProblem ? '#dc2626' : '#16a34a';

  useFrame((_, delta) => {
    phase.current += delta * (isProblem ? 1.8 : 2.6);
    const pulse  = 0.5 + 0.5 * Math.sin(phase.current);
    const pulse2 = 0.5 + 0.5 * Math.sin(phase.current + Math.PI);
    const pulse3 = 0.5 + 0.5 * Math.sin(phase.current + Math.PI * 0.5);

    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = isProblem ? 0.25 + 0.35 * pulse : 0.42 + 0.55 * pulse;
      ringRef.current.scale.setScalar(isProblem ? 0.88 + 0.16 * pulse : 0.84 + 0.24 * pulse);
    }
    if (ring2Ref.current) {
      const mat = ring2Ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = isProblem ? 0.15 + 0.25 * pulse2 : 0.28 + 0.42 * pulse2;
      ring2Ref.current.scale.setScalar(isProblem ? 1.05 + 0.2 * pulse2 : 1.0 + 0.32 * pulse2);
    }
    if (ring3Ref.current) {
      const mat = ring3Ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.10 + 0.22 * pulse3;
      ring3Ref.current.scale.setScalar(1.04 + 0.38 * pulse3);
    }
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = isProblem ? 0.25 + 0.35 * pulse : 0.42 + 0.52 * pulse;
    }
  });

  const r = event.radius;

  return (
    <group position={[event.x, 0, event.z]}>
      {/* Extra outer halo ring — green improvement only */}
      {!isProblem && (
        <mesh ref={ring3Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[r * 0.9, r * 1.45, 48]} />
          <meshStandardMaterial
            color={color} emissive={emissive} emissiveIntensity={0.35}
            transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Outer soft ring (expanding) */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[r * 0.78, r * 1.1, 48]} />
        <meshStandardMaterial
          color={color} emissive={emissive} emissiveIntensity={isProblem ? 0.5 : 0.9}
          transparent opacity={isProblem ? 0.2 : 0.28} depthWrite={false} side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner solid ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[r * 0.52, r * 0.76, 48]} />
        <meshStandardMaterial
          color={color} emissive={emissive} emissiveIntensity={isProblem ? 1.2 : 1.8}
          transparent opacity={isProblem ? 0.55 : 0.72} depthWrite={false} side={THREE.DoubleSide}
        />
      </mesh>

      {/* Filled ground disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[r * 0.5, 40]} />
        <meshStandardMaterial
          color={color} emissive={emissive} emissiveIntensity={isProblem ? 0.3 : 0.55}
          transparent opacity={isProblem ? 0.12 : 0.20} depthWrite={false}
        />
      </mesh>

      {/* Vertical beam / column of light */}
      <mesh ref={beamRef} position={[0, 10, 0]}>
        <cylinderGeometry args={isProblem ? [0.35, 1.2, 20, 16, 1, true] : [0.6, 2.0, 20, 16, 1, true]} />
        <meshStandardMaterial
          color={color} emissive={emissive} emissiveIntensity={isProblem ? 1.0 : 1.6}
          transparent opacity={isProblem ? 0.28 : 0.42} depthWrite={false} side={THREE.DoubleSide}
        />
      </mesh>

      {/* Top cap glow */}
      <mesh position={[0, 20.5, 0]}>
        <sphereGeometry args={[isProblem ? 1.0 : 1.6, 12, 12]} />
        <meshStandardMaterial
          color={color} emissive={emissive} emissiveIntensity={isProblem ? 3.0 : 5.5}
          transparent opacity={isProblem ? 0.9 : 1.0}
        />
      </mesh>

      {/* Point light for ambient color cast */}
      <pointLight
        color={color} intensity={isProblem ? 8 : 20}
        distance={r * (isProblem ? 3 : 5.5)} decay={1.5} position={[0, 2, 0]}
      />

      {/* Icon marker — thin vertical pole + sphere cap (like a map pin) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 1.0, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.42, 14, 14]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={3} roughness={0.2} />
      </mesh>
      {/* Icon symbol — exclamation (problem) or check (benefit) */}
      {isProblem ? (
        <>
          <mesh position={[0, 1.42, 0.44]}>
            <boxGeometry args={[0.12, 0.36, 0.06]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
          </mesh>
          <mesh position={[0, 1.14, 0.44]}>
            <boxGeometry args={[0.12, 0.1, 0.06]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
          </mesh>
        </>
      ) : (
        <mesh position={[-0.05, 1.32, 0.44]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.1, 0.36, 0.06]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
}
