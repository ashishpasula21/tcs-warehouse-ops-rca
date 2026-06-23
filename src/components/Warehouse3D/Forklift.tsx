import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getEquipmentState } from '../../simulation/routes';
import type { EquipmentRoute } from '../../simulation/routes';
import { useSimulationStore } from '../../store/simulationStore';
import { updateForkliftPos } from '../../simulation/agentPositions';

// Mirrors the truck cycle constants from WarehouseScene so Forklift can self-check
// whether its assigned truck is present without a cross-component callback.
const _CYCLE  = 1_800_000;
const _DOCKED = 1_200_000;
const _DEPART =   120_000;
const _GAP    =   300_000;

// Only true during the fully-docked phase — forklift must not operate while
// a truck is still arriving or departing.
function isTruckDocked(dockIdx: number, currentTime: number): boolean {
  const offset = dockIdx * 285_000;
  const t = ((currentTime + offset) % _CYCLE + _CYCLE) % _CYCLE;
  return t < _DOCKED;
}

interface ForkliftProps {
  route: EquipmentRoute;
  beaconColor: string;
  /** When set, forklift parks at (parkX, parkZ) whenever the assigned truck is absent. */
  parkWhenAbsent?: { dockIdx: number; parkX: number; parkZ: number };
  /** Forklift stays at its depot waypoint until currentTime exceeds this (sim-ms). */
  startAfterMs?: number;
}

export function Forklift({ route, beaconColor, parkWhenAbsent, startAfterMs = 0 }: ForkliftProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const carriageRef = useRef<THREE.Mesh>(null);
  const fork1Ref    = useRef<THREE.Mesh>(null);
  const fork2Ref    = useRef<THREE.Mesh>(null);
  const palletRef   = useRef<THREE.Group>(null);
  const currentAngle  = useRef(0);
  const forkY         = useRef(0.3);
  // Tracks when the forklift last became active so route always restarts from depot.
  const activeStartMs = useRef<number>(-1);
  const wasHeld       = useRef(true);

  useFrame((_, delta) => {
    const { currentTime } = useSimulationStore.getState();
    if (!groupRef.current) return;

    const holdAtDepot  = currentTime < startAfterMs;
    const truckAbsent  = parkWhenAbsent ? !isTruckDocked(parkWhenAbsent.dockIdx, currentTime) : false;
    const isHeld       = holdAtDepot || truckAbsent;

    // On every held → active transition, record the time so route plays from t=0.
    if (wasHeld.current && !isHeld) activeStartMs.current = currentTime;
    wasHeld.current = isHeld;

    const depotWp = route.waypoints[0];

    let x: number, z: number, isLoaded: boolean;
    if (isHeld) {
      // Freeze at rest position — no movement, no rotation update.
      x        = truckAbsent ? parkWhenAbsent!.parkX : depotWp.x;
      z        = truckAbsent ? parkWhenAbsent!.parkZ : depotWp.z;
      isLoaded = false;
    } else {
      const effectiveMs = activeStartMs.current < 0 ? 0 : currentTime - activeStartMs.current;
      const state = getEquipmentState(route, effectiveMs);
      x        = state.x;
      z        = state.z;
      isLoaded = state.isLoaded;
      // Only interpolate rotation while actively operating.
      const diff    = state.angle - currentAngle.current;
      const wrapped = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
      currentAngle.current += wrapped * Math.min(1, delta * 5);
      groupRef.current.rotation.y = currentAngle.current;
    }

    // y=0.93 keeps wheels on floor at scale 1.5 (wheel local y=-0.62; 0.62×1.5=0.93)
    groupRef.current.position.set(x, 0.93, z);
    updateForkliftPos(route.id, x, z);

    const targetForkY = isLoaded ? 1.6 : 0.3;
    forkY.current += (targetForkY - forkY.current) * delta * 2;

    if (carriageRef.current) carriageRef.current.position.y = forkY.current + 0.55;
    if (fork1Ref.current)    fork1Ref.current.position.y    = forkY.current;
    if (fork2Ref.current)    fork2Ref.current.position.y    = forkY.current;
    if (palletRef.current) {
      palletRef.current.visible = isLoaded;
      palletRef.current.position.y = forkY.current;
    }
  });

  return (
    <group ref={groupRef} scale={[1.5, 1.5, 1.5]}>
      {/* Body */}
      <mesh>
        <boxGeometry args={[2.2, 1.3, 3.0]} />
        <meshStandardMaterial color="#f5c518" roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.75, 0.6]}>
        <boxGeometry args={[2.0, 0.22, 1.4]} />
        <meshStandardMaterial color="#e8b800" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Cab */}
      <mesh position={[0, 1.05, 0.5]}>
        <boxGeometry args={[1.7, 0.9, 1.3]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.18, 1.08]}>
        <boxGeometry args={[1.45, 0.7, 0.06]} />
        <meshStandardMaterial color="#4a6a8a" metalness={0.7} roughness={0.05} transparent opacity={0.75} />
      </mesh>

      {/* Overhead guard */}
      <mesh position={[0, 1.9, 0.2]}>
        <boxGeometry args={[2.35, 0.07, 2.85]} />
        <meshStandardMaterial color="#d4a800" metalness={0.6} roughness={0.3} />
      </mesh>
      {([[-1.08, -1.2], [-1.08, 1.3], [1.08, -1.2], [1.08, 1.3]] as const).map(([xOff, zOff], i) => (
        <mesh key={`gp-${i}`} position={[xOff, 1.3, zOff]}>
          <boxGeometry args={[0.08, 1.25, 0.08]} />
          <meshStandardMaterial color="#d4a800" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}

      {/* Mast */}
      <mesh position={[0, 2.1, -1.35]}>
        <boxGeometry args={[2.1, 4.2, 0.2]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.55} roughness={0.45} />
      </mesh>
      {([-0.9, 0.9] as const).map((xOff, i) => (
        <mesh key={`mr-${i}`} position={[xOff, 2.1, -1.3]}>
          <boxGeometry args={[0.12, 4.2, 0.12]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Carriage + forks — Y driven by ref in useFrame */}
      <mesh ref={carriageRef} position={[0, 0.85, -1.35]}>
        <boxGeometry args={[2.1, 0.5, 0.16]} />
        <meshStandardMaterial color="#444" metalness={0.65} />
      </mesh>
      <mesh ref={fork1Ref} position={[-0.62, 0.3, -2.2]}>
        <boxGeometry args={[0.18, 0.1, 2.2]} />
        <meshStandardMaterial color="#c8c8c8" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh ref={fork2Ref} position={[0.62, 0.3, -2.2]}>
        <boxGeometry args={[0.18, 0.1, 2.2]} />
        <meshStandardMaterial color="#c8c8c8" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Pallet load — visibility toggled by ref in useFrame */}
      <group ref={palletRef} visible={false}>
        <mesh position={[0, 0.28, -1.9]}>
          <boxGeometry args={[1.8, 0.18, 1.5]} />
          <meshStandardMaterial color="#8a6a3a" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.78, -1.78]}>
          <boxGeometry args={[1.6, 0.8, 1.3]} />
          <meshStandardMaterial color="#c8924a" roughness={0.88} />
        </mesh>
      </group>

      {/* Wheels */}
      {([[-1.1, -0.62, 0.9], [1.1, -0.62, 0.9], [-1.1, -0.62, -0.85], [1.1, -0.62, -0.85]] as const).map(([wx, wy, wz], i) => (
        <mesh key={`w-${i}`} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.34, 18]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
      ))}


      {/* Beacon */}
      <mesh position={[0, 2.95, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.28, 12]} />
        <meshStandardMaterial color={beaconColor} emissive={beaconColor} emissiveIntensity={2.0} />
      </mesh>
    </group>
  );
}
