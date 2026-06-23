// Industrial warehouse — FlexSim/AnyLogic-quality visuals
// Light concrete floor, tall pallet racking with orange beams, yellow safety lines, white trucks
import { useRef, useMemo, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

const WALL_H      = 10;
const FLOOR_COLOR = '#cac6bc';   // light concrete
const WALL_COLOR  = '#d8d4cc';   // light gray walls
const UPRIGHT     = '#6e6e6e';   // steel gray rack uprights
const BEAM_COLOR  = '#c04a00';   // orange/rust rack beams
const BOX_COLORS  = ['#c8924a', '#b87c38', '#d4a462', '#bf8430'];
const LINE_COLOR  = '#e8d200';   // yellow safety lines
const TRUCK_WHITE = '#ededeb';   // white truck body
const TRUCK_CAB   = '#2a3a4a';   // dark cab

// Rack geometry
const RACK_H       = 13;          // tall racks (5 levels)
const RACK_LEVELS  = 5;
const RACK_W       = 2.2;         // x-direction width
const Z_STORAGE_S  = -22;
const Z_STORAGE_N  =  8;
const RACK_D       = Z_STORAGE_N - Z_STORAGE_S;  // 30
const BAY_SPACING  = 3.75;        // z between upright frames
const BAY_FRAMES   = Math.round(RACK_D / BAY_SPACING) + 1;  // 9

// 10 racks, consistent spacing throughout:
//   Zone A (-59,-49): 7.8-unit aisle   | back corridor 4.8 |
//   Zone B (-42,-28): 11.8-unit aisle  | 12.8 cross | 12.8 center | 12.8 cross |
//   Zone D (17,37):   17.8-unit aisle  | back corridor 5.8 |
//   Zone E (45,56):   8.8-unit aisle
// Center racks (-13,+2) split the gap evenly into three equal 12.8-unit corridors.
const RACK_ROWS: number[] = [-59, -49, -42, -28, -13, 2, 17, 37, 45, 56];

// Door / dock geometry
export const RECV_DOORS = [-54, -15, 8];
export const SHIP_DOORS = [-30, -5,  49];

// ── Dynamic shelf slot definitions ────────────────────────────────────────────
// Excluded from static RackRow rendering; rendered dynamically in WarehouseScene.
export interface ShelfSlot { rackX: number; bi: number; li: number }
export const RACK_LEVEL_H = RACK_H / RACK_LEVELS; // 2.6
export const DYNAMIC_SHELF_SLOTS: ShelfSlot[] = [
  // Zone A — aisle x=-54 — FL-1 inbound deposits
  { rackX: -59, bi: 1, li: 0 }, { rackX: -59, bi: 3, li: 0 }, { rackX: -59, bi: 5, li: 0 },
  { rackX: -49, bi: 1, li: 0 }, { rackX: -49, bi: 3, li: 0 }, { rackX: -49, bi: 5, li: 0 },
  // Zone B — aisle x=-38 — FL-3 outbound picks
  { rackX: -42, bi: 1, li: 0 }, { rackX: -42, bi: 3, li: 0 }, { rackX: -42, bi: 5, li: 0 },
  { rackX: -28, bi: 1, li: 0 }, { rackX: -28, bi: 3, li: 0 }, { rackX: -28, bi: 5, li: 0 },
  // Zone D — aisle x=+28 — FL-2 inbound deposits
  { rackX: 17,  bi: 1, li: 0 }, { rackX: 17,  bi: 3, li: 0 }, { rackX: 17,  bi: 5, li: 0 },
  { rackX: 37,  bi: 1, li: 0 }, { rackX: 37,  bi: 3, li: 0 }, { rackX: 37,  bi: 5, li: 0 },
  // Zone E — aisle x=+49 — FL-4 outbound picks
  { rackX: 45,  bi: 1, li: 0 }, { rackX: 45,  bi: 3, li: 0 }, { rackX: 45,  bi: 5, li: 0 },
  { rackX: 56,  bi: 1, li: 0 }, { rackX: 56,  bi: 3, li: 0 }, { rackX: 56,  bi: 5, li: 0 },
];
export function slotToWorldPos(slot: ShelfSlot): { x: number; y: number; z: number } {
  return {
    x: slot.rackX,
    y: slot.li * RACK_LEVEL_H + RACK_LEVEL_H * 0.48,
    z: Z_STORAGE_S + slot.bi * BAY_SPACING + BAY_SPACING / 2,
  };
}
const _dynSlotSet = new Set(DYNAMIC_SHELF_SLOTS.map(s => `${s.rackX}:${s.bi}:${s.li}`));
const DOOR_W = 5.5;
const DOOR_H = 5.5;

// ── Zone Overlays ─────────────────────────────────────────────────────────────
interface ZonePanelProps {
  cx: number; cz: number;
  width: number; depth: number;
  color: string; opacity: number;
}
function ZonePanel({ cx, cz, width, depth, color, opacity }: ZonePanelProps) {
  return (
    // renderOrder=1 keeps zone panels above the base floor without z-fighting
    <mesh renderOrder={1} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, cz]}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false}
        polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

// Thin raised border strip drawn along an axis
function ZoneBorder({ x1, z1, x2, z2 }: { x1: number; z1: number; x2: number; z2: number }) {
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const isE_W = Math.abs(z2 - z1) < 0.01;
  const len = isE_W ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const rot: [number, number, number] = isE_W
    ? [-Math.PI / 2, 0, 0]
    : [-Math.PI / 2, Math.PI / 2, 0];
  return (
    <mesh renderOrder={3} rotation={rot} position={[cx, 0.03, cz]}>
      <planeGeometry args={[len, 0.28]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false}
        polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
    </mesh>
  );
}

function ZoneOverlays() {
  // Zone panel boundaries based on midpoints between aisle x-positions:
  // aisles: -54, -38, 0, +28, +49
  // Zone A: -74 to -46 (cx=-60, w=28), Zone B: -46 to -19 (cx=-32.5, w=27)
  // Zone C: -19 to +14 (cx=-2.5, w=33), Zone D: +14 to +38.5 (cx=+26.25, w=24.5)
  // Zone E: +38.5 to +74 (cx=+56.25, w=35.5)
  return (
    <group>
      {/* ── Colored zone panels — rack storage zone z=-22 to +8 ─────── */}
      <ZonePanel cx={0}       cz={-30.5} width={152}  depth={17}  color="#1d4ed8" opacity={0.32} />
      <ZonePanel cx={-60}     cz={-7}    width={28}   depth={30}  color="#dc2626" opacity={0.32} />
      <ZonePanel cx={-32.5}   cz={-7}    width={27}   depth={30}  color="#f97316" opacity={0.32} />
      <ZonePanel cx={-2.5}    cz={-7}    width={33}   depth={30}  color="#6366f1" opacity={0.32} />
      <ZonePanel cx={+26.25}  cz={-7}    width={24.5} depth={30}  color="#7c3aed" opacity={0.32} />
      <ZonePanel cx={+56.25}  cz={-7}    width={35.5} depth={30}  color="#0891b2" opacity={0.32} />
      <ZonePanel cx={0}       cz={23.5}  width={152}  depth={31}  color="#ca8a04" opacity={0.32} />

      {/* ── Zone boundary lines ───────────────────────────────────────── */}
      <ZoneBorder x1={-74}  z1={-22} x2={74}   z2={-22} />
      <ZoneBorder x1={-74}  z1={8}   x2={74}   z2={8}   />
      <ZoneBorder x1={-46}  z1={-22} x2={-46}  z2={8}   />
      <ZoneBorder x1={-19}  z1={-22} x2={-19}  z2={8}   />
      <ZoneBorder x1={14}   z1={-22} x2={14}   z2={8}   />
      <ZoneBorder x1={38.5} z1={-22} x2={38.5} z2={8}   />

      {/* ── Zone labels — placed at aisle x, just south of rack zone ─── */}
      {/* z=-25 / z=-23 puts them in the open receiving area (clear of racks) */}
      <Text position={[0,   0.05, -31.5]} rotation={[-Math.PI/2,0,0]} fontSize={3.6} color="#1d4ed8" anchorX="center" anchorY="middle" renderOrder={5}>RECEIVING</Text>
      <Text position={[0,   0.05, -28.2]} rotation={[-Math.PI/2,0,0]} fontSize={1.8} color="#3b82f6" anchorX="center" anchorY="middle" renderOrder={5}>Inbound Pallets</Text>

      <Text position={[-60, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#991b1b" anchorX="center" anchorY="middle" renderOrder={5}>ZONE A</Text>
      <Text position={[-60, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#dc2626" anchorX="center" anchorY="middle" renderOrder={5}>Far West</Text>

      <Text position={[-32, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#c2410c" anchorX="center" anchorY="middle" renderOrder={5}>ZONE B</Text>
      <Text position={[-32, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#f97316" anchorX="center" anchorY="middle" renderOrder={5}>West Storage</Text>

      <Text position={[-2,  0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#4338ca" anchorX="center" anchorY="middle" renderOrder={5}>ZONE C</Text>
      <Text position={[-2,  0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#6366f1" anchorX="center" anchorY="middle" renderOrder={5}>Center Storage</Text>

      <Text position={[+26, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#4c1d95" anchorX="center" anchorY="middle" renderOrder={5}>ZONE D</Text>
      <Text position={[+26, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#7c3aed" anchorX="center" anchorY="middle" renderOrder={5}>East Storage</Text>

      <Text position={[+56, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#155e75" anchorX="center" anchorY="middle" renderOrder={5}>ZONE E</Text>
      <Text position={[+56, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#0891b2" anchorX="center" anchorY="middle" renderOrder={5}>Far East</Text>

      <Text position={[0,   0.05, 20]}   rotation={[-Math.PI/2,0,0]} fontSize={3.2} color="#713f12" anchorX="center" anchorY="middle" renderOrder={5}>STAGING / SHIPPING</Text>
      <Text position={[0,   0.05, 23.2]} rotation={[-Math.PI/2,0,0]} fontSize={1.6} color="#92400e" anchorX="center" anchorY="middle" renderOrder={5}>Outbound Assembly &amp; Loading</Text>
    </group>
  );
}

// ── Dock Bay Markings — permanent floor paint visible even without a truck ────
function DockBayMarkings() {
  return (
    <>
      {RECV_DOORS.map((x, i) => (
        <group key={`recv-bay-${i}`}>
          {/* Interior pad just inside the door */}
          <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, -37]}>
            <planeGeometry args={[5.8, 4]} />
            <meshBasicMaterial color="#2a2a2a" transparent opacity={0.22} depthWrite={false}
              polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
          {/* Dock number label at door — always visible */}
          <Text position={[x, 0.06, -37.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.5}
            color="#ffe040" anchorX="center" anchorY="middle" renderOrder={4}>
            {`R${i + 1}`}
          </Text>
          {/* Exterior guide lines — frame the truck parking bay on the yard */}
          {([-3.1, 3.1] as const).map((ox, j) => (
            <mesh key={j} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x + ox, -0.006, -50]}>
              <planeGeometry args={[0.2, 24]} />
              <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false}
              polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
            </mesh>
          ))}
          {/* Stop bar at back of bay */}
          <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.006, -62]}>
            <planeGeometry args={[6.8, 0.28]} />
            <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false}
              polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
        </group>
      ))}
      {SHIP_DOORS.map((x, i) => (
        <group key={`ship-bay-${i}`}>
          <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 37]}>
            <planeGeometry args={[5.8, 4]} />
            <meshBasicMaterial color="#2a2a2a" transparent opacity={0.22} depthWrite={false}
              polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
          <Text position={[x, 0.06, 37.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.5}
            color="#ffe040" anchorX="center" anchorY="middle" renderOrder={4}>
            {`S${i + 1}`}
          </Text>
          {([-3.1, 3.1] as const).map((ox, j) => (
            <mesh key={j} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x + ox, -0.006, 50]}>
              <planeGeometry args={[0.2, 24]} />
              <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false}
              polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
            </mesh>
          ))}
          <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.006, 62]}>
            <planeGeometry args={[6.8, 0.28]} />
            <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false}
              polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// A single pallet tower: wood pallet base + `layers` stacked cardboard boxes.
// `seed` drives deterministic color/height variation.
function PalletTower({ x, z, layers, seed }: { x: number; z: number; layers: number; seed: number }) {
  const BOX_H = 0.62;
  const BOX_W = 1.02;
  const BOX_D = 0.88;
  return (
    <group position={[x, 0, z]}>
      {/* Wood pallet base */}
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[1.18, 0.18, 1.02]} />
        <meshLambertMaterial color="#7a5c1a" />
      </mesh>
      {/* Stacked box layers */}
      {Array.from({ length: layers }, (_, li) => (
        <mesh key={li} position={[0, 0.18 + li * BOX_H + BOX_H * 0.5, 0]}>
          <boxGeometry args={[BOX_W - (li % 2) * 0.04, BOX_H - 0.02, BOX_D - (li % 2) * 0.04]} />
          <meshLambertMaterial color={BOX_COLORS[(seed + li) % BOX_COLORS.length]} />
        </mesh>
      ))}
    </group>
  );
}

// A cluster of 2-3 adjacent pallet towers grouped as one staging unit.
// `offsets` = [x,z] offsets within the cluster, one per tower.
function PalletCluster({ cx, cz, seed }: { cx: number; cz: number; seed: number }) {
  const towers: { dx: number; dz: number; layers: number }[] = [
    { dx: -1.25, dz:  0,    layers: 8  + ((seed)     % 7) },
    { dx:  0,    dz:  0,    layers: 10 + ((seed + 3)  % 6) },
    { dx:  1.25, dz:  0,    layers: 9  + ((seed + 5)  % 6) },
  ];
  return (
    <>
      {towers.map((t, i) => (
        <PalletTower key={i} x={cx + t.dx} z={cz + t.dz} layers={t.layers} seed={seed + i * 4} />
      ))}
    </>
  );
}

// Static pallet stacks in receiving/shipping staging areas
function StagingPallets() {
  // South wall z=-39, North wall z=+39. Side walls x=±74.
  // RECV_DOORS at x=-54,-15,+8  (door width ±2.75 → clear lanes ±5 each side)
  // SHIP_DOORS at x=-30,-5,+49  (same clearance)
  //
  // Equipment constraints:
  //   Receiving: DOCK_WORKER_1 z=-26/-27 x=-38..-15, FL1 x=-54 z=-26, FL2 x=0..+28 z=-26
  //   Shipping:  PJ1 z=+17 x=-42..-6, PJ2 z=+17 x=+6..+42,
  //              WALKER_3 x=-32..-6 z=+11..+25, FL3 diagonal x=-38..-4 z=+11..+29,
  //              FL4 x=+49 z=+11..+29, DOCK_WORKER_2 x=-5..+18 z=+27..+29

  // Pallets only placed in clear STAGING BAYS — never in dock door approach lanes,
  // never in forklift travel aisles, never outside the building.

  // ── Receiving bays ─────────────────────────────────────────────────────────
  // Dock doors divide receiving floor into 4 staging bays.
  // Equipment only travels at z=-26/-27, so rows starting at z=-24 are safe
  // as long as they're not in the door approach lane x-ranges.
  //
  // Door approach lanes (keep clear full z depth):
  //   x=-54: clear x=-58..-50   x=-15: clear x=-19..-11   x=+8: clear x=+4..+12

  // Bay W  (west wall → door 1):      x=-71 to x=-59
  // Bay MW (between door 1 and door 2): x=-49 to x=-20
  // Bay ME (between door 2 and door 3): x=-10 to x=+3
  // Bay E  (door 3 → east wall):       x=+13 to x=+71

  // SW receiving corner — ChargingStation sits at x=-62,z=-24 so start at z=-29
  // SE receiving corner — clear of all structures
  const recvBays: Array<[number, number]> = [
    [-70,-29],[-66,-29],[-63,-29],
    [-70,-34],[-66,-34],[-63,-34],
    [ 62,-24],[ 66,-24],[ 70,-24],
    [ 62,-29],[ 66,-29],[ 70,-29],
  ];

  // NW shipping corner is occupied by ControlBooth (x=-68,z=+30) — skip it
  // NE shipping corner — clear of all structures (all equipment max z=+29)
  const shipBays: Array<[number, number]> = [
    [ 62,31],[ 66,31],[ 70,31],
    [ 62,35],[ 66,35],[ 70,35],
  ];

  const all = [...recvBays, ...shipBays];
  return (
    <group>
      {all.map(([cx, cz], i) => (
        <PalletCluster key={i} cx={cx} cz={cz} seed={i * 7 + Math.abs(cx | 0)} />
      ))}
    </group>
  );
}

// Forklift battery charging stations (where forklifts park when idle)
function ChargingStations() {
  const positions: [number, number][] = [
    [-62, -24], [3, -24], [-35, 24], [52, 24],
  ];
  return (
    <group>
      {positions.map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]} scale={[1.5, 1.5, 1.5]}>
          {/* Cabinet body — 3× original */}
          <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[3.2, 5.0, 1.2]} />
            <meshStandardMaterial color="#374151" roughness={0.65} metalness={0.4} />
          </mesh>
          {/* Yellow stripe */}
          <mesh position={[0, 1.4, 0.62]}>
            <boxGeometry args={[3.2, 0.38, 0.04]} />
            <meshStandardMaterial color={LINE_COLOR} roughness={0.5} />
          </mesh>
          {/* Status LED panel */}
          <mesh position={[0, 4.2, 0.62]}>
            <boxGeometry args={[0.7, 0.32, 0.04]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.2} />
          </mesh>
          {/* Charging cable on floor */}
          <mesh position={[1.2, 0.08, 1.4]} rotation={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 2.8, 6]} />
            <meshStandardMaterial color="#1f2937" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Stretch-wrap stations near shipping area
function WrapStations() {
  const positions: [number, number][] = [[-20, 20], [20, 20]];
  return (
    <group>
      {positions.map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]} scale={[1.5, 1.5, 1.5]}>
          {/* Turntable base */}
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[1.8, 1.8, 0.5, 16]} />
            <meshStandardMaterial color="#6b7280" roughness={0.7} metalness={0.5} />
          </mesh>
          {/* Pallet on turntable */}
          <mesh position={[0, 0.65, 0]}>
            <boxGeometry args={[2.3, 0.3, 2.1]} />
            <meshStandardMaterial color="#7a5c1a" roughness={0.96} />
          </mesh>
          {/* Wrapped load */}
          <mesh position={[0, 2.4, 0]}>
            <cylinderGeometry args={[1.1, 1.1, 3.0, 14]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.5} transparent opacity={0.75} />
          </mesh>
          {/* Wrap mast */}
          <mesh position={[2.1, 2.5, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 5.0, 8]} />
            <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Film roll on mast */}
          <mesh position={[2.1, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.5, 10]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.5} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Safety/first-aid stations on walls
function SafetyStations() {
  // Flush against side walls (inner face at ±73.75; cabinet half-x = 0.375 at scale 1.5)
  const positions: [number, number, number][] = [
    [-73, 0, -10], [73, 0, 10], [-73, 0, 15], [73, 0, -15],
  ];
  return (
    <group>
      {positions.map(([px, , pz], i) => (
        <group key={i} position={[px, 0, pz]} scale={[1.5, 1.5, 1.5]}>
          {/* Red cabinet — 3× original */}
          <mesh position={[0, 2.0, 0]}>
            <boxGeometry args={[0.5, 2.4, 1.4]} />
            <meshStandardMaterial color="#dc2626" roughness={0.6} />
          </mesh>
          {/* White cross H */}
          <mesh position={[0.27, 2.0, 0]}>
            <boxGeometry args={[0.04, 0.9, 0.22]} />
            <meshStandardMaterial color="white" roughness={0.5} />
          </mesh>
          <mesh position={[0.27, 2.0, 0]}>
            <boxGeometry args={[0.04, 0.22, 0.9]} />
            <meshStandardMaterial color="white" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Supervisor / control booth in the northwest corner
function ControlBooth() {
  return (
    <group position={[-68, 0, 30]} scale={[1.5, 1.5, 1.5]}>
      {/* Walls */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[8, 5.0, 7]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.85} />
      </mesh>
      {/* Glass window front */}
      <mesh position={[4.05, 3.0, 0]}>
        <boxGeometry args={[0.12, 3.0, 5.5]} />
        <meshStandardMaterial color="#bfdbfe" roughness={0.1} metalness={0.4} transparent opacity={0.55} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 5.1, 0]}>
        <boxGeometry args={[8.4, 0.28, 7.4]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.9} />
      </mesh>
      {/* Door */}
      <mesh position={[4.05, 1.4, 2.2]}>
        <boxGeometry args={[0.12, 2.8, 1.3]} />
        <meshStandardMaterial color="#d97706" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ── Receiving check-in desk ───────────────────────────────────────────────────
// x=-30, z=-25: moved south from z=-23 to clear rack at x=-28 (south face z=-22).
// Desk north face at z=-23.5 and chairs north edge at z=-23.8 — both clear of racks.
function ReceivingDesk() {
  return (
    <group position={[-30, 0, -25]} scale={[1.5, 1.5, 1.5]}>
      {/* Desk body */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[6.0, 2.0, 2.0]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.75} />
      </mesh>
      {/* Desk surface */}
      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[6.4, 0.14, 2.4]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.6} />
      </mesh>
      {/* Monitor left */}
      <mesh position={[-1.8, 3.5, -0.3]}>
        <boxGeometry args={[2.2, 1.5, 0.14]} />
        <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-1.8, 3.5, -0.22]}>
        <boxGeometry args={[2.0, 1.35, 0.02]} />
        <meshStandardMaterial color="#bfdbfe" emissive="#bfdbfe" emissiveIntensity={0.4} />
      </mesh>
      {/* Monitor right */}
      <mesh position={[1.4, 3.5, -0.3]}>
        <boxGeometry args={[2.2, 1.5, 0.14]} />
        <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[1.4, 3.5, -0.22]}>
        <boxGeometry args={[2.0, 1.35, 0.02]} />
        <meshStandardMaterial color="#bfdbfe" emissive="#bfdbfe" emissiveIntensity={0.4} />
      </mesh>
      {/* Label printer */}
      <mesh position={[-0.2, 2.4, -0.3]}>
        <boxGeometry args={[1.3, 0.6, 0.8]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.6} />
      </mesh>
      {/* Two chairs */}
      {([-1.5, 1.5] as const).map((xo, i) => (
        <group key={i} position={[xo, 0, 1.4]}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[1.2, 0.16, 1.2]} />
            <meshStandardMaterial color="#1f2937" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.0, -0.6]}>
            <boxGeometry args={[1.2, 1.4, 0.15]} />
            <meshStandardMaterial color="#1f2937" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── QA / Inspection table ────────────────────────────────────────────────────
// x=+30, z=-24: east of dock door 3 (x=+8), clear of all routes.
// ── QA / Inspection table ────────────────────────────────────────────────────
// x=+50, z=-25: east of RECV_DOOR[2] (x=+8), east of FL2 max reach (x=+28), clear of all routes.
// Original x=+30 was colliding with FL2 whose path goes to (x=+28, z=-26) and the table
// south face (z=-26.25) was clipping FL2's z=-26 travel lane. Moved east to x=+50.
function QAInspectionTable() {
  const legs: [number, number][] = [[-3.5, -1.2], [-3.5, 1.2], [3.5, -1.2], [3.5, 1.2]];
  return (
    <group position={[50, 0, -25]} scale={[1.5, 1.5, 1.5]}>
      {/* Table top */}
      <mesh position={[0, 2.0, 0]}>
        <boxGeometry args={[8.0, 0.16, 3.0]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.6} />
      </mesh>
      {/* Legs */}
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 1.0, lz]}>
          <boxGeometry args={[0.16, 2.0, 0.16]} />
          <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Shelf under table */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[7.6, 0.1, 2.6]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.7} />
      </mesh>
      {/* Boxes being inspected */}
      <mesh position={[-2.0, 2.5, 0]}>
        <boxGeometry args={[1.4, 1.1, 1.2]} />
        <meshStandardMaterial color="#c8924a" roughness={0.9} />
      </mesh>
      <mesh position={[1.0, 2.5, 0.2]}>
        <boxGeometry args={[1.6, 1.3, 1.4]} />
        <meshStandardMaterial color="#b87c38" roughness={0.9} />
      </mesh>
      {/* Clipboard */}
      <mesh position={[-3.0, 2.18, -0.5]}>
        <boxGeometry args={[0.8, 0.05, 1.1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>
      {/* QA sign post */}
      <mesh position={[4.2, 3.5, -1.4]}>
        <boxGeometry args={[0.15, 3.5, 0.15]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[4.2, 5.1, -1.4]}>
        <boxGeometry args={[2.2, 0.8, 0.12]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.5} />
      </mesh>
    </group>
  );
}

// ── Inbound roller conveyor ───────────────────────────────────────────────────
// x=-44, z=-29: moved from x=-50,z=-21 which overlapped rack x=-49.
// At x=-44 spans x=-45.8 to -42.2 — clear of rack x=-49 (east edge -47.9) by 2.1 u
// and rack x=-42 (west edge -43.1) by 0.9 u. z=-29 north face at -23, clear of z=-22.
function ConveyorSegment() {
  const CONV_LEN = 8.0;
  const CONV_W   = 2.4;
  const RAIL_H   = 1.3;
  return (
    <group position={[-44, 0, -29]} scale={[1.5, 1.5, 1.5]}>
      {/* Side rails */}
      {([-CONV_W / 2, CONV_W / 2] as const).map((xo, i) => (
        <mesh key={i} position={[xo, RAIL_H, 0]}>
          <boxGeometry args={[0.14, 0.22, CONV_LEN]} />
          <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Rollers */}
      {Array.from({ length: 10 }, (_, ri) => (
        <mesh key={ri} position={[0, RAIL_H, -CONV_LEN / 2 + 0.45 + ri * 0.8]}
          rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, CONV_W, 8]} />
          <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* Support legs (4 pairs) */}
      {[-3.0, -1.0, 1.0, 3.0].flatMap((zo) =>
        ([-CONV_W / 2 + 0.15, CONV_W / 2 - 0.15] as const).map((xo, j) => (
          <mesh key={`${zo}-${j}`} position={[xo, RAIL_H / 2, zo]}>
            <boxGeometry args={[0.13, RAIL_H, 0.13]} />
            <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
          </mesh>
        ))
      )}
      {/* Boxes on conveyor */}
      <mesh position={[0, RAIL_H + 0.75, -2.0]}>
        <boxGeometry args={[1.6, 1.3, 1.5]} />
        <meshStandardMaterial color="#c8924a" roughness={0.9} />
      </mesh>
      <mesh position={[0, RAIL_H + 0.85, 1.5]}>
        <boxGeometry args={[1.8, 1.5, 1.6]} />
        <meshStandardMaterial color="#b87c38" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Weigh & manifest station ──────────────────────────────────────────────────
// x=-38, z=+26: FL3 at this x is at z=+11 (not in [+23.4,+28.6]). PJ1 at z=+17
// is now 6+ units south of platform south face (+23.4). WALKER_3 max x=-32, not at x=-38.
// Moved from [-43,0,20] where platform south face z=+17.375 clipped PJ1 pause at z=+17.
function WeighManifestStation() {
  return (
    <group position={[-38, 0, 26]} scale={[1.5, 1.5, 1.5]}>
      {/* Floor scale platform */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[4.0, 0.36, 3.5]} />
        <meshStandardMaterial color="#374151" roughness={0.55} metalness={0.5} />
      </mesh>
      {/* Yellow safety border */}
      <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.37, 0]}>
        <planeGeometry args={[4.0, 3.5]} />
        <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.35} depthWrite={false}
          {...({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } as any)} />
      </mesh>
      {/* Pallet on scale */}
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[2.3, 0.28, 2.1]} />
        <meshStandardMaterial color="#7a5c1a" roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[1.8, 1.6, 1.7]} />
        <meshStandardMaterial color="#c8924a" roughness={0.9} />
      </mesh>
      {/* Terminal pole */}
      <mesh position={[2.6, 2.0, 1.5]}>
        <boxGeometry args={[0.18, 4.0, 0.18]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Terminal screen */}
      <mesh position={[2.6, 3.9, 1.5]}>
        <boxGeometry args={[1.3, 0.95, 0.15]} />
        <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[2.6, 3.9, 1.43]}>
        <boxGeometry args={[1.1, 0.8, 0.02]} />
        <meshStandardMaterial color="#bfdbfe" emissive="#bfdbfe" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

// ── Packaging materials supply rack ──────────────────────────────────────────
// x=+25, z=+33: between ship doors, near north wall. All equipment max z=+29.
function PackagingSupplyRack() {
  const rollColors = ['#e5e7eb', '#fbbf24', '#d1d5db', '#f3f4f6'];
  return (
    <group position={[25, 0, 33]} scale={[1.5, 1.5, 1.5]}>
      {/* Uprights */}
      {([-3.5, 0, 3.5] as const).map((xo, i) => (
        <mesh key={i} position={[xo, 3.5, 0]}>
          <boxGeometry args={[0.16, 7.0, 0.16]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Shelf boards — 4 levels */}
      {[1.2, 2.6, 4.0, 5.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[7.2, 0.14, 1.8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {/* Rolls on each shelf */}
      {[0, 1, 2, 3].map(shelf =>
        [-2.6, -1.3, 0, 1.3, 2.6].map((xo, j) => (
          <mesh key={`${shelf}-${j}`} position={[xo, 1.2 + shelf * 1.4 + 0.5, 0]}
            rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.42, 0.42, 0.52, 10]} />
            <meshStandardMaterial color={rollColors[j % 4]} roughness={0.65} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ── Empty pallet stacks against dock walls ────────────────────────────────────
// Stacks of 10-14 bare pallets stored between dock doors — extremely common in
// real warehouses. Placed at z=-37 (south) and z=+37 (north), between door
// approach lanes and away from all equipment travel paths.
function EmptyPalletStacks() {
  const stacks: Array<{ x: number; z: number; count: number }> = [
    { x: -35, z: -37, count: 13 }, // south wall, between recv doors 1 & 2
    { x: +30, z: -37, count: 11 }, // south wall, east of recv door 3
    { x: -15, z: +37, count: 12 }, // north wall, between ship doors 1 & 2
    { x: +30, z: +37, count: 14 }, // north wall, between ship doors 2 & 3
  ];
  return (
    <group>
      {stacks.map((s, si) => (
        // Two side-by-side stacks per location
        <group key={si} position={[s.x, 0, s.z]}>
          {([0, 2.4] as const).map((xOff, ti) => (
            <group key={ti} position={[xOff, 0, 0]}>
              {Array.from({ length: s.count + (ti === 0 ? 0 : -2) }, (_, pi) => (
                <mesh key={pi} position={[0, 0.11 + pi * 0.2, 0]}>
                  <boxGeometry args={[2.1, 0.18, 1.8]} />
                  <meshLambertMaterial color="#7a5c1a" />
                </mesh>
              ))}
              {/* Fork entry stringers visible from side */}
              {([-0.55, 0.55] as const).map((fb, fi) => (
                <mesh key={fi} position={[fb, 0.07, 0]}>
                  <boxGeometry args={[0.14, 0.14, 1.8]} />
                  <meshLambertMaterial color="#6b4c15" />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// ── Industrial dock ventilation fans ─────────────────────────────────────────
// Large floor-standing fans on wheeled bases, placed near dock doors for air
// circulation. Positioned against side walls clear of all equipment routes.
function DockFans() {
  // Flush against side walls (inner face at ±73.75; base half-x = 0.825 at scale 1.5)
  const positions: Array<[number, number]> = [
    [-73, -34], // west side, receiving
    [+73, -30], // east side, receiving
    [+73, +30], // east side, shipping
  ];
  return (
    <group>
      {positions.map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]} scale={[1.5, 1.5, 1.5]}>
          {/* Wheeled base */}
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[1.1, 0.7, 0.9]} />
            <meshStandardMaterial color="#374151" roughness={0.65} metalness={0.5} />
          </mesh>
          {/* Caster wheels */}
          {([-0.4, 0.4] as const).map((xw, wi) => (
            <mesh key={wi} position={[xw, 0.14, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.12, 10]} />
              <meshStandardMaterial color="#1f2937" roughness={0.9} />
            </mesh>
          ))}
          {/* Vertical stand pole */}
          <mesh position={[0, 1.9, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.4, 8]} />
            <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Fan guard ring */}
          <mesh position={[0, 3.1, 0]}>
            <torusGeometry args={[0.88, 0.1, 8, 24]} />
            <meshStandardMaterial color="#374151" metalness={0.55} roughness={0.4} />
          </mesh>
          {/* Fan blades — 4 blades in X-Y plane */}
          {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((ang, bi) => (
            <mesh
              key={bi}
              position={[Math.cos(ang) * 0.38, 3.1 + Math.sin(ang) * 0.38, 0]}
              rotation={[0, 0, ang + Math.PI / 4]}>
              <boxGeometry args={[0.14, 0.72, 0.05]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
          {/* Tilt head knob */}
          <mesh position={[0, 3.1, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Safety yellow stripe on base */}
          <mesh position={[0, 0.71, 0]}>
            <boxGeometry args={[1.14, 0.1, 0.94]} />
            <meshStandardMaterial color={LINE_COLOR} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Cardboard baler / compactor ───────────────────────────────────────────────
// Recycling compactor near dock walls — takes in cardboard boxes, outputs
// compressed bales. Placed between dock doors against the south/north walls.
// Positions confirmed clear of all equipment routes (all equipment max z=±29).
function CardboardBaler() {
  // pz = ±37.4 places baler body back face flush with wall inner face (±38.75)
  const positions: Array<[number, number]> = [
    [+45, -37.4], // receiving east — east of door 3 (x=+8), east of FL2 range (x≤+28)
    [-42, +37.4], // shipping west — west of door 1 (x=-30), east of ControlBooth (x≥-62)
  ];
  return (
    <group>
      {positions.map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]} scale={[1.5, 1.5, 1.5]}>
          {/* Main machine body */}
          <mesh position={[0, 2.6, 0]}>
            <boxGeometry args={[2.6, 5.2, 1.8]} />
            <meshStandardMaterial color="#374151" roughness={0.65} metalness={0.45} />
          </mesh>
          {/* Feed chute opening at top */}
          <mesh position={[0, 5.1, 0.95]}>
            <boxGeometry args={[1.8, 1.4, 0.1]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
          {/* Chute funnel lip */}
          <mesh position={[0, 5.8, 0.88]}>
            <boxGeometry args={[2.2, 0.25, 0.4]} />
            <meshStandardMaterial color="#4b5563" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Bale exit door at bottom-front */}
          <mesh position={[0, 1.0, 0.95]}>
            <boxGeometry args={[2.0, 1.6, 0.1]} />
            <meshStandardMaterial color="#6b7280" roughness={0.6} metalness={0.4} />
          </mesh>
          {/* Compressed cardboard bale sitting outside */}
          <mesh position={[0, 0.9, 1.8]}>
            <boxGeometry args={[1.7, 1.4, 1.0]} />
            <meshStandardMaterial color="#c8924a" roughness={0.95} />
          </mesh>
          {/* Baling wire straps on bale */}
          {([-0.5, 0.5] as const).map((bx, bi) => (
            <mesh key={bi} position={[bx, 0.9, 1.8]}>
              <boxGeometry args={[0.06, 1.42, 1.04]} />
              <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.4} />
            </mesh>
          ))}
          {/* Yellow hazard stripe base */}
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[2.64, 0.3, 1.84]} />
            <meshStandardMaterial color={LINE_COLOR} roughness={0.5} />
          </mesh>
          {/* Control panel on side */}
          <mesh position={[1.35, 3.2, 0.2]}>
            <boxGeometry args={[0.1, 1.1, 0.75]} />
            <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[1.36, 3.2, 0.2]}>
            <boxGeometry args={[0.04, 0.9, 0.6]} />
            <meshStandardMaterial color="#bfdbfe" emissive="#bfdbfe" emissiveIntensity={0.3} />
          </mesh>
          {/* Emergency stop button (red) */}
          <mesh position={[1.36, 3.8, 0.2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 10]} />
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.4} />
          </mesh>
          {/* "RECYCLE" signage on machine */}
          <mesh position={[0, 4.4, 0.96]}>
            <boxGeometry args={[1.8, 0.55, 0.08]} />
            <meshStandardMaterial color="#16a34a" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Instanced Rack Boxes (400 individual draw calls → 4) ─────────────────────
function StaticRackBoxes() {
  const levelH = RACK_H / RACK_LEVELS;  // 2.6 — same for main and shipping buffer racks
  const boxArgs: [number, number, number] = [RACK_W - 0.28, levelH * 0.74, BAY_SPACING - 0.4];
  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const colorGroups = useMemo(() => {
    const groups: [number, number, number][][] = BOX_COLORS.map(() => []);
    // Main racks
    for (const rackX of RACK_ROWS) {
      for (let bi = 0; bi < BAY_FRAMES - 1; bi++) {
        for (let li = 0; li < RACK_LEVELS; li++) {
          if (_dynSlotSet.has(`${rackX}:${bi}:${li}`)) continue;
          if ((((bi * 7 + li * 11 + rackX * 3) % 10 + 10) % 10) <= 1) continue;
          groups[(bi + li) % BOX_COLORS.length].push([
            rackX,
            li * levelH + levelH * 0.48,
            Z_STORAGE_S + bi * BAY_SPACING + BAY_SPACING / 2,
          ]);
        }
      }
    }
    // Shipping buffer racks (same box geometry and levelH)
    for (const rackX of SHIP_RACK_X) {
      for (let bi = 0; bi < SHIP_BAY_FRAMES - 1; bi++) {
        for (let li = 0; li < SHIP_LEVELS; li++) {
          if ((((bi * 7 + li * 11 + rackX * 3) % 10 + 10) % 10) <= 1) continue;
          groups[(bi + li) % BOX_COLORS.length].push([
            rackX,
            li * levelH + levelH * 0.48,
            SHIP_Z_S + bi * BAY_SPACING + BAY_SPACING / 2,
          ]);
        }
      }
    }
    return groups;
  }, []);

  useLayoutEffect(() => {
    const mat = new THREE.Matrix4();
    colorGroups.forEach((positions, ci) => {
      const mesh = meshRefs.current[ci];
      if (!mesh) return;
      positions.forEach((pos, i) => {
        mat.makeTranslation(pos[0], pos[1], pos[2]);
        mesh.setMatrixAt(i, mat);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {BOX_COLORS.map((color, ci) =>
        colorGroups[ci].length > 0 ? (
          <instancedMesh
            key={ci}
            ref={el => { meshRefs.current[ci] = el; }}
            args={[undefined, undefined, colorGroups[ci].length]}
            frustumCulled={false}
          >
            <boxGeometry args={boxArgs} />
            <meshLambertMaterial color={color} />
          </instancedMesh>
        ) : null
      )}
    </>
  );
}

// ── Instanced Empty Pallet Boards (~96 draw calls → 2) ───────────────────────
function InstancedEmptyPallets() {
  const boardRef    = useRef<THREE.InstancedMesh>(null);
  const stringerRef = useRef<THREE.InstancedMesh>(null);

  const { boards, stringers } = useMemo(() => {
    const boards:    [number, number, number][] = [];
    const stringers: [number, number, number][] = [];
    // z = ±37.85 places pallet board face flush with wall inner face (±38.75)
    const stacks: Array<{ x: number; z: number; count: number }> = [
      { x: -35, z: -37.85, count: 13 },
      { x:  30, z: -37.85, count: 11 },
      { x: -15, z: +37.85, count: 12 },
      { x:  30, z: +37.85, count: 14 },
    ];
    for (const { x: sx, z: sz, count } of stacks) {
      for (let ti = 0; ti < 2; ti++) {
        const xOff = ti * 2.4;
        const cnt  = count - ti * 2;
        for (let pi = 0; pi < cnt; pi++) {
          boards.push([sx + xOff, 0.11 + pi * 0.2, sz]);
        }
        stringers.push([sx + xOff - 0.55, 0.07, sz]);
        stringers.push([sx + xOff + 0.55, 0.07, sz]);
      }
    }
    return { boards, stringers };
  }, []);

  useLayoutEffect(() => {
    const mat = new THREE.Matrix4();
    if (boardRef.current) {
      boards.forEach((pos, i) => {
        mat.makeTranslation(pos[0], pos[1], pos[2]);
        boardRef.current!.setMatrixAt(i, mat);
      });
      boardRef.current.instanceMatrix.needsUpdate = true;
    }
    if (stringerRef.current) {
      stringers.forEach((pos, i) => {
        mat.makeTranslation(pos[0], pos[1], pos[2]);
        stringerRef.current!.setMatrixAt(i, mat);
      });
      stringerRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <instancedMesh ref={boardRef} args={[undefined, undefined, boards.length]} frustumCulled={false}>
        <boxGeometry args={[2.1, 0.18, 1.8]} />
        <meshLambertMaterial color="#7a5c1a" />
      </instancedMesh>
      <instancedMesh ref={stringerRef} args={[undefined, undefined, stringers.length]} frustumCulled={false}>
        <boxGeometry args={[0.14, 0.14, 1.8]} />
        <meshLambertMaterial color="#6b4c15" />
      </instancedMesh>
    </>
  );
}

// ── Instanced Rack Structure (~390 draw calls → 6) ───────────────────────────
// Step beam y = li * levelH + levelH * 0.11 − 0.05 places the beam top flush
// with the box bottom (boxes are centered at li * levelH + levelH * 0.48,
// half-height levelH * 0.37, so bottom = li * levelH + levelH * 0.11).
function InstancedRackStructure() {
  const mainUprightRef  = useRef<THREE.InstancedMesh>(null);
  const mainBeamRef     = useRef<THREE.InstancedMesh>(null);
  const mainStepRef     = useRef<THREE.InstancedMesh>(null);
  const shipUprightRef  = useRef<THREE.InstancedMesh>(null);
  const shipBeamRef     = useRef<THREE.InstancedMesh>(null);
  const shipStepRef     = useRef<THREE.InstancedMesh>(null);

  const levelH     = RACK_H / RACK_LEVELS;
  const shipLevelH = SHIP_RACK_H / SHIP_LEVELS;

  const { mainUprights, mainBeams, mainSteps, shipUprights, shipBeams, shipSteps } = useMemo(() => {
    const mainUprights: [number, number, number][] = [];
    const mainBeams:    [number, number, number][] = [];
    const mainSteps:    [number, number, number][] = [];
    const shipUprights: [number, number, number][] = [];
    const shipBeams:    [number, number, number][] = [];
    const shipSteps:    [number, number, number][] = [];

    for (const rx of RACK_ROWS) {
      for (let fi = 0; fi < BAY_FRAMES; fi++) {
        mainUprights.push([rx - RACK_W / 2, RACK_H / 2, Z_STORAGE_S + fi * BAY_SPACING]);
        mainUprights.push([rx + RACK_W / 2, RACK_H / 2, Z_STORAGE_S + fi * BAY_SPACING]);
        // Step beams at levels 1..RACK_LEVELS (skip ground — boxes there rest on floor)
        for (let li = 1; li <= RACK_LEVELS; li++) {
          const beamY = li * levelH + levelH * 0.11 - 0.05;
          mainSteps.push([rx, beamY, Z_STORAGE_S + fi * BAY_SPACING]);
        }
      }
      for (let li = 0; li <= RACK_LEVELS; li++) {
        mainBeams.push([rx - RACK_W / 2, li * levelH, Z_STORAGE_S + RACK_D / 2]);
        mainBeams.push([rx + RACK_W / 2, li * levelH, Z_STORAGE_S + RACK_D / 2]);
      }
    }
    for (const rx of SHIP_RACK_X) {
      for (let fi = 0; fi < SHIP_BAY_FRAMES; fi++) {
        shipUprights.push([rx - RACK_W / 2, SHIP_RACK_H / 2, SHIP_Z_S + fi * BAY_SPACING]);
        shipUprights.push([rx + RACK_W / 2, SHIP_RACK_H / 2, SHIP_Z_S + fi * BAY_SPACING]);
        for (let li = 1; li <= SHIP_LEVELS; li++) {
          const beamY = li * shipLevelH + shipLevelH * 0.11 - 0.05;
          shipSteps.push([rx, beamY, SHIP_Z_S + fi * BAY_SPACING]);
        }
      }
      for (let li = 0; li <= SHIP_LEVELS; li++) {
        shipBeams.push([rx - RACK_W / 2, li * shipLevelH, SHIP_Z_S + SHIP_RACK_D / 2]);
        shipBeams.push([rx + RACK_W / 2, li * shipLevelH, SHIP_Z_S + SHIP_RACK_D / 2]);
      }
    }
    return { mainUprights, mainBeams, mainSteps, shipUprights, shipBeams, shipSteps };
  }, [levelH, shipLevelH]);

  useLayoutEffect(() => {
    const mat = new THREE.Matrix4();
    const fill = (ref: React.RefObject<THREE.InstancedMesh | null>, pts: [number, number, number][]) => {
      const m = ref.current; if (!m) return;
      pts.forEach((p, i) => { mat.makeTranslation(p[0], p[1], p[2]); m.setMatrixAt(i, mat); });
      m.instanceMatrix.needsUpdate = true;
    };
    fill(mainUprightRef, mainUprights);
    fill(mainBeamRef,    mainBeams);
    fill(mainStepRef,    mainSteps);
    fill(shipUprightRef, shipUprights);
    fill(shipBeamRef,    shipBeams);
    fill(shipStepRef,    shipSteps);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <instancedMesh ref={mainUprightRef} args={[undefined, undefined, mainUprights.length]} frustumCulled={false}>
        <boxGeometry args={[0.1, RACK_H, 0.1]} />
        <meshLambertMaterial color={UPRIGHT} />
      </instancedMesh>
      <instancedMesh ref={mainBeamRef} args={[undefined, undefined, mainBeams.length]} frustumCulled={false}>
        <boxGeometry args={[0.08, 0.09, RACK_D]} />
        <meshLambertMaterial color={BEAM_COLOR} />
      </instancedMesh>
      {/* Orange step beams: horizontal cross-members boxes rest on (1 per level per frame) */}
      <instancedMesh ref={mainStepRef} args={[undefined, undefined, mainSteps.length]} frustumCulled={false}>
        <boxGeometry args={[RACK_W, 0.1, 0.12]} />
        <meshLambertMaterial color={BEAM_COLOR} />
      </instancedMesh>
      <instancedMesh ref={shipUprightRef} args={[undefined, undefined, shipUprights.length]} frustumCulled={false}>
        <boxGeometry args={[0.1, SHIP_RACK_H, 0.1]} />
        <meshLambertMaterial color={UPRIGHT} />
      </instancedMesh>
      <instancedMesh ref={shipBeamRef} args={[undefined, undefined, shipBeams.length]} frustumCulled={false}>
        <boxGeometry args={[0.08, 0.09, SHIP_RACK_D]} />
        <meshLambertMaterial color={BEAM_COLOR} />
      </instancedMesh>
      <instancedMesh ref={shipStepRef} args={[undefined, undefined, shipSteps.length]} frustumCulled={false}>
        <boxGeometry args={[RACK_W, 0.1, 0.12]} />
        <meshLambertMaterial color={BEAM_COLOR} />
      </instancedMesh>
    </>
  );
}

// ── Public component ─────────────────────────────────────────────────────────
// ── Personnel Door ────────────────────────────────────────────────────────────
// Worker entry/exit on the east side wall (x=+73.75, z=+5).
// Visual door frame cut into the wall at this position.
function PersonnelDoor() {
  const doorW = 1.6, doorH = 2.4, x = 73.5, z = 5;
  return (
    <group position={[x, 0, z]}>
      {/* Dark opening (simulates wall cutout) */}
      <mesh position={[0, doorH / 2, 0]}>
        <boxGeometry args={[0.6, doorH, doorW]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Frame jambs */}
      {([-doorW / 2 - 0.2, doorW / 2 + 0.2] as const).map((zo, i) => (
        <mesh key={i} position={[0, doorH / 2, zo]}>
          <boxGeometry args={[0.55, doorH + 0.1, 0.3]} />
          <meshStandardMaterial color="#7a7a7a" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* Lintel */}
      <mesh position={[0, doorH + 0.15, 0]}>
        <boxGeometry args={[0.55, 0.3, doorW + 0.5]} />
        <meshStandardMaterial color="#7a7a7a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Green entry LED strip */}
      <mesh position={[0, doorH + 0.35, 0]}>
        <boxGeometry args={[0.12, 0.12, doorW - 0.2]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2.5} />
      </mesh>
      {/* Floor arrow — green arrow stripe pointing into warehouse */}
      <mesh position={[-1.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 0.5]} />
        <meshStandardMaterial color="#22c55e" opacity={0.7} transparent />
      </mesh>
    </group>
  );
}

export function WarehouseFloor() {
  return (
    <group>
      {/* Interior floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[152, 82]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.85} metalness={0.03} />
      </mesh>

      {/* Exterior yard (lighter asphalt) */}
      {[{ z: -57, d: 22 }, { z: 57, d: 22 }].map((y, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, y.z]}>
          <planeGeometry args={[170, y.d]} />
          <meshStandardMaterial color="#b8b4ac" roughness={0.92} />
        </mesh>
      ))}

      {/* Zone overlays — colored panels + labels */}
      <ZoneOverlays />

      {/* Floor joint lines (concrete slab pattern) */}
      <FloorJoints />

      {/* Yellow safety stripes on aisles */}
      <AisleLines />

      {/* Rack structure — uprights + beams instanced (was ~390 draw calls) */}
      <InstancedRackStructure />

      {/* Walls with dock doors */}
      <Walls />

      {/* Dock leveler platforms */}
      <DockLevelers wall="south" doors={RECV_DOORS} />
      <DockLevelers wall="north" doors={SHIP_DOORS} />

      {/* Permanent dock bay markings — visible even when no truck is present */}
      <DockBayMarkings />

      {/* Trucks rendered by TruckSystem in WarehouseScene */}

      <StaticRackBoxes />
      <InstancedEmptyPallets />

      <StagingPallets />
      <ChargingStations />
      <WrapStations />
      <SafetyStations />
      <ControlBooth />
      <ReceivingDesk />
      <QAInspectionTable />
      <ConveyorSegment />
      <WeighManifestStation />
      <PackagingSupplyRack />
      <DockFans />
      <CardboardBaler />
      <PersonnelDoor />

    </group>
  );
}

// ── Shipping Buffer Rack (forward-pick zone near docks) ───────────────────────
// Only placed at far-west (x≤-45) and far-east (x≥+56) columns where no
// equipment routes travel in the shipping zone (z=+13 to +28).
const SHIP_Z_S      = 13;
const SHIP_Z_N      = 28;
const SHIP_RACK_D   = SHIP_Z_N - SHIP_Z_S;          // 15
const SHIP_BAY_FRAMES = Math.round(SHIP_RACK_D / BAY_SPACING) + 1;  // 5
const SHIP_LEVELS   = 3;
const SHIP_RACK_H   = SHIP_LEVELS * (RACK_H / RACK_LEVELS);         // 7.8

// Safe x columns: far west ≤ -45, far east ≥ +56 (no E-W routes cross here in shipping zone)
const SHIP_RACK_X: number[] = [-59, -49, -42, 56, 60];



// ── Yellow Safety Lines ───────────────────────────────────────────────────────
function AisleLines() {
  const aisles = [-54, -38, 0, 28, 49];
  return (
    <group>
      {aisles.map(ax => (
        <group key={ax}>
          {([-1.6, 1.6] as const).map((off, i) => (
            <mesh key={i} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[ax + off, 0.02, -5]}>
              <planeGeometry args={[0.22, 62]} />
              <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.85} depthWrite={false}
                polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Cross-aisle lines — full warehouse width */}
      {([-1.2, 1.2] as const).map((off, i) => (
        <mesh key={`ca-${i}`} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 11 + off * 2]}>
          <planeGeometry args={[120, 0.22]} />
          <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.85} depthWrite={false}
            polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}
      {/* Dashed center chevrons */}
      {Array.from({ length: 28 }, (_, i) => (
        <mesh key={`dash-${i}`} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[-66 + i * 5, 0.02, 11]}>
          <planeGeometry args={[3, 0.14]} />
          <meshBasicMaterial color={LINE_COLOR} transparent opacity={0.6} depthWrite={false}
            polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}
    </group>
  );
}

// ── Floor Joints (concrete slab pattern) ─────────────────────────────────────
function FloorJoints() {
  const joints: { x: number; z: number; rot: boolean }[] = [];
  for (let x = -66; x <= 66; x += 15) joints.push({ x, z: 0, rot: false });
  for (let z = -35; z <= 35; z += 15) joints.push({ x: 0, z, rot: true });
  return (
    <group>
      {joints.map((j, i) => (
        <mesh key={i} renderOrder={1} rotation={[-Math.PI / 2, 0, j.rot ? Math.PI / 2 : 0]} position={[j.x, 0.005, j.z]}>
          <planeGeometry args={[0.08, 84]} />
          <meshBasicMaterial color="#b4b0a6" transparent opacity={0.5} depthWrite={false}
            polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      ))}
    </group>
  );
}

// ── Structural Columns ────────────────────────────────────────────────────────
// ── Walls ─────────────────────────────────────────────────────────────────────
function Walls() {
  const hw = 74;
  const hd = 39;
  return (
    <group>
      <WallWithDoors z={-hd} doors={RECV_DOORS} />
      <WallWithDoors z={+hd} doors={SHIP_DOORS} />
      {/* Side walls */}
      {([-hw, hw] as const).map((x, i) => (
        <mesh key={i} position={[x, WALL_H / 2, 0]}>
          <boxGeometry args={[0.5, WALL_H, hd * 2]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.88} />
        </mesh>
      ))}
      {/* Roof edge cap */}
      {([-hw, hw] as const).map((x, i) => (
        <mesh key={`cap-${i}`} position={[x, WALL_H, 0]}>
          <boxGeometry args={[0.8, 0.3, hd * 2 + 0.5]} />
          <meshStandardMaterial color="#c8c4bc" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function WallWithDoors({ z, doors }: { z: number; doors: number[] }) {
  const hw = 74;
  const sorted = [-hw, ...doors.flatMap(d => [d - DOOR_W / 2, d + DOOR_W / 2]), hw].sort((a, b) => a - b);
  const slabs: { cx: number; w: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const l = sorted[i], r = sorted[i + 1];
    const isDoor = doors.some(d => Math.abs((l + r) / 2 - d) < DOOR_W / 2 + 0.1);
    if (!isDoor) slabs.push({ cx: (l + r) / 2, w: r - l });
  }
  return (
    <group>
      {slabs.map((s, i) => (
        <mesh key={i} position={[s.cx, WALL_H / 2, z]}>
          <boxGeometry args={[s.w, WALL_H, 0.5]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.88} />
        </mesh>
      ))}
      {/* Wall cap */}
      <mesh position={[0, WALL_H, z]}>
        <boxGeometry args={[hw * 2, 0.3, 0.8]} />
        <meshStandardMaterial color="#c8c4bc" roughness={0.7} />
      </mesh>
      {/* Door frames */}
      {doors.map((d, i) => (
        <group key={`df-${i}`} position={[d, 0, z]}>
          {/* Top lintel */}
          <mesh position={[0, DOOR_H + 0.3, 0]}>
            <boxGeometry args={[DOOR_W + 0.6, 0.5, 0.7]} />
            <meshStandardMaterial color="#bfbbb3" roughness={0.7} />
          </mesh>
          {/* Side posts */}
          {([-DOOR_W / 2, DOOR_W / 2] as const).map((ox, j) => (
            <mesh key={j} position={[ox, DOOR_H / 2, 0]}>
              <boxGeometry args={[0.35, DOOR_H, 0.7]} />
              <meshStandardMaterial color="#bfbbb3" roughness={0.7} />
            </mesh>
          ))}
          {/* Door opening (interior darkness) */}
          <mesh position={[0, DOOR_H / 2, 0]}>
            <boxGeometry args={[DOOR_W - 0.1, DOOR_H, 0.12]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          {/* Dock seal strip */}
          <mesh position={[0, DOOR_H / 2, z > 0 ? -0.42 : 0.42]}>
            <boxGeometry args={[DOOR_W + 0.3, DOOR_H + 0.3, 0.1]} />
            <meshStandardMaterial color="#444" roughness={0.98} transparent opacity={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Dock Levelers ─────────────────────────────────────────────────────────────
function DockLevelers({ wall, doors }: { wall: 'south' | 'north'; doors: number[] }) {
  const zSign = wall === 'south' ? -1 : 1;
  const zBase = zSign * 39;
  return (
    <>
      {doors.map((x, i) => (
        <group key={i} position={[x, 0.22, zBase + zSign * 1.8]}>
          <mesh>
            <boxGeometry args={[DOOR_W - 0.5, 0.2, 3.5]} />
            <meshStandardMaterial color="#a8a49c" roughness={0.65} metalness={0.35} />
          </mesh>
          {/* Yellow bumper stripes */}
          {([-1.2, 0, 1.2] as const).map((o, j) => (
            <mesh key={j} position={[0, 0.12, o]}>
              <boxGeometry args={[DOOR_W - 0.6, 0.06, 0.22]} />
              <meshStandardMaterial color={LINE_COLOR} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

// ── Truck Model ───────────────────────────────────────────────────────────────
export interface TruckProps { x: number; z: number; facingNorth: boolean; loadPct?: number; truckType?: 'recv' | 'ship' }
export function TruckModel({ x, z, facingNorth, loadPct = 0, truckType }: TruckProps) {
  // Receiving trucks = green stripe on trailer, shipping trucks = blue stripe
  const trailerAccent = truckType === 'recv' ? '#2d7a3a' : truckType === 'ship' ? '#1e4d8c' : undefined;
  const dir = facingNorth ? 1 : -1;
  // Wheels r=0.75 → diameter 1.5. Trailer h=6.0 → half=3.0. Body bottom at 1.4 → center at 4.4.
  const TY       = 4.4;           // trailer body center Y
  const CY       = 4.0;           // cab body center Y (sits flush with chassis)
  const trailerZ = z + dir * 10;  // trailer center (18-unit trailer needs more reach)
  const cabZ     = z + dir * 22;  // cab beyond trailer front
  return (
    <group>
      {/* Trailer body — 5.2 wide × 6.0 tall × 18 long */}
      <mesh position={[x, TY, trailerZ]}>
        <boxGeometry args={[5.2, 6.0, 18]} />
        <meshStandardMaterial color={TRUCK_WHITE} roughness={0.7} metalness={0.12} />
      </mesh>
      {/* Trailer roof cap */}
      <mesh position={[x, TY + 3.1, trailerZ]}>
        <boxGeometry args={[5.4, 0.25, 18.4]} />
        <meshStandardMaterial color="#d0cdc8" roughness={0.75} />
      </mesh>
      {/* Color stripe: green for inbound (recv), blue for outbound (ship) */}
      {trailerAccent && (
        <mesh position={[x, TY - 1.8, trailerZ]}>
          <boxGeometry args={[5.22, 0.55, 18.05]} />
          <meshStandardMaterial color={trailerAccent} roughness={0.6} metalness={0.1} />
        </mesh>
      )}
      {/* Structural ribs */}
      {[-6.5, -2.5, 1.5, 5.5].map((zOff, i) => (
        <mesh key={i} position={[x, TY, trailerZ + zOff]}>
          <boxGeometry args={[5.25, 6.2, 0.12]} />
          <meshStandardMaterial color="#c0bdb8" metalness={0.2} roughness={0.7} />
        </mesh>
      ))}
      {/* Rear doors */}
      <mesh position={[x, TY, trailerZ - dir * 9.1]}>
        <boxGeometry args={[5.0, 5.8, 0.2]} />
        <meshStandardMaterial color="#cac7c2" roughness={0.8} />
      </mesh>
      {/* Cab — 5.0 wide × 5.5 tall × 7.0 long */}
      <mesh position={[x, CY, cabZ]}>
        <boxGeometry args={[5.0, 5.5, 7.0]} />
        <meshStandardMaterial color={TRUCK_CAB} roughness={0.65} metalness={0.22} />
      </mesh>
      {/* Windshield */}
      <mesh position={[x, CY + 1.2, cabZ + dir * 3.6]}>
        <boxGeometry args={[4.0, 2.6, 0.12]} />
        <meshStandardMaterial color="#4a5a6a" metalness={0.7} roughness={0.1} transparent opacity={0.8} />
      </mesh>
      {/* Chrome bumper */}
      <mesh position={[x, 1.2, cabZ + dir * 3.6]}>
        <boxGeometry args={[5.1, 0.55, 0.28]} />
        <meshStandardMaterial color="#a8a8a8" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Wheels — r=0.75, sitting at y=0.75 */}
      {([-2.2, 2.2] as const).map((xOff, i) =>
        [trailerZ - 6, trailerZ + 6, cabZ - dir * 2].map((zOff, j) => (
          <mesh key={`${i}-${j}`} position={[x + xOff, 0.75, zOff]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.75, 0.75, 0.62, 20]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
          </mesh>
        ))
      )}
      {/* Headlights removed — 12 point lights per frame was too expensive */}
      {/* Load indicator bar on trailer side */}
      <mesh position={[x + 2.7, TY, trailerZ]}>
        <boxGeometry args={[0.09, 5.8, 17.6]} />
        <meshStandardMaterial color="#d0d0cc" roughness={0.8} />
      </mesh>
      {loadPct > 0 && (
        <mesh position={[x + 2.75, TY - 2.9 * (1 - loadPct), trailerZ]}>
          <boxGeometry args={[0.10, 5.8 * loadPct, 17.6]} />
          <meshStandardMaterial color={loadPct > 0.7 ? '#e85c1a' : '#22c55e'} emissive={loadPct > 0.7 ? '#e85c1a' : '#22c55e'} emissiveIntensity={0.3} />
        </mesh>
      )}
    </group>
  );
}
