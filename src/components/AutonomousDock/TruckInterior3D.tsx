import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

export type LoadMode3D = 'baseline' | 'optimised';

// ── Trailer interior geometry ──────────────────────────────────────────────────
const TW  = 7.2;   // interior width
const TH  = 4.4;   // interior height
const TD  = 14.0;  // interior depth (back of trailer)
const EXT = 0.35;  // wall thickness

// ── Box grid: 4 cols × 3 rows × 3 depth slabs ─────────────────────────────────
const COL_X  = [-2.70, -0.90, 0.90, 2.70] as const;
const ROW_Y  = [0.64, 1.88, 3.12]          as const;
const SLAB_Z = [-1.20, -4.40, -8.00]       as const;

type BoxType = 'L' | 'M' | 'S';
type Cell    = BoxType | '';

const BOX_DIM: Record<BoxType, [number, number, number]> = {
  L: [1.68, 1.18, 1.52],
  M: [1.68, 0.98, 1.28],
  S: [1.68, 0.82, 1.04],
};

const BOX_COLOR: Record<BoxType, { front: string; top: string }> = {
  L: { front: '#7a4f28', top: '#9a6530' },
  M: { front: '#b8874b', top: '#c8924a' },
  S: { front: '#c8924a', top: '#d4a462' },
};

// [slab][row][col]
const BASELINE_GRID: Cell[][][] = [
  [
    ['L', '',  'S', 'M'],
    ['',  'M', '',  'S'],
    ['S', '',  '',  '' ],
  ],
  [
    ['M', 'L', '',  'L'],
    ['S', '',  'M', '' ],
    ['',  'S', '',  '' ],
  ],
  [
    ['L', '',  'M', '' ],
    ['',  'L', '',  'S'],
    ['',  '',  'M', '' ],
  ],
];

const OPTIMISED_GRID: Cell[][][] = [
  [
    ['L', 'L', 'L', 'L'],
    ['M', 'M', 'M', 'M'],
    ['S', 'S', 'S', 'S'],
  ],
  [
    ['L', 'L', 'L', 'L'],
    ['M', 'M', 'M', 'M'],
    ['S', 'S', 'S', 'S'],
  ],
  [
    ['L', 'L', 'L', 'L'],
    ['M', 'M', 'M', 'M'],
    ['S', 'S', 'S', 'S'],
  ],
];

function computeFill3D(grid: Cell[][][]) {
  const total  = SLAB_Z.length * ROW_Y.length * COL_X.length;
  const filled = grid.flat(2).filter(c => c !== '').length;
  return Math.round((filled / total) * 100);
}

// ── Single box mesh with drop-in animation ─────────────────────────────────────
function Box3D({
  targetPos,
  size,
  color,
  animate,
  delay,
}: {
  targetPos: [number, number, number];
  size: [number, number, number];
  color: { front: string; top: string };
  animate: boolean;
  delay: number;
}) {
  const mesh  = useRef<THREE.Mesh>(null!);
  const prog  = useRef(animate ? 0 : 1);
  const ready = useRef(!animate);

  useEffect(() => {
    if (animate) {
      prog.current  = 0;
      ready.current = false;
      const t = setTimeout(() => { ready.current = true; }, delay);
      return () => clearTimeout(t);
    } else {
      prog.current  = 1;
      ready.current = true;
    }
  }, [animate, delay]);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const startY = targetPos[1] + 9;
    if (!ready.current) {
      mesh.current.position.y = startY;
      return;
    }
    if (prog.current < 1) {
      prog.current = Math.min(1, prog.current + dt * 2.6);
      // ease-out cubic
      const t = 1 - Math.pow(1 - prog.current, 3);
      mesh.current.position.y = startY + (targetPos[1] - startY) * t;
    } else {
      mesh.current.position.y = targetPos[1];
    }
  });

  const initY = animate ? targetPos[1] + 9 : targetPos[1];

  return (
    <mesh
      ref={mesh}
      position={[targetPos[0], initY, targetPos[2]]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={color.front} roughness={0.86} metalness={0.03} />
    </mesh>
  );
}

// ── Trailer walls + exterior shell ─────────────────────────────────────────────
function Trailer() {
  const wallColor = '#2d3748';
  const floorCol  = '#3d4a5c';
  const ceilCol   = '#242f3e';
  const extCol    = '#1a2332';
  const stripeCol = '#f59e0b'; // safety yellow

  return (
    <group>
      {/* Interior floor */}
      <mesh position={[0, -EXT / 2, -TD / 2]} receiveShadow>
        <boxGeometry args={[TW, EXT, TD]} />
        <meshStandardMaterial color={floorCol} roughness={0.9} metalness={0.2} />
      </mesh>

      {/* Interior ceiling */}
      <mesh position={[0, TH + EXT / 2, -TD / 2]}>
        <boxGeometry args={[TW + EXT * 2, EXT, TD + EXT]} />
        <meshStandardMaterial color={ceilCol} roughness={0.8} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-TW / 2 - EXT / 2, TH / 2, -TD / 2]}>
        <boxGeometry args={[EXT, TH + EXT, TD + EXT]} />
        <meshStandardMaterial color={wallColor} roughness={0.85} />
      </mesh>

      {/* Right wall */}
      <mesh position={[TW / 2 + EXT / 2, TH / 2, -TD / 2]}>
        <boxGeometry args={[EXT, TH + EXT, TD + EXT]} />
        <meshStandardMaterial color={wallColor} roughness={0.85} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, TH / 2, -TD - EXT / 2]}>
        <boxGeometry args={[TW + EXT * 2, TH + EXT, EXT]} />
        <meshStandardMaterial color={extCol} roughness={0.9} />
      </mesh>

      {/* ── Exterior truck body (visible from outside) ── */}
      {/* Top exterior panel above opening */}
      <mesh position={[0, TH + EXT + 0.5, 0.2]}>
        <boxGeometry args={[TW + EXT * 2 + 1.4, 1.1, EXT + 0.3]} />
        <meshStandardMaterial color={extCol} roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Left exterior pillar */}
      <mesh position={[-TW / 2 - EXT - 0.55, TH / 2, 0.2]}>
        <boxGeometry args={[1.1, TH + EXT * 2 + 1.2, EXT + 0.3]} />
        <meshStandardMaterial color={extCol} roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Right exterior pillar */}
      <mesh position={[TW / 2 + EXT + 0.55, TH / 2, 0.2]}>
        <boxGeometry args={[1.1, TH + EXT * 2 + 1.2, EXT + 0.3]} />
        <meshStandardMaterial color={extCol} roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Bottom bumper / dock plate strip */}
      <mesh position={[0, -0.55, 0.15]}>
        <boxGeometry args={[TW + 2.4, 0.55, 0.5]} />
        <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.5} />
      </mesh>

      {/* Safety yellow stripe along bottom frame */}
      <mesh position={[0, -0.26, 0.22]}>
        <boxGeometry args={[TW + 2.6, 0.08, 0.12]} />
        <meshStandardMaterial color={stripeCol} roughness={0.5} emissive={stripeCol} emissiveIntensity={0.3} />
      </mesh>

      {/* Corner reflectors */}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[side * (TW / 2 + EXT + 1.05), 0.4, 0.25]}>
          <boxGeometry args={[0.22, 0.32, 0.12]} />
          <meshStandardMaterial color="#fcd34d" emissive="#fcd34d" emissiveIntensity={0.6} />
        </mesh>
      ))}

      {/* Door hinge lines (decorative) */}
      {[-0.05, 0.05].map((x, i) => (
        <mesh key={i} position={[x, TH / 2, 0.25]}>
          <boxGeometry args={[0.06, TH, 0.08]} />
          <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Interior ceiling strip lights */}
      {[-4.5, -8.5].map((z, i) => (
        <mesh key={i} position={[0, TH - 0.08, z]}>
          <boxGeometry args={[TW - 1, 0.06, 1.8]} />
          <meshStandardMaterial color="#fffbeb" emissive="#fef3c7" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* Floor texture lines */}
      {[-1.5, -4.5, -7.5, -10.5].map((z, i) => (
        <mesh key={i} position={[0, 0.005, z]}>
          <boxGeometry args={[TW - 0.2, 0.01, 0.06]} />
          <meshStandardMaterial color="#4a5568" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ── Box grid renderer ──────────────────────────────────────────────────────────
function BoxGrid({
  grid,
  animate,
}: {
  grid: Cell[][][];
  animate: boolean;
}) {
  // Build ordered list: optimised animates bottom-up, front-to-back
  const boxes: { pos: [number,number,number]; type: BoxType; delay: number }[] = [];
  let idx = 0;

  // For optimised: row 0 (floor) first, then row 1, row 2
  // For baseline: just left-to-right, top-to-bottom order
  for (let r = 0; r < ROW_Y.length; r++) {
    for (let s = 0; s < SLAB_Z.length; s++) {
      for (let c = 0; c < COL_X.length; c++) {
        const cell = grid[s][r][c];
        if (cell !== '') {
          boxes.push({
            pos: [COL_X[c], ROW_Y[r], SLAB_Z[s]],
            type: cell as BoxType,
            delay: idx * 0.10,
          });
          idx++;
        }
      }
    }
  }

  return (
    <>
      {boxes.map((b, i) => (
        <Box3D
          key={i}
          targetPos={b.pos}
          size={BOX_DIM[b.type]}
          color={BOX_COLOR[b.type]}
          animate={animate}
          delay={b.delay}
        />
      ))}
    </>
  );
}

// ── Particle dust effect while loading ────────────────────────────────────────
function DustParticles({ active }: { active: boolean }) {
  const pts = useRef<THREE.Points>(null!);

  useFrame((_, dt) => {
    if (!pts.current || !active) return;
    pts.current.rotation.y += dt * 0.15;
  });

  const positions = new Float32Array(80 * 3);
  for (let i = 0; i < 80; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * TW;
    positions[i * 3 + 1] = Math.random() * TH;
    positions[i * 3 + 2] = -Math.random() * TD;
  }

  if (!active) return null;

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#d4a462" size={0.06} transparent opacity={0.4} />
    </points>
  );
}

// ── Full 3D scene ──────────────────────────────────────────────────────────────
function Scene({
  mode,
  animating,
}: {
  mode: LoadMode3D;
  animating: boolean;
}) {
  const grid = mode === 'optimised' ? OPTIMISED_GRID : BASELINE_GRID;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 10, 12]} intensity={1.0} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-6, 4, 8]} intensity={0.35} color="#c7d2fe" />
      {/* Interior lights */}
      <pointLight position={[0, TH - 0.3, -4]} intensity={1.2} color="#fef3c7" distance={12} />
      <pointLight position={[0, TH - 0.3, -9]} intensity={0.9} color="#fef3c7" distance={10} />
      {/* Subtle fill from below */}
      <pointLight position={[0, 0.5, -4]} intensity={0.3} color="#93c5fd" distance={8} />

      <Trailer />
      <BoxGrid grid={grid} animate={animating} />
      <DustParticles active={animating} />

      <PerspectiveCamera makeDefault position={[0, 3.8, 12.5]} fov={52} />
      <OrbitControls
        target={[0, 2.0, -2.5]}
        minDistance={5}
        maxDistance={22}
        minPolarAngle={0.2}
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
}

export function TruckInterior3D({ mode, animating, height = 500 }: Props) {
  const fill = computeFill3D(mode === 'optimised' ? OPTIMISED_GRID : BASELINE_GRID);
  const fillColor = mode === 'optimised' ? '#0891b2' : '#9ca3af';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Fill rate badge */}
      <div style={{
        position: 'absolute', top: 10, right: 12, zIndex: 10,
        background: mode === 'optimised' ? '#ecfeff' : '#f9fafb',
        border: `1px solid ${mode === 'optimised' ? '#a5f3fc' : '#e5e7eb'}`,
        borderRadius: 8, padding: '5px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: fillColor }}>
          Fill Rate
        </span>
        <span style={{ fontSize: 18, fontWeight: 800, color: fillColor, letterSpacing: '-0.02em' }}>
          {fill}%
        </span>
        {mode === 'optimised' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a',
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px' }}>
            +{fill - computeFill3D(BASELINE_GRID)}pp
          </span>
        )}
      </div>

      {/* Mode badge */}
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 10,
        background: mode === 'optimised' ? '#0891b2' : '#374151',
        borderRadius: 6, padding: '4px 10px',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {mode === 'optimised' ? '✓ AI Optimised Load' : '⚠ Random Loading'}
        </span>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 10, left: 12, zIndex: 10,
        background: 'rgba(15,23,42,0.75)', borderRadius: 7, padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        backdropFilter: 'blur(4px)',
      }}>
        {[
          { color: '#7a4f28', label: 'LARGE'  },
          { color: '#b8874b', label: 'MEDIUM' },
          { color: '#d4a462', label: 'SMALL'  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1' }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 9, color: '#64748b', marginLeft: 4 }}>drag to rotate · scroll to zoom</span>
      </div>

      <Canvas
        style={{ height, width: '100%', borderRadius: 8 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor('#0f172a'); }}
      >
        <Suspense fallback={null}>
          <Scene mode={mode} animating={animating} />
        </Suspense>
      </Canvas>
    </div>
  );
}
