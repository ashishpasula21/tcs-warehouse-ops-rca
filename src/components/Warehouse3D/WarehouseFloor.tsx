// Industrial warehouse — FlexSim/AnyLogic-quality visuals
// Light concrete floor, tall pallet racking with orange beams, yellow safety lines, white trucks
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

const RACK_ROWS: number[] = [-63, -59, -49, -45, -28, -22, 12, 17, 37, 42, 56, 60];

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
  { rackX: -45, bi: 1, li: 0 }, { rackX: -45, bi: 3, li: 0 }, { rackX: -45, bi: 5, li: 0 },
  { rackX: -28, bi: 1, li: 0 }, { rackX: -28, bi: 3, li: 0 }, { rackX: -28, bi: 5, li: 0 },
  // Zone D — aisle x=+28 — FL-2 inbound deposits
  { rackX: 17,  bi: 1, li: 0 }, { rackX: 17,  bi: 3, li: 0 }, { rackX: 17,  bi: 5, li: 0 },
  { rackX: 37,  bi: 1, li: 0 }, { rackX: 37,  bi: 3, li: 0 }, { rackX: 37,  bi: 5, li: 0 },
  // Zone E — aisle x=+49 — FL-4 outbound picks
  { rackX: 42,  bi: 1, li: 0 }, { rackX: 42,  bi: 3, li: 0 }, { rackX: 42,  bi: 5, li: 0 },
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
      <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} roughness={1} metalness={0} />
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
      <meshStandardMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
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
      <ZonePanel cx={0}       cz={-30.5} width={152}  depth={17}  color="#3b82f6" opacity={0.12} />
      <ZonePanel cx={-60}     cz={-7}    width={28}   depth={30}  color="#f97316" opacity={0.14} />
      <ZonePanel cx={-32.5}   cz={-7}    width={27}   depth={30}  color="#fb923c" opacity={0.11} />
      <ZonePanel cx={-2.5}    cz={-7}    width={33}   depth={30}  color="#22c55e" opacity={0.11} />
      <ZonePanel cx={+26.25}  cz={-7}    width={24.5} depth={30}  color="#a855f7" opacity={0.12} />
      <ZonePanel cx={+56.25}  cz={-7}    width={35.5} depth={30}  color="#06b6d4" opacity={0.13} />
      <ZonePanel cx={0}       cz={23.5}  width={152}  depth={31}  color="#eab308" opacity={0.11} />

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

      <Text position={[-54, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#9a3412" anchorX="center" anchorY="middle" renderOrder={5}>ZONE A</Text>
      <Text position={[-54, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#c2410c" anchorX="center" anchorY="middle" renderOrder={5}>Far West</Text>

      <Text position={[-38, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#92400e" anchorX="center" anchorY="middle" renderOrder={5}>ZONE B</Text>
      <Text position={[-38, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#b45309" anchorX="center" anchorY="middle" renderOrder={5}>West Storage</Text>

      <Text position={[0,   0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#14532d" anchorX="center" anchorY="middle" renderOrder={5}>ZONE C</Text>
      <Text position={[0,   0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#15803d" anchorX="center" anchorY="middle" renderOrder={5}>Center Storage</Text>

      <Text position={[+28, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#581c87" anchorX="center" anchorY="middle" renderOrder={5}>ZONE D</Text>
      <Text position={[+28, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#7e22ce" anchorX="center" anchorY="middle" renderOrder={5}>East Storage</Text>

      <Text position={[+49, 0.05, -25]}  rotation={[-Math.PI/2,0,0]} fontSize={2.2} color="#155e75" anchorX="center" anchorY="middle" renderOrder={5}>ZONE E</Text>
      <Text position={[+49, 0.05, -23]}  rotation={[-Math.PI/2,0,0]} fontSize={1.2} color="#0e7490" anchorX="center" anchorY="middle" renderOrder={5}>Far East</Text>

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
            <meshStandardMaterial color="#2a2a2a" transparent opacity={0.22} depthWrite={false} />
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
              <meshStandardMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false} />
            </mesh>
          ))}
          {/* Stop bar at back of bay */}
          <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.006, -62]}>
            <planeGeometry args={[6.8, 0.28]} />
            <meshStandardMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {SHIP_DOORS.map((x, i) => (
        <group key={`ship-bay-${i}`}>
          <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 37]}>
            <planeGeometry args={[5.8, 4]} />
            <meshStandardMaterial color="#2a2a2a" transparent opacity={0.22} depthWrite={false} />
          </mesh>
          <Text position={[x, 0.06, 37.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.5}
            color="#ffe040" anchorX="center" anchorY="middle" renderOrder={4}>
            {`S${i + 1}`}
          </Text>
          {([-3.1, 3.1] as const).map((ox, j) => (
            <mesh key={j} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x + ox, -0.006, 50]}>
              <planeGeometry args={[0.2, 24]} />
              <meshStandardMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false} />
            </mesh>
          ))}
          <mesh renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.006, 62]}>
            <planeGeometry args={[6.8, 0.28]} />
            <meshStandardMaterial color={LINE_COLOR} transparent opacity={0.55} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Public component ─────────────────────────────────────────────────────────
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

      {/* Rack rows */}
      {RACK_ROWS.map((x, i) => <RackRow key={i} x={x} />)}

      {/* Walls with dock doors */}
      <Walls />

      {/* Dock leveler platforms */}
      <DockLevelers wall="south" doors={RECV_DOORS} />
      <DockLevelers wall="north" doors={SHIP_DOORS} />

      {/* Permanent dock bay markings — visible even when no truck is present */}
      <DockBayMarkings />

      {/* Trucks rendered by TruckSystem in WarehouseScene */}
    </group>
  );
}

// ── Rack Row ─────────────────────────────────────────────────────────────────
function RackRow({ x }: { x: number }) {
  const levelH = RACK_H / RACK_LEVELS;
  const hasBox = (bi: number, li: number) =>
    !_dynSlotSet.has(`${x}:${bi}:${li}`) && ((bi * 7 + li * 11 + x * 3) % 10) > 2;
  const boxColor = (bi: number, li: number) => BOX_COLORS[(bi + li) % BOX_COLORS.length];

  return (
    <group position={[x, 0, Z_STORAGE_S]}>
      {/* Upright frames every BAY_SPACING along Z — posts only, no diagonals */}
      {Array.from({ length: BAY_FRAMES }, (_, fi) => {
        const zPos = fi * BAY_SPACING;
        return (
          <group key={`frame-${fi}`} position={[0, 0, zPos]}>
            {([-RACK_W / 2, RACK_W / 2] as const).map((xOff, pi) => (
              <mesh key={pi} position={[xOff, RACK_H / 2, 0]}>
                <boxGeometry args={[0.1, RACK_H, 0.1]} />
                <meshStandardMaterial color={UPRIGHT} metalness={0.7} roughness={0.3} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Orange horizontal beams at each level — run along full rack Z */}
      {Array.from({ length: RACK_LEVELS + 1 }, (_, li) => (
        <group key={`beams-${li}`} position={[0, li * levelH, RACK_D / 2]}>
          {([-RACK_W / 2, RACK_W / 2] as const).map((xOff, ri) => (
            <mesh key={ri} position={[xOff, 0, 0]}>
              <boxGeometry args={[0.08, 0.09, RACK_D]} />
              <meshStandardMaterial color={BEAM_COLOR} metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Cardboard boxes on each shelf bay */}
      {Array.from({ length: BAY_FRAMES - 1 }, (_, bi) =>
        Array.from({ length: RACK_LEVELS }, (_, li) =>
          hasBox(bi, li) ? (
            <mesh key={`box-${bi}-${li}`}
              position={[0, li * levelH + levelH * 0.48, bi * BAY_SPACING + BAY_SPACING / 2]}
             >
              <boxGeometry args={[RACK_W - 0.28, levelH * 0.74, BAY_SPACING - 0.4]} />
              <meshStandardMaterial color={boxColor(bi, li)} roughness={0.9} />
            </mesh>
          ) : null
        )
      )}
    </group>
  );
}

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
              <meshStandardMaterial color={LINE_COLOR} transparent opacity={0.85} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Cross-aisle lines — full warehouse width */}
      {([-1.2, 1.2] as const).map((off, i) => (
        <mesh key={`ca-${i}`} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 11 + off * 2]}>
          <planeGeometry args={[120, 0.22]} />
          <meshStandardMaterial color={LINE_COLOR} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
      {/* Dashed center chevrons */}
      {Array.from({ length: 28 }, (_, i) => (
        <mesh key={`dash-${i}`} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[-66 + i * 5, 0.02, 11]}>
          <planeGeometry args={[3, 0.14]} />
          <meshStandardMaterial color={LINE_COLOR} transparent opacity={0.6} depthWrite={false} />
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
          <meshStandardMaterial color="#b4b0a6" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Structural Columns ────────────────────────────────────────────────────────
function StructuralColumns() {
  const cols = [
    [-64, -28], [-64, 8], [-64, 28],
    [-45, -28], [-45,  8], [-45, 28],
    [0,   -28], [0,   28],
    [45,  -28], [45,   8], [45,  28],
    [64,  -28], [64,   8], [64,  28],
  ];
  return (
    <>
      {cols.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, WALL_H / 2, cz]}>
          <boxGeometry args={[0.7, WALL_H, 0.7]} />
          <meshStandardMaterial color="#bfbbaf" roughness={0.8} metalness={0.05} />
        </mesh>
      ))}
    </>
  );
}

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
export interface TruckProps { x: number; z: number; facingNorth: boolean; loadPct?: number }
export function TruckModel({ x, z, facingNorth, loadPct = 0 }: TruckProps) {
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
      {/* Headlights */}
      {([-1.6, 1.6] as const).map((xOff, k) => (
        <pointLight key={k} position={[x + xOff, 2.5, cabZ + dir * 3.8]} color="#ffe8a0" intensity={1.2} distance={16} />
      ))}
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
