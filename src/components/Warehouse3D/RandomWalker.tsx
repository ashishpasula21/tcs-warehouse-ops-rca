import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/simulationStore';
import { isHeavyEquipmentNear } from '../../simulation/agentPositions';

// ── Safe pedestrian zones ───────────────────────────────────────────────────
// Main racks:     z = -22 to +8   at x = [-59,-49,-42,-28,-13,2,17,37,45,56]
// Shipping racks: z = +13 to +28  at x = [-59,-49,-42,56,60]
// Safe E-W corridors (no racks across full warehouse width):
//   Receiving floor z ≈ -23  (just south of main racks)
//   Cross-aisle    z ≈ +10   (between main & ship racks)
//   Staging floor  z ≈ +30   (north of ship racks)
// Safe N-S aisles (forklift lanes excluded — FL1=x=-54, FL3=x=-38, FL4=x=+49):
//   x=-45 (between racks -49/-42), x=-20 (-28/-13), x=-5 (-13/+2),
//   x=+9 (+2/+17), x=+27 (+17/+37), x=+41 (+37/+45)

const RECV_Z  = -23;  // receiving corridor
const CROSS_Z = +10;  // cross-aisle corridor
const STAGE_Z = +30;  // staging corridor
const RACK_S  = -22;
const SHIP_N  = +28;

const WAYPOINTS: readonly [number, number][] = [
  // East wall entry corridor
  [65,  0], [65, 15], [65, -15],
  // Receiving floor (z=-31) — open E-W
  [-45, -31], [-25, -31], [-5, -31], [+15, -31], [+35, -31], [+52, -31],
  // Receiving/admin desk (south wall)
  [+22, -37], [-5, -37],
  // Aisle x=-45  (between racks -49 and -42)
  [-45, -14], [-45,  0],
  // Aisle x=-20  (between racks -28 and -13)
  [-20, -14], [-20,  0],
  // Aisle x=-5   (between racks -13 and +2)
  [ -5, -14], [ -5,  0],
  // Aisle x=+9   (between racks +2 and +17)
  [ +9, -14], [ +9,  0],
  // Aisle x=+27  (between racks +17 and +37)
  [+27, -14], [+27,  0],
  // Aisle x=+41  (between racks +37 and +45)
  [+41, -14], [+41,  0],
  // Cross-aisle row (z=+10) — E-W transit above main racks
  [-28, +10], [-8, +10], [+10, +10], [+28, +10], [+43, +10],
  // Pick lane south (z=+14, south of PJ zone at z=+17)
  [-22, +14], [-5, +14], [+15, +14], [+35, +14],
  // Pick lane north (z=+21, north of PJ zone)
  [-20, +21], [0, +21], [+20, +21], [+38, +21],
  // Staging/shipping floor (z=+31-34, north of ship racks)
  [-15, +32], [0, +32], [+18, +32], [+35, +32],
];

// Desk/station waypoints — workers linger here after arriving
const DESK_WPS = new Set(['22,-37', '-5,-37']);

const SPAWN_X = 73;
const SPAWN_Z = 5;
const SPEED   = 0.003;  // units/ms
const MIN_TRANSIT_PAUSE =  1000;
const MAX_TRANSIT_PAUSE =  5000;
const MIN_DESK_PAUSE    = 60_000;  // 1 sim-minute
const MAX_DESK_PAUSE    = 90_000;  // 1.5 sim-minutes
const EQUIP_RADIUS = 5.5;  // forklift is ~4.5 units long at scale 1.5

// Rack column x-centers and half-widths (from WarehouseFloor geometry)
const MAIN_RACK_XS  = [-59, -49, -42, -28, -13, 2, 17, 37, 45, 56] as const;
const SHIP_RACK_XS  = [-59, -49, -42, 56, 60] as const;
const RACK_HALF_W   = 2.2;  // conservative half-width — keeps workers in aisle centre

function isInRack(x: number, z: number): boolean {
  if (z >= -22 && z <= 8)
    return MAIN_RACK_XS.some(rx => Math.abs(x - rx) < RACK_HALF_W);
  if (z >= 13 && z <= 28)
    return SHIP_RACK_XS.some(rx => Math.abs(x - rx) < RACK_HALF_W);
  return false;
}

/** Return collision-free waypoints from (fx,fz) to (tx,tz).
 *  E-W movement through rack zones routes via the nearest open corridor. */
function planPath(fx: number, fz: number, tx: number, tz: number): [number, number][] {
  if (Math.abs(fx - tx) < 2.5) return [[tx, tz]];            // same column: straight N-S
  if (fz <= RACK_S && tz <= RACK_S) return [[tx, tz]];       // both in receiving: direct
  if (fz >= SHIP_N && tz >= SHIP_N) return [[tx, tz]];       // both in staging: direct
  if (Math.abs(fz - CROSS_Z) < 3 && Math.abs(tz - CROSS_Z) < 3) return [[tx, tz]]; // cross-aisle: direct

  // L-shape via corridor — prefer going south when destination is south
  const corridorZ = tz < fz
    ? RECV_Z                                                   // heading south → receiving floor
    : Math.abs(tz - CROSS_Z) < Math.abs(tz - STAGE_Z)
      ? CROSS_Z                                                // heading north, dest closer to cross-aisle
      : STAGE_Z;                                              // heading north, dest closer to staging

  const path: [number, number][] = [];
  if (Math.abs(fz - corridorZ) > 0.5) path.push([fx, corridorZ]);
  path.push([tx, corridorZ]);
  if (Math.abs(tz - corridorZ) > 0.5) path.push([tx, tz]);
  return path;
}

interface RandomWalkerProps {
  vestColor?: string;
  hatColor?: string;
  initialDelayMs?: number;
  seed?: number;
}

export function RandomWalker({
  vestColor = '#f5d700',
  hatColor  = '#f5d700',
  initialDelayMs = 0,
  seed = 1,
}: RandomWalkerProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const legRef       = useRef<THREE.Group>(null);
  const clipboardRef = useRef<THREE.Mesh>(null);
  const statusDotRef = useRef<THREE.Mesh>(null);

  const posX      = useRef(SPAWN_X);
  const posZ      = useRef(SPAWN_Z);
  const segPath   = useRef<[number, number][]>([]);
  const pauseMs   = useRef(initialDelayMs);
  const angle     = useRef(0);
  const walkCyc   = useRef(0);
  const rngState  = useRef(seed * 48271 + 1);
  const entered   = useRef(false);
  const lastSimMs = useRef(-1);

  const rand = () => {
    rngState.current = (rngState.current * 1664525 + 1013904223) >>> 0;
    return rngState.current / 0xffffffff;
  };

  const pickDest = (): [number, number] => WAYPOINTS[Math.floor(rand() * WAYPOINTS.length)];

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Hide workers that haven't entered yet — they sit at x=73 (inside the east wall).
    groupRef.current.visible = entered.current;

    const { playbackSpeed, isPlaying, currentTime } = useSimulationStore.getState();

    // Detect timeline scrub: currentTime jumped non-linearly (user dragged the slider).
    // Forklifts teleport to the correct deterministic position; snap workers to the
    // nearest safe waypoint so they don't end up inside equipment or rack geometry.
    if (lastSimMs.current >= 0 && entered.current) {
      const jump = currentTime - lastSimMs.current;
      if (jump > 2000 || jump < 0) {
        let bestWp = WAYPOINTS[0];
        let bestDist = Infinity;
        for (const wp of WAYPOINTS) {
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

    const dt = delta * 1000 * Math.max(playbackSpeed, 0.5); // sim-ms per frame

    // Initial delay — sit hidden at spawn door
    if (pauseMs.current > 0) {
      pauseMs.current -= dt;
      groupRef.current.position.set(posX.current, -0.18, posZ.current);
      return;
    }

    // First activation: walk from door into east corridor
    if (!entered.current) {
      entered.current = true;
      segPath.current = [[65, SPAWN_Z], ...planPath(65, SPAWN_Z, ...pickDest())];
    }

    // No path: pick next destination (pause was already set on arrival)
    if (segPath.current.length === 0) {
      const [tx, tz] = pickDest();
      segPath.current = planPath(posX.current, posZ.current, tx, tz);
      return;
    }

    const [tx, tz] = segPath.current[0];
    const dx = tx - posX.current;
    const dz = tz - posZ.current;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Yield to heavy equipment
    const blocked = isHeavyEquipmentNear(posX.current, posZ.current, EQUIP_RADIUS);
    if (!blocked) {
      if (dist < 0.08) {
        posX.current = tx;
        posZ.current = tz;
        segPath.current = segPath.current.slice(1);
        if (segPath.current.length === 0) {
          // Arrived at final destination — pause duration based on where we are now
          const isDesk = DESK_WPS.has(`${tx},${tz}`);
          pauseMs.current = isDesk
            ? MIN_DESK_PAUSE    + rand() * (MAX_DESK_PAUSE    - MIN_DESK_PAUSE)
            : MIN_TRANSIT_PAUSE + rand() * (MAX_TRANSIT_PAUSE - MIN_TRANSIT_PAUSE);
        }
      } else {
        const step = Math.min(dist, SPEED * dt);
        const nx = posX.current + (dx / dist) * step;
        const nz = posZ.current + (dz / dist) * step;
        // Abort path segment if next step would enter rack geometry
        if (isInRack(nx, nz)) {
          segPath.current = [];
        } else {
          posX.current = nx;
          posZ.current = nz;
        }
        const tgt = Math.atan2(dx, dz);
        const diff = ((tgt - angle.current + Math.PI) % (2 * Math.PI)) - Math.PI;
        angle.current += diff * Math.min(1, delta * 6);
      }
    }

    groupRef.current.position.set(posX.current, -0.18, posZ.current);
    groupRef.current.rotation.y = angle.current;

    const moving = !blocked && segPath.current.length > 0 && dist > 0.08;
    if (legRef.current) {
      if (moving) {
        walkCyc.current += delta * 5;
        legRef.current.position.y = 0.06 * Math.abs(Math.sin(walkCyc.current));
      } else {
        legRef.current.position.y = 0;
      }
    }
    if (clipboardRef.current) clipboardRef.current.visible = !moving;
    if (statusDotRef.current) {
      const m = statusDotRef.current.material as THREE.MeshStandardMaterial;
      m.color.set(moving ? '#22c55e' : '#e5e7eb');
      m.emissive.set(moving ? '#22c55e' : '#aaaaaa');
      m.emissiveIntensity = moving ? 1.0 : 0.1;
    }
  });

  return (
    <group ref={groupRef} scale={[2.2, 2.2, 2.2]}>
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
        <sphereGeometry args={[0.17, 8, 8]} />
        <meshStandardMaterial color="#c8a880" roughness={0.88} />
      </mesh>
      {/* Hard hat */}
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color={hatColor} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.64, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.03, 10]} />
        <meshStandardMaterial color={hatColor === '#f5d700' ? '#e8c800' : hatColor} roughness={0.5} />
      </mesh>
      {/* Status dot */}
      <mesh ref={statusDotRef} position={[0, 2.12, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#e5e7eb" emissive="#aaaaaa" emissiveIntensity={0.1} />
      </mesh>
      {/* Clipboard — visible when paused */}
      <mesh ref={clipboardRef} position={[0.22, 0.88, 0.14]} rotation={[0.1, 0.3, 0.2]} visible={false}>
        <boxGeometry args={[0.14, 0.22, 0.03]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
      </mesh>
    </group>
  );
}
