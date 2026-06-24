import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';

// ── Types ──────────────────────────────────────────────────────────────────────
export type Speed = 1 | 2 | 3 | 5 | 10;
type Phase = 'face-pallet' | 'reach' | 'carry' | 'place' | 'return';
type BoxCat = 'L' | 'M' | 'S';

// ── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_L = 32, TOTAL_M = 32, TOTAL_S = 32;
const TOTAL   = TOTAL_L + TOTAL_M + TOTAL_S;

const CYCLE_MS: Record<Speed, number> = { 1: 2800, 2: 1400, 3: 933, 5: 560, 10: 280 };

const PHASE_FRAC: Record<Phase, number> = {
  'face-pallet': 0.18,
  'reach':       0.22,
  'carry':       0.20,
  'place':       0.22,
  'return':      0.18,
};

const PHASES: Phase[] = ['face-pallet', 'reach', 'carry', 'place', 'return'];

function boxCat(idx: number): BoxCat {
  if (idx < TOTAL_L) return 'L';
  if (idx < TOTAL_L + TOTAL_M) return 'M';
  return 'S';
}

const BOX_COLORS: Record<BoxCat, { fill: string; top: string }> = {
  L: { fill: '#9a6530', top: '#b8874b' },
  M: { fill: '#c8924a', top: '#d4a462' },
  S: { fill: '#d4a462', top: '#e5c07a' },
};

const BOX_LABEL: Record<BoxCat, string> = { L: 'LARGE', M: 'MED', S: 'SMALL' };

// ── 3D geometry constants (mirrors TruckInterior3D) ───────────────────────────
const TW = 7.2, TH = 4.4, TD = 14.0, EXT = 0.35;
const COL_X  = [-2.70, -0.90, 0.90, 2.70] as const;
const SLAB_Z = [-1.0, -2.7, -4.4, -6.1, -7.8, -9.5, -11.2, -12.9] as const;

const BOX_DIM_3D: Record<BoxCat, [number, number, number]> = {
  L: [1.66, 1.18, 1.50],
  M: [1.66, 0.96, 1.26],
  S: [1.66, 0.80, 1.02],
};
const BOX_COLOR_3D: Record<BoxCat, string> = {
  L: '#7a4f28', M: '#b8874b', S: '#c8924a',
};

// Box list in L-first, M-second, S-third order
function buildBoxList() {
  const list: { pos: [number, number, number]; cat: BoxCat }[] = [];
  const lh = BOX_DIM_3D.L[1], mh = BOX_DIM_3D.M[1], sh = BOX_DIM_3D.S[1];
  for (const cat of ['L', 'M', 'S'] as BoxCat[]) {
    const y = cat === 'L' ? lh / 2 : cat === 'M' ? lh + mh / 2 : lh + mh + sh / 2;
    for (let s = 0; s < SLAB_Z.length; s++) {
      for (let c = 0; c < COL_X.length; c++) {
        list.push({ pos: [COL_X[c], y, SLAB_Z[s]], cat });
      }
    }
  }
  return list;
}
const BOX_LIST = buildBoxList();

// ── 3D components ─────────────────────────────────────────────────────────────
function Box3D({ pos, cat }: { pos: [number, number, number]; cat: BoxCat }) {
  const [w, h, d] = BOX_DIM_3D[cat];
  return (
    <group position={pos}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={BOX_COLOR_3D[cat]} roughness={0.88} metalness={0.03} />
      </mesh>
      <mesh position={[0, h / 2 + 0.003, 0]}>
        <boxGeometry args={[w - 0.04, 0.012, d - 0.04]} />
        <meshStandardMaterial color={BOX_COLORS[cat].top} roughness={0.80} />
      </mesh>
    </group>
  );
}

function TrailerBox() {
  return (
    <group>
      <mesh receiveShadow position={[0, -EXT / 2, -TD / 2]}>
        <boxGeometry args={[TW, EXT, TD]} />
        <meshStandardMaterial color="#5c7a96" roughness={0.85} />
      </mesh>
      <mesh position={[0, TH + EXT / 2, -TD / 2]}>
        <boxGeometry args={[TW + EXT * 2, EXT, TD + EXT]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      <mesh position={[-(TW / 2 + EXT / 2), TH / 2, -TD / 2]}>
        <boxGeometry args={[EXT, TH + EXT, TD]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      <mesh position={[TW / 2 + EXT / 2, TH / 2, -TD / 2]}>
        <boxGeometry args={[EXT, TH + EXT, TD]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      <mesh position={[0, TH / 2, -TD - EXT / 2]}>
        <boxGeometry args={[TW + EXT * 2, TH + EXT, EXT]} />
        <meshStandardMaterial color="#0f1a2a" roughness={0.9} />
      </mesh>
      {[-3.5, -7.0, -10.5].map((z, i) => (
        <group key={i}>
          <mesh position={[0, TH - 0.06, z]}>
            <boxGeometry args={[TW - 0.8, 0.06, 2.0]} />
            <meshStandardMaterial color="#fffff0" emissive="#fff8d6" emissiveIntensity={3.5} />
          </mesh>
          <pointLight position={[0, TH - 0.3, z]} intensity={5} color="#fff5d0" distance={20} decay={1.2} />
        </group>
      ))}
    </group>
  );
}

function TruckScene({ loadedCount }: { loadedCount: number }) {
  return (
    <>
      <ambientLight intensity={2.5} />
      <directionalLight position={[10, 15, 8]} intensity={1.4} castShadow />
      <directionalLight position={[-10, 10, -20]} intensity={0.6} color="#d0e4f8" />
      <TrailerBox />
      {BOX_LIST.slice(0, loadedCount).map((b, i) => (
        <Box3D key={i} pos={b.pos} cat={b.cat} />
      ))}
      <PerspectiveCamera makeDefault position={[14, 7, 5]} fov={50} near={0.5} far={60} />
      <OrbitControls
        target={[0, 2, -8]}
        minDistance={8}
        maxDistance={30}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.1}
        enablePan={false}
      />
    </>
  );
}

// ── SVG Worker scene ──────────────────────────────────────────────────────────
// Worker stands at center facing left (truck). Pallet on right. Truck door on left.
// Arms animate via CSS transform on SVG groups.
function WorkerSVG({ phase, boxIdx }: { phase: Phase; boxIdx: number }) {
  const cat  = boxCat(boxIdx);
  const bc   = BOX_COLORS[cat];

  // Worker body center
  const WX  = 195;  // hip X
  const hipY = 205;
  const torsoTop = hipY - 58;
  const shoulderY = torsoTop + 8;
  const headY = torsoTop - 20;

  // Box dims in SVG
  const bw = cat === 'L' ? 34 : cat === 'M' ? 26 : 20;
  const bh = cat === 'L' ? 26 : cat === 'M' ? 20 : 15;

  // Carried box position
  const carryBoxX = phase === 'place' ? WX - 72 : WX + 10;
  const carryBoxY = shoulderY + 4;
  const showCarried = phase === 'carry' || phase === 'place';

  // Right arm angle from shoulder pivot (SVG: +angle = clockwise = toward right when arm starts pointing down)
  const rightAngle: Record<Phase, number> = {
    'face-pallet': 50,
    'reach':       82,
    'carry':       20,
    'place':      -65,
    'return':       5,
  };
  // Left arm angle from shoulder pivot
  const leftAngle: Record<Phase, number> = {
    'face-pallet':  0,
    'reach':        0,
    'carry':       30,
    'place':      -80,
    'return':       0,
  };

  const headTilt = (phase === 'face-pallet' || phase === 'reach') ? 14 : 0;

  // right shoulder pivot
  const rsX = WX + 16, rsY = shoulderY;
  // left shoulder pivot
  const lsX = WX - 16, lsY = shoulderY;

  const tr = 'transform 0.22s ease-in-out';

  return (
    <svg viewBox="0 0 440 300" width="100%" height="100%" style={{ userSelect: 'none', display: 'block' }}>
      {/* Sky / background */}
      <rect x={0} y={0} width={440} height={300} fill="#f0f4f8" />

      {/* Dock floor */}
      <rect x={0} y={240} width={440} height={60} fill="#d8cfc0" />
      <rect x={0} y={236} width={440} height={7} fill="#b8a888" />

      {/* ── TRUCK DOOR (left) ── */}
      {/* Truck body */}
      <rect x={0} y={28} width={108} height={214} fill="#374151" />
      {/* Door opening */}
      <rect x={6} y={36} width={95} height={196} rx={3} fill="#0f172a" />
      {/* Inside view: boxes stacking up */}
      {boxIdx > 0  && <rect x={12} y={195} width={30} height={34} rx={1} fill="#7a4f28" opacity={0.7} />}
      {boxIdx > 1  && <rect x={44} y={195} width={30} height={34} rx={1} fill="#7a4f28" opacity={0.7} />}
      {boxIdx > 4  && <rect x={76} y={195} width={18} height={34} rx={1} fill="#7a4f28" opacity={0.7} />}
      {boxIdx > 8  && <rect x={12} y={163} width={30} height={30} rx={1} fill="#b8874b" opacity={0.7} />}
      {boxIdx > 10 && <rect x={44} y={163} width={30} height={30} rx={1} fill="#b8874b" opacity={0.7} />}
      {boxIdx > 16 && <rect x={76} y={163} width={18} height={30} rx={1} fill="#b8874b" opacity={0.7} />}
      {boxIdx > 24 && <rect x={12} y={140} width={30} height={21} rx={1} fill="#d4a462" opacity={0.7} />}
      {boxIdx > 28 && <rect x={44} y={140} width={30} height={21} rx={1} fill="#d4a462" opacity={0.7} />}
      {/* Truck top */}
      <rect x={0} y={16} width={112} height={14} fill="#4b5563" />
      {/* Door frame details */}
      <rect x={0} y={36} width={6}  height={196} fill="#1f2937" />
      <rect x={6} y={36} width={95} height={4}   fill="#1f2937" />
      <rect x={6} y={228} width={95} height={4}  fill="#1f2937" />
      {/* Door handle */}
      <rect x={96} y={118} width={5} height={24} rx={2} fill="#6b7280" />
      {/* Hinges */}
      <rect x={0} y={52}  width={6} height={14} rx={2} fill="#9ca3af" />
      <rect x={0} y={115} width={6} height={14} rx={2} fill="#9ca3af" />
      <rect x={0} y={178} width={6} height={14} rx={2} fill="#9ca3af" />
      {/* Dock bumpers */}
      <rect x={98} y={158} width={14} height={50} rx={3} fill="#1a1f2a" />
      <rect x={98} y={70}  width={14} height={50} rx={3} fill="#1a1f2a" />
      {/* Dock leveler */}
      <rect x={0} y={228} width={116} height={12} fill="#4b5563" />
      <rect x={0} y={238} width={120} height={5} rx={2} fill="#374151" />
      {/* DOT tape */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 12} y={231} width={10} height={6}
          fill={i % 2 === 0 ? '#dc2626' : '#e2e8f0'} />
      ))}

      {/* ── PALLET (right) ── */}
      {/* Pallet deck */}
      <rect x={288} y={214} width={140} height={14} rx={2} fill="#b8864e" />
      {/* Pallet legs */}
      <rect x={300} y={224} width={14} height={14} rx={1} fill="#9a6530" />
      <rect x={336} y={224} width={14} height={14} rx={1} fill="#9a6530" />
      <rect x={372} y={224} width={14} height={14} rx={1} fill="#9a6530" />
      <rect x={288} y={226} width={140} height={6} rx={1} fill="#c8924a" />

      {/* Box stack on pallet — always full (unlimited) */}
      {/* Large boxes - bottom row */}
      <rect x={290} y={182} width={42} height={30} rx={2} fill="#9a6530" />
      <rect x={334} y={182} width={42} height={30} rx={2} fill="#9a6530" />
      <rect x={378} y={182} width={46} height={30} rx={2} fill="#9a6530" />
      {/* Medium boxes */}
      <rect x={290} y={158} width={42} height={22} rx={2} fill="#c8924a" />
      <rect x={334} y={158} width={42} height={22} rx={2} fill="#c8924a" />
      <rect x={378} y={158} width={46} height={22} rx={2} fill="#c8924a" />
      {/* Small boxes */}
      <rect x={298} y={142} width={32} height={14} rx={2} fill="#d4a462" />
      <rect x={340} y={142} width={32} height={14} rx={2} fill="#d4a462" />
      <rect x={384} y={142} width={38} height={14} rx={2} fill="#d4a462" />
      {/* Box sheen lines */}
      {[290, 334, 378].map((x, i) => (
        <line key={i} x1={x} y1={182} x2={x + (i === 2 ? 46 : 42)} y2={182} stroke="#ffffff22" strokeWidth={1} />
      ))}
      {/* Label */}
      <text x={358} y={252} textAnchor="middle" fontSize={9} fill="#78716c" fontWeight={700}>STAGING PALLET</text>
      <text x={358} y={263} textAnchor="middle" fontSize={8} fill="#a8a29e">(unlimited)</text>

      {/* ── Yellow hazard line on floor ── */}
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} x={118 + i * 14} y={237} width={9} height={5}
          fill={i % 2 === 0 ? '#facc15' : '#1f2937'} />
      ))}

      {/* ── WORKER FIGURE ── */}
      {/* Shadow */}
      <ellipse cx={WX} cy={242} rx={22} ry={5} fill="#00000020" />

      {/* Boots */}
      <rect x={WX - 18} y={228} width={15} height={11} rx={3} fill="#111827" />
      <rect x={WX + 3}  y={228} width={15} height={11} rx={3} fill="#111827" />

      {/* Legs */}
      <rect x={WX - 15} y={196} width={12} height={36} rx={4} fill="#1e3a8a" />
      <rect x={WX + 3}  y={196} width={12} height={36} rx={4} fill="#1e3a8a" />

      {/* Belt */}
      <rect x={WX - 18} y={192} width={36} height={6} rx={2} fill="#92400e" />

      {/* Torso — blue uniform */}
      <rect x={WX - 18} y={torsoTop} width={36} height={58} rx={6} fill="#2563eb" />
      {/* Safety vest */}
      <rect x={WX - 13} y={torsoTop + 4} width={26} height={50} rx={4} fill="#f59e0b" opacity={0.7} />
      {/* Vest reflective stripes */}
      <rect x={WX - 18} y={torsoTop + 16} width={36} height={5} fill="#fbbf24" opacity={0.55} />
      <rect x={WX - 18} y={torsoTop + 28} width={36} height={5} fill="#fbbf24" opacity={0.55} />

      {/* Right arm (toward pallet / right side) */}
      <g transform={`translate(${rsX}, ${rsY})`}>
        <g style={{ transition: tr, transform: `rotate(${rightAngle[phase]}deg)`, transformOrigin: '0px 0px' }}>
          <rect x={-5} y={0} width={10} height={32} rx={4} fill="#f5d6b8" />
          <rect x={-7} y={28} width={14} height={10} rx={3} fill="#374151" />
        </g>
      </g>

      {/* Left arm (toward truck / left side) */}
      <g transform={`translate(${lsX}, ${lsY})`}>
        <g style={{ transition: tr, transform: `rotate(${leftAngle[phase]}deg)`, transformOrigin: '0px 0px' }}>
          <rect x={-5} y={0} width={10} height={32} rx={4} fill="#f5d6b8" />
          <rect x={-7} y={28} width={14} height={10} rx={3} fill="#374151" />
        </g>
      </g>

      {/* Neck */}
      <rect x={WX - 5} y={headY + 17} width={10} height={12} rx={3} fill="#f5d6b8" />

      {/* Head */}
      <g style={{ transition: tr, transform: `rotate(${headTilt}deg)`, transformOrigin: `${WX}px ${headY + 17}px` }}>
        <circle cx={WX} cy={headY} r={19} fill="#f5d6b8" />
        {/* Hard hat */}
        <ellipse cx={WX} cy={headY - 11} rx={24} ry={10} fill="#facc15" />
        <rect x={WX - 24} y={headY - 14} width={48} height={8} rx={3} fill="#eab308" />
        {/* Hat brim */}
        <rect x={WX - 28} y={headY - 6} width={56} height={4} rx={2} fill="#ca8a04" />
        {/* Eyes */}
        <circle cx={WX - 7} cy={headY} r={2.8} fill="#374151" />
        <circle cx={WX + 7} cy={headY} r={2.8} fill="#374151" />
        {/* Nose */}
        <ellipse cx={WX} cy={headY + 6} rx={2} ry={2.5} fill="#e5b99e" />
      </g>

      {/* ── Carried box (animated) ── */}
      {showCarried && (
        <g style={{ transition: 'all 0.25s ease-in-out' }}>
          <rect
            x={carryBoxX - bw / 2}
            y={carryBoxY - bh / 2}
            width={bw}
            height={bh}
            rx={3}
            fill={bc.fill}
          />
          <rect
            x={carryBoxX - bw / 2 + 1}
            y={carryBoxY - bh / 2}
            width={bw - 2}
            height={4}
            rx={1}
            fill={bc.top}
          />
          <text
            x={carryBoxX}
            y={carryBoxY + 4}
            textAnchor="middle"
            fontSize={7}
            fontWeight={700}
            fill="#fff"
          >
            {BOX_LABEL[cat]}
          </text>
        </g>
      )}

      {/* Progress bar */}
      <rect x={118} y={8} width={200} height={8} rx={4} fill="#e2e8f0" />
      <rect x={118} y={8} width={Math.round(200 * (boxIdx / TOTAL))} height={8} rx={4} fill="#2563eb" />
      <text x={118 + 100} y={22} textAnchor="middle" fontSize={9} fill="#64748b" fontWeight={600}>
        {boxIdx}/{TOTAL} boxes placed
      </text>
    </svg>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export function WorkerLoadSim() {
  const [phase,       setPhase]       = useState<Phase>('face-pallet');
  const [boxIdx,      setBoxIdx]      = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [speed,       setSpeed]       = useState<Speed>(1);
  const [done,        setDone]        = useState(false);

  const phaseRef    = useRef<Phase>('face-pallet');
  const boxIdxRef   = useRef(0);
  const speedRef    = useRef<Speed>(1);
  const doneRef     = useRef(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleNext = useCallback(() => {
    if (doneRef.current) return;
    clearTimeout(timerRef.current);
    const duration = CYCLE_MS[speedRef.current] * PHASE_FRAC[phaseRef.current];
    timerRef.current = setTimeout(() => {
      if (phaseRef.current === 'place') {
        const next = boxIdxRef.current + 1;
        boxIdxRef.current = next;
        setBoxIdx(next);
        setLoadedCount(next);
        if (next >= TOTAL) {
          doneRef.current = true;
          setDone(true);
          return;
        }
      }
      const nextPhase = PHASES[(PHASES.indexOf(phaseRef.current) + 1) % PHASES.length];
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
      scheduleNext();
    }, duration);
  }, []);

  useEffect(() => {
    phaseRef.current = 'face-pallet';
    boxIdxRef.current = 0;
    doneRef.current = false;
    scheduleNext();
    return () => clearTimeout(timerRef.current);
  }, [scheduleNext]);

  const handleSpeed = (s: Speed) => {
    speedRef.current = s;
    setSpeed(s);
    clearTimeout(timerRef.current);
    scheduleNext();
  };

  const fillPct  = Math.round((loadedCount / TOTAL) * 100);
  const curCat   = boxCat(boxIdx);
  const catLabel = curCat === 'L' ? 'LARGE' : curCat === 'M' ? 'MEDIUM' : 'SMALL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Speed bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 16px', borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>SPEED</span>
        {([1, 2, 3, 5, 10] as Speed[]).map(s => (
          <button key={s} onClick={() => handleSpeed(s)} style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', border: 'none',
            background: speed === s ? '#2563eb' : '#e2e8f0',
            color:      speed === s ? '#fff'    : '#374151',
          }}>
            {s}×
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {done ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ All {TOTAL} boxes loaded!</span>
        ) : (
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Loading <strong style={{ color: '#374151' }}>{catLabel}</strong> boxes &nbsp;·&nbsp; {loadedCount}/{TOTAL}
          </span>
        )}
        <div style={{ width: 120, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${fillPct}%`, height: '100%', background: '#2563eb', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', minWidth: 34 }}>{fillPct}%</span>
      </div>

      {/* ── Main split view ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Left: worker SVG */}
        <div style={{ flex: '0 0 44%', borderRight: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative' }}>
          <WorkerSVG phase={phase} boxIdx={boxIdx} />
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, color: '#94a3b8', fontWeight: 600,
            background: 'rgba(255,255,255,0.85)', borderRadius: 5, padding: '2px 8px',
            border: '1px solid #e2e8f0',
          }}>
            ← TRUCK DOOR &nbsp;·&nbsp; WORKER &nbsp;·&nbsp; PALLET →
          </div>
        </div>

        {/* Right: 3D truck interior */}
        <div style={{ flex: 1, position: 'relative', background: '#0f172a', overflow: 'hidden' }}>
          {/* Fill rate badge */}
          <div style={{
            position: 'absolute', top: 8, right: 10, zIndex: 10,
            background: '#ecfeff', border: '1px solid #a5f3fc',
            borderRadius: 8, padding: '4px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#0891b2' }}>Fill Rate</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#0891b2' }}>{fillPct}%</span>
          </div>
          {/* Mode badge */}
          <div style={{
            position: 'absolute', top: 8, left: 10, zIndex: 10,
            background: '#2563eb', borderRadius: 6, padding: '3px 10px',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              AI Optimised — L → M → S
            </span>
          </div>
          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 8, left: 10, zIndex: 10,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 10px',
            display: 'flex', gap: 10,
          }}>
            {([['#7a4f28','LARGE'],['#b8874b','MEDIUM'],['#c8924a','SMALL']] as [string,string][]).map(([c,l]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:9, height:9, borderRadius:2, background:c }} />
                <span style={{ fontSize:9, fontWeight:700, color:'#cbd5e1' }}>{l}</span>
              </div>
            ))}
            <span style={{ fontSize:9, color:'#64748b' }}>drag · scroll</span>
          </div>

          <Canvas
            style={{ height: '100%', width: '100%' }}
            shadows
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => { gl.setClearColor('#0f172a'); }}
          >
            <Suspense fallback={null}>
              <TruckScene loadedCount={loadedCount} />
            </Suspense>
          </Canvas>
        </div>
      </div>
    </div>
  );
}
