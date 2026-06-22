import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import {
  WarehouseFloor, TruckModel, RECV_DOORS, SHIP_DOORS,
  DYNAMIC_SHELF_SLOTS, slotToWorldPos,
} from './WarehouseFloor';
import { Forklift } from './Forklift';
import { PalletJack } from './PalletJack';
import { OperatorModel } from './OperatorModel';
import { HeatmapOverlay } from './HeatmapOverlay';
import { EventIndicator } from './EventIndicator';
import { useSimulationStore } from '../../store/simulationStore';
import { getScenarioConfig } from '../../simulation/routes';
import { getActiveEvent } from '../../data/shiftEvents';
import {
  WALKER_1_ROUTE, WALKER_2_ROUTE, WALKER_3_ROUTE,
  DOCK_WORKER_1_ROUTE, DOCK_WORKER_2_ROUTE,
  SHELF_PICKER_1_ROUTE, SHELF_PICKER_2_ROUTE,
  FL1_ROUTE, FL2_ROUTE, FL3_ROUTE, FL4_ROUTE,
  getEquipmentState, getRouteCycleNum,
} from '../../simulation/routes';
import type { EquipmentRoute } from '../../simulation/routes';

// ── Truck Cycle Animation ─────────────────────────────────────────────────────
const TRUCK_CYCLE_MS  = 1_800_000;  // 30 sim-minutes per cycle
const DOCKED_MS       = 1_200_000;
const DEPART_MS       =   120_000;
const GAP_MS          =   300_000;
const ARRIVE_MS       =   180_000;

function getTruckState(dockIdx: number, southWall: boolean, globalMs: number) {
  const offset = dockIdx * 285_000; // stagger each dock
  const t = ((globalMs + offset) % TRUCK_CYCLE_MS + TRUCK_CYCLE_MS) % TRUCK_CYCLE_MS;
  // Wall is at z=±39 (hd=39 in WarehouseFloor). Truck rear doors land at group.z − 0.9 (for
  // southWall, dir=−1). Setting group at −38 places rear doors at −38.9 ≈ flush with the wall.
  const dockZ = southWall ? -38 : +38;
  const farZ  = southWall ? -80 : +80;

  if (t < DOCKED_MS) {
    const loadPct = southWall ? 1 - t / DOCKED_MS : t / DOCKED_MS;
    return { z: dockZ, visible: true, loadPct };
  }
  if (t < DOCKED_MS + DEPART_MS) {
    const p = (t - DOCKED_MS) / DEPART_MS;
    return { z: dockZ + (farZ - dockZ) * p, visible: true, loadPct: southWall ? 0 : 1 };
  }
  if (t < DOCKED_MS + DEPART_MS + GAP_MS) {
    return { z: farZ, visible: false, loadPct: 0 };
  }
  const p = (t - DOCKED_MS - DEPART_MS - GAP_MS) / ARRIVE_MS;
  return { z: farZ + (dockZ - farZ) * p, visible: true, loadPct: southWall ? 1 : 0 };
}

// Export so App can read truck states for analytics
export function getTruckStates(currentTime: number) {
  return [
    ...RECV_DOORS.map((x, i) => ({ id: `recv-${i}`, x, label: `Recv ${i + 1} (x=${x})`, southWall: true,  ...getTruckState(i,     true,  currentTime) })),
    ...SHIP_DOORS.map((x, i) => ({ id: `ship-${i}`, x, label: `Ship ${i + 1} (x=${x})`, southWall: false, ...getTruckState(i + 3, false, currentTime) })),
  ];
}

// ── Animated Shelf Box System ─────────────────────────────────────────────────
// Each forklift services SLOTS_PER_ROUTE shelf positions, one per trip.
// The active slot (cycleNum % SLOTS_PER_ROUTE) tracks with the forklift cycle.
// When a slot is active AND the forklift is loaded, the box is "on the forks":
//   - box shrinks with a spring and rises slightly (lift effect)
//   - when deposited, it settles back with a spring overshoot (physical impact)
// All other slots remain fully visible — only ONE box changes per forklift trip.

const _BOX_COLORS      = ['#c8924a', '#b87c38', '#d4a462', '#bf8430'];
const _RACK_W          = 2.2;
const _LEVEL_H         = 13 / 5;   // 2.6
const _BAY_SP          = 3.75;
const SLOTS_PER_ROUTE  = 6;        // 3 bays × 2 adjacent rack rows per aisle

// Spring constants for box settle animation
const SPRING_K = 18;  // stiffness — controls how snappy the settle is
const SPRING_D = 7;   // damping — controls overshoot (slightly underdamped for a nice bounce)

function DynamicShelfBox({ wx, wy, wz, watchRoute, color, slotIdx }: {
  wx: number; wy: number; wz: number;
  watchRoute: EquipmentRoute;
  color: string;
  slotIdx: number; // index within this route's slots (0 to SLOTS_PER_ROUTE-1)
}) {
  const ref      = useRef<THREE.Mesh>(null);
  const scale    = useRef(1);   // current spring scale (1=full, 0=gone)
  const velocity = useRef(0);   // spring velocity for settle bounce

  useFrame((_, delta) => {
    if (!ref.current) return;
    const { currentTime } = useSimulationStore.getState();
    const st         = getEquipmentState(watchRoute, currentTime);
    const cycleNum   = getRouteCycleNum(watchRoute, currentTime);
    const activeSlot = cycleNum % SLOTS_PER_ROUTE;

    // This slot's box is "on the forks" only during the loaded travel of its cycle
    const shouldBeGone = st.isLoaded && activeSlot === slotIdx;
    const target = shouldBeGone ? 0 : 1;

    // Critically-damped spring toward target
    const dt = Math.min(delta, 0.05); // cap to avoid spiral on first frame
    const force = SPRING_K * (target - scale.current) - SPRING_D * velocity.current;
    velocity.current += force * dt;
    scale.current    += velocity.current * dt;
    // Clamp so we don't go wildly negative
    scale.current = Math.max(-0.05, Math.min(1.4, scale.current));

    const s = scale.current;
    ref.current.visible = s > 0.02;

    // Lift effect: box rises proportionally as it shrinks (fork lifting it up)
    // Max lift is 0.25 units — just enough to look physical without clipping beams
    const liftY = (1 - Math.max(0, s)) * 0.25;
    ref.current.position.set(wx, wy + liftY, wz);
    ref.current.scale.setScalar(Math.max(0, s));
  });

  return (
    <mesh ref={ref} position={[wx, wy, wz]}>
      <boxGeometry args={[_RACK_W - 0.28, _LEVEL_H * 0.74, _BAY_SP - 0.4]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

// Zone A (FL-1) and Zone D (FL-2) react to inbound forklifts.
// Zone B (-42, -28): FL-3 drives in to pick from the rack → shelf box vanishes while FL-3 carries.
// Zone E (+42, +56): FL-4 does the same on the east end.
function routeForRack(rackX: number): EquipmentRoute {
  if (rackX === -59 || rackX === -49) return FL1_ROUTE;
  if (rackX === -42 || rackX === -28) return FL3_ROUTE;
  if (rackX === 17  || rackX === 37)  return FL2_ROUTE;
  return FL4_ROUTE;
}

// ── Staging Stack — visible pallet stack at forklift pickup spots ──────────────
// Stacks appear when the forklift is empty (new load assembled), vanish when picked.


// Each dock slot is always mounted — position/visibility driven by useFrame
function TruckSlot({ dockIdx, southWall, x }: { dockIdx: number; southWall: boolean; x: number }) {
  const groupRef  = useRef<THREE.Group>(null);
  const cargo1Ref = useRef<THREE.Mesh>(null);
  const cargo2Ref = useRef<THREE.Mesh>(null);
  const cargo3Ref = useRef<THREE.Mesh>(null);

  // Trucks back into docks — cab faces away from warehouse, trailer/rear at the dock wall.
  // facingNorth=!southWall: receiving trucks face south (outside), shipping trucks face north (outside).
  // dir mirrors TruckModel: dir = facingNorth ? 1 : -1 = !southWall ? 1 : -1
  const dir = southWall ? -1 : 1;
  const tZ  = dir * 10; // trailer center offset, same sign as TruckModel

  useFrame(() => {
    const { currentTime } = useSimulationStore.getState();
    const s = getTruckState(dockIdx, southWall, currentTime);
    if (!groupRef.current) return;
    groupRef.current.visible = s.visible;
    groupRef.current.position.z = s.z;
    // Show cargo boxes based on how full the truck is
    if (cargo1Ref.current) cargo1Ref.current.visible = s.loadPct > 0.08;
    if (cargo2Ref.current) cargo2Ref.current.visible = s.loadPct > 0.42;
    if (cargo3Ref.current) cargo3Ref.current.visible = s.loadPct > 0.74;
  });

  return (
    <group ref={groupRef} visible={false}>
      <TruckModel x={x} z={0} facingNorth={!southWall} loadPct={0} truckType={southWall ? 'recv' : 'ship'} />
      {/* Cargo pallets visible inside the trailer as it fills */}
      {/* Interior floor at y=1.4 (trailer center 4.4 − half-height 3.0). */}
      {/* Cargo center at 1.4 + half-box-height 0.9 = 2.3. Boxes fill wider trailer. */}
      <mesh ref={cargo1Ref} visible={false} position={[x, 2.3, tZ + dir * 5.0]}>
        <boxGeometry args={[4.5, 1.8, 3.5]} />
        <meshStandardMaterial color="#c8924a" roughness={0.88} />
      </mesh>
      <mesh ref={cargo2Ref} visible={false} position={[x, 2.3, tZ]}>
        <boxGeometry args={[4.5, 1.8, 3.5]} />
        <meshStandardMaterial color="#b87c38" roughness={0.88} />
      </mesh>
      <mesh ref={cargo3Ref} visible={false} position={[x, 2.3, tZ - dir * 5.0]}>
        <boxGeometry args={[4.5, 1.8, 3.5]} />
        <meshStandardMaterial color="#d4a462" roughness={0.88} />
      </mesh>
    </group>
  );
}

function TruckSystem() {
  const recvSlots = RECV_DOORS.map((x, i) => ({ x, dockIdx: i,     southWall: true  }));
  const shipSlots = SHIP_DOORS.map((x, i) => ({ x, dockIdx: i + 3, southWall: false }));
  return (
    <>
      {[...recvSlots, ...shipSlots].map(s => (
        <TruckSlot key={`${s.southWall ? 'r' : 's'}-${s.dockIdx}`}
          dockIdx={s.dockIdx} southWall={s.southWall} x={s.x} />
      ))}
    </>
  );
}

// ── Lighting ──────────────────────────────────────────────────────────────────
function SceneLighting() {
  return (
    <>
      <ambientLight intensity={3.8} color="#e8ecf4" />
      <directionalLight position={[30, 60, 40]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[-40, 30, -30]} intensity={1.4} color="#dde8f8" />
      <directionalLight position={[0, 20, 0]} intensity={1.0} color="#f0f4ff" />
      {/* 6 point lights instead of 14 — same visual quality, much cheaper */}
      <pointLight position={[-40, 11, -20]} intensity={4.0} color="#fff4e0" distance={55} decay={1.2} />
      <pointLight position={[  0, 11, -20]} intensity={4.0} color="#fff4e0" distance={55} decay={1.2} />
      <pointLight position={[ 40, 11, -20]} intensity={4.0} color="#fff4e0" distance={55} decay={1.2} />
      <pointLight position={[-40, 11,   5]} intensity={4.0} color="#fff4e0" distance={55} decay={1.2} />
      <pointLight position={[  0, 11,   5]} intensity={4.0} color="#fff4e0" distance={55} decay={1.2} />
      <pointLight position={[ 40, 11,   5]} intensity={4.0} color="#fff4e0" distance={55} decay={1.2} />
    </>
  );
}

function SimulationTicker() {
  const lastWriteRef = useRef(0);
  useFrame((_, delta) => {
    const store = useSimulationStore.getState();
    if (!store.isPlaying) return;
    const next = store.currentTime + delta * 1000 * store.playbackSpeed;
    if (next >= 28_800_000) {
      useSimulationStore.setState({ currentTime: 28_800_000, isPlaying: false });
      return;
    }
    // Write to store at most 15fps (every ~67ms) — React UI subscribers don't
    // need sub-frame precision; 3D animators call getState() imperatively.
    const now = performance.now();
    if (now - lastWriteRef.current >= 67) {
      lastWriteRef.current = now;
      useSimulationStore.setState({ currentTime: next });
    }
  });
  return null;
}

// Computes activeEvent imperatively each frame; only triggers a store write
// when the event ID changes (rare), so WarehouseScene doesn't re-render every tick.
function EventMonitor({ improvementScenario }: { improvementScenario: string | null }) {
  const lastEventId = useRef<string | null | undefined>(undefined);
  useFrame(() => {
    const { currentTime } = useSimulationStore.getState();
    const ev = getActiveEvent(currentTime, improvementScenario);
    const id = ev?.id ?? null;
    if (id !== lastEventId.current) {
      lastEventId.current = id;
      useSimulationStore.setState({ activeEventId: id } as any);
    }
  });
  return null;
}

// ── Main Scene ────────────────────────────────────────────────────────────────
export function WarehouseScene() {
  const improvementScenario = useSimulationStore(s => s.improvementScenario);
  const activeEventId       = useSimulationStore(s => (s as any).activeEventId as string | null);
  const config = getScenarioConfig(improvementScenario);
  // Derive activeEvent from the id stored by EventMonitor (changes rarely)
  const activeEvent = activeEventId != null
    ? getActiveEvent(useSimulationStore.getState().currentTime, improvementScenario)
    : null;

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={['#b8ccd8']} />
      <fog attach="fog" args={['#c4d8e4', 120, 240]} />

      <PerspectiveCamera makeDefault position={[5, 52, 70]} fov={56} near={0.1} far={500} />
      <OrbitControls
        enablePan enableZoom enableRotate
        minDistance={15} maxDistance={250}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 4, -5]}
      />

      <SceneLighting />

      <Suspense fallback={null}>
        <WarehouseFloor />
        <HeatmapOverlay />

        {/* Animated trucks at docks */}
        <TruckSystem />

        {/* Forklifts — scenario-aware */}
        {config.forklifts.map((f, i) => {
          // Inbound forklifts (FL-1, FL-2) park near their receiving dock when empty.
          // Outbound forklifts (FL-3, FL-4) park near their shipping dock when empty.
          // dockIdx 0-2 = RECV_DOORS; 3-5 = SHIP_DOORS (see getTruckState offset logic).
          const id = f.route.id;
          const parkWhenAbsent =
            ['fl-1', 'fl-1-stag', 'fl-1-opt'].includes(id)
              ? { dockIdx: 0, parkX: -54, parkZ: -22 }   // RECV_DOORS[0] = x=-54
            : ['fl-2', 'fl-2-improved', 'fl-2-stag', 'fl-2-opt'].includes(id)
              ? { dockIdx: 2, parkX:   0, parkZ: -22 }   // RECV_DOORS[2] = x=+8 (FL-2 stages at x=0)
            : ['fl-3', 'fl-3-stag', 'fl-3-opt', 'fl-3-best'].includes(id)
              ? { dockIdx: 3, parkX: -30, parkZ:  22 }   // SHIP_DOORS[0] = x=-30
            : id === 'fl-4-base'
              ? { dockIdx: 5, parkX:  49, parkZ:  22 }   // SHIP_DOORS[2] = x=+49
            : id === 'fl-4'                               // FL4_PUTAWAY_ROUTE
              ? { dockIdx: 0, parkX: -38, parkZ: -22 }   // shares RECV west truck
            : undefined;
          return (
            <Forklift key={`fl-${i}`} route={f.route} beaconColor={f.beaconColor} parkWhenAbsent={parkWhenAbsent} />
          );
        })}

        {/* Pallet jacks — scenario-aware */}
        {config.palletJacks.map((p, i) => (
          <PalletJack key={`pj-${i}`} route={p.route} beaconColor={p.beaconColor} />
        ))}

        {/* Pick lane walkers */}
        <OperatorModel route={WALKER_1_ROUTE} vestColor="#f5d700" hatColor="#f5d700" />
        <OperatorModel route={WALKER_2_ROUTE} vestColor="#f5d700" hatColor="#f5d700" />

        {/* Cross-aisle / staging walker */}
        <OperatorModel route={WALKER_3_ROUTE} vestColor="#ff6600" hatColor="#f5d700" />

        {/* Dock workers */}
        <OperatorModel route={DOCK_WORKER_1_ROUTE} vestColor="#f5d700" hatColor="#ffffff" />
        <OperatorModel route={DOCK_WORKER_2_ROUTE} vestColor="#f5d700" hatColor="#ffffff" />

        {/* Shelf pickers — slightly different vest for variety */}
        <OperatorModel route={SHELF_PICKER_1_ROUTE} vestColor="#22c55e" hatColor="#f5d700" />
        <OperatorModel route={SHELF_PICKER_2_ROUTE} vestColor="#22c55e" hatColor="#f5d700" />

        {/* ── Animated shelf boxes — actual rack shelf positions ──────────────────
            Each DynamicShelfBox sits at the same coordinates as the static box
            that RackRow would normally render, but reacts to its forklift:
            the box vanishes from the shelf while the forklift is carrying a load.
        ──────────────────────────────────────────────────────────────────────── */}
        {DYNAMIC_SHELF_SLOTS.map((slot, i) => {
          const pos = slotToWorldPos(slot);
          // slotIdx cycles 0-5 within each route's group of SLOTS_PER_ROUTE
          const slotIdx = i % SLOTS_PER_ROUTE;
          return (
            <DynamicShelfBox
              key={i}
              wx={pos.x} wy={pos.y} wz={pos.z}
              watchRoute={routeForRack(slot.rackX)}
              color={_BOX_COLORS[(slot.bi + slot.rackX) % _BOX_COLORS.length]}
              slotIdx={slotIdx}
            />
          );
        })}

        {/* Event indicators — problem zones or improvement benefit zones */}
        {activeEvent && <EventIndicator event={activeEvent} />}
      </Suspense>

      <SimulationTicker />
      <EventMonitor improvementScenario={improvementScenario} />
    </Canvas>
  );
}
