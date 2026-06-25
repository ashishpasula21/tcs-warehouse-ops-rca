import { useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

export type Speed = 1 | 2 | 3 | 5 | 10 | 50;

export type LoadMode3D = 'baseline' | 'optimised';

// ── Trailer interior geometry ──────────────────────────────────────────────────
const TW  = 7.2;   // interior width
const TH  = 4.4;   // interior height
const TD  = 14.0;  // interior depth
const EXT = 0.35;  // wall/structural thickness

// ── Cab geometry ────────────────────────────────────────────────────────────────
const CAB_D  = 7.2;   // cab depth (front-to-back)
const CAB_W  = 7.8;   // cab width (slightly wider for aerodynamics)
const CAB_H  = 5.0;   // cab height
const HOOD_D = 2.8;   // hood / engine compartment depth

// ── Total truck z range:  0 (rear doors)  →  -(TD + CAB_D + HOOD_D) (bumper)
const CAB_START = -TD;                           // where cab begins (front of trailer)
const CAB_END   = -(TD + CAB_D);                 // front of cab body (start of hood)
const HOOD_END  = -(TD + CAB_D + HOOD_D);        // front of hood / bumper

// ── Column / depth grid ─────────────────────────────────────────────────────────
const COL_X  = [-2.70, -0.90, 0.90, 2.70] as const;
const SLAB_Z = [-1.0, -2.7, -4.4, -6.1, -7.8, -9.5, -11.2, -12.9] as const;

type BoxType = 'L' | 'M' | 'S';
type Cell    = BoxType | '';

const BOX_DIM: Record<BoxType, [number, number, number]> = {
  L: [1.66, 1.18, 1.50],
  M: [1.66, 0.96, 1.26],
  S: [1.66, 0.80, 1.02],
};

const BOX_COLOR: Record<BoxType, { body: string; top: string; edge: string }> = {
  L: { body: '#7a4f28', top: '#9a6530', edge: '#5a3a18' },
  M: { body: '#b8874b', top: '#c8924a', edge: '#8a6030' },
  S: { body: '#c8924a', top: '#d4a462', edge: '#a07038' },
};

const BASELINE_GRID: Cell[][][] = [
  [['L', 'M', 'S', 'L'], ['M', '',  'M', 'S'], ['S', 'L', '',  'M']],
  [['',  'L', 'M', 'S'], ['L', 'M', '',  'L'], ['',  'S', 'M', '' ]],
  [['M', 'S', 'L', '' ], ['S', '',  'L', 'M'], ['L', 'M', 'S', '' ]],
  [['L', '',  'S', 'M'], ['M', 'L', 'S', '' ], ['',  'M', '',  'L']],
  [['S', 'L', 'M', 'S'], ['',  'M', 'L', 'M'], ['L', '',  'S', '' ]],
  [['M', 'S', '',  'L'], ['L', '',  'M', 'S'], ['S', 'L', '',  'M']],
  [['L', 'M', 'S', '' ], ['',  'L', '',  'M'], ['M', '',  'L', 'S']],
  [['S', '',  'L', 'M'], ['M', 'S', '',  'L'], ['',  'L', 'S', '' ]],
];

const OPTIMISED_GRID: Cell[][][] = [
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
  [['L', 'L', 'L', 'L'], ['M', 'M', 'M', 'M'], ['S', 'S', 'S', 'S']],
];

function computeBoxPositions(grid: Cell[][][]) {
  const items: { pos: [number, number, number]; type: BoxType; delay: number }[] = [];
  let idx = 0;
  for (let s = 0; s < SLAB_Z.length; s++) {
    for (let c = 0; c < COL_X.length; c++) {
      let floorTop = 0;
      for (let r = 0; r < 3; r++) {
        const cell = grid[s][r][c];
        if (cell === '') continue;
        const type = cell as BoxType;
        const h    = BOX_DIM[type][1];
        items.push({ pos: [COL_X[c], floorTop + h / 2, SLAB_Z[s]], type, delay: idx * 0.07 });
        floorTop += h;
        idx++;
      }
    }
  }
  return items;
}

function computeFill3D(grid: Cell[][][]) {
  const total  = SLAB_Z.length * 3 * COL_X.length;
  const filled = grid.flat(2).filter(c => c !== '').length;
  return Math.round((filled / total) * 100);
}

// ── Single box with drop animation ────────────────────────────────────────────
function Box3D({
  targetPos, size, color, animate, delay,
}: {
  targetPos: [number, number, number];
  size: [number, number, number];
  color: { body: string; top: string; edge: string };
  animate: boolean;
  delay: number;
}) {
  const mesh  = useRef<THREE.Group>(null!);
  const prog  = useRef(animate ? 0 : 1);
  const ready = useRef(!animate);

  useEffect(() => {
    if (animate) {
      prog.current = 0; ready.current = false;
      const t = setTimeout(() => { ready.current = true; }, delay * 1000);
      return () => clearTimeout(t);
    } else {
      prog.current = 1; ready.current = true;
    }
  }, [animate, delay]);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const startY = targetPos[1] + 9;
    if (!ready.current) { mesh.current.position.y = startY; return; }
    if (prog.current < 1) {
      prog.current = Math.min(1, prog.current + dt * 2.4);
      const t = 1 - Math.pow(1 - prog.current, 3);
      mesh.current.position.y = startY + (targetPos[1] - startY) * t;
    } else {
      mesh.current.position.y = targetPos[1];
    }
  });

  const [w, h, d] = size;
  const initY = animate ? targetPos[1] + 9 : targetPos[1];
  return (
    <group ref={mesh} position={[targetPos[0], initY, targetPos[2]]} castShadow>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color.body} roughness={0.88} metalness={0.03} />
      </mesh>
      <mesh position={[0, h / 2 + 0.003, 0]}>
        <boxGeometry args={[w - 0.04, 0.012, d - 0.04]} />
        <meshStandardMaterial color={color.top} roughness={0.80} />
      </mesh>
      <mesh position={[0, h / 2 + 0.008, 0]}>
        <boxGeometry args={[w - 0.05, 0.016, 0.06]} />
        <meshStandardMaterial color="#c8b88a" roughness={0.7} />
      </mesh>
      <mesh position={[0, h / 2 + 0.008, 0]}>
        <boxGeometry args={[0.06, 0.016, d - 0.05]} />
        <meshStandardMaterial color="#c8b88a" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ── Trailer: glass side walls + detailed rear face ─────────────────────────────
function Trailer({ doorOpen = false }: { doorOpen?: boolean }) {
  const frameCol = '#1a2840';
  const extColor = '#111827';
  const glassCol = '#88bcd8';

  return (
    <group>
      {/* ── Interior floor ── */}
      <mesh receiveShadow position={[0, -EXT / 2, -TD / 2]}>
        <boxGeometry args={[TW, EXT, TD]} />
        <meshStandardMaterial color="#5c7a96" roughness={0.85} metalness={0.05} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 0.005, -(i + 0.5) * (TD / 9)]}>
          <boxGeometry args={[TW - 0.1, 0.01, 0.05]} />
          <meshStandardMaterial color="#4a6880" roughness={1} />
        </mesh>
      ))}

      {/* ── Ceiling ── */}
      <mesh position={[0, TH + EXT / 2, -TD / 2]}>
        <boxGeometry args={[TW + EXT * 2, EXT, TD + EXT]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, TH - 0.08, -(i + 1) * (TD / 7)]}>
          <boxGeometry args={[TW, 0.14, 0.22]} />
          <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* ── Very bright ceiling strip lights ── */}
      {[-3.5, -7.0, -10.5].map((z, i) => (
        <group key={i}>
          <mesh position={[0, TH - 0.06, z]}>
            <boxGeometry args={[TW - 0.8, 0.06, 2.0]} />
            <meshStandardMaterial color="#fffff0" emissive="#fff8d6" emissiveIntensity={4.0} />
          </mesh>
          <pointLight position={[0, TH - 0.3, z]} intensity={6} color="#fff5d0" distance={22} decay={1.2} />
        </group>
      ))}

      {/* ── Glass side walls with structural posts ── */}
      {([-1, 1] as const).map((side, si) => {
        const wx = side * (TW / 2 + EXT / 2);
        return (
          <group key={si}>
            {/* Full-length glass panel */}
            <mesh position={[wx, TH / 2, -TD / 2]} renderOrder={2}>
              <boxGeometry args={[0.04, TH, TD]} />
              <meshStandardMaterial
                color={glassCol}
                transparent={true}
                opacity={0.16}
                roughness={0.03}
                metalness={0.08}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Structural posts at four z positions */}
            {([0, -TD / 3, -(2 * TD) / 3, -TD] as const).map((z, pi) => (
              <mesh key={pi} position={[wx, TH / 2, z]}>
                <boxGeometry args={[EXT + 0.12, TH + EXT + 0.1, 0.28]} />
                <meshStandardMaterial color={frameCol} metalness={0.45} roughness={0.55} />
              </mesh>
            ))}
            {/* Top rail */}
            <mesh position={[wx, TH + EXT / 2 + 0.02, -TD / 2]}>
              <boxGeometry args={[EXT, EXT, TD + EXT * 2]} />
              <meshStandardMaterial color={frameCol} metalness={0.4} roughness={0.6} />
            </mesh>
            {/* Bottom sill */}
            <mesh position={[wx, -EXT / 2, -TD / 2]}>
              <boxGeometry args={[EXT, EXT, TD + EXT * 2]} />
              <meshStandardMaterial color={frameCol} metalness={0.4} roughness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* ── Back wall — front of trailer (connects to cab) ── */}
      <mesh position={[0, TH / 2, -TD - EXT / 2]}>
        <boxGeometry args={[TW + EXT * 2, TH + EXT, EXT]} />
        <meshStandardMaterial color={extColor} roughness={0.9} />
      </mesh>

      {/* ━━━ EXTERIOR REAR FACE (rear doors, tail lights, DOT tape) ━━━ */}

      {/* Side posts */}
      {([-1, 1] as const).map((side, i) => (
        <group key={i}>
          <mesh position={[side * (TW / 2 + EXT + 0.32), TH / 2 + 0.1, 0.32]}>
            <boxGeometry args={[0.58, TH + EXT * 2 + 0.7, 0.58]} />
            <meshStandardMaterial color={extColor} metalness={0.45} roughness={0.65} />
          </mesh>
          <mesh position={[side * (TW / 2 + EXT + 0.08), TH / 2, 0.24]}>
            <boxGeometry args={[0.12, TH + EXT * 2, 0.42]} />
            <meshStandardMaterial color="#1e2a3a" metalness={0.55} roughness={0.45} />
          </mesh>
        </group>
      ))}

      {/* Top header bar */}
      <mesh position={[0, TH + EXT + 0.32, 0.28]}>
        <boxGeometry args={[TW + EXT * 2 + 1.4, 0.65, 0.58]} />
        <meshStandardMaterial color={extColor} metalness={0.45} roughness={0.65} />
      </mesh>

      {/* Door panels — swing open when doorOpen=true */}
      {([-1, 1] as const).map((side, di) => {
        const doorW      = TW / 2 - 0.1;
        const hingeX     = side * TW / 2;
        // positive openAng for right door swings it behind truck; same for left but mirrored
        const openAng    = doorOpen ? side * Math.PI * 0.56 : 0;
        // door extends from hinge toward center (left door: +x, right door: -x)
        const meshOffset = -side * doorW / 2;
        return (
          <group key={di} position={[hingeX, TH / 2, 0.26]} rotation={[0, openAng, 0]}>
            <mesh position={[meshOffset, 0, 0]} renderOrder={2}>
              <boxGeometry args={[doorW, TH, 0.18]} />
              <meshStandardMaterial
                color="#88bcd8"
                transparent={true}
                opacity={doorOpen ? 0.5 : 0.16}
                roughness={0.03}
                metalness={0.08}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Door handle (local space) */}
            <mesh position={[meshOffset - side * 0.55, -0.75, 0.18]}>
              <boxGeometry args={[0.06, 0.28, 0.1]} />
              <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.15} />
            </mesh>
          </group>
        );
      })}

      {/* Center door split — only when closed */}
      {!doorOpen && (
        <mesh position={[0, TH / 2, 0.36]}>
          <boxGeometry args={[0.07, TH, 0.14]} />
          <meshStandardMaterial color="#0f1a2a" roughness={0.82} metalness={0.6} />
        </mesh>
      )}

      {/* Door hinges */}
      {([-1, 1] as const).map((side, i) =>
        ([0.55, TH / 2, TH - 0.55] as const).map((y, j) => (
          <mesh key={`${i}-${j}`} position={[side * (TW / 2 + EXT + 0.06), y, 0.38]}>
            <boxGeometry args={[0.1, 0.26, 0.24]} />
            <meshStandardMaterial color="#6b7280" metalness={0.85} roughness={0.18} />
          </mesh>
        ))
      )}

      {/* Tail lights */}
      {([-1, 1] as const).map((side, i) => (
        <group key={i} position={[side * (TW / 2 + EXT + 0.2), 0, 0]}>
          <mesh position={[0, TH - 0.72, 0.34]}>
            <boxGeometry args={[0.48, 1.0, 0.2]} />
            <meshStandardMaterial color="#111827" roughness={0.3} metalness={0.55} />
          </mesh>
          <mesh position={[0, TH - 0.52, 0.46]}>
            <boxGeometry args={[0.42, 0.52, 0.07]} />
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, TH - 1.0, 0.46]}>
            <boxGeometry args={[0.42, 0.26, 0.07]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, TH - 1.3, 0.46]}>
            <boxGeometry args={[0.42, 0.2, 0.07]} />
            <meshStandardMaterial color="#f1f5f9" emissive="#f1f5f9" emissiveIntensity={0.35} roughness={0.3} />
          </mesh>
          <pointLight position={[0, TH - 0.7, 0.55]} intensity={0.45} color="#dc2626" distance={3.5} />
        </group>
      ))}

      {/* DOT reflective tape — bottom rear */}
      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[(i - 8.5) * (TW / 18), 0.14, 0.36]}>
          <boxGeometry args={[TW / 18 - 0.025, 0.11, 0.05]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#dc2626' : '#f1f5f9'}
            emissive={i % 2 === 0 ? '#dc2626' : '#e2e8f0'}
            emissiveIntensity={0.28}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* ICC underride guard */}
      <mesh position={[0, -0.2, 0.42]}>
        <boxGeometry args={[TW + 0.7, 0.2, 0.34]} />
        <meshStandardMaterial color="#374151" metalness={0.88} roughness={0.14} />
      </mesh>
      {([-2.2, -0.7, 0.7, 2.2] as const).map((x, i) => (
        <mesh key={i} position={[x, -0.06, 0.38]}>
          <boxGeometry args={[0.14, 0.44, 0.24]} />
          <meshStandardMaterial color="#4b5563" metalness={0.78} roughness={0.22} />
        </mesh>
      ))}

      {/* Rubber dock bumpers */}
      {([-TW / 2 + 0.55, TW / 2 - 0.55] as const).map((x, i) => (
        <mesh key={i} position={[x, 0.82, 0.42]}>
          <boxGeometry args={[0.58, 1.18, 0.32]} />
          <meshStandardMaterial color="#1f2937" roughness={0.97} />
        </mesh>
      ))}

      {/* License plate */}
      <mesh position={[0, 0.62, 0.46]}>
        <boxGeometry args={[0.84, 0.44, 0.04]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.62, 0.49]}>
        <boxGeometry args={[0.78, 0.38, 0.01]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.5} />
      </mesh>
    </group>
  );
}

// ── Semi-truck cab with transparent glass ─────────────────────────────────────
function Cab() {
  const bodyCol   = '#1a2840';
  const accentCol = '#253050';
  const chromeCol = '#c8c8c8';
  const glassCol  = '#88bcd8';
  const cz        = (CAB_START + CAB_END) / 2;            // center z of cab body
  const hoodCz    = (CAB_END + HOOD_END) / 2;             // center z of hood
  const bumperZ   = HOOD_END - 0.2;

  return (
    <group>
      {/* ── Cab roof ── */}
      <mesh position={[0, CAB_H - 0.06, cz]}>
        <boxGeometry args={[CAB_W, 0.24, CAB_D + 0.15]} />
        <meshStandardMaterial color={bodyCol} roughness={0.55} metalness={0.3} />
      </mesh>

      {/* ── Cab floor / underframe ── */}
      <mesh position={[0, -0.22, cz]}>
        <boxGeometry args={[CAB_W + 0.15, 0.44, CAB_D + 0.2]} />
        <meshStandardMaterial color={bodyCol} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* ── Left solid side wall + structural frame ── */}
      <mesh position={[-CAB_W / 2, CAB_H / 2, cz]}>
        <boxGeometry args={[EXT, CAB_H - 0.5, CAB_D - 0.4]} />
        <meshStandardMaterial color={bodyCol} roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Left A-pillar (front) */}
      <mesh position={[-CAB_W / 2, CAB_H / 2, CAB_END]}>
        <boxGeometry args={[0.28, CAB_H + 0.2, 0.28]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} metalness={0.35} />
      </mesh>
      {/* Left B-pillar (mid) */}
      <mesh position={[-CAB_W / 2, CAB_H / 2, cz]}>
        <boxGeometry args={[0.18, CAB_H + 0.1, 0.2]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} metalness={0.35} />
      </mesh>
      {/* Left C-pillar (rear, connects to trailer) */}
      <mesh position={[-CAB_W / 2, CAB_H / 2, CAB_START]}>
        <boxGeometry args={[0.28, CAB_H + 0.2, 0.28]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} metalness={0.35} />
      </mesh>

      {/* ── Right solid side wall + structural frame ── */}
      <mesh position={[CAB_W / 2, CAB_H / 2, cz]}>
        <boxGeometry args={[EXT, CAB_H - 0.5, CAB_D - 0.4]} />
        <meshStandardMaterial color={bodyCol} roughness={0.55} metalness={0.3} />
      </mesh>
      <mesh position={[CAB_W / 2, CAB_H / 2, CAB_END]}>
        <boxGeometry args={[0.28, CAB_H + 0.2, 0.28]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} metalness={0.35} />
      </mesh>
      <mesh position={[CAB_W / 2, CAB_H / 2, cz]}>
        <boxGeometry args={[0.18, CAB_H + 0.1, 0.2]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} metalness={0.35} />
      </mesh>
      <mesh position={[CAB_W / 2, CAB_H / 2, CAB_START]}>
        <boxGeometry args={[0.28, CAB_H + 0.2, 0.28]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} metalness={0.35} />
      </mesh>

      {/* ── Windshield (front glass) ── */}
      <mesh position={[0, CAB_H * 0.58, CAB_END + 0.04]} renderOrder={2}>
        <boxGeometry args={[CAB_W - 0.62, CAB_H * 0.68, 0.05]} />
        <meshStandardMaterial
          color={glassCol}
          transparent={true}
          opacity={0.22}
          roughness={0.03}
          metalness={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Windshield surround / frame */}
      <mesh position={[0, CAB_H * 0.58, CAB_END + 0.02]}>
        <boxGeometry args={[CAB_W - 0.38, CAB_H * 0.68 + 0.25, 0.1]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} />
      </mesh>
      {/* Windshield glass (put on top of frame so it renders) */}
      <mesh position={[0, CAB_H * 0.58, CAB_END + 0.08]} renderOrder={3}>
        <boxGeometry args={[CAB_W - 0.62, CAB_H * 0.68, 0.04]} />
        <meshStandardMaterial
          color={glassCol}
          transparent={true}
          opacity={0.22}
          roughness={0.03}
          metalness={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Cab back wall (where cab meets trailer) ── */}
      <mesh position={[0, CAB_H / 2, CAB_START - 0.2]}>
        <boxGeometry args={[CAB_W, CAB_H, 0.38]} />
        <meshStandardMaterial color={bodyCol} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* ── Air deflector / fairing (aerodynamic connector from cab roof to trailer roof) ── */}
      <mesh position={[0, CAB_H + 0.45, CAB_START - 1.0]}>
        <boxGeometry args={[TW + EXT * 2 + 0.8, 0.9, 2.0]} />
        <meshStandardMaterial color={accentCol} roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Side fairings */}
      {([-1, 1] as const).map((side, i) => (
        <mesh key={i} position={[side * (TW / 2 + EXT + 0.4), TH * 0.7, CAB_START - 1.0]}>
          <boxGeometry args={[0.28, TH * 0.6, 2.0]} />
          <meshStandardMaterial color={accentCol} roughness={0.55} metalness={0.3} />
        </mesh>
      ))}

      {/* ── Hood / engine compartment ── */}
      <mesh position={[0, 1.3, hoodCz]}>
        <boxGeometry args={[CAB_W - 0.5, 2.6, HOOD_D]} />
        <meshStandardMaterial color={bodyCol} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Hood top panel */}
      <mesh position={[0, 2.62, hoodCz]}>
        <boxGeometry args={[CAB_W - 0.6, 0.12, HOOD_D - 0.12]} />
        <meshStandardMaterial color={accentCol} roughness={0.45} metalness={0.38} />
      </mesh>
      {/* Hood intake vents */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, 2.0, hoodCz - 0.6 + i * 0.28]}>
          <boxGeometry args={[CAB_W - 0.9, 0.14, 0.12]} />
          <meshStandardMaterial color="#0f1a2a" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}

      {/* ── Front bumper ── */}
      <mesh position={[0, 0.62, bumperZ - 0.12]}>
        <boxGeometry args={[CAB_W + 0.22, 1.22, 0.38]} />
        <meshStandardMaterial color={chromeCol} metalness={0.88} roughness={0.12} />
      </mesh>
      {/* Step / tow bar */}
      <mesh position={[0, 0.15, bumperZ - 0.14]}>
        <boxGeometry args={[CAB_W - 0.8, 0.2, 0.32]} />
        <meshStandardMaterial color={chromeCol} metalness={0.88} roughness={0.12} />
      </mesh>

      {/* ── Grille bars ── */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, 0.9 + i * 0.24, HOOD_END - 0.01]}>
          <boxGeometry args={[CAB_W - 0.8, 0.1, 0.14]} />
          <meshStandardMaterial color="#888" metalness={0.82} roughness={0.22} />
        </mesh>
      ))}
      {/* Vertical grille dividers */}
      {([-1, 0, 1] as const).map((x, i) => (
        <mesh key={i} position={[x * ((CAB_W - 0.9) / 3), 2.2, HOOD_END - 0.01]}>
          <boxGeometry args={[0.1, 2.6, 0.12]} />
          <meshStandardMaterial color="#666" metalness={0.85} roughness={0.18} />
        </mesh>
      ))}

      {/* ── Headlights ── */}
      {([-1, 1] as const).map((side, i) => (
        <group key={i} position={[side * (CAB_W / 2 - 0.62), 1.38, HOOD_END + 0.02]}>
          <mesh>
            <boxGeometry args={[1.0, 0.55, 0.12]} />
            <meshStandardMaterial color="#fffff0" emissive="#fff8d0" emissiveIntensity={2.0} roughness={0.08} />
          </mesh>
          <pointLight intensity={1.2} color="#fff7cc" distance={14} decay={1.5} />
        </group>
      ))}
      {/* Fog lights */}
      {([-1, 1] as const).map((side, i) => (
        <mesh key={i} position={[side * (CAB_W / 2 - 1.2), 0.45, bumperZ - 0.04]}>
          <boxGeometry args={[0.55, 0.28, 0.1]} />
          <meshStandardMaterial color="#fffde8" emissive="#fef3c7" emissiveIntensity={1.2} roughness={0.1} />
        </mesh>
      ))}

      {/* ── Fuel tanks (cylinders on both sides) ── */}
      {([-1, 1] as const).map((side, i) => (
        <group key={i} position={[side * (TW / 2 + EXT + 0.58), 0.88, CAB_START - 2.5]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.58, 0.58, 2.8, 16]} />
            <meshStandardMaterial color="#2a3a50" metalness={0.72} roughness={0.28} />
          </mesh>
          {/* Cap */}
          <mesh position={[0, 0, 1.5]}>
            <cylinderGeometry args={[0.6, 0.6, 0.12, 16]} />
            <meshStandardMaterial color={chromeCol} metalness={0.88} roughness={0.12} />
          </mesh>
        </group>
      ))}

      {/* ── Exhaust stacks ── */}
      {([-1, 1] as const).map((side, i) => (
        <group key={i} position={[side * (CAB_W / 2 - 0.52), 0, CAB_END + 1.1]}>
          <mesh position={[0, CAB_H + 1.8, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 3.6, 10]} />
            <meshStandardMaterial color="#4a4a4a" metalness={0.82} roughness={0.18} />
          </mesh>
          {/* Exhaust cap */}
          <mesh position={[0, CAB_H + 3.62, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.14, 10]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.82} roughness={0.18} />
          </mesh>
        </group>
      ))}

      {/* ── Side mirrors ── */}
      {([-1, 1] as const).map((side, i) => (
        <group key={i} position={[side * (CAB_W / 2 + 0.08), CAB_H * 0.72, CAB_END + 0.8]}>
          {/* Mirror arm */}
          <mesh position={[side * 0.3, 0, 0]} rotation={[0, 0, side * 0.3]}>
            <boxGeometry args={[0.55, 0.06, 0.06]} />
            <meshStandardMaterial color={chromeCol} metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Mirror glass */}
          <mesh position={[side * 0.62, -0.1, 0.04]}>
            <boxGeometry args={[0.32, 0.52, 0.07]} />
            <meshStandardMaterial color="#1a2332" roughness={0.25} metalness={0.5} />
          </mesh>
        </group>
      ))}

      {/* ── Marker lights on cab sides ── */}
      {([-1, 1] as const).map((side, i) =>
        ([CAB_H - 0.3, CAB_H / 2] as const).map((y, j) => (
          <mesh key={`${i}-${j}`} position={[side * (CAB_W / 2 + 0.04), y, cz]}>
            <boxGeometry args={[0.06, 0.22, 0.16]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} roughness={0.3} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ── Wheels: steer axle, drive tandems, trailer tandems ────────────────────────
function Wheels() {
  const TIRE_R   = 0.80;
  const TIRE_W   = 0.32;
  const DUAL_OFF = 0.24;
  const WHEEL_Y  = -(TIRE_R - 0.04);  // wheel center Y (resting on ground)
  const HUB_COL  = '#a0a8b0';
  const TIRE_COL = '#1a1a1a';

  // [z, isDual, isSteer]
  const axles: [number, boolean, boolean][] = [
    [HOOD_END + 1.0,    false, true ],   // front steer axle
    [CAB_START - 1.8,   true,  false],   // drive axle 1
    [CAB_START - 3.4,   true,  false],   // drive axle 2
    [-3.0,              true,  false],   // trailer axle 1
    [-4.8,              true,  false],   // trailer axle 2
  ];

  const AXLE_SPAN = TW / 2 + EXT + 0.52;

  return (
    <group>
      {/* Trailer chassis rails */}
      {([-1, 1] as const).map((side, i) => (
        <mesh key={i} position={[side * 2.2, -0.32, -TD / 2 + 1.0]}>
          <boxGeometry args={[0.22, 0.3, TD - 4.0]} />
          <meshStandardMaterial color="#2d3a4a" metalness={0.75} roughness={0.28} />
        </mesh>
      ))}

      {/* Fifth wheel plate */}
      <mesh position={[0, -0.18, CAB_START - 2.2]}>
        <cylinderGeometry args={[1.3, 1.3, 0.28, 16]} />
        <meshStandardMaterial color="#6b7280" metalness={0.88} roughness={0.18} />
      </mesh>

      {/* Axle + wheel assemblies */}
      {axles.map(([z, isDual, isSteer], ai) => (
        <group key={ai}>
          {/* Axle rod */}
          <mesh position={[0, WHEEL_Y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, AXLE_SPAN * 2 + (isDual ? 0.6 : 0), 10]} />
            <meshStandardMaterial color="#555" metalness={0.88} roughness={0.18} />
          </mesh>

          {([-1, 1] as const).map((side, si) => {
            const baseX = side * AXLE_SPAN;
            return (
              <group key={si}>
                {isDual ? (
                  <>
                    {/* Outer tire */}
                    <mesh position={[baseX + side * DUAL_OFF, WHEEL_Y, z]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[TIRE_R, TIRE_R, TIRE_W, 18]} />
                      <meshStandardMaterial color={TIRE_COL} roughness={0.95} />
                    </mesh>
                    {/* Inner tire */}
                    <mesh position={[baseX - side * DUAL_OFF, WHEEL_Y, z]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[TIRE_R, TIRE_R, TIRE_W, 18]} />
                      <meshStandardMaterial color={TIRE_COL} roughness={0.95} />
                    </mesh>
                    {/* Hub / drum */}
                    <mesh position={[baseX, WHEEL_Y, z]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[0.32, 0.32, DUAL_OFF * 2 + TIRE_W * 2 + 0.1, 10]} />
                      <meshStandardMaterial color={HUB_COL} metalness={0.85} roughness={0.15} />
                    </mesh>
                  </>
                ) : (
                  <>
                    {/* Single steer tire */}
                    <mesh position={[baseX, WHEEL_Y, z]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[TIRE_R, TIRE_R, TIRE_W + 0.06, 18]} />
                      <meshStandardMaterial color={TIRE_COL} roughness={0.95} />
                    </mesh>
                    {/* Hub */}
                    <mesh position={[baseX, WHEEL_Y, z]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[0.3, 0.3, TIRE_W + 0.1, 10]} />
                      <meshStandardMaterial color={HUB_COL} metalness={0.85} roughness={0.15} />
                    </mesh>
                  </>
                )}
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

// ── Worker-mode box list: L-first, M-second, S-third ─────────────────────────
function buildWorkerBoxList() {
  const out: { pos: [number, number, number]; type: BoxType }[] = [];
  const lh = BOX_DIM['L'][1], mh = BOX_DIM['M'][1], sh = BOX_DIM['S'][1];
  for (const type of ['L', 'M', 'S'] as BoxType[]) {
    const y = type === 'L' ? lh / 2 : type === 'M' ? lh + mh / 2 : lh + mh + sh / 2;
    for (let s = SLAB_Z.length - 1; s >= 0; s--)
      for (let c = 0; c < COL_X.length; c++)
        out.push({ pos: [COL_X[c], y, SLAB_Z[s]], type });
  }
  return out;
}
const WORKER_BOX_LIST = buildWorkerBoxList();
const WORKER_TOTAL = WORKER_BOX_LIST.length;  // 96

// ── Pallet outside truck door (visible behind worker) ────────────────────────
function PalletOutside() {
  return (
    <group position={[0, 0, 3.2]}>
      {/* Pallet deck */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[2.4, 0.22, 1.8]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
      {/* Pallet legs */}
      {([-0.8, 0, 0.8] as const).map((x, i) => (
        <mesh key={i} position={[x, 0.0, 0]}>
          <boxGeometry args={[0.4, 0.18, 1.8]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
      ))}
      {/* Box stack — always looks full (replenishes) */}
      {([
        ['L', '#9a6530', 0.64],
        ['M', '#c8924a', 1.22],
        ['S', '#d4a462', 1.68],
      ] as [string, string, number][]).map(([, col, y]) => (
        <mesh key={col} position={[0, y, 0]}>
          <boxGeometry args={[2.0, 0.48, 1.6]} />
          <meshStandardMaterial color={col} roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

// ── Worker 3D — same blocky style as AdaptiveTwin, rotation-only animation ────
// Worker stands at the truck door and rotates: face pallet (grab) → face truck (place)
type WPhase = 'face-pallet' | 'carry' | 'drop';

function Worker3D({
  speedMult,
  currentType,
  onPlace,
  paused,
}: {
  speedMult: number;
  currentType: BoxType;
  onPlace: () => void;
  paused: boolean;
}) {
  const g       = useRef<THREE.Group>(null);
  const boxMesh = useRef<THREE.Group>(null);
  const ph      = useRef<WPhase>('face-pallet');
  const tmr     = useRef(0);
  const rotY    = useRef(0);   // 0 = facing +z (pallet outside), π = facing -z (into truck)
  const fired   = useRef(false);

  const cbRef = useRef(onPlace);
  cbRef.current = onPlace;

  useFrame((_, dt) => {
    if (!g.current || paused) return;
    const ds = Math.min(dt, 0.05) * speedMult;
    tmr.current += ds;

    if (ph.current === 'face-pallet') {
      // Smoothly face pallet (rotY → 0)
      rotY.current += (0 - rotY.current) * Math.min(7 * ds, 0.95);
      if (tmr.current > 0.5) { ph.current = 'carry'; tmr.current = 0; fired.current = false; }
    } else if (ph.current === 'carry') {
      // Turn to face truck (rotY → π), holding box
      rotY.current += (Math.PI - rotY.current) * Math.min(7 * ds, 0.95);
      if (tmr.current > 0.5) { ph.current = 'drop'; tmr.current = 0; }
    } else {
      // Facing truck — fire onPlace then return to face-pallet
      if (!fired.current && tmr.current > 0.25) {
        fired.current = true;
        cbRef.current();
      }
      if (tmr.current > 0.55) { ph.current = 'face-pallet'; tmr.current = 0; }
    }

    const carrying = ph.current === 'carry' || ph.current === 'drop';
    g.current.rotation.y = rotY.current;
    if (boxMesh.current) boxMesh.current.visible = carrying;
  });

  const col = BOX_COLOR[currentType];
  const [bw, bh, bd] = BOX_DIM[currentType];

  // Worker fixed at the truck door entrance (z=+1.0), centered
  return (
    <group ref={g} position={[0, 0, 1.0]}>
      {/* Torso — blue uniform */}
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[0.52, 0.95, 0.40]} />
        <meshStandardMaterial color="#1e40af" roughness={0.9} />
      </mesh>
      {/* Safety vest */}
      <mesh position={[0, 1.1, 0.20]}>
        <boxGeometry args={[0.45, 0.72, 0.02]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.90, 0]}>
        <sphereGeometry args={[0.27, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.85} />
      </mesh>
      {/* Hard hat */}
      <mesh position={[0, 2.20, 0]}>
        <cylinderGeometry args={[0.34, 0.30, 0.17, 8]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.75} />
      </mesh>
      {/* Legs */}
      {([-0.14, 0.14] as const).map((xo, i) => (
        <mesh key={i} position={[xo, 0.40, 0]}>
          <boxGeometry args={[0.23, 0.58, 0.36]} />
          <meshStandardMaterial color="#374151" roughness={0.9} />
        </mesh>
      ))}
      {/* Feet */}
      {([-0.14, 0.14] as const).map((xo, i) => (
        <mesh key={i} position={[xo, 0.09, 0.11]}>
          <boxGeometry args={[0.20, 0.14, 0.44]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      ))}
      {/* Carried box — in front of worker in local +z (faces pallet when rotY=0, faces truck when rotY=π) */}
      <group ref={boxMesh} position={[0, 1.08, 0.60]} visible={false}>
        <mesh>
          <boxGeometry args={[bw * 0.75, bh * 0.75, bd * 0.75]} />
          <meshStandardMaterial color={col.body} roughness={0.88} />
        </mesh>
        <mesh position={[0, bh * 0.375 + 0.003, 0]}>
          <boxGeometry args={[bw * 0.73, 0.01, bd * 0.73]} />
          <meshStandardMaterial color={col.top} roughness={0.80} />
        </mesh>
      </group>
    </group>
  );
}

// ── Full 3D scene ──────────────────────────────────────────────────────────────
function Scene({ mode, animating }: { mode: LoadMode3D; animating: boolean }) {
  const grid  = mode === 'optimised' ? OPTIMISED_GRID : BASELINE_GRID;
  const boxes = computeBoxPositions(grid);

  return (
    <>
      {/* Strong ambient so interior is always visible */}
      <ambientLight intensity={2.8} />
      {/* Key light from upper right front */}
      <directionalLight position={[18, 22, 10]} intensity={1.6} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-near={0.5} shadow-camera-far={50}
        shadow-camera-left={-16} shadow-camera-right={16}
        shadow-camera-top={10} shadow-camera-bottom={-5}
      />
      {/* Fill light from upper left rear */}
      <directionalLight position={[-14, 12, -26]} intensity={0.8} color="#d0e4f8" />
      {/* Bottom bounce */}
      <pointLight position={[0, -0.5, -8]} intensity={0.6} color="#b0c8e0" distance={20} decay={1.5} />

      <Trailer />
      <Cab />
      <Wheels />

      {boxes.map((b, i) => (
        <Box3D
          key={`${mode}-${i}`}
          targetPos={b.pos}
          size={BOX_DIM[b.type]}
          color={BOX_COLOR[b.type]}
          animate={animating}
          delay={b.delay}
        />
      ))}

      {/* Camera: elevated right-side 3/4 view showing full truck */}
      <PerspectiveCamera makeDefault position={[18, 9, 5]} fov={50} near={0.5} far={80} />
      <OrbitControls
        target={[0, 2.5, -12]}
        minDistance={10}
        maxDistance={40}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.1}
        enablePan={false}
      />
    </>
  );
}

// ── Worker-mode scene (separate from baseline/optimised static scene) ──────────
function SceneWorker({
  loadedCount,
  speedMult,
  onPlace,
  paused,
}: {
  loadedCount: number;
  speedMult: number;
  onPlace: () => void;
  paused: boolean;
}) {
  const currentType: BoxType = loadedCount < 32 ? 'L' : loadedCount < 64 ? 'M' : 'S';
  const done = loadedCount >= WORKER_TOTAL;

  return (
    <>
      <ambientLight intensity={2.8} />
      <directionalLight position={[18, 22, 10]} intensity={1.6} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-near={0.5} shadow-camera-far={60}
        shadow-camera-left={-16} shadow-camera-right={16}
        shadow-camera-top={10} shadow-camera-bottom={-5}
      />
      <directionalLight position={[-14, 12, -26]} intensity={0.8} color="#d0e4f8" />
      <pointLight position={[0, -0.5, -8]} intensity={0.6} color="#b0c8e0" distance={20} decay={1.5} />

      <Trailer doorOpen={true} />
      <Cab />
      <Wheels />
      <PalletOutside />

      {/* Boxes placed so far */}
      {WORKER_BOX_LIST.slice(0, loadedCount).map((b, i) => (
        <Box3D
          key={i}
          targetPos={b.pos}
          size={BOX_DIM[b.type]}
          color={BOX_COLOR[b.type]}
          animate={false}
          delay={0}
        />
      ))}

      {/* Worker only shown while loading */}
      {!done && (
        <Worker3D
          speedMult={speedMult}
          currentType={currentType}
          onPlace={onPlace}
          paused={paused}
        />
      )}

      <PerspectiveCamera makeDefault position={[16, 8, 8]} fov={52} near={0.5} far={80} />
      <OrbitControls
        target={[0, 2.5, -8]}
        minDistance={10}
        maxDistance={40}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.1}
        enablePan={false}
      />
    </>
  );
}

// ── Public component ───────────────────────────────────────────────────────────
interface Props {
  mode: LoadMode3D;
  animating: boolean;
  height?: number;
  // Worker mode props
  workerMode?: boolean;
  workerSpeed?: Speed;
  workerPaused?: boolean;
  loadedCount?: number;
  onBoxLoaded?: () => void;
}

export function TruckInterior3D({
  mode, animating, height = 500,
  workerMode = false, workerSpeed = 1, workerPaused = false,
  loadedCount = 0, onBoxLoaded,
}: Props) {
  const fill         = workerMode
    ? Math.round((loadedCount / WORKER_TOTAL) * 100)
    : computeFill3D(mode === 'optimised' ? OPTIMISED_GRID : BASELINE_GRID);
  const fillColor    = (mode === 'optimised' || workerMode) ? '#0891b2' : '#9ca3af';
  const baselineFill = computeFill3D(BASELINE_GRID);
  const done         = workerMode && loadedCount >= WORKER_TOTAL;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Fill rate badge */}
      <div style={{
        position: 'absolute', top: 10, right: 12, zIndex: 10,
        background: (mode === 'optimised' || workerMode) ? '#ecfeff' : '#f9fafb',
        border: `1px solid ${(mode === 'optimised' || workerMode) ? '#a5f3fc' : '#e5e7eb'}`,
        borderRadius: 8, padding: '5px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: fillColor }}>Fill Rate</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: fillColor, letterSpacing: '-0.02em' }}>
          {fill}%
        </span>
        {workerMode && loadedCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a',
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px' }}>
            {loadedCount}/{WORKER_TOTAL} boxes
          </span>
        )}
        {!workerMode && mode === 'optimised' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a',
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px' }}>
            +{fill - baselineFill}pp
          </span>
        )}
      </div>

      {/* Mode badge */}
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 10,
        background: (mode === 'optimised' || workerMode) ? '#0891b2' : '#374151',
        borderRadius: 6, padding: '4px 10px',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {workerMode
            ? (done ? '✓ Loading complete' : `Worker loading — ${loadedCount < 32 ? 'LARGE' : loadedCount < 64 ? 'MEDIUM' : 'SMALL'} boxes`)
            : mode === 'optimised' ? '✓ AI Optimised Load' : '⚠ Random Loading'}
        </span>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 10, left: 12, zIndex: 10,
        background: 'rgba(255,255,255,0.88)', borderRadius: 7, padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        backdropFilter: 'blur(4px)', border: '1px solid #e2e8f0',
      }}>
        {[
          { color: '#7a4f28', label: 'LARGE'  },
          { color: '#b8874b', label: 'MEDIUM' },
          { color: '#d4a462', label: 'SMALL'  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 9, color: '#6b7280', marginLeft: 4 }}>drag · scroll to zoom</span>
      </div>

      <Canvas
        style={{ height, width: '100%', borderRadius: 8 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor('#f0f4f8'); }}
      >
        <Suspense fallback={null}>
          {workerMode ? (
            <SceneWorker
              loadedCount={loadedCount}
              speedMult={workerSpeed}
              onPlace={onBoxLoaded ?? (() => {})}
              paused={workerPaused}
            />
          ) : (
            <Scene mode={mode} animating={animating} />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

export { WORKER_TOTAL };
