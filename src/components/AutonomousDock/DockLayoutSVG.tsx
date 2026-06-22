import { useEffect, useState } from 'react';

export type DockPhase = 'baseline' | 'optimised';

interface Props {
  phase: DockPhase;
}

// ── Layout constants ───────────────────────────────────────────────────────────
const W = 760, H = 480;
const BL = 170, BR = 590, BT = 40, BB = 450;
const WALL = 13;

// Y centers for the 3 bays on each side
const BAY_Y = [145, 245, 345];
const BAY_H = 54;

// Storage zone areas inside building (left portion)
const ZONE_X0 = BL + WALL;       // 183
const ZONE_X1 = ZONE_X0 + 130;   // 313
const ZONE_Y: Record<string, [number, number]> = {
  A: [BT + 10,   BAY_Y[0] + 45],   // [50, 190]
  B: [BAY_Y[0] + 55, BAY_Y[1] + 45], // [200, 290]
  C: [BAY_Y[1] + 55, BB - 10],       // [300, 440]
};

// Staging lanes (right portion of interior)
const STAG_X0 = ZONE_X1 + 40;    // 353
const STAG_X1 = BR - WALL - 10;  // 567

const ZONE_COLOR: Record<string, string> = {
  A: '#ea580c',
  B: '#16a34a',
  C: '#7c3aed',
};
const ZONE_BG: Record<string, string> = {
  A: '#fff7ed',
  B: '#f0fdf4',
  C: '#f5f3ff',
};

// Pathing distance labels (baseline path length: suboptimal, optimised: optimal)
const OPTIMAL_PATH_M: Record<string, number> = { A: 18, B: 20, C: 19 };
const SUBOPT_PATH_M  = 31; // T-103 at R-3 → Zone A

// ── Truck component (receiving side, cab-left, trailer-right) ─────────────────
function RecvTruck({
  y, truck, queued,
}: {
  y: number;
  truck: { id: string; carrier: string; zone: string; priority: string; pallets: number } | null;
  queued?: boolean;
}) {
  const txRight = BL - 4;   // trailer face touches left wall
  const txLeft  = txRight - 110;
  const cabW    = 36;
  const ty      = y - 24;
  const th      = 48;

  if (queued) {
    // Show as faded truck parked in queue area far left
    return (
      <g opacity={0.35}>
        <rect x={txLeft} y={ty} width={110} height={th} rx={3} fill="#e2e8f0" stroke="#9ca3af" strokeWidth={1} />
        <text x={txLeft + 55} y={ty + 13} textAnchor="middle" fontSize={7} fill="#6b7280">QUEUED</text>
        <text x={txLeft + 55} y={ty + 24} textAnchor="middle" fontSize={8} fontWeight={700} fill="#374151">
          {truck?.carrier.split(' ')[0]}
        </text>
      </g>
    );
  }

  if (!truck) {
    // Empty dock — draw faint dock leveler only (no text, R-label is rendered separately)
    return (
      <g>
        <rect x={txRight - 12} y={ty + th * 0.3} width={12} height={th * 0.4} rx={2}
          fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 2" />
      </g>
    );
  }

  const zoneCol  = ZONE_COLOR[truck.zone];
  const isHigh   = truck.priority === 'HIGH';

  return (
    <g style={{ transition: 'transform 0.6s ease' }}>
      {/* Trailer body */}
      <rect x={txLeft + cabW} y={ty} width={110 - cabW} height={th} rx={2}
        fill="#f8fafc" stroke="#64748b" strokeWidth={1.5} />
      {/* Accent stripe — zone colour */}
      <rect x={txLeft + cabW} y={ty + th - 9} width={110 - cabW} height={5} rx={0}
        fill={zoneCol} opacity={0.7} />
      {/* Cab */}
      <rect x={txLeft} y={ty + 5} width={cabW} height={th - 5} rx={3}
        fill={isHigh ? '#f97316' : '#94a3b8'} stroke={isHigh ? '#ea580c' : '#64748b'} strokeWidth={1.5} />
      {/* Windshield */}
      <rect x={txLeft + 5} y={ty + 9} width={cabW - 10} height={12} rx={2} fill="#bae6fd" opacity={0.7} />
      {/* Wheels */}
      {[txLeft + 10, txLeft + cabW + 15, txLeft + cabW + 55].map((wx, i) => (
        <ellipse key={i} cx={wx} cy={ty + th} rx={7} ry={5} fill="#1e293b" />
      ))}
      {/* Pallet count badge */}
      <rect x={txLeft + cabW + 8} y={ty + 5} width={28} height={14} rx={3} fill={zoneCol + 'cc'} />
      <text x={txLeft + cabW + 22} y={ty + 15} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
        {truck.pallets}p
      </text>
      {/* Carrier name */}
      <text x={txLeft + cabW + 40} y={ty + 22} textAnchor="middle" fontSize={7} fill="#475569">
        {truck.carrier.split(' ')[0]}
      </text>
      {/* Zone badge */}
      <rect x={txLeft + cabW + 6} y={ty + 24} width={16} height={11} rx={2} fill={zoneCol} />
      <text x={txLeft + cabW + 14} y={ty + 32} textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff">
        Z{truck.zone}
      </text>
      {isHigh && (
        <text x={txLeft + 2} y={ty - 4} fontSize={7} fontWeight={700} fill="#dc2626">▲HIGH</text>
      )}
    </g>
  );
}

// ── Shipping truck component (right side) ─────────────────────────────────────
function ShipTruck({ y, fill, label }: { y: number; fill: number; label: string }) {
  const txLeft = BR + 4;
  const ty     = y - 23;
  const th     = 46;
  const cabW   = 34;
  const barW   = Math.round((110 - cabW) * fill / 100);
  const barCol = fill > 90 ? '#16a34a' : fill > 60 ? '#d97706' : '#dc2626';

  return (
    <g>
      {/* Trailer */}
      <rect x={txLeft} y={ty} width={110 - cabW} height={th} rx={2}
        fill="#f8fafc" stroke="#64748b" strokeWidth={1.5} />
      {/* Fill bar */}
      <rect x={txLeft + 2} y={ty + th - 10} width={barW - 4} height={6} rx={2} fill={barCol} opacity={0.8} />
      {/* Cab */}
      <rect x={txLeft + 110 - cabW} y={ty + 5} width={cabW} height={th - 5} rx={3}
        fill="#6366f1" stroke="#4f46e5" strokeWidth={1.5} />
      {/* Windshield */}
      <rect x={txLeft + 110 - cabW + 5} y={ty + 9} width={cabW - 10} height={12} rx={2} fill="#c7d2fe" opacity={0.8} />
      {/* Wheels */}
      {[txLeft + 12, txLeft + 48, txLeft + 110 - cabW + 20].map((wx, i) => (
        <ellipse key={i} cx={wx} cy={ty + th} rx={7} ry={5} fill="#1e293b" />
      ))}
      <text x={txLeft + (110 - cabW) / 2} y={ty + th / 2 - 2} textAnchor="middle" fontSize={9} fontWeight={700} fill="#374151">
        {label}
      </text>
      <text x={txLeft + (110 - cabW) / 2} y={ty + th / 2 + 9} textAnchor="middle" fontSize={8} fill="#64748b">
        {fill}%
      </text>
    </g>
  );
}

// ── Pallet stack in staging ────────────────────────────────────────────────────
function PalletStack({ x, y, count, max }: { x: number; y: number; count: number; max: number }) {
  const isCongested = count >= 6;
  const rows = Math.min(count, 4);
  const col  = isCongested ? '#f97316' : '#a16207';

  return (
    <g>
      {Array.from({ length: rows }, (_, i) => (
        <rect key={i} x={x} y={y - i * 6} width={18} height={5} rx={1}
          fill={col} stroke="#92400e" strokeWidth={0.5} opacity={0.85 - i * 0.1} />
      ))}
      {count > max / 2 && (
        <text x={x + 9} y={y - rows * 6 - 2} textAnchor="middle" fontSize={7}
          fontWeight={700} fill={isCongested ? '#dc2626' : '#92400e'}>
          {count}
        </text>
      )}
    </g>
  );
}

// ── Main SVG component ─────────────────────────────────────────────────────────
export function DockLayoutSVG({ phase }: Props) {
  const isOpt = phase === 'optimised';

  const recvTrucks: Array<{ id: string; carrier: string; zone: string; priority: string; pallets: number } | null> = isOpt
    ? [
        { id: 'T-103', carrier: 'Old Dominion',  zone: 'A', priority: 'HIGH',   pallets: 44 },
        { id: 'T-104', carrier: 'Estes Express', zone: 'B', priority: 'NORMAL', pallets: 28 },
        { id: 'T-105', carrier: 'Saia LTL',      zone: 'C', priority: 'LOW',    pallets: 18 },
      ]
    : [
        null,
        null,
        { id: 'T-103', carrier: 'Old Dominion',  zone: 'A', priority: 'HIGH',   pallets: 44 },
      ];

  // Baseline queue (visible far left, faded)
  const queuedTrucks = isOpt ? [] : [
    { id: 'T-104', carrier: 'Estes Express', zone: 'B', priority: 'NORMAL', pallets: 28 },
    { id: 'T-105', carrier: 'Saia LTL',      zone: 'C', priority: 'LOW',    pallets: 18 },
  ];

  const shipFill   = isOpt ? [98, 100, 89] : [92, 100, 23];
  const stagPallets = isOpt ? [8, 1, 2] : [8, 1, 8];

  // Build left wall segments (gap = bay opening)
  const leftWall: Array<{ x: number; y: number; h: number }> = [];
  leftWall.push({ x: BL, y: BT,               h: BAY_Y[0] - BAY_H / 2 - BT });
  leftWall.push({ x: BL, y: BAY_Y[0] + BAY_H / 2, h: BAY_Y[1] - BAY_H / 2 - (BAY_Y[0] + BAY_H / 2) });
  leftWall.push({ x: BL, y: BAY_Y[1] + BAY_H / 2, h: BAY_Y[2] - BAY_H / 2 - (BAY_Y[1] + BAY_H / 2) });
  leftWall.push({ x: BL, y: BAY_Y[2] + BAY_H / 2, h: BB - (BAY_Y[2] + BAY_H / 2) });

  // Build right wall segments
  const rightWall = leftWall.map(s => ({ ...s, x: BR - WALL }));

  // Path from receiving dock to its zone
  function recvPath(dockIdx: number, zoneKey: string, isOptPath: boolean) {
    const fromX = ZONE_X0;
    const fromY = BAY_Y[dockIdx];
    const toY   = (ZONE_Y[zoneKey][0] + ZONE_Y[zoneKey][1]) / 2;
    const toX   = ZONE_X1 - 20;

    if (fromY === toY || isOptPath) {
      // Straight horizontal for matching zone, gentle curve for others
      const midX = (fromX + toX) / 2;
      return `M${fromX},${fromY} Q${midX},${fromY} ${toX},${toY}`;
    }
    // Suboptimal — noticeable curve showing long path
    const midX = fromX + 30;
    return `M${fromX},${fromY} C${midX},${fromY} ${toX},${fromY} ${toX},${toY}`;
  }

  type PathInfo = {
    d: string;
    stroke: string;
    strokeW: number;
    dash: string;
    label: string;
    labelX: number;
    labelY: number;
  };

  const paths: PathInfo[] = [];

  if (isOpt) {
    // Optimal paths — each dock to matching zone, straight, cyan
    ['A', 'B', 'C'].forEach((z, i) => {
      const fromX = ZONE_X0;
      const fromY = BAY_Y[i];
      const midY  = (ZONE_Y[z][0] + ZONE_Y[z][1]) / 2;
      paths.push({
        d: `M${fromX},${fromY} H${ZONE_X1 - 22}`,
        stroke: '#0891b2',
        strokeW: 2.5,
        dash: 'none',
        label: `${OPTIMAL_PATH_M[z]} m`,
        labelX: fromX + (ZONE_X1 - 22 - fromX) / 2,
        labelY: fromY - 6,
      });
    });
  } else {
    // Baseline: T-103 at R-3 (dock index 2) → Zone A (top zone)
    // Long curved red path
    const fromX = ZONE_X0;
    const fromY = BAY_Y[2]; // R-3
    const toY   = (ZONE_Y['A'][0] + ZONE_Y['A'][1]) / 2;
    const toX   = ZONE_X1 - 22;
    paths.push({
      d: `M${fromX},${fromY} C${fromX + 40},${fromY} ${fromX + 40},${toY} ${toX},${toY}`,
      stroke: '#dc2626',
      strokeW: 2,
      dash: '6 4',
      label: `${SUBOPT_PATH_M} m  ⚠`,
      labelX: fromX + 22,
      labelY: (fromY + toY) / 2,
    });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {/* Background */}
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" />

      {/* ── Building floor ── */}
      <rect x={BL} y={BT} width={BR - BL} height={BB - BT}
        fill="#ffffff" stroke="#e2e8f0" strokeWidth={1} />

      {/* ── Zone areas ── */}
      {(['A', 'B', 'C'] as const).map(z => (
        <g key={z}>
          <rect x={ZONE_X0} y={ZONE_Y[z][0]} width={ZONE_X1 - ZONE_X0} height={ZONE_Y[z][1] - ZONE_Y[z][0]}
            fill={ZONE_BG[z]} stroke={ZONE_COLOR[z]} strokeWidth={1.5} strokeDasharray="4 3" rx={4} opacity={0.9} />
          <text x={ZONE_X0 + (ZONE_X1 - ZONE_X0) / 2} y={ZONE_Y[z][0] + 14}
            textAnchor="middle" fontSize={9} fontWeight={700} fill={ZONE_COLOR[z]}>
            Zone {z}
          </text>
          <text x={ZONE_X0 + (ZONE_X1 - ZONE_X0) / 2} y={ZONE_Y[z][0] + 26}
            textAnchor="middle" fontSize={8} fill={ZONE_COLOR[z]} opacity={0.7}>
            {z === 'A' ? 'High-Vel' : z === 'B' ? 'Med-Vel' : 'Low-Vel'}
          </text>
        </g>
      ))}

      {/* ── Staging area divider lines ── */}
      <line x1={STAG_X0 - 20} y1={BT} x2={STAG_X0 - 20} y2={BB}
        stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={STAG_X0 + (STAG_X1 - STAG_X0) / 2} y={BT + 14}
        textAnchor="middle" fontSize={9} fontWeight={700} fill="#9ca3af">
        STAGING AREA
      </text>

      {/* ── Staging pallet stacks ── */}
      {BAY_Y.map((by, i) => {
        const cx  = STAG_X0 + (STAG_X1 - STAG_X0) / 2;
        const cnt = stagPallets[i];
        const congested = cnt >= 6;
        return (
          <g key={i}>
            {/* Staging zone backing */}
            <rect x={STAG_X0} y={ZONE_Y[String.fromCharCode(65 + i)][0]}
              width={STAG_X1 - STAG_X0}
              height={ZONE_Y[String.fromCharCode(65 + i)][1] - ZONE_Y[String.fromCharCode(65 + i)][0]}
              fill={congested ? '#fef2f2' : '#f9fafb'} stroke={congested ? '#fecaca' : '#e5e7eb'}
              strokeWidth={1} rx={3} />
            {/* Pallet icons */}
            {Array.from({ length: Math.min(cnt, 6) }, (_, j) => (
              <PalletStack
                key={j}
                x={STAG_X0 + 12 + j * 24}
                y={by + 10}
                count={j === 0 ? cnt : 1}
                max={6}
              />
            ))}
            {/* S-label */}
            <text x={STAG_X0 + 6} y={ZONE_Y[String.fromCharCode(65 + i)][0] + 13}
              fontSize={9} fontWeight={700} fill={congested ? '#dc2626' : '#6b7280'}>
              S-{i + 1} {congested ? '⚠' : ''}
            </text>
            <text x={STAG_X0 + 6} y={ZONE_Y[String.fromCharCode(65 + i)][0] + 24}
              fontSize={8} fill="#9ca3af">{cnt} pallets</text>
          </g>
        );
      })}

      {/* ── Path lines ── */}
      {paths.map((p, i) => (
        <g key={i}>
          {/* Glow effect for optimal paths */}
          {p.dash === 'none' && (
            <path d={p.d} stroke={p.stroke} strokeWidth={p.strokeW + 4}
              fill="none" opacity={0.15} strokeLinecap="round" />
          )}
          <path d={p.d} stroke={p.stroke} strokeWidth={p.strokeW}
            fill="none" strokeDasharray={p.dash === 'none' ? undefined : p.dash}
            strokeLinecap="round" markerEnd={p.dash === 'none' ? `url(#arrow-${p.stroke.replace('#', '')})` : undefined} />
          {/* Distance label */}
          <rect x={p.labelX - 18} y={p.labelY - 9} width={38} height={14} rx={3}
            fill={p.dash === 'none' ? '#ecfeff' : '#fef2f2'}
            stroke={p.dash === 'none' ? '#a5f3fc' : '#fecaca'} strokeWidth={0.8} />
          <text x={p.labelX + 1} y={p.labelY + 1} textAnchor="middle"
            fontSize={7.5} fontWeight={700} fill={p.dash === 'none' ? '#0e7490' : '#dc2626'}>
            {p.label}
          </text>
        </g>
      ))}

      {/* ── Left wall (receiving) ── */}
      {leftWall.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={WALL} height={s.h} fill="#374151" />
      ))}

      {/* ── Right wall (shipping) ── */}
      {rightWall.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={WALL} height={s.h} fill="#374151" />
      ))}

      {/* ── Top & Bottom walls ── */}
      <rect x={BL} y={BT}          width={BR - BL} height={WALL} fill="#374151" />
      <rect x={BL} y={BB - WALL}   width={BR - BL} height={WALL} fill="#374151" />

      {/* ── Dock doors (dark rectangles in bay openings) ── */}
      {BAY_Y.map((by, i) => (
        <g key={i}>
          {/* Receiving door */}
          <rect x={BL - 1} y={by - BAY_H / 2} width={WALL + 2} height={BAY_H}
            fill="#1e293b" stroke="#475569" strokeWidth={1} />
          <rect x={BL + 1} y={by - BAY_H / 2 + 3} width={WALL - 2} height={BAY_H - 6}
            fill="#0f172a" />
          {/* Dock label — placed inside the door opening so it never collides with truck text */}
          <text x={BL + WALL / 2 + 1} y={by - BAY_H / 2 - 5} textAnchor="middle" fontSize={8}
            fontWeight={700} fill="#94a3b8">R-{i + 1}</text>
          {/* Shipping door */}
          <rect x={BR - WALL - 1} y={by - BAY_H / 2} width={WALL + 2} height={BAY_H}
            fill="#1e293b" stroke="#475569" strokeWidth={1} />
          <rect x={BR - WALL + 1} y={by - BAY_H / 2 + 3} width={WALL - 2} height={BAY_H - 6}
            fill="#0f172a" />
          <text x={BR - WALL / 2 - 1} y={by - BAY_H / 2 - 5} textAnchor="middle" fontSize={8}
            fontWeight={700} fill="#94a3b8">S-{i + 1}</text>
        </g>
      ))}

      {/* ── Receiving trucks ── */}
      {BAY_Y.map((by, i) => (
        <RecvTruck key={i} y={by} truck={recvTrucks[i]} />
      ))}

      {/* ── Queued trucks (baseline only, shown faded below last dock) ── */}
      {queuedTrucks.map((t, i) => (
        <RecvTruck key={t.id} y={BB + 20 + i * 60} truck={t as any} queued />
      ))}

      {/* ── Shipping trucks ── */}
      {BAY_Y.map((by, i) => (
        <ShipTruck key={i} y={by} fill={shipFill[i]} label={`S-${i + 1}`} />
      ))}

      {/* ── Column labels ── */}
      <text x={(BL + ZONE_X1) / 2} y={BB + 14} textAnchor="middle"
        fontSize={9} fontWeight={700} fill="#64748b" letterSpacing={1}>
        RECEIVING ZONE
      </text>
      <text x={(STAG_X0 + STAG_X1) / 2} y={BB + 14} textAnchor="middle"
        fontSize={9} fontWeight={700} fill="#64748b" letterSpacing={1}>
        STAGING
      </text>
      <text x={15} y={BB + 14} fontSize={8} fill="#9ca3af">← Inbound trucks</text>
      <text x={W - 10} y={BB + 14} textAnchor="end" fontSize={8} fill="#9ca3af">Outbound trucks →</text>

      {/* ── Phase badge ── */}
      {isOpt ? (
        <g>
          <rect x={W / 2 - 80} y={BT - 30} width={160} height={22} rx={11}
            fill="#0891b2" />
          <text x={W / 2} y={BT - 15} textAnchor="middle" fontSize={9}
            fontWeight={700} fill="#fff" letterSpacing={0.5}>
            ✓ AI OPTIMISED — 3 DOCKS ACTIVE
          </text>
        </g>
      ) : (
        <g>
          <rect x={W / 2 - 80} y={BT - 30} width={160} height={22} rx={11}
            fill="#dc2626" />
          <text x={W / 2} y={BT - 15} textAnchor="middle" fontSize={9}
            fontWeight={700} fill="#fff" letterSpacing={0.5}>
            ⚠ BASELINE — SUBOPTIMAL ROUTING
          </text>
        </g>
      )}

      {/* ── Legend ── */}
      <g transform={`translate(${BL}, ${BB + 26})`}>
        <rect x={0} y={0} width={10} height={3} rx={1} fill="#0891b2" />
        <text x={14} y={4} fontSize={8} fill="#374151">Optimal path</text>
        <rect x={80} y={0} width={10} height={3} rx={1} fill="#dc2626"
          style={{ strokeDasharray: '4 2' }} stroke="#dc2626" />
        <text x={94} y={4} fontSize={8} fill="#374151">Suboptimal</text>
        <circle cx={175} cy={2} r={3} fill="#ea580c" />
        <text x={181} y={4} fontSize={8} fill="#374151">Zone A · High-Vel</text>
        <circle cx={270} cy={2} r={3} fill="#16a34a" />
        <text x={276} y={4} fontSize={8} fill="#374151">Zone B · Med-Vel</text>
        <circle cx={355} cy={2} r={3} fill="#7c3aed" />
        <text x={361} y={4} fontSize={8} fill="#374151">Zone C · Low-Vel</text>
      </g>

      {/* ── Arrow marker defs ── */}
      <defs>
        {['0891b2'].map(c => (
          <marker key={c} id={`arrow-${c}`} markerWidth={6} markerHeight={6}
            refX={5} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={`#${c}`} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
