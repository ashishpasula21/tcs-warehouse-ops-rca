import { useEffect, useState } from 'react';

export type LoadMode = 'baseline' | 'optimised';

interface Props {
  mode: LoadMode;
  animated?: boolean;
}

// ── Grid constants ─────────────────────────────────────────────────────────────
// 6 columns × 4 rows of pallet positions, viewed from behind the trailer
const COLS = 6;
const ROWS = 4;
const CELL_W = 66;
const CELL_H = 58;
const TOP_H  = 16;   // height of top-face perspective strip
const TOP_DX = 6;    // horizontal offset of top-face (isometric shift)

// Grid origin inside the SVG
const GRID_X0 = 52;
const GRID_Y0 = 44;

// Total SVG size
const SVG_W  = COLS * CELL_W + GRID_X0 + TOP_DX + 40;  // ~490
const SVG_H  = ROWS * CELL_H + GRID_Y0 + TOP_H + 60;    // ~320

// ── Box size categories ────────────────────────────────────────────────────────
type BoxSize = 'L' | 'M' | 'S' | '';

// Colors: front face, top face, label
const BOX_STYLE: Record<BoxSize, { front: string; top: string; label: string; text: string }> = {
  L: { front: '#9a6530', top: '#b8874b', label: '#7a4f28', text: '#fff' },
  M: { front: '#c8924a', top: '#d4a462', label: '#92400e', text: '#fff' },
  S: { front: '#d4a462', top: '#e5c07a', label: '#a16207', text: '#fff' },
  '': { front: '#e5e7eb', top: '#d1d5db', label: '#9ca3af', text: '#9ca3af' },
};

// ── Packing grids ──────────────────────────────────────────────────────────────
// Row 0 = top row (visually highest), Row 3 = floor
const BASELINE_GRID: BoxSize[][] = [
  ['',  'S', '',  '',  'S', '' ],   // row 0 top — lots of empty space
  ['M', '',  'S', 'M', '',  'S'],   // row 1
  ['',  'M', 'L', '',  '',  'M'],   // row 2
  ['L', 'S', '',  'M', '',  'S'],   // row 3 floor — gaps on floor
];

const OPTIMISED_GRID: BoxSize[][] = [
  ['S', 'S', 'S', 'S', 'S', 'S'],   // row 0 top — small boxes fill top
  ['M', 'M', 'M', 'M', 'M', 'M'],   // row 1 — medium fill middle
  ['M', 'M', 'L', 'L', 'M', 'M'],   // row 2 — large mixed in
  ['L', 'L', 'L', 'L', 'L', 'L'],   // row 3 floor — large at base
];

// Fill rate calculation
function computeFill(grid: BoxSize[][]): number {
  const total  = ROWS * COLS;
  const filled = grid.flat().filter(c => c !== '').length;
  return Math.round((filled / total) * 100);
}

// ── Single box drawn as 2.5D ──────────────────────────────────────────────────
function Box({
  col, row, size, visible,
}: {
  col: number; row: number; size: BoxSize; visible: boolean;
}) {
  const x  = GRID_X0 + col * CELL_W;
  const y  = GRID_Y0 + row * CELL_H;
  const s  = BOX_STYLE[size];
  const px = 3;  // padding inside cell

  if (!visible) return null;

  if (size === '') {
    // Empty cell — hatching pattern
    return (
      <g>
        <rect x={x + px} y={y + px + TOP_H} width={CELL_W - px * 2} height={CELL_H - px * 2}
          fill={`url(#hatch)`} stroke="#d1d5db" strokeWidth={0.8} rx={2} opacity={0.7} />
      </g>
    );
  }

  const fw = CELL_W - px * 2;
  const fh = CELL_H - px * 2;

  // Top face (isometric parallelogram)
  // Points: bottom-left, bottom-right, top-right+dx, top-left+dx
  const tx  = x + px;
  const ty  = y + px;
  const pts = [
    `${tx},${ty + TOP_H}`,
    `${tx + fw},${ty + TOP_H}`,
    `${tx + fw + TOP_DX},${ty}`,
    `${tx + TOP_DX},${ty}`,
  ].join(' ');

  // Size label inside box
  const sizeLabel = size === 'L' ? 'LARGE' : size === 'M' ? 'MED' : 'SMALL';

  return (
    <g style={{ transition: 'opacity 0.4s' }}>
      {/* Top face (isometric) */}
      <polygon points={pts} fill={s.top} stroke="#fff" strokeWidth={0.8} />
      {/* Front face */}
      <rect x={tx} y={ty + TOP_H} width={fw} height={fh}
        fill={s.front} stroke="#fff" strokeWidth={0.8} rx={1} />
      {/* Size label on front face */}
      <text x={tx + fw / 2} y={ty + TOP_H + fh / 2 + 4}
        textAnchor="middle" fontSize={8} fontWeight={700} fill={s.text} opacity={0.85}>
        {sizeLabel}
      </text>
      {/* Box outline shadow */}
      <rect x={tx} y={ty + TOP_H} width={fw} height={fh}
        fill="none" stroke="#00000018" strokeWidth={2} rx={1} />
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function TruckLoadView({ mode, animated = false }: Props) {
  const [visibleCount, setVisibleCount] = useState(animated ? 0 : 999);

  useEffect(() => {
    if (!animated) { setVisibleCount(999); return; }
    setVisibleCount(0);
    const total = ROWS * COLS;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= total) clearInterval(t);
    }, 60);
    return () => clearInterval(t);
  }, [mode, animated]);

  const grid = mode === 'optimised' ? OPTIMISED_GRID : BASELINE_GRID;
  const fill = computeFill(grid);

  // For animation: cells reveal in order (floor row first for optimised, random for baseline)
  const cellOrder: [number, number][] = [];
  if (mode === 'optimised') {
    // Bottom-up: row 3 first, then 2, then 1, then 0
    for (let r = ROWS - 1; r >= 0; r--)
      for (let c = 0; c < COLS; c++)
        cellOrder.push([r, c]);
  } else {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        cellOrder.push([r, c]);
  }

  // Determine which cells are visible based on visibleCount
  const visibleSet = new Set(cellOrder.slice(0, visibleCount).map(([r, c]) => `${r}-${c}`));

  // Trailer frame dimensions
  const frameX  = GRID_X0 - 16;
  const frameY  = GRID_Y0 - 12;
  const frameW  = COLS * CELL_W + 32 + TOP_DX;
  const frameH  = ROWS * CELL_H + 28 + TOP_H;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          {/* Hatch pattern for empty cells */}
          <pattern id="hatch" patternUnits="userSpaceOnUse" width={8} height={8}>
            <path d="M0,8 L8,0" stroke="#d1d5db" strokeWidth={1} />
          </pattern>
        </defs>

        {/* ── Trailer frame (dark outer shell) ── */}
        <rect x={frameX - 10} y={frameY - 8} width={frameW + 20} height={frameH + 16}
          rx={6} fill="#1e293b" />
        {/* Trailer interior dark background */}
        <rect x={frameX} y={frameY} width={frameW} height={frameH}
          rx={3} fill="#0f172a" />
        {/* Floor strip */}
        <rect x={frameX} y={frameY + frameH - 14} width={frameW} height={14}
          fill="#1e293b" rx={0} />
        {/* Ceiling strip */}
        <rect x={frameX} y={frameY} width={frameW} height={12} fill="#1e293b" />
        {/* Left wall strip */}
        <rect x={frameX} y={frameY + 12} width={14} height={frameH - 26} fill="#1e293b" />
        {/* Right wall strip */}
        <rect x={frameX + frameW - 14} y={frameY + 12} width={14} height={frameH - 26}
          fill="#1e293b" />

        {/* ── Grid background (interior floor) ── */}
        <rect x={GRID_X0 - 2} y={GRID_Y0 - 2 + TOP_H}
          width={COLS * CELL_W + 4 + TOP_DX} height={ROWS * CELL_H + 4}
          fill="#1e293b" rx={2} />

        {/* ── Render boxes ── */}
        {grid.map((row, r) =>
          row.map((size, c) => {
            const key   = `${r}-${c}`;
            const vis   = visibleSet.has(key) || visibleCount >= 999;
            return <Box key={key} col={c} row={r} size={size} visible={vis} />;
          })
        )}

        {/* ── Row depth lines (perspective guides) ── */}
        {Array.from({ length: ROWS + 1 }, (_, r) => {
          const y = GRID_Y0 + r * CELL_H + TOP_H;
          return (
            <line key={r} x1={GRID_X0} y1={y} x2={GRID_X0 + COLS * CELL_W + TOP_DX} y2={y}
              stroke="#374151" strokeWidth={0.5} />
          );
        })}
        {Array.from({ length: COLS + 1 }, (_, c) => {
          const x = GRID_X0 + c * CELL_W;
          return (
            <line key={c} x1={x} y1={GRID_Y0 + TOP_H} x2={x + TOP_DX} y2={GRID_Y0}
              stroke="#374151" strokeWidth={0.5} />
          );
        })}

        {/* ── Row labels ── */}
        {['Top layer', 'Mid layer', 'Mid-low', 'Floor'].map((lbl, r) => (
          <text key={r} x={GRID_X0 - 8} y={GRID_Y0 + r * CELL_H + CELL_H / 2 + TOP_H + 4}
            textAnchor="end" fontSize={7.5} fill="#64748b">{lbl}</text>
        ))}

        {/* ── Fill rate bar ── */}
        <g transform={`translate(${frameX}, ${frameY + frameH + 14})`}>
          <text x={0} y={10} fontSize={9} fontWeight={700}
            fill={mode === 'optimised' ? '#0891b2' : '#9ca3af'}>
            Fill Rate
          </text>
          <rect x={56} y={0} width={200} height={12} rx={6} fill="#e5e7eb" />
          <rect x={56} y={0} width={fill * 2} height={12} rx={6}
            fill={mode === 'optimised' ? '#0891b2' : '#9ca3af'} />
          <text x={262} y={10} fontSize={10} fontWeight={800}
            fill={mode === 'optimised' ? '#0891b2' : '#6b7280'}>
            {fill}%
          </text>
          {mode === 'optimised' && (
            <text x={296} y={10} fontSize={9} fontWeight={700} fill="#16a34a">
              +17pp
            </text>
          )}
        </g>

        {/* ── Load sequence label ── */}
        {mode === 'optimised' && (
          <g transform={`translate(${frameX}, ${frameY + frameH + 32})`}>
            <text x={0} y={10} fontSize={8} fill="#0891b2" fontWeight={600}>
              Load order:
            </text>
            {[
              { label: 'LARGE', color: '#9a6530', x: 66 },
              { label: 'MEDIUM', color: '#c8924a', x: 118 },
              { label: 'SMALL', color: '#d4a462', x: 182 },
            ].map(({ label, color, x }) => (
              <g key={label}>
                <rect x={x} y={1} width={10} height={8} rx={1} fill={color} />
                <text x={x + 13} y={9} fontSize={8} fill="#374151">{label}</text>
              </g>
            ))}
          </g>
        )}
        {mode === 'baseline' && (
          <g transform={`translate(${frameX}, ${frameY + frameH + 32})`}>
            <text x={0} y={10} fontSize={8} fill="#dc2626" fontWeight={600}>
              ⚠ No sequence plan — random loading — wasted space
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
