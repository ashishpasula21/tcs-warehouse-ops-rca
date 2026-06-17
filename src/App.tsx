import { useState } from 'react';
import { TrendChart } from './components/Dashboard/TrendChart';
import { AIRecommendations } from './components/Dashboard/AIRecommendations';
import { WarehouseScene, getTruckStates } from './components/Warehouse3D/WarehouseScene';
import { SimulationControls } from './components/Controls/SimulationControls';
import { useSimulationStore } from './store/simulationStore';
import { SCENARIO_LABELS } from './data/aiRecommendations';
import { getActiveEvent } from './data/shiftEvents';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart2, Brain, Activity, Play, ArrowLeft, AlertTriangle, TrendingUp, TrendingDown, Zap, Clock, RotateCcw, Package, Truck, Timer, CheckCircle, ChevronRight } from 'lucide-react';

type View = 'overview' | 'simulation' | 'analytics' | 'ai';

const PAGE   = '#f4f6f9';
const CARD   = '#ffffff';
const BORDER = '#e2e8f0';
const T1     = '#111827';
const T2     = '#6b7280';
const T3     = '#9ca3af';
const RED    = '#dc2626';
const GREEN  = '#16a34a';
const CARDSH = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';

// ── Header ───────────────────────────────────────────────────────────────────
function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { isPlaying } = useSimulationStore();
  const tabs: { id: View; label: string; Icon: typeof Activity }[] = [
    { id: 'overview',  label: 'Overview',    Icon: Activity  },
    { id: 'analytics', label: 'Analytics',   Icon: BarChart2 },
    { id: 'ai',        label: 'AI Insights', Icon: Brain     },
  ];
  return (
    <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: T1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="7" width="14" height="8" rx="1" fill="white" opacity="0.9"/>
              <rect x="3" y="3" width="10" height="5" rx="1" fill="white" opacity="0.6"/>
              <rect x="5" y="1" width="6" height="3" rx="1" fill="white" opacity="0.4"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: T1, letterSpacing: '-0.02em' }}>WareVision</span>
          <span style={{ fontSize: 11, color: T3, marginLeft: 4, borderLeft: `1px solid ${BORDER}`, paddingLeft: 10 }}>TCS Distribution · Jun 15, 2026</span>
        </div>

        {/* Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {tabs.map(({ id, label, Icon }) => {
            const active = view === id;
            return (
              <button key={id} onClick={() => setView(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                  borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                  background: active ? T1 : 'transparent', color: active ? '#fff' : T2,
                  transition: 'all 0.15s',
                }}>
                <Icon size={13} />
                {label}
                {id === 'ai' && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: RED, color: '#fff', borderRadius: 99, padding: '1px 5px' }}>2</span>
                )}
              </button>
            );
          })}
          <div style={{ width: 1, height: 20, background: BORDER, margin: '0 8px' }} />
          <button onClick={() => setView('simulation')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
              borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: view === 'simulation' ? '#0f172a' : PAGE,
              color: view === 'simulation' ? '#fff' : T1,
              border: `1px solid ${view === 'simulation' ? '#0f172a' : BORDER}`,
              transition: 'all 0.15s',
            }}>
            <Play size={11} />
            {view === 'simulation' && isPlaying ? 'Replaying…' : 'Simulation'}
          </button>
        </nav>
      </div>
    </header>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ title, value, unit, sub, progress, target, ok }: {
  title: string; value: string; unit: string; sub: string; progress: number; target: string; ok: boolean;
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px 24px 20px', boxShadow: CARDSH }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 40, fontWeight: 800, color: T1, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</span>
        <span style={{ fontSize: 13, color: T2, marginBottom: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12, color: T2, marginBottom: 16 }}>{sub}</div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: T3 }}>Progress</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: ok ? GREEN : RED }}>{target}</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: '#f0f2f5' }}>
          <div style={{ height: 5, borderRadius: 3, width: `${progress}%`, background: ok ? GREEN : RED, transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: T1, margin: 0 }}>{title}</h2>
      {action && (
        <button onClick={onAction} style={{ fontSize: 12, color: T2, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          {action}
        </button>
      )}
    </div>
  );
}

const MINI_HOURLY = [
  { h: '06', v: 198 }, { h: '07', v: 243 }, { h: '08', v: 267 },
  { h: '09', v: 221 }, { h: '10', v: 285 }, { h: '11', v: 201 },
  { h: '12', v: 234 }, { h: '13', v: 198 },
];

const DOCK_ROWS = [
  { id: 'R-1', type: 'Receiving', carrier: 'XPO Logistics',   trailer: 'TRL-4821', pallets: 48, cap: 52, status: 'Loading',  eta: '07:22' },
  { id: 'R-2', type: 'Receiving', carrier: 'FedEx Freight',   trailer: 'TRL-2294', pallets: 31, cap: 52, status: 'Docked',   eta: '—'     },
  { id: 'R-3', type: 'Receiving', carrier: 'Old Dominion',    trailer: 'TRL-7741', pallets: 0,  cap: 52, status: 'Departed', eta: '12:00' },
  { id: 'S-1', type: 'Shipping',  carrier: 'UPS Supply Chain',trailer: 'TRL-9912', pallets: 44, cap: 48, status: 'Loading',  eta: '09:45' },
  { id: 'S-2', type: 'Shipping',  carrier: 'Werner Ent.',     trailer: 'TRL-3358', pallets: 48, cap: 48, status: 'Full',     eta: '—'     },
  { id: 'S-3', type: 'Shipping',  carrier: 'Schneider',       trailer: 'TRL-6615', pallets: 11, cap: 48, status: 'Loading',  eta: '13:30' },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Loading:  { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Docked:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Full:     { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  Departed: { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
};

const RECENT_EVENTS = [
  { time: '13:41', type: 'alert',   msg: 'FL-2 idle >15 min — no assigned task' },
  { time: '13:28', type: 'info',    msg: 'Truck TRL-9912 reached 92% load — flagged for dispatch' },
  { time: '13:10', type: 'success', msg: 'PJ-1 Williams completed 45th cycle — above daily target' },
  { time: '12:54', type: 'alert',   msg: 'Aisle 1 congestion spike — 3 forklifts queued at junction' },
  { time: '12:33', type: 'info',    msg: 'Inbound truck TRL-4821 arrived at Dock R-1' },
  { time: '12:09', type: 'success', msg: 'Zone A slotting update complete — 14 SKUs relocated' },
  { time: '11:47', type: 'alert',   msg: 'PJ-2 battery below 35% — suggest opportunity charge' },
  { time: '11:20', type: 'info',    msg: 'FL-3 Kim assigned to high-velocity Zone A picks' },
];

const EVENT_STYLE: Record<string, { dot: string; bg: string }> = {
  alert:   { dot: '#dc2626', bg: '#fef2f2' },
  info:    { dot: '#3b82f6', bg: '#eff6ff' },
  success: { dot: '#16a34a', bg: '#f0fdf4' },
};

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ setView }: { setView: (v: View) => void }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px 28px 40px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>Shift Summary</h1>
          <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Jun 15, 2026 · Day Shift · 06:00 – 14:00</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 99, padding: '4px 10px' }}>
            ● Behind Target
          </span>
          <button onClick={() => setView('simulation')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: T1, color: '#fff', border: 'none' }}>
            <Play size={12} />
            Run Simulation
          </button>
        </div>
      </div>

      {/* KPI Row 1 — throughput & utilization */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <KPICard title="Case Pick Rate"       value="1,847" unit="cases" sub="Today's output"   progress={88} target="Target: 2,100" ok={false} />
        <KPICard title="Forklift Utilization" value="71%"   unit=""      sub="Fleet average"    progress={71} target="Target: 85%"  ok={false} />
        <KPICard title="Operator Utilization" value="79%"   unit=""      sub="Shift average"    progress={79} target="Target: 88%"  ok={false} />
        <KPICard title="Congestion Score"     value="67"    unit="/ 100" sub="Aisle blockages"  progress={67} target="Target: < 30" ok={false} />
      </div>

      {/* KPI Row 2 — dock & receiving */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { Icon: Package, title: 'Pallets Received',  value: '118',    sub: 'vs 140 target',   color: '#3b82f6', bg: '#eff6ff' },
          { Icon: Truck,   title: 'Pallets Shipped',   value: '143',    sub: 'vs 130 target',   color: '#16a34a', bg: '#f0fdf4' },
          { Icon: Timer,   title: 'Avg Dwell Time',    value: '18.3',   sub: 'min to putaway',  color: '#d97706', bg: '#fffbeb' },
          { Icon: CheckCircle, title: 'Trucks Docked', value: '5 / 6',  sub: 'docks active',    color: '#8b5cf6', bg: '#f5f3ff' },
        ].map(({ Icon, title, value, sub, color, bg }) => (
          <div key={title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 22px', boxShadow: CARDSH }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: T1, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 12, color: T2, marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Row: Throughput chart + Shift Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 24px 18px', boxShadow: CARDSH }}>
          <SectionHead title="Throughput — Cases Picked / Hour" action="Full Analytics →" onAction={() => setView('analytics')} />
          <TrendChart compact />
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 24px', boxShadow: CARDSH }}>
          <SectionHead title="Shift Highlights" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Peak Hour',      value: '10:00 AM', note: '285 cases picked',   icon: TrendingUp,  good: true  },
              { label: 'Slowest Hour',   value: '06:00 AM', note: '198 cases picked',   icon: TrendingDown,good: false },
              { label: 'Avg Cycle Time', value: '4.2 min',  note: 'Forklift put-away',  icon: TrendingDown,good: false },
              { label: 'Near-Misses',    value: '23 events',note: 'Aisle 1 / 07–09h',  icon: AlertTriangle,good:false },
              { label: 'Orders Filled',  value: '312',       note: 'vs 340 target',      icon: TrendingDown,good: false },
              { label: 'On-Time Trucks', value: '4 / 5',    note: 'departed on time',   icon: TrendingUp,  good: true  },
            ].map(({ label, value, note, icon: Icon, good }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: good ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} color={good ? GREEN : RED} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{value}</div>
                </div>
                <div style={{ fontSize: 11, color: T2, textAlign: 'right', maxWidth: 95 }}>{note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row: Operator Table + AI Alerts + Simulation CTA */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARDSH, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <SectionHead title="Operator Performance" action="Full Analytics →" onAction={() => setView('analytics')} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
                {['Operator', 'Role', 'Cases', 'Idle h', 'Efficiency', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', background: PAGE }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Mark Rivera',   role: 'FL-1 · Forklift',     cases: 38,  idle: 0.9, eff: 91, ok: true  },
                { name: 'James Chen',    role: 'FL-2 · Forklift',     cases: 21,  idle: 3.1, eff: 58, ok: false },
                { name: 'Sarah Kim',     role: 'FL-3 · Forklift',     cases: 29,  idle: 1.6, eff: 78, ok: true  },
                { name: 'Deon Williams', role: 'PJ-1 · Pallet Jack',  cases: 45,  idle: 1.2, eff: 85, ok: true  },
                { name: 'Priya Patel',   role: 'PJ-2 · Pallet Jack',  cases: 35,  idle: 2.1, eff: 72, ok: true  },
                { name: 'Tom Nguyen',    role: 'Pick · Order Picker',  cases: 312, idle: 0.6, eff: 88, ok: true  },
              ].map((op, i) => (
                <tr key={op.name} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? CARD : '#fafbfc' }}>
                  <td style={{ padding: '12px 20px', fontWeight: 600, fontSize: 13, color: T1 }}>{op.name}</td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: T2 }}>{op.role}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: T1 }}>{op.cases}</td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: op.idle > 2 ? RED : T2 }}>{op.idle}h</td>
                  <td style={{ padding: '12px 20px', minWidth: 130 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f0f2f5' }}>
                        <div style={{ height: 5, borderRadius: 3, width: `${op.eff}%`, background: op.ok ? GREEN : RED }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: op.ok ? T1 : RED, minWidth: 30 }}>{op.eff}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '3px 9px', background: op.ok ? '#f0fdf4' : '#fef2f2', color: op.ok ? GREEN : RED, border: `1px solid ${op.ok ? '#bbf7d0' : '#fecaca'}` }}>
                      {op.ok ? 'On Target' : 'Below Target'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Critical Alerts */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 22px', boxShadow: CARDSH }}>
            <SectionHead title="Critical Alerts" action="View All →" onAction={() => setView('ai')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { title: 'James Chen 42% below target pick rate', impact: '+11 pallets/shift if resolved' },
                { title: 'Aisle 1 bottleneck — 23 near-miss events 07–09h', impact: '+18% throughput if cleared' },
                { title: 'PJ-2 battery at 30% — speed sag imminent', impact: 'Opportunity charge at next stop' },
              ].map(a => (
                <div key={a.title} style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2' }}>
                  <div style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
                    <AlertTriangle size={12} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#7f1d1d', lineHeight: 1.4 }}>{a.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: GREEN, fontWeight: 500, paddingLeft: 19 }}>{a.impact}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation CTA */}
          <div style={{ background: T1, borderRadius: 12, padding: '22px', boxShadow: CARDSH }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>3D Shift Replay</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginBottom: 18 }}>
              Watch the full 8-hour shift with real telemetry. Replay congestion events, equipment routes, and dock activity.
            </div>
            <button onClick={() => setView('simulation')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 0', borderRadius: 8, background: '#fff', color: T1, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Play size={13} />
              Run Shift Simulation
            </button>
          </div>
        </div>
      </div>

      {/* Row: Dock Activity Table */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARDSH, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '20px 24px 0' }}>
          <SectionHead title="Dock & Receiving Activity" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
              {['Dock', 'Type', 'Carrier', 'Trailer', 'Pallets', 'Capacity', 'Status', 'ETA / Next'].map(h => (
                <th key={h} style={{ padding: '9px 18px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', background: PAGE }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOCK_ROWS.map((d, i) => {
              const sc = STATUS_COLORS[d.status];
              const loadPct = d.cap > 0 ? Math.round((d.pallets / d.cap) * 100) : 0;
              return (
                <tr key={d.id} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? CARD : '#fafbfc' }}>
                  <td style={{ padding: '11px 18px', fontWeight: 700, fontSize: 13, color: T1 }}>{d.id}</td>
                  <td style={{ padding: '11px 18px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '3px 7px', background: d.type === 'Receiving' ? '#eff6ff' : '#f0fdf4', color: d.type === 'Receiving' ? '#1d4ed8' : '#16a34a', border: `1px solid ${d.type === 'Receiving' ? '#bfdbfe' : '#bbf7d0'}` }}>
                      {d.type}
                    </span>
                  </td>
                  <td style={{ padding: '11px 18px', fontSize: 12, color: T1 }}>{d.carrier}</td>
                  <td style={{ padding: '11px 18px', fontSize: 12, color: T2, fontFamily: 'monospace' }}>{d.trailer}</td>
                  <td style={{ padding: '11px 18px', minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f0f2f5' }}>
                        <div style={{ height: 5, borderRadius: 3, width: `${loadPct}%`, background: loadPct > 90 ? RED : loadPct > 60 ? '#d97706' : '#3b82f6' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T2, minWidth: 28 }}>{d.pallets}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 18px', fontSize: 12, color: T2 }}>{d.cap}</td>
                  <td style={{ padding: '11px 18px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '3px 9px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ padding: '11px 18px', fontSize: 12, color: T2 }}>{d.eta}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Row: Recent Events Feed + Mini throughput spark */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Events feed */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: CARDSH }}>
          <SectionHead title="Recent Shift Events" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RECENT_EVENTS.map((e, i) => {
              const s = EVENT_STYLE[e.type];
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: s.bg }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, color: T1, lineHeight: 1.45 }}>{e.msg}</span>
                  </div>
                  <span style={{ fontSize: 10, color: T3, flexShrink: 0, marginTop: 2 }}>{e.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Zone throughput + inventory snapshot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: CARDSH }}>
            <SectionHead title="Throughput Spark — Last 8 Hours" />
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={MINI_HOURLY} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                <XAxis dataKey="h" tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
                <YAxis tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={({ active, payload, label }: any) => active && payload?.length ? (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, color: T1 }}>
                    {label}h: <strong>{payload[0].value}</strong> cases
                  </div>
                ) : null} />
                <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#spk)" dot={false} name="Cases" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: CARDSH }}>
            <SectionHead title="Inventory Movement" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { zone: 'Zone A (High-Vel)',  inbound: 384, outbound: 412, delta: -28 },
                { zone: 'Zone B (Med-Vel)',   inbound: 196, outbound: 178, delta: +18 },
                { zone: 'Zone C (Low-Vel)',   inbound:  88, outbound:  62, delta: +26 },
                { zone: 'Staging',            inbound: 143, outbound: 143, delta:   0 },
              ].map(z => (
                <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: T1, fontWeight: 600, marginBottom: 2 }}>{z.zone}</div>
                    <div style={{ fontSize: 10, color: T3 }}>In: {z.inbound} · Out: {z.outbound}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: z.delta < 0 ? RED : z.delta > 0 ? GREEN : T3 }}>
                    {z.delta > 0 ? '+' : ''}{z.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Simulation View ───────────────────────────────────────────────────────────
function SimulationView({ setView }: { setView: (v: View) => void }) {
  const { currentTime, isPlaying, setCurrentTime, setPlaybackSpeed, setPlaying, improvementScenario, setImprovementScenario } = useSimulationStore();
  const truckStates = getTruckStates(currentTime);
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null);

  const playYesterdayShift = () => {
    setCurrentTime(0);
    setPlaybackSpeed(60);
    setPlaying(true);
    setImprovementScenario(null);
  };

  const backToShift = () => {
    setImprovementScenario(null);
    setCurrentTime(0);
    setPlaying(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, background: CARD, flexShrink: 0 }}>
        <button onClick={() => setView('overview')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>
          <ArrowLeft size={12} />
          Back
        </button>
        <div style={{ width: 1, height: 16, background: BORDER }} />

        {improvementScenario ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 99, padding: '4px 12px' }}>
              <Zap size={11} color="#16a34a" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>
                {SCENARIO_LABELS[improvementScenario] ?? improvementScenario}
              </span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>— Improved Scenario</span>
            </div>
            <button onClick={backToShift}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: T2, background: PAGE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
              <RotateCcw size={11} />
              Back to Shift
            </button>
          </>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Day Shift · Jun 15, 2026</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Play Yesterday's Shift button */}
        {!improvementScenario && (
          <button onClick={playYesterdayShift}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: isPlaying ? '#f0fdf4' : T1, color: isPlaying ? '#15803d' : '#fff',
              border: isPlaying ? '1px solid #86efac' : 'none',
            }}>
            <Clock size={11} />
            {isPlaying ? '● Playing Shift…' : "Play Yesterday's Shift"}
          </button>
        )}

        {/* Equipment legend */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { color: '#f5c518', label: 'FL-1 Rivera' },
            { color: '#e8a000', label: 'FL-2 Chen' },
            { color: '#d49000', label: 'FL-3 Kim' },
            { color: '#cc2200', label: 'PJ-1 Williams' },
            { color: '#aa1a00', label: 'PJ-2 Patel' },
          ].map(e => (
            <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: e.color }} />
              <span style={{ fontSize: 11, color: T2 }}>{e.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3D viewport + optional side panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <WarehouseScene />

          {/* Zone legend */}
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px', pointerEvents: 'none', boxShadow: CARDSH }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Zone Map</div>
            {[
              ['#3b82f6', 'Receiving'],
              ['#8b5cf6', 'Storage A–C'],
              ['#f59e0b', 'Pick Lane'],
              ['#10b981', 'Staging'],
              ['#ef4444', 'Shipping'],
            ].map(([c, z]) => (
              <div key={z as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c as string, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: T1 }}>{z}</span>
              </div>
            ))}
          </div>

          {/* Truck dock status — top right of canvas */}
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', pointerEvents: 'none', boxShadow: CARDSH, minWidth: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Dock Status</div>
            {truckStates.map(ts => {
              const pct = Math.round(ts.loadPct * 100);
              const barColor = pct > 85 ? '#dc2626' : pct > 50 ? '#d97706' : '#16a34a';
              return (
                <div key={ts.id} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: T1, fontWeight: 600 }}>{ts.label}</span>
                    <span style={{ fontSize: 11, color: ts.visible ? T2 : T3 }}>
                      {ts.visible ? `${pct}%` : 'Away'}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#f0f2f5' }}>
                    <div style={{ height: 4, borderRadius: 2, width: ts.visible ? `${pct}%` : '0%', background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event side panel — slides in alongside canvas, never covers it */}
        {(() => {
          const ev = getActiveEvent(currentTime, improvementScenario);
          if (!ev || ev.id === dismissedEventId) return null;
          const isProblem    = ev.type === 'problem';
          const accentColor  = isProblem ? '#dc2626' : '#16a34a';
          const accentBg     = isProblem ? '#fef2f2' : '#f0fdf4';
          const accentBorder = isProblem ? '#fecaca' : '#bbf7d0';
          const accentLight  = isProblem ? '#fef9f9' : '#f7fff8';
          return (
            <div style={{
              width: 300, flexShrink: 0,
              borderLeft: `1px solid ${BORDER}`,
              background: CARD,
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}>
              {/* Accent strip */}
              <div style={{ height: 4, background: accentColor, flexShrink: 0 }} />

              <div style={{ padding: '16px 18px', flex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: accentBg, border: `1px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isProblem ? <AlertTriangle size={15} color={accentColor} /> : <Zap size={15} color={accentColor} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                      {isProblem ? 'Problem Detected' : 'Improvement Active'} · {ev.timeLabel}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T1, lineHeight: 1.3 }}>{ev.title}</div>
                  </div>
                  <button onClick={() => setDismissedEventId(ev.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: 2, flexShrink: 0, fontSize: 14, lineHeight: 1 }}>
                    ✕
                  </button>
                </div>

                {/* Description highlight */}
                <div style={{ background: accentLight, border: `1px solid ${accentBorder}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: T1, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{ev.description}</p>
                </div>

                {/* Detailed explanation */}
                <p style={{ fontSize: 11, color: T2, lineHeight: 1.7, margin: '0 0 16px' }}>{ev.detail}</p>

                {/* Beacon hint */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 7, background: accentBg, border: `1px solid ${accentBorder}`, marginBottom: 14 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: accentColor, fontWeight: 600, lineHeight: 1.4 }}>
                    {isProblem ? 'Red beacon marks this area in the 3D view' : 'Green beacon marks the improvement zone'}
                  </span>
                </div>

                {isProblem && (
                  <button onClick={() => setView('ai')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T1, color: '#fff', border: 'none' }}>
                    View Recommended Fix <ChevronRight size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <SimulationControls />
    </div>
  );
}

// ── Analytics View ────────────────────────────────────────────────────────────
function AnalyticsView() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>Performance Analytics</h1>
        <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Jun 15, 2026 · Day Shift · All Zones</p>
      </div>
      <TrendChart />
    </div>
  );
}

// ── AI Insights View ──────────────────────────────────────────────────────────
function AIView({ setView }: { setView: (v: View) => void }) {
  const { setImprovementScenario, setCurrentTime, setPlaying, setPlaybackSpeed } = useSimulationStore();

  const handleRunImproved = (scenario: string) => {
    setImprovementScenario(scenario);
    setCurrentTime(0);
    setPlaybackSpeed(60);
    setPlaying(true);
    setView('simulation');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>AI Insights</h1>
        <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Machine-generated recommendations from shift telemetry</p>
      </div>
      <AIRecommendations onRunImproved={handleRunImproved} />
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>('overview');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: PAGE }}>
      <Header view={view} setView={setView} />
      {view === 'overview'   && <Overview    setView={setView} />}
      {view === 'simulation' && <SimulationView setView={setView} />}
      {view === 'analytics'  && <AnalyticsView />}
      {view === 'ai'         && <AIView setView={setView} />}
    </div>
  );
}
