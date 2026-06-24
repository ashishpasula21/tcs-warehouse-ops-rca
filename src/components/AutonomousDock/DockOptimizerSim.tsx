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
  id: string; simMin: number; type: 'assign' | 'complete';
  msg: string; dockId: string;
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


const P_CLR: Record<Priority, { fg: string; bg: string; border: string }> = {
  URGENT:   { fg:'#dc2626', bg:'#fee2e2', border:'#fca5a5' },
  STANDARD: { fg:'#1d4ed8', bg:'#dbeafe', border:'#93c5fd' },
  LOW:      { fg:'#4b5563', bg:'#f3f4f6', border:'#d1d5db' },
};

const S_CLR: Record<DockStatus, { bg: string; fg: string }> = {
  idle:    { bg:'#e5e7eb', fg:'#6b7280'  },
  staged:  { bg:'#fef3c7', fg:'#b45309'  },
  loading: { bg:'#dbeafe', fg:'#1d4ed8'  },
};

function fmtMin(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
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

/* ── Dock bay (embedded in wall) ────────────────────────────────── */
function DockBayView({ dock, onClick }: { dock: DockState; onClick: () => void }) {
  const isLoading = dock.status === 'loading';
  const isStaged  = dock.status === 'staged';
  const sc        = S_CLR[dock.status];

  return (
    <div onClick={onClick} style={{ width:78, flexShrink:0, cursor:'pointer', position:'relative' }}>

      {/* Bay number painted on wall above door */}
      <div style={{
        textAlign:'center', paddingBottom:5,
        fontWeight:900, fontSize:12, letterSpacing:'0.08em', color:'#f9fafb',
        textShadow:'0 1px 2px rgba(0,0,0,0.5)',
      }}>
        {dock.id}
      </div>

      {/* Door frame — heavy steel channel */}
      <div style={{
        border:'5px solid #374151',
        borderBottom:'none',
        borderRadius:'2px 2px 0 0',
        boxShadow: isLoading
          ? '0 0 0 2px #3b82f6, 0 0 18px rgba(59,130,246,0.5), inset 0 0 0 2px #1d4ed8'
          : isStaged
            ? '0 0 0 2px #f59e0b, 0 0 10px rgba(245,158,11,0.35)'
            : '0 2px 6px rgba(0,0,0,0.25)',
        transition:'box-shadow 0.4s ease',
        position:'relative',
        overflow:'hidden',
      }}>

        {/* Warehouse interior view through door opening */}
        <div style={{ height:105, background:'#1c1917', position:'relative', overflow:'hidden' }}>

          {/* Interior floor / product fill */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            height:`${dock.productFill}%`,
            background:'linear-gradient(to top, #92400e 0%, #b45309 35%, #d97706 70%, #fbbf24 100%)',
            transition:'height 0.9s ease',
          }}>
            {Array.from({ length: Math.min(Math.floor(dock.productFill / 10), 10) }, (_, i) => (
              <div key={i} style={{
                position:'absolute',
                left:(i % 4) * 23 + 4, bottom:Math.floor(i / 4) * 20 + 4,
                width:19, height:15,
                background:['#fbbf24','#f59e0b','#d97706','#b45309'][i % 4],
                borderRadius:1, border:'1px solid rgba(0,0,0,0.35)', opacity:0.92,
              }} />
            ))}
          </div>

          {/* Loading shimmer sweep */}
          {isLoading && (
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(135deg,transparent 0%,rgba(59,130,246,0.12) 50%,transparent 100%)',
              backgroundSize:'200% 100%',
              animation:'shimmerSlide 1.8s linear infinite',
            }} />
          )}

          {/* Interior overhead light */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:3,
            background: isLoading ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,200,0.18)',
          }} />

          {/* Fill % badge */}
          <div style={{
            position:'absolute', top:5, right:5,
            background:'rgba(0,0,0,0.65)', borderRadius:3, padding:'1px 4px',
            fontSize:9, fontWeight:700,
            color: dock.productFill > 70 ? '#fbbf24' : dock.productFill > 40 ? '#fb923c' : '#9ca3af',
          }}>{Math.round(dock.productFill)}%</div>

          {/* Active truck ID inside bay */}
          {dock.truckId && (
            <div style={{
              position:'absolute', bottom:3, left:0, right:0, textAlign:'center',
              fontSize:8, fontWeight:700, color:'#93c5fd',
              textShadow:'0 0 6px rgba(59,130,246,0.8)',
            }}>⬆ {dock.truckId}</div>
          )}
        </div>

        {/* Dock leveler plate */}
        <div style={{
          height:7, background:'#374151',
          borderTop:'1px solid #4b5563',
          display:'flex', alignItems:'center',
          gap:4, padding:'0 6px', flexShrink:0,
        }}>
          {[0,1,2,3,4,5,6].map(i => (
            <div key={i} style={{ flex:1, height:2, background:'#4b5563', borderRadius:1 }} />
          ))}
        </div>

        {/* Loading progress bar at very bottom of frame */}
        <div style={{ height:3, background:'#1f2937' }}>
          {isLoading && (
            <div style={{ width:`${dock.loadPct}%`, height:'100%', background:'#3b82f6', transition:'width 0.5s ease' }} />
          )}
        </div>
      </div>

      {/* Dock bumpers — yellow rubber, bolted to wall face */}
      <div style={{
        display:'flex', justifyContent:'space-between',
        padding:'0 2px', marginTop:0,
      }}>
        <div style={{
          width:14, height:10,
          background:'linear-gradient(to bottom, #fbbf24 0%, #f59e0b 100%)',
          borderRadius:'0 0 2px 2px',
          border:'1px solid #d97706', borderTop:'none',
          boxShadow:'inset 0 -2px 3px rgba(0,0,0,0.2)',
        }} />
        <div style={{
          width:14, height:10,
          background:'linear-gradient(to bottom, #fbbf24 0%, #f59e0b 100%)',
          borderRadius:'0 0 2px 2px',
          border:'1px solid #d97706', borderTop:'none',
          boxShadow:'inset 0 -2px 3px rgba(0,0,0,0.2)',
        }} />
      </div>

      {/* Status + zone label under bumpers */}
      <div style={{ textAlign:'center', marginTop:4 }}>
        <span style={{
          fontSize:7, fontWeight:700, padding:'1px 6px', borderRadius:3,
          background:sc.bg, color:sc.fg, textTransform:'uppercase', letterSpacing:'0.05em',
          border:`1px solid ${sc.bg}`,
        }}>{dock.status}</span>
        <div style={{ fontSize:8, color:'#d1d5db', marginTop:2 }}>{dock.zone}</div>
      </div>

      {/* Staged pulse ring */}
      {isStaged && (
        <div style={{
          position:'absolute', inset:-3, borderRadius:6, pointerEvents:'none',
          border:'2px solid #f59e0b',
          animation:'pulseRing 2.2s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

/* ── Truck view ──────────────────────────────────────────────────── */
function TruckView({ truckId, priority, parked }: { truckId: string; priority: Priority; parked: boolean }) {
  const cabColor   = priority === 'URGENT' ? '#dc2626' : priority === 'STANDARD' ? '#1d4ed8' : '#4b5563';
  const trailerBdr = priority === 'URGENT' ? '#dc2626' : priority === 'STANDARD' ? '#3b82f6' : '#9ca3af';

  return (
    <div style={{
      width:72, position:'relative', flexShrink:0,
      transform: parked ? 'translateY(0)' : 'translateY(150px)',
      opacity: parked ? 1 : 0,
      transition:'transform 1.8s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease',
    }}>
      {/* Trailer body */}
      <div style={{
        height:38, background:'#e5e7eb',
        border:`2px solid ${trailerBdr}`, borderRight:'none',
        borderRadius:'3px 0 0 3px', marginRight:20,
        position:'relative', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ position:'absolute', top:0, bottom:0, left:`${(i+1)*20}%`, width:1, background:'rgba(0,0,0,0.1)' }} />
        ))}
        <span style={{ fontSize:7, fontWeight:700, color:'#374151', zIndex:1 }}>{truckId}</span>
        <span style={{
          position:'absolute', top:2, right:4,
          fontSize:6, fontWeight:700, padding:'1px 3px', borderRadius:2,
          background:P_CLR[priority].bg, color:P_CLR[priority].fg,
          border:`1px solid ${P_CLR[priority].border}`,
        }}>{priority[0]}</span>
      </div>
      {/* Cab */}
      <div style={{
        position:'absolute', right:0, top:4, width:22, height:32,
        background:cabColor, borderRadius:'0 4px 4px 0',
        display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:4,
      }}>
        <div style={{ width:12, height:8, background:'rgba(255,255,255,0.3)', borderRadius:2 }} />
      </div>
      {/* Wheels */}
      {[4, 32, 52].map((lx, wi) => (
        <div key={wi} style={{
          position:'absolute', bottom:-4, left:lx,
          width:11, height:9, borderRadius:'50%',
          background:'#1f2937', border:'2px solid #4b5563',
        }} />
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

  const doPause = useCallback(() => {
    clearInterval(ivRef.current!);
    setPaused(true);
  }, []);

  const doResume = useCallback(() => {
    setPaused(false);
    ivRef.current = setInterval(() => {
      setSimMin(p => {
        const n = p + MINS_TICK;
        if (n >= TOTAL_MIN) {
          clearInterval(ivRef.current!);
          setRunning(false);
          setPaused(false);
          setDone(true);
        }
        return n;
      });
    }, TICK_MS);
  }, [setDockPhase]);

  const doRun = useCallback(() => {
    setRunning(true);
    setDockPhase('optimised');
    const t = setTimeout(() => {
      ivRef.current = setInterval(() => {
        setSimMin(p => {
          const n = p + MINS_TICK;
          if (n >= TOTAL_MIN) {
            clearInterval(ivRef.current!);
            setRunning(false);
            setDone(true);
          }
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
      // All non-loading docks: keep filling passively
      if (d.status !== 'loading') {
        const fill = Math.min(d.productFill + Math.random() * 2.5, 100);
        return { ...d, productFill: fill, status: fill >= 75 ? 'staged' : 'idle' };
      }
      // Loading dock: keep filling toward 100%; truck departs when full
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
      // loadPct shows progress from 75% (arrival) → 100% (full load)
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

        {/* ── Dock scene ── */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start',
          padding:'16px 8px 8px', perspective:'1200px', perspectiveOrigin:'50% 30%',
          overflow:'hidden', background:'#f8fafc',
        }}>
          <div style={{
            transform:'rotateX(48deg) scale(0.78)', transformOrigin:'top center',
            transformStyle:'preserve-3d', width:'100%', maxWidth:1100,
          }}>

            {/* ═══ WAREHOUSE EXTERIOR WALL ═══ */}
            <div style={{
              /* Corrugated metal panels: alternating darker and lighter horizontal bands */
              background:'repeating-linear-gradient(to bottom, #78828c 0px, #8c97a3 4px, #9faab5 7px, #8c97a3 10px, #78828c 14px)',
              borderRadius:'6px 6px 0 0',
              paddingTop:14,
              paddingBottom:16,
              borderTop:'10px solid #4b5563',  /* parapet / roofline edge */
              boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
              position:'relative',
            }}>

              {/* Company signage strip on wall */}
              <div style={{
                background:'rgba(0,0,0,0.35)', margin:'0 20px 12px',
                borderRadius:3, padding:'4px 0',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>
                <div style={{ width:20, height:2, background:'#fbbf24', borderRadius:1 }} />
                <span style={{
                  fontSize:9, fontWeight:800, color:'#f9fafb',
                  letterSpacing:'0.2em', textTransform:'uppercase',
                }}>Outbound Shipping Dock — Bays 01–10</span>
                <div style={{ width:20, height:2, background:'#fbbf24', borderRadius:1 }} />
              </div>

              {/* Dock bays row */}
              <div style={{ display:'flex', gap:6, justifyContent:'center', padding:'0 20px' }}>
                {docks.map(d => (
                  <DockBayView key={d.id} dock={d} onClick={() => {
                    const dec = decisions.find(de => de.dockId === d.id);
                    if (dec) setSelected(dec);
                  }} />
                ))}
              </div>
            </div>

            {/* ═══ CONCRETE APPROACH APRON ═══ */}
            <div style={{
              /* Concrete texture */
              background:'#c9d0d8',
              backgroundImage:'repeating-linear-gradient(to right, transparent, transparent 87px, rgba(0,0,0,0.06) 87px, rgba(0,0,0,0.06) 89px), repeating-linear-gradient(to bottom, transparent, transparent 28px, rgba(0,0,0,0.04) 28px, rgba(0,0,0,0.04) 29px)',
              position:'relative',
              padding:'0 20px',
              height:130,
              display:'flex',
              gap:6,
              justifyContent:'center',
              alignItems:'flex-end',
              paddingBottom:8,
              borderBottom:'3px solid #9ca3af',
            }}>

              {/* Yellow lane markings between bays */}
              {docks.map((d, i) => (
                <div key={d.id} style={{
                  width:78, height:130, flexShrink:0,
                  position:'relative',
                  display:'flex', alignItems:'flex-end', justifyContent:'center',
                  paddingBottom:6,
                }}>
                  {/* Dashed lane centerline */}
                  <div style={{
                    position:'absolute', top:0, bottom:0, left:'50%', width:0,
                    borderLeft:'2px dashed rgba(245,158,11,0.55)', marginLeft:-1,
                  }} />
                  {/* Lane boundary lines on each side */}
                  {i === 0 && (
                    <div style={{ position:'absolute', top:0, bottom:0, left:0, width:2, background:'rgba(245,158,11,0.3)' }} />
                  )}
                  <div style={{ position:'absolute', top:0, bottom:0, right:0, width:2, background:'rgba(245,158,11,0.3)' }} />

                  {/* Bay number painted on apron */}
                  <div style={{
                    position:'absolute', top:6, left:'50%', transform:'translateX(-50%)',
                    fontSize:10, fontWeight:900, color:'rgba(245,158,11,0.6)',
                    letterSpacing:'0.05em',
                  }}>{d.id}</div>

                  {/* Truck in this bay */}
                  {dockedTrucks[d.id] && (
                    <TruckView
                      truckId={dockedTrucks[d.id].id}
                      priority={dockedTrucks[d.id].priority}
                      parked={true}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ═══ YARD / ROAD SURFACE ═══ */}
            <div style={{
              height:30,
              background:'linear-gradient(to bottom, #9ca3af 0%, #6b7280 100%)',
              backgroundImage:'repeating-linear-gradient(to right, transparent, transparent 55px, rgba(255,255,255,0.15) 55px, rgba(255,255,255,0.15) 58px)',
            }} />
          </div>

          {!running && !done && simMin === 0 && (
            <div style={{ marginTop:22, textAlign:'center' }}>
              <div style={{ fontSize:13, color:'#6b7280', lineHeight:1.75 }}>
                Press <span style={{ color:'#2563eb', fontWeight:700 }}>Run AI Optimisation</span> to simulate a full 3-hour outbound shift.<br />
                <span style={{ fontSize:11, color:'#9ca3af' }}>AI routes each truck to the dock with the most staged product — no empty pulls, no wasted turns.</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div style={{
          width:300, borderLeft:'1px solid #e5e7eb',
          display:'flex', flexDirection:'column', background:'#ffffff',
        }}>

          {/* Decision card */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e5e7eb', flexShrink:0 }}>
            <div style={{
              fontSize:9, fontWeight:700, color:'#9ca3af',
              textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8,
            }}>AI Decision</div>
            {selected ? (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:16, fontWeight:800, color:'#111827' }}>
                    {selected.truckId} → {selected.dockId}
                  </span>
                  <span style={{
                    fontSize:8, fontWeight:700, padding:'2px 7px', borderRadius:4,
                    background:P_CLR[selected.priority].bg, color:P_CLR[selected.priority].fg,
                    border:`1px solid ${P_CLR[selected.priority].border}`,
                  }}>{selected.priority}</span>
                </div>
                <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.65, marginBottom:10 }}>{selected.reason}</div>
                {selected.skipped.length > 0 && (
                  <div style={{ paddingTop:8, borderTop:'1px solid #f3f4f6' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginBottom:6 }}>
                      Why not other docks
                    </div>
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
                Decisions appear here as trucks are routed. Click a dock bay to see its last decision.
              </div>
            )}
          </div>

          {/* Live ticker */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
            <div style={{
              padding:'7px 16px 6px',
              fontSize:9, fontWeight:700, color:'#9ca3af',
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
                  <div style={{
                    fontSize:10, fontWeight:600, marginBottom:1,
                    color: entry.type === 'assign' ? '#2563eb' : '#16a34a',
                  }}>
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
