import { useState, useEffect, useRef, useCallback } from 'react';

/* ── types ─────────────────────────────────────────────────────── */
type DockStatus = 'idle' | 'staged' | 'loading';
type Priority   = 'URGENT' | 'STANDARD' | 'LOW';

interface DockState {
  id: string; zone: string; productFill: number; status: DockStatus;
  truckId: string | null; loadPct: number; loadStartMin: number;
  loadDurationMin: number; lastClearMin: number;
}
interface Truck { at: number; id: string; priority: Priority; pallets: number; deadline: number; }
interface Decision {
  truckId: string; dockId: string; reason: string; priority: Priority;
  pallets: number; skipped: { dock: string; why: string }[];
}
interface TickerEntry {
  id: string; simMin: number; type: 'assign' | 'complete'; msg: string; dockId: string;
}

/* ── constants ──────────────────────────────────────────────────── */
const TICK_MS   = 500;
const MINS_TICK = 3;
const TOTAL_MIN = 180;

const INIT_DOCKS: DockState[] = [
  { id:'D-01', zone:'Zone A',     productFill:  0, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-30 },
  { id:'D-02', zone:'Carrier B',  productFill: 65, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-15 },
  { id:'D-03', zone:'Cold Chain', productFill:  0, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-45 },
  { id:'D-04', zone:'Priority',   productFill: 82, status:'staged', truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-20 },
  { id:'D-05', zone:'Standard',   productFill: 28, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-10 },
  { id:'D-06', zone:'Overflow',   productFill: 45, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-5  },
  { id:'D-07', zone:'Zone B',     productFill:  0, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-40 },
  { id:'D-08', zone:'Express',    productFill: 78, status:'staged', truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-8  },
  { id:'D-09', zone:'Zone C',     productFill: 15, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-60 },
  { id:'D-10', zone:'Returns',    productFill: 55, status:'idle',   truckId:null, loadPct:0, loadStartMin:-1, loadDurationMin:0, lastClearMin:-25 },
];

const TRUCKS: Truck[] = [
  { at:  3, id:'T-41', priority:'URGENT',   pallets:31, deadline:48  },
  { at:  8, id:'T-42', priority:'STANDARD', pallets:22, deadline:90  },
  { at: 14, id:'T-43', priority:'URGENT',   pallets:28, deadline:55  },
  { at: 22, id:'T-44', priority:'STANDARD', pallets:18, deadline:110 },
  { at: 35, id:'T-45', priority:'LOW',      pallets:12, deadline:150 },
  { at: 42, id:'T-46', priority:'URGENT',   pallets:35, deadline:80  },
  { at: 58, id:'T-47', priority:'STANDARD', pallets:24, deadline:130 },
  { at: 67, id:'T-51', priority:'URGENT',   pallets:29, deadline:105 },
  { at: 75, id:'T-48', priority:'STANDARD', pallets:20, deadline:160 },
  { at: 83, id:'T-52', priority:'LOW',      pallets:14, deadline:170 },
  { at: 90, id:'T-49', priority:'LOW',      pallets:16, deadline:175 },
  { at: 98, id:'T-53', priority:'STANDARD', pallets:26, deadline:165 },
  { at:110, id:'T-50', priority:'URGENT',   pallets:30, deadline:145 },
  { at:125, id:'T-54', priority:'STANDARD', pallets:21, deadline:178 },
];

const P_CLR: Record<Priority, { fg: string; bg: string; border: string; cab: string }> = {
  URGENT:   { fg:'#dc2626', bg:'#fee2e2', border:'#fca5a5', cab:'#991b1b' },
  STANDARD: { fg:'#1d4ed8', bg:'#dbeafe', border:'#93c5fd', cab:'#1e3a8a' },
  LOW:      { fg:'#4b5563', bg:'#f3f4f6', border:'#d1d5db', cab:'#374151' },
};

function fmtMin(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
}

function fillColor(pct: number) {
  if (pct < 20) return '#374151';
  if (pct < 45) return '#dc2626';
  if (pct < 65) return '#f97316';
  if (pct < 80) return '#f59e0b';
  return '#16a34a';
}

/* ── AI assignment ──────────────────────────────────────────────── */
function assignTruck(truck: Truck, docks: DockState[], simMin: number): Decision {
  const avail = docks.filter(d => d.status !== 'loading' && d.productFill >= 75);
  if (avail.length === 0) {
    return { truckId:truck.id, dockId:'QUEUE', reason:'No dock at ≥75% fill — truck held in yard until product is staged', priority:truck.priority, pallets:truck.pallets, skipped:[] };
  }
  const scored = avail.map(d => {
    const fill  = d.productFill / 100;
    const clear = Math.min((simMin - d.lastClearMin) / 30, 1);
    const pri   = truck.priority === 'URGENT' ? 0.25 : truck.priority === 'STANDARD' ? 0.1 : 0;
    const stage = d.status === 'staged' ? 0.15 : 0;
    return { d, sc: fill * 0.45 + clear * 0.15 + pri + stage };
  }).sort((a, b) => b.sc - a.sc);

  const best = scored[0].d;
  const skipped = scored.slice(1, 3).map(s => ({
    dock: s.d.id,
    why: s.d.productFill < 35
      ? `${Math.round(s.d.productFill)}% staged — empty pull risk`
      : `score ${s.sc.toFixed(2)} vs ${scored[0].sc.toFixed(2)}`,
  }));

  const parts: string[] = [];
  if (best.productFill >= 60) parts.push(`${Math.round(best.productFill)}% product ready for immediate loading`);
  else parts.push(`${Math.round(best.productFill)}% staged — best available dock`);
  if (truck.priority === 'URGENT') parts.push(`deadline in ${truck.deadline - simMin} min`);
  if (best.status === 'staged') parts.push('dock pre-staged by warehouse team');
  const tc = simMin - best.lastClearMin;
  if (tc > 10) parts.push(`bay clear ${tc} min — no congestion`);

  return { truckId:truck.id, dockId:best.id, reason:parts.join(' · '), priority:truck.priority, pallets:truck.pallets, skipped };
}

/* ── KPI chip ───────────────────────────────────────────────────── */
function KPIChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
      <span style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
      <span style={{ fontSize:15, fontWeight:800, color:'#111827', fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  );
}

/* ── Top-down dock bay ──────────────────────────────────────────── */
function DockBayTopDown({
  dock, isSelected, onClick,
}: {
  dock: DockState; isSelected: boolean; onClick: () => void;
}) {
  const pct       = dock.productFill;
  const fc        = fillColor(pct);
  const isLoading = dock.status === 'loading';
  const isStaged  = dock.status === 'staged';

  const borderColor = isLoading ? '#3b82f6' : isStaged ? '#f59e0b' : isSelected ? '#e2e8f0' : '#1e293b';
  const glowShadow  = isLoading
    ? '0 0 0 2px #3b82f6, 0 0 16px rgba(59,130,246,0.55)'
    : isStaged
      ? '0 0 0 2px #f59e0b, 0 0 12px rgba(245,158,11,0.45)'
      : isSelected
        ? '0 0 0 2px #e2e8f0'
        : 'none';

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        border: `2px solid ${borderColor}`,
        boxShadow: glowShadow,
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        borderRadius: 3, overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Bay header: ID + status ── */}
      <div style={{
        padding: '3px 5px 2px', background: '#0f172a',
        borderBottom: '1px solid #1e293b', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3,
      }}>
        <span style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.06em' }}>
          {dock.id}
        </span>
        <span style={{
          fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
          background: isLoading ? '#1e3a8a' : isStaged ? '#78350f' : '#1e293b',
          color:      isLoading ? '#93c5fd' : isStaged ? '#fcd34d' : '#475569',
          textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
        }}>
          {dock.status}
        </span>
      </div>

      {/* ── Fill level — the main visual ── */}
      {/* Fixed height so this always renders regardless of container height */}
      <div style={{
        height: 120, flexShrink: 0,
        position: 'relative', overflow: 'hidden',
        background: '#020617',
      }}>
        {/* Fill column — rises from bottom, color-coded */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${pct}%`,
          background: pct < 20
            ? `${fc}50`
            : `linear-gradient(to top, ${fc} 0%, ${fc}cc 50%, ${fc}99 100%)`,
          transition: 'height 0.9s ease',
        }} />

        {/* Loading overlay — blue wash over the fill */}
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0.12) 100%)',
            animation: 'shimmerSlide 2s linear infinite',
          }} />
        )}

        {/* Horizontal tick marks (25 / 50 / 75% guides) */}
        {[25, 50, 75].map(tick => (
          <div key={tick} style={{
            position: 'absolute', left: 0, right: 0,
            bottom: `${tick}%`,
            borderTop: '1px dashed rgba(148,163,184,0.15)',
          }} />
        ))}

        {/* Large centered fill percentage — THE main readout */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 2,
        }}>
          <span style={{
            fontSize: 26, fontWeight: 900, lineHeight: 1,
            color: pct < 10 ? '#334155' : '#ffffff',
            textShadow: pct >= 10 ? '0 1px 6px rgba(0,0,0,0.7)' : 'none',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}>
            {Math.round(pct)}%
          </span>
          {/* Coloured status word under the number */}
          <span style={{
            fontSize: 8, fontWeight: 700, color: fc,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}>
            {isLoading
              ? `${Math.round(dock.loadPct)}% loaded`
              : pct < 20  ? 'empty'
              : pct < 65  ? 'filling'
              : pct < 80  ? 'staged'
              : 'ready'}
          </span>
        </div>

        {/* Active truck badge */}
        {dock.truckId && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            background: 'rgba(37,99,235,0.85)', borderRadius: 3,
            padding: '1px 5px', fontSize: 8, fontWeight: 700, color: '#bfdbfe',
          }}>
            ▲ {dock.truckId}
          </div>
        )}
      </div>

      {/* ── Dock leveler strip ── */}
      <div style={{
        height: 6, flexShrink: 0,
        background: 'repeating-linear-gradient(to right, #1e293b 0px, #1e293b 5px, #334155 5px, #334155 7px)',
        borderTop: '1px solid #334155', borderBottom: '1px solid #0f172a',
      }} />

      {/* ── Bay footer: zone name ── */}
      <div style={{
        padding: '3px 5px 4px', background: '#0a1120', flexShrink: 0,
      }}>
        <div style={{
          fontSize: 8, color: '#475569',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {dock.zone}
        </div>
      </div>

      {/* Staged pulse border */}
      {isStaged && (
        <div style={{
          position: 'absolute', inset: -2, borderRadius: 4, pointerEvents: 'none',
          border: '2px solid #f59e0b',
          animation: 'pulseRing 2.2s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

/* ── Top-down truck (viewed from above) ────────────────────────── */
function TruckTopDown({
  truckId, priority, parked, loadPct,
}: {
  truckId: string; priority: Priority; parked: boolean; loadPct: number;
}) {
  const p = P_CLR[priority];

  return (
    <div style={{
      width: '100%',
      transform: parked ? 'translateY(0)' : 'translateY(220px)',
      opacity: parked ? 1 : 0,
      transition: 'transform 1.8s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease',
      display: 'flex', flexDirection: 'column',
      gap: 0,
    }}>
      {/* Trailer body (top = toward dock — trucks back in) */}
      <div style={{
        background: '#d1d5db',
        border: `2px solid ${p.border}`,
        borderBottom: 'none',
        borderRadius: '2px 2px 0 0',
        position: 'relative',
        overflow: 'hidden',
        height: 160,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3,
      }}>
        {/* Trailer panel lines */}
        {[25, 50, 75].map(xp => (
          <div key={xp} style={{
            position: 'absolute', top: 0, bottom: 0, left: `${xp}%`,
            width: 1, background: 'rgba(0,0,0,0.12)',
          }} />
        ))}

        {/* Loading progress overlay (fills trailer from top down — loaded from dock end) */}
        {loadPct > 0 && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: `${loadPct}%`,
            background: 'rgba(59,130,246,0.32)',
            transition: 'height 0.5s ease',
          }} />
        )}

        {/* Truck ID */}
        <span style={{ fontSize: 9, fontWeight: 700, color: '#374151', zIndex: 1, letterSpacing: '0.04em' }}>
          {truckId}
        </span>
        {loadPct > 0 && (
          <span style={{ fontSize: 8, color: '#1d4ed8', fontWeight: 600, zIndex: 1 }}>
            {Math.round(loadPct)}% loaded
          </span>
        )}
      </div>

      {/* Cab (bottom = facing away from dock) */}
      <div style={{
        height: 20, background: p.cab,
        borderRadius: '0 0 3px 3px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Windshield strip */}
        <div style={{ position: 'absolute', bottom: 4, left: 6, right: 6, height: 5, background: 'rgba(147,197,253,0.4)', borderRadius: 1 }} />
        {/* Priority badge */}
        <div style={{
          position: 'absolute', bottom: 2, right: 3,
          fontSize: 7, fontWeight: 800, padding: '0px 3px', borderRadius: 2,
          background: p.bg, color: p.fg, border: `1px solid ${p.border}`,
        }}>
          {priority[0]}
        </div>
      </div>
    </div>
  );
}

/* ── Fill color scale legend ────────────────────────────────────── */
function FillLegend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Fill
      </span>
      {[
        { range: '0–20%',  color: '#374151', label: 'Empty' },
        { range: '20–45%', color: '#dc2626', label: 'Low' },
        { range: '45–65%', color: '#f97316', label: 'Moderate' },
        { range: '65–80%', color: '#f59e0b', label: 'Good' },
        { range: '80%+',   color: '#16a34a', label: 'Ready ✓' },
      ].map(({ range, color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{label}</span>
          <span style={{ fontSize: 8, color: '#9ca3af' }}>{range}</span>
        </div>
      ))}
    </div>
  );
}

/* ── main export ─────────────────────────────────────────────────── */
export function DockOptimizerSim({
  dockPhase, setDockPhase,
}: {
  dockPhase: 'baseline' | 'optimised';
  setDockPhase: (p: 'baseline' | 'optimised') => void;
}) {
  const [simMin,       setSimMin]       = useState(0);
  const [running,      setRunning]      = useState(false);
  const [paused,       setPaused]       = useState(false);
  const [done,         setDone]         = useState(false);
  const [docks,        setDocks]        = useState<DockState[]>(INIT_DOCKS);
  const [ticker,       setTicker]       = useState<TickerEntry[]>([]);
  const [decisions,    setDecisions]    = useState<Decision[]>([]);
  const [selected,     setSelected]     = useState<Decision | null>(null);
  const [dockedTrucks, setDockedTrucks] = useState<Record<string, { id: string; priority: Priority }>>({});

  const processedRef = useRef(new Set<string>());
  const ivRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerRef    = useRef<HTMLDivElement>(null);

  const doReset = useCallback(() => {
    clearInterval(ivRef.current!);
    processedRef.current = new Set();
    setSimMin(0); setRunning(false); setPaused(false); setDone(false);
    setDocks(INIT_DOCKS); setTicker([]); setDecisions([]);
    setSelected(null); setDockedTrucks({});
    setDockPhase('baseline');
  }, [setDockPhase]);

  const doPause = useCallback(() => { clearInterval(ivRef.current!); setPaused(true); }, []);

  const doResume = useCallback(() => {
    setPaused(false);
    ivRef.current = setInterval(() => {
      setSimMin(p => {
        const n = p + MINS_TICK;
        if (n >= TOTAL_MIN) { clearInterval(ivRef.current!); setRunning(false); setPaused(false); setDone(true); }
        return n;
      });
    }, TICK_MS);
  }, []);

  const doRun = useCallback(() => {
    setRunning(true);
    setDockPhase('optimised');
    const t = setTimeout(() => {
      ivRef.current = setInterval(() => {
        setSimMin(p => {
          const n = p + MINS_TICK;
          if (n >= TOTAL_MIN) { clearInterval(ivRef.current!); setRunning(false); setDone(true); }
          return n;
        });
      }, TICK_MS);
    }, 1400);
    return () => clearTimeout(t);
  }, [setDockPhase]);

  useEffect(() => {
    if (simMin === 0) return;
    const cur = simMin;

    TRUCKS.forEach(truck => {
      if (truck.at > cur - MINS_TICK && truck.at <= cur && !processedRef.current.has(truck.id)) {
        processedRef.current.add(truck.id);
        setDocks(prev => {
          const dec = assignTruck(truck, prev, cur);
          setDecisions(d => [dec, ...d]);
          setSelected(dec);
          if (dec.dockId !== 'QUEUE') {
            setDockedTrucks(dt => ({ ...dt, [dec.dockId]: { id: truck.id, priority: truck.priority } }));
            setTicker(t => [{
              id: `${truck.id}-${cur}`, simMin: cur, type: 'assign' as const,
              msg: `${truck.id} → ${dec.dockId} · ${truck.priority} · ${truck.pallets} pal`,
              dockId: dec.dockId,
            }, ...t].slice(0, 40));
            return prev.map(d => d.id === dec.dockId
              ? { ...d, status:'loading', truckId:truck.id, loadPct:0, loadStartMin:cur, loadDurationMin:0 }
              : d
            );
          }
          return prev;
        });
      }
    });

    setDocks(prev => prev.map(d => {
      if (d.status !== 'loading') {
        const fill = Math.min(d.productFill + Math.random() * 2.5, 100);
        return { ...d, productFill: fill, status: fill >= 75 ? 'staged' : 'idle' };
      }
      const fill = Math.min(d.productFill + Math.random() * 2.5, 100);
      if (fill >= 100) {
        const tid = d.truckId;
        setDockedTrucks(dt => { const n = { ...dt }; delete n[d.id]; return n; });
        setTicker(t => [{
          id: `${d.id}-done-${cur}`, simMin: cur, type: 'complete' as const,
          msg: `${d.id} door clear · ${tid} departed fully loaded`, dockId: d.id,
        }, ...t].slice(0, 40));
        return { ...d, status:'idle', truckId:null, loadPct:0, loadStartMin:-1, lastClearMin:cur, productFill:0 };
      }
      const loadPct = Math.min(((fill - 75) / 25) * 100, 100);
      return { ...d, productFill: fill, loadPct };
    }));
  }, [simMin]);

  useEffect(() => {
    if (tickerRef.current) tickerRef.current.scrollTop = 0;
  }, [ticker.length]);

  const activeCt = docks.filter(d => d.status === 'loading').length;
  const avgFill  = Math.round(docks.reduce((s, d) => s + d.productFill, 0) / docks.length);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, background:'#ffffff' }}>
      <style>{`
        @keyframes pulseRing    { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.018)} }
        @keyframes shimmerSlide { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes tickIn       { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* ── KPI / control bar ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:20, padding:'9px 22px',
        background:'#ffffff', borderBottom:'1px solid #e5e7eb', flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:120 }}>
          <div style={{
            width:8, height:8, borderRadius:'50%', flexShrink:0,
            background: running && !paused ? '#16a34a' : paused ? '#f59e0b' : done ? '#2563eb' : '#d1d5db',
            boxShadow: running && !paused ? '0 0 7px #16a34a' : paused ? '0 0 7px #f59e0b' : 'none',
            transition:'all 0.3s',
          }} />
          <span style={{ fontSize:15, fontWeight:800, color:'#111827', fontVariantNumeric:'tabular-nums' }}>{fmtMin(simMin)}</span>
          <span style={{ fontSize:10, color:'#9ca3af' }}>/ {fmtMin(TOTAL_MIN)}</span>
        </div>
        <div style={{ width:1, height:28, background:'#e5e7eb' }} />
        <KPIChip label="Active Docks" value={`${activeCt} / 10`} />
        <KPIChip label="Avg Fill"     value={`${avgFill}%`} />
        <KPIChip label="Decisions"    value={String(decisions.length)} />
        <div style={{ flex:1 }} />
        {!running && !done && (
          <button onClick={doRun} style={{
            display:'flex', alignItems:'center', gap:7, padding:'8px 20px',
            borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
            background:'#2563eb', color:'#fff', border:'none',
            boxShadow:'0 2px 10px rgba(37,99,235,0.35)',
          }}>▶ Run AI Optimisation</button>
        )}
        {running && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:'#6b7280' }}>
              {paused ? 'Paused — review AI decisions below' : 'Simulating 3-hr shift…'}
            </span>
            <button onClick={paused ? doResume : doPause} style={{
              padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
              background: paused ? '#2563eb' : '#fef3c7',
              color:       paused ? '#fff'    : '#92400e',
              border:      paused ? '1px solid #2563eb' : '1px solid #fcd34d',
            }}>
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button onClick={doReset} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, background:'#f3f4f6', color:'#374151', border:'1px solid #d1d5db', cursor:'pointer' }}>Stop</button>
          </div>
        )}
        {done && (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓ Shift complete · {decisions.length} trucks optimised</span>
            <button onClick={doReset} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:600, background:'#f3f4f6', color:'#374151', border:'1px solid #d1d5db', cursor:'pointer' }}>↺ Reset</button>
          </div>
        )}
      </div>

      {/* ── Main split ── */}
      <div style={{ flex:1, display:'flex', minHeight:0 }}>

        {/* ── Top-down dock scene ── */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column', minHeight:0,
          background:'#0f172a', overflow:'hidden', position:'relative',
        }}>

          {/* ══ WAREHOUSE WALL (top band) ══ */}
          <div style={{
            flexShrink: 0,
            background: 'repeating-linear-gradient(to right, #1e293b 0px, #1e293b 2px, #243044 2px, #243044 18px)',
            borderBottom: '4px solid #334155',
            padding: '8px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{ width: 30, height: 2, background: '#f59e0b', borderRadius: 1 }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Outbound Shipping Dock — Bays D-01 to D-10
            </span>
            <div style={{ width: 30, height: 2, background: '#f59e0b', borderRadius: 1 }} />
          </div>

          {/* ══ BAY ROW — top-down view of dock openings ══ */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 4, padding: '4px 8px 0', background: '#0f172a' }}>
            {docks.map(d => (
              <DockBayTopDown
                key={d.id}
                dock={d}
                isSelected={selected?.dockId === d.id}
                onClick={() => {
                  const dec = decisions.find(de => de.dockId === d.id);
                  if (dec) setSelected(dec);
                }}
              />
            ))}
          </div>

          {/* ══ APRON + TRUCK LANES ══ */}
          <div style={{
            flex: 1, minHeight: 0, position: 'relative',
            /* Concrete texture */
            background: 'repeating-linear-gradient(to bottom, #1e293b 0px, #1e293b 1px, #1a2538 1px, #1a2538 28px)',
            overflow: 'hidden',
          }}>
            {/* Apron top edge / dock seal strip */}
            <div style={{
              height: 10, flexShrink: 0,
              background: 'linear-gradient(to bottom, #334155, #1e293b)',
              marginBottom: 0,
            }} />

            {/* Lane markings — one dashed line per bay */}
            <div style={{
              position: 'absolute', inset: '10px 8px 0',
              display: 'flex', gap: 4,
              pointerEvents: 'none',
            }}>
              {docks.map((d, i) => (
                <div key={d.id} style={{ flex: 1, position: 'relative' }}>
                  {/* Dashed center line */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: '50%',
                    borderLeft: '2px dashed rgba(245,158,11,0.35)',
                    marginLeft: -1,
                  }} />
                  {/* Left lane boundary */}
                  {i === 0 && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 1, background: 'rgba(245,158,11,0.2)' }} />
                  )}
                  {/* Right lane boundary */}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 1, background: 'rgba(245,158,11,0.2)' }} />
                  {/* Bay label on apron */}
                  <div style={{
                    position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 9, fontWeight: 700, color: 'rgba(245,158,11,0.45)',
                    letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{d.id}</div>
                </div>
              ))}
            </div>

            {/* Trucks in their lanes — parked near dock (top of apron), trailer toward dock */}
            <div style={{
              position: 'absolute', inset: '4px 8px 0',
              display: 'flex', gap: 4,
              alignItems: 'flex-start',
              padding: '4px 0 0',
            }}>
              {docks.map(d => {
                const truck = dockedTrucks[d.id];
                return (
                  <div key={d.id} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start' }}>
                    {truck ? (
                      <TruckTopDown
                        truckId={truck.id}
                        priority={truck.priority}
                        parked={true}
                        loadPct={d.loadPct}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* ══ YARD / ROAD (bottom strip) ══ */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
              background: 'linear-gradient(to bottom, #243044 0%, #1e2d42 100%)',
              borderTop: '2px solid #334155',
              display: 'flex', alignItems: 'center', paddingLeft: 10,
            }}>
              <span style={{ fontSize: 8, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Yard / Truck Approach
              </span>
            </div>
          </div>

          {/* ══ LEGEND ══ */}
          <div style={{
            flexShrink: 0, padding: '6px 12px',
            background: '#0f172a', borderTop: '1px solid #1e293b',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <FillLegend />
            <div style={{ width: 1, height: 12, background: '#1e293b' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { color: '#1e3a8a', border: '1px solid #3b82f6', label: 'Loading' },
                { color: '#78350f', border: '1px solid #f59e0b', label: 'Staged' },
                { color: '#1f2937', border: '1px solid #374151', label: 'Idle' },
              ].map(({ color, border, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, border }} />
                  <span style={{ fontSize: 9, color: '#6b7280' }}>{label}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 9, color: '#475569', marginLeft: 'auto' }}>Click a bay to see AI decision</span>
          </div>

          {/* Pre-run hint */}
          {!running && !done && simMin === 0 && (
            <div style={{
              position: 'absolute', bottom: 52, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                background: 'rgba(15,23,42,0.9)', border: '1px solid #1e293b',
                borderRadius: 10, padding: '10px 22px', textAlign: 'center',
                backdropFilter: 'blur(4px)',
              }}>
                <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, marginBottom: 2 }}>
                  Press <span style={{ color: '#60a5fa' }}>Run AI Optimisation</span> to simulate a full 3-hour outbound shift.
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  AI routes each truck to the dock with the most staged product — no empty pulls, no wasted turns.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div style={{ width:300, borderLeft:'1px solid #e5e7eb', display:'flex', flexDirection:'column', background:'#ffffff' }}>

          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e5e7eb', flexShrink:0 }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>AI Decision</div>
            {selected ? (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:16, fontWeight:800, color:'#111827' }}>{selected.truckId} → {selected.dockId}</span>
                  <span style={{
                    fontSize:8, fontWeight:700, padding:'2px 7px', borderRadius:4,
                    background:P_CLR[selected.priority].bg, color:P_CLR[selected.priority].fg,
                    border:`1px solid ${P_CLR[selected.priority].border}`,
                  }}>{selected.priority}</span>
                </div>
                <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.65, marginBottom:10 }}>{selected.reason}</div>
                {selected.skipped.length > 0 && (
                  <div style={{ paddingTop:8, borderTop:'1px solid #f3f4f6' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginBottom:6 }}>Why not other docks</div>
                    {selected.skipped.map((s, i) => (
                      <div key={i} style={{ display:'flex', gap:8, marginBottom:5, alignItems:'flex-start' }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#374151', minWidth:32 }}>{s.dock}</span>
                        <span style={{ fontSize:10, color:'#9ca3af', lineHeight:1.4 }}>{s.why}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize:11, color:'#9ca3af' }}>
                Decisions appear here as trucks are routed. Click a bay to see its last decision.
              </div>
            )}
          </div>

          <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
            <div style={{
              padding:'7px 16px 6px', fontSize:9, fontWeight:700, color:'#9ca3af',
              textTransform:'uppercase', letterSpacing:'0.1em',
              borderBottom:'1px solid #f3f4f6', flexShrink:0,
            }}>Live Activity</div>
            <div ref={tickerRef} style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
              {ticker.length === 0 && (
                <div style={{ padding:'24px 16px', fontSize:11, color:'#9ca3af', textAlign:'center' }}>
                  Awaiting simulation start…
                </div>
              )}
              {ticker.map((entry, i) => (
                <div key={entry.id} style={{
                  padding:'6px 14px 6px 12px', marginLeft:6, marginBottom:3,
                  borderLeft:`2px solid ${entry.type === 'assign' ? '#3b82f6' : '#16a34a'}`,
                  animation: i === 0 ? 'tickIn 0.22s ease-out' : 'none',
                }}>
                  <div style={{ fontSize:10, fontWeight:600, marginBottom:1, color: entry.type === 'assign' ? '#2563eb' : '#16a34a' }}>
                    {entry.type === 'assign' ? '→ Assigned' : '✓ Cleared'}
                  </div>
                  <div style={{ fontSize:11, color:'#374151' }}>{entry.msg}</div>
                  <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>{fmtMin(entry.simMin)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
