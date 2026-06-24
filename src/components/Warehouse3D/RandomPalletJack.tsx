import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/simulationStore';
import { updateAgentPos, isForkliftNear } from '../../simulation/agentPositions';

// PJs operate entirely north of the main rack zone (z > +8).
// Safe E-W corridors:
//   Cross-aisle  z ≈ +10   (between main racks and shipping racks)
//   Pick lane    z ≈ +17   (primary PJ highway through shipping rack zone)
//   Staging      z ≈ +30   (open floor north of all racks)
// Forklift aisles to avoid: x=-54 (FL1), x=-38 (FL3), x=+49 (FL4)

const PJ_PICK_Z = 17; // primary E-W routing corridor

const PJ_WAYPOINTS: readonly [number, number][] = [
  // Cross-aisle z=+10
  [-40, +10], [-22, +10], [0, +10], [+22, +10], [+40, +10],
  // Pick lane z=+17 — main PJ highway
  [-44, +17], [-32, +17], [-18, +17], [-4, +17],
  [+11, +17], [+26, +17], [+43, +17],
  // Pick lane north z=+21
  [-35, +21], [-18, +21], [+4, +21], [+22, +21], [+40, +21],
  // Staging z=+30
  [-30, +30], [-14, +30], [+4, +30], [+22, +30], [+40, +30],
  // Staging z=+34 (near dock area)
  [-22, +34], [0, +34], [+18, +34], [+36, +34],
];

// Start positions: parked at cross-aisle, spread across warehouse
const SPAWN: Record<string, [number, number]> = {
  'pj-r1': [-20, +10],
  'pj-r2': [+20, +10],
};

const SPEED      = 0.004;  // units/ms (same as original PJ routes)
const MIN_PAUSE  = 1200;
const MAX_PAUSE  = 6000;
const YIELD_RADIUS = 6.0; // forklift is ~4.5 units long at scale 1.5 — give extra clearance

const SHIP_RACK_XS = [-59, -49, -42, 56, 60] as const;
const RACK_HALF_W  = 2.2;

function isInShipRack(x: number, z: number): boolean {
  if (z >= 13 && z <= 28)
    return SHIP_RACK_XS.some(rx => Math.abs(x - rx) < RACK_HALF_W);
  return false;
}

/** Route E-W via the pick lane when crossing z-zones to avoid rack geometry. */
function planPJPath(fx: number, fz: number, tx: number, tz: number): [number, number][] {
  if (Math.abs(fx - tx) < 3) return [[tx, tz]];              // same column: straight N-S
  if (fz >= 25 && tz >= 25)  return [[tx, tz]];              // both in staging: direct
  if (Math.abs(fz - PJ_PICK_Z) < 5 && Math.abs(tz - PJ_PICK_Z) < 5) return [[tx, tz]]; // within pick band: direct
  // L-shape via pick lane
  const path: [number, number][] = [];
  if (Math.abs(fz - PJ_PICK_Z) > 1) path.push([fx, PJ_PICK_Z]);
  path.push([tx, PJ_PICK_Z]);
  if (Math.abs(tz - PJ_PICK_Z) > 1) path.push([tx, tz]);
  return path;
}

interface RandomPalletJackProps {
  id: string;
  beaconColor?: string;
  seed?: number;
  startAfterMs?: number;
}

export function RandomPalletJack({
  id,
  beaconColor = '#cc2200',
  seed = 1,
  startAfterMs = 60000,
}: RandomPalletJackProps) {
  const groupRef  = useRef<THREE.Group>(null);
  const palletRef = useRef<THREE.Group>(null);
  const angleRef  = useRef(0);

  const [spawnX, spawnZ] = SPAWN[id] ?? [0, +17];

  const posX      = useRef(spawnX);
  const posZ      = useRef(spawnZ);
  const segPath   = useRef<[number, number][]>([]);
  const pauseMs   = useRef(0);
  const carrying  = useRef(false);
  const rngState  = useRef(seed * 48271 + 1);
  const lastSimMs = useRef(-1);

  const rand = () => {
    rngState.current = (rngState.current * 1664525 + 1013904223) >>> 0;
    return rngState.current / 0xffffffff;
  };

  const pickDest = (): [number, number] =>
    PJ_WAYPOINTS[Math.floor(rand() * PJ_WAYPOINTS.length)];

  useFrame((_, delta) => {
    const { playbackSpeed, isPlaying, currentTime } = useSimulationStore.getState();
    if (!groupRef.current) return;

    // Detect timeline scrub — snap to nearest safe waypoint
    if (lastSimMs.current >= 0) {
      const jump = currentTime - lastSimMs.current;
      if (jump > 2000 || jump < 0) {
        let bestWp = PJ_WAYPOINTS[0];
        let bestDist = Infinity;
        for (const wp of PJ_WAYPOINTS) {
          const d = (wp[0] - posX.current) ** 2 + (wp[1] - posZ.current) ** 2;
          if (d < bestDist) { bestDist = d; bestWp = wp; }
        }
        posX.current = bestWp[0];
        posZ.current = bestWp[1];
        segPath.current = [];
        pauseMs.current = 500;
      }
    }
    lastSimMs.current = currentTime;

    if (!isPlaying) return;

    // Hold at spawn until startAfterMs of simulation time has elapsed
    if (currentTime < startAfterMs) {
      groupRef.current.position.set(posX.current, 0.14, posZ.current);
      updateAgentPos(id, posX.current, posZ.current);
      return;
    }

    const dt = delta * 1000 * Math.max(playbackSpeed, 0.5);

    if (pauseMs.current > 0) {
      pauseMs.current -= dt;
      groupRef.current.position.set(posX.current, 0.14, posZ.current);
      updateAgentPos(id, posX.current, posZ.current);
      return;
    }

    if (segPath.current.length === 0) {
      const [tx, tz] = pickDest();
      segPath.current = planPJPath(posX.current, posZ.current, tx, tz);
      pauseMs.current = MIN_PAUSE + rand() * (MAX_PAUSE - MIN_PAUSE);
      // Toggle carrying on each destination arrival (load → carry → deposit)
      carrying.current = !carrying.current;
      return;
    }

    const [tx, tz] = segPath.current[0];
    const dx = tx - posX.current;
    const dz = tz - posZ.current;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Yield to forklifts only — yielding to other PJs causes mutual deadlock
    const blocked = isForkliftNear(posX.current, posZ.current, YIELD_RADIUS);

    if (!blocked) {
      if (dist < 0.08) {
        posX.current = tx;
        posZ.current = tz;
        segPath.current = segPath.current.slice(1);
        if (segPath.current.length === 0) {
          pauseMs.current = MIN_PAUSE + rand() * (MAX_PAUSE - MIN_PAUSE);
        }
      } else {
        const step = Math.min(dist, SPEED * dt);
        const nx = posX.current + (dx / dist) * step;
        const nz = posZ.current + (dz / dist) * step;
        if (isInShipRack(nx, nz)) {
          segPath.current = []; // abort — reroute via pick lane next tick
        } else {
          posX.current = nx;
          posZ.current = nz;
        }
        const tgt  = Math.atan2(dx, dz);
        const diff = ((tgt - angleRef.current + Math.PI) % (2 * Math.PI)) - Math.PI;
        angleRef.current += diff * Math.min(1, delta * 5);
      }
    }

    groupRef.current.position.set(posX.current, 0.14, posZ.current);
    groupRef.current.rotation.y = angleRef.current;
    updateAgentPos(id, posX.current, posZ.current);

    if (palletRef.current) palletRef.current.visible = carrying.current;
  });

  return (
    <group ref={groupRef} scale={[1.4, 1.4, 1.4]}>
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
        <meshStandardMaterial color={beaconColor} metalness={0.5} roughness={0.45} />
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

      {/* Pallet load */}
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
