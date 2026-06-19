import { useState } from 'react';
import { TrendChart } from './components/Dashboard/TrendChart';
import { AIRecommendations } from './components/Dashboard/AIRecommendations';
import { WarehouseScene, getTruckStates } from './components/Warehouse3D/WarehouseScene';
import { SimulationControls } from './components/Controls/SimulationControls';
import { useSimulationStore } from './store/simulationStore';
import { SCENARIO_LABELS, SCENARIO_IMPACTS } from './data/aiRecommendations';
import { getActiveEvent, SCENARIO_BENEFIT_EVENTS } from './data/shiftEvents';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  BarChart2, Brain, Activity, Play, ArrowLeft, AlertTriangle,
  TrendingUp, TrendingDown, Zap, Clock, RotateCcw, Package, Truck,
  Timer, CheckCircle, ChevronRight, Network, Bot, GitBranch, Layers,
  Cpu, Radio, FlaskConical, Settings,
} from 'lucide-react';
import { AdaptiveTwinScene } from './components/AdaptiveTwin/AdaptiveTwinScene';
import { DockLayoutSVG } from './components/AutonomousDock/DockLayoutSVG';
import { TruckInterior3D } from './components/AutonomousDock/TruckInterior3D';
import {
  AT_ANOMALIES, AT_SCENARIOS, AT_BASELINE, AT_CONTROL_EVENTS,
  AT_SCENARIO_LABELS, AT_CATEGORY_COLORS,
} from './data/adaptiveTwinData';
import {
  DOCK_BAYS, INBOUND_TRUCKS, OUTBOUND_ORDERS, DOCK_EVENTS,
  DOCK_BASELINE, DOCK_OPTIMISED,
  assignRecvDock, assignShipDock, getLoadSequence, optimisedFillRate,
  type DockBay, type InboundTruck, type OutboundOrder,
} from './data/autonomousDockData';

// ── Design tokens ─────────────────────────────────────────────────────────────
const PAGE   = '#f4f6f9';
const CARD   = '#ffffff';
const BORDER = '#e2e8f0';
const T1     = '#111827';
const T2     = '#6b7280';
const T3     = '#9ca3af';
const RED    = '#dc2626';
const GREEN  = '#16a34a';
const CARDSH = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';

// ── Navigation types ──────────────────────────────────────────────────────────
type AppView    = 'home' | 'network' | 'warehouse';
type MainTab    = 'warehouse-ops' | 'adaptive-twin' | 'autonomous-dock';
type SubView    = 'overview' | 'simulation' | 'analytics' | 'ai' | 'kpi-impact';
type ATSubView  = 'live' | 'anomalies' | 'ai-scenarios' | 'simulation' | 'control';
type ADSubView  = 'live-ops' | 'ai-decisions' | 'simulation';

// ── Main tabs config ──────────────────────────────────────────────────────────
const MAIN_TABS: { id: MainTab; label: string; Icon: typeof Activity; color: string }[] = [
  { id: 'warehouse-ops',    label: 'Warehouse Ops',    Icon: Layers,    color: '#1d4ed8' },
  { id: 'adaptive-twin',    label: 'Adaptive Twin',    Icon: GitBranch, color: '#7c3aed' },
  { id: 'autonomous-dock',  label: 'Autonomous Dock',  Icon: Bot,       color: '#0891b2' },
];

const SUB_VIEWS: { id: SubView; label: string; Icon: typeof Activity }[] = [
  { id: 'overview',   label: 'Overview',    Icon: Activity  },
  { id: 'analytics',  label: 'Analytics',   Icon: BarChart2 },
  { id: 'ai',         label: 'AI Insights', Icon: Brain     },
  { id: 'simulation', label: '3D Simulation', Icon: Play    },
];

// ── Top Navigation Bar ────────────────────────────────────────────────────────
function TopNav({
  mainTab, setMainTab, subView, setSubView, atSubView, setAtSubView,
  adSubView, setAdSubView, onBackToNetwork,
}: {
  mainTab: MainTab; setMainTab: (t: MainTab) => void;
  subView: SubView; setSubView: (v: SubView) => void;
  atSubView: ATSubView; setAtSubView: (v: ATSubView) => void;
  adSubView: ADSubView; setAdSubView: (v: ADSubView) => void;
  onBackToNetwork: () => void;
}) {
  const { isPlaying, improvementScenario, atScenario } = useSimulationStore();
  return (
    <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, flexShrink: 0, zIndex: 10 }}>
      {/* Primary bar — logo + main tabs */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 52, borderBottom: `1px solid ${BORDER}`, gap: 16 }}>
        {/* Logo + back to network */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={onBackToNetwork} style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px 0',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: T1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="7" width="14" height="8" rx="1" fill="white" opacity="0.9"/>
                <rect x="3" y="3" width="10" height="5" rx="1" fill="white" opacity="0.6"/>
                <rect x="5" y="1" width="6" height="3" rx="1" fill="white" opacity="0.4"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: T1, letterSpacing: '-0.02em' }}>WareVision</span>
          </button>
          <span style={{ fontSize: 10, color: T3, marginLeft: 2, borderLeft: `1px solid ${BORDER}`, paddingLeft: 10 }}>TCS Operations Intelligence</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Main tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {MAIN_TABS.map(({ id, label, Icon, color }) => {
            const active = mainTab === id;
            return (
              <button key={id} onClick={() => setMainTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: active ? color : 'transparent',
                  color: active ? '#fff' : T2,
                  boxShadow: active ? `0 1px 4px ${color}55` : 'none',
                }}>
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Simulation Live badge */}
        {isPlaying && (
          <span style={{ fontSize: 10, fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 99, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Simulation Live
          </span>
        )}
      </div>

      {/* Secondary bar — adaptive twin sub-tabs */}
      {mainTab === 'adaptive-twin' && (() => {
        const AT_TABS: { id: ATSubView; label: string; Icon: typeof Activity }[] = [
          { id: 'live',        label: 'Live Operations', Icon: Radio      },
          { id: 'anomalies',   label: 'Anomalies',       Icon: AlertTriangle },
          { id: 'ai-scenarios',label: 'AI Scenarios',    Icon: Brain      },
        ];
        return (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              {AT_TABS.map(({ id, label, Icon }) => {
                const active = atSubView === id;
                return (
                  <button key={id} onClick={() => setAtSubView(id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                      background: active ? PAGE : 'transparent',
                      color: active ? T1 : T2,
                      borderBottom: active ? `2px solid #7c3aed` : '2px solid transparent',
                    }}>
                    <Icon size={12} />
                    {label}
                    {id === 'anomalies' && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: RED, color: '#fff', borderRadius: 99, padding: '1px 4px' }}>4</span>
                    )}
                  </button>
                );
              })}
              {atScenario && (
                <button onClick={() => setAtSubView('control')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                    background: atSubView === 'control' ? PAGE : 'transparent',
                    color: atSubView === 'control' ? '#15803d' : '#16a34a',
                    borderBottom: atSubView === 'control' ? `2px solid #16a34a` : '2px solid transparent',
                  }}>
                  <Settings size={12} />
                  Control System
                </button>
              )}
            </div>
            <button onClick={() => setAtSubView('simulation')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: atSubView === 'simulation' ? '#0f172a' : '#7c3aed',
                color: '#fff',
                boxShadow: '0 1px 4px rgba(124,58,237,0.4)',
              }}>
              <Cpu size={11} />
              3D Twin
            </button>
          </div>
        );
      })()}

      {/* Secondary bar — autonomous dock sub-tabs */}
      {mainTab === 'autonomous-dock' && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {([
              { id: 'live-ops'     as ADSubView, label: 'Live Operations', Icon: Radio   },
              { id: 'ai-decisions' as ADSubView, label: 'AI Decisions',    Icon: Brain   },
            ]).map(({ id, label, Icon }) => {
              const active = adSubView === id;
              return (
                <button key={id} onClick={() => setAdSubView(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                    background: active ? PAGE : 'transparent',
                    color: active ? T1 : T2,
                    borderBottom: active ? `2px solid #0891b2` : '2px solid transparent',
                  }}>
                  <Icon size={12} />
                  {label}
                </button>
              );
            })}
          </div>
          <button onClick={() => setAdSubView('simulation')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: adSubView === 'simulation' ? '#0f172a' : '#0891b2',
              color: '#fff',
              boxShadow: '0 1px 4px rgba(8,145,178,0.4)',
            }}>
            <Play size={11} />
            Run Simulation
          </button>
        </div>
      )}

      {/* Secondary bar — sub-tabs (only for warehouse-ops) */}
      {mainTab === 'warehouse-ops' && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {SUB_VIEWS.filter(v => v.id !== 'simulation').map(({ id, label, Icon }) => {
              const active = subView === id;
              return (
                <button key={id} onClick={() => setSubView(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                    background: active ? PAGE : 'transparent',
                    color: active ? T1 : T2,
                    borderBottom: active ? `2px solid #1d4ed8` : '2px solid transparent',
                  }}>
                  <Icon size={12} />
                  {label}
                  {id === 'ai' && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: RED, color: '#fff', borderRadius: 99, padding: '1px 4px' }}>2</span>
                  )}
                </button>
              );
            })}
            {improvementScenario && (
              <button onClick={() => setSubView('kpi-impact')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                  background: subView === 'kpi-impact' ? PAGE : 'transparent',
                  color: subView === 'kpi-impact' ? '#15803d' : '#16a34a',
                  borderBottom: subView === 'kpi-impact' ? `2px solid #16a34a` : '2px solid transparent',
                }}>
                <Zap size={12} />
                KPI Impact
              </button>
            )}
          </div>
          <button onClick={() => setSubView('simulation')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: subView === 'simulation' ? T1 : '#1d4ed8',
              color: '#fff',
              boxShadow: '0 1px 4px rgba(29,78,216,0.4)',
            }}>
            <Play size={11} />
            3D Simulation
          </button>
        </div>
      )}
    </header>
  );
}

// ── Placeholder for future tabs ───────────────────────────────────────────────
function ComingSoon({ tab }: { tab: MainTab }) {
  const cfg = MAIN_TABS.find(t => t.id === tab)!;
  const Icon = cfg.Icon;
  const descriptions: Record<MainTab, { tagline: string; bullets: string[] }> = {
    'warehouse-ops': { tagline: '', bullets: [] },
    'adaptive-twin': {
      tagline: 'A live digital twin that re-plans routes, staffing, and slotting in real time as conditions change.',
      bullets: [
        'Real-time sensor fusion from WCS, WMS, and IoT streams',
        'Automatic re-slotting engine triggered by velocity shifts',
        'Adaptive routing that responds to congestion and equipment faults',
        'AI demand forecasting to pre-position inventory before peaks',
      ],
    },
    'autonomous-dock': {
      tagline: 'Fully autonomous dock appointment scheduling, trailer spotting, and unload sequencing.',
      bullets: [
        'AI-driven appointment windows to balance inbound flow',
        'Computer vision trailer ID and damage detection at gate',
        'Automated dock door assignment by SKU affinity and priority',
        'Real-time carrier ETA integration with buffer alerting',
      ],
    },
  };
  const { tagline, bullets } = descriptions[tab];
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAGE }}>
      <div style={{ textAlign: 'center', maxWidth: 540, padding: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: `${cfg.color}18`, border: `1.5px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon size={28} color={cfg.color} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Coming Soon</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: T1, margin: '0 0 12px', letterSpacing: '-0.02em' }}>{cfg.label}</h2>
        <p style={{ fontSize: 14, color: T2, lineHeight: 1.7, margin: '0 0 28px' }}>{tagline}</p>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', textAlign: 'left' }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < bullets.length - 1 ? 12 : 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: `${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <ChevronRight size={11} color={cfg.color} />
              </div>
              <span style={{ fontSize: 13, color: T1, lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  { id: 'R-1', type: 'Receiving', carrier: 'XPO Logistics',    trailer: 'TRL-4821', pallets: 48, cap: 52, status: 'Loading',  eta: '07:22' },
  { id: 'R-2', type: 'Receiving', carrier: 'FedEx Freight',    trailer: 'TRL-2294', pallets: 31, cap: 52, status: 'Docked',   eta: '—'     },
  { id: 'R-3', type: 'Receiving', carrier: 'Old Dominion',     trailer: 'TRL-7741', pallets: 0,  cap: 52, status: 'Departed', eta: '12:00' },
  { id: 'S-1', type: 'Shipping',  carrier: 'UPS Supply Chain', trailer: 'TRL-9912', pallets: 44, cap: 48, status: 'Loading',  eta: '09:45' },
  { id: 'S-2', type: 'Shipping',  carrier: 'Werner Ent.',      trailer: 'TRL-3358', pallets: 48, cap: 48, status: 'Full',     eta: '—'     },
  { id: 'S-3', type: 'Shipping',  carrier: 'Schneider',        trailer: 'TRL-6615', pallets: 11, cap: 48, status: 'Loading',  eta: '13:30' },
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

// ── KPI Improvement comparison strip ─────────────────────────────────────────
function KPIImpactStrip({ scenarioKey }: { scenarioKey: string }) {
  const impact = SCENARIO_IMPACTS[scenarioKey];
  if (!impact) return null;

  const baseline = { cases: 1847, util: 71, congestion: 67, dwell: 18.3, shipped: 143 };
  const improved = {
    cases:     baseline.cases + impact.casesImprovement,
    util:      Math.min(99, baseline.util + impact.utilizationImprovement),
    congestion: Math.max(5, baseline.congestion - impact.congestionReduction),
    dwell:     Math.max(6, baseline.dwell - baseline.dwell * (impact.congestionReduction / 200)),
    shipped:   Math.min(180, baseline.shipped + Math.round(impact.casesImprovement * 0.08)),
  };

  const kpis = [
    {
      label: 'Case Pick Rate',
      before: `${baseline.cases.toLocaleString()}`,
      after: `${improved.cases.toLocaleString()}`,
      delta: `+${impact.casesImprovement}`,
      unit: 'cases',
      good: true,
    },
    {
      label: 'Forklift Utilization',
      before: `${baseline.util}%`,
      after: `${improved.util}%`,
      delta: `+${impact.utilizationImprovement}pp`,
      unit: '',
      good: true,
    },
    {
      label: 'Congestion Score',
      before: `${baseline.congestion}`,
      after: `${improved.congestion}`,
      delta: `-${impact.congestionReduction}pts`,
      unit: '/ 100',
      good: true,
    },
    {
      label: 'Avg Dwell Time',
      before: `${baseline.dwell}`,
      after: `${improved.dwell.toFixed(1)}`,
      delta: `-${(baseline.dwell - improved.dwell).toFixed(1)} min`,
      unit: 'min',
      good: true,
    },
    {
      label: 'Pallets Shipped',
      before: `${baseline.shipped}`,
      after: `${improved.shipped}`,
      delta: `+${improved.shipped - baseline.shipped}`,
      unit: 'pallets',
      good: true,
    },
  ];

  return (
    <div style={{
      flexShrink: 0, background: '#0f172a', borderTop: `1px solid #1e293b`,
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, marginRight: 8 }}>
        <Zap size={13} color="#fbbf24" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', whiteSpace: 'nowrap' }}>
          KPI Impact
        </span>
        <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>vs. baseline shift</span>
      </div>
      <div style={{ width: 1, height: 32, background: '#1e293b', flexShrink: 0 }} />
      <div style={{ display: 'flex', gap: 6, flex: 1, overflow: 'hidden' }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{
            flex: 1, minWidth: 0,
            background: '#1e293b', borderRadius: 8,
            padding: '6px 10px',
            border: '1px solid #334155',
          }}>
            <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kpi.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'line-through' }}>{kpi.before}</span>
              <span style={{ fontSize: 10, color: '#475569' }}>→</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>{kpi.after}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', marginLeft: 2, background: '#14532d', borderRadius: 4, padding: '1px 5px' }}>
                {kpi.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ setSubView }: { setSubView: (v: SubView) => void }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>Shift Summary</h1>
          <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Jun 18, 2026 · Day Shift · 06:00 – 14:00</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 99, padding: '4px 10px' }}>
            ● Behind Target
          </span>
          <button onClick={() => setSubView('simulation')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: T1, color: '#fff', border: 'none' }}>
            <Play size={12} />
            Run Simulation
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <KPICard title="Case Pick Rate"       value="1,847" unit="cases" sub="Today's output"  progress={88} target="Target: 2,100" ok={false} />
        <KPICard title="Forklift Utilization" value="71%"   unit=""      sub="Fleet average"   progress={71} target="Target: 85%"  ok={false} />
        <KPICard title="Operator Utilization" value="79%"   unit=""      sub="Shift average"   progress={79} target="Target: 88%"  ok={false} />
        <KPICard title="Congestion Score"     value="67"    unit="/ 100" sub="Aisle blockages" progress={67} target="Target: < 30" ok={false} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { Icon: Package,     title: 'Pallets Received', value: '118',   sub: 'vs 140 target',  color: '#3b82f6', bg: '#eff6ff' },
          { Icon: Truck,       title: 'Pallets Shipped',  value: '143',   sub: 'vs 130 target',  color: '#16a34a', bg: '#f0fdf4' },
          { Icon: Timer,       title: 'Avg Dwell Time',   value: '18.3',  sub: 'min to putaway', color: '#d97706', bg: '#fffbeb' },
          { Icon: CheckCircle, title: 'Trucks Docked',    value: '5 / 6', sub: 'docks active',   color: '#8b5cf6', bg: '#f5f3ff' },
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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 24px 18px', boxShadow: CARDSH }}>
          <SectionHead title="Throughput — Cases Picked / Hour" action="Full Analytics →" onAction={() => setSubView('analytics')} />
          <TrendChart compact />
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 24px', boxShadow: CARDSH }}>
          <SectionHead title="Shift Highlights" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Peak Hour',      value: '10:00 AM',  note: '285 cases picked',  icon: TrendingUp,   good: true  },
              { label: 'Slowest Hour',   value: '06:00 AM',  note: '198 cases picked',  icon: TrendingDown, good: false },
              { label: 'Avg Cycle Time', value: '4.2 min',   note: 'Forklift put-away', icon: TrendingDown, good: false },
              { label: 'Near-Misses',    value: '23 events', note: 'Aisle 1 / 07–09h',  icon: AlertTriangle,good: false },
              { label: 'Orders Filled',  value: '312',       note: 'vs 340 target',      icon: TrendingDown, good: false },
              { label: 'On-Time Trucks', value: '4 / 5',     note: 'departed on time',  icon: TrendingUp,   good: true  },
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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARDSH, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <SectionHead title="Operator Performance" action="Full Analytics →" onAction={() => setSubView('analytics')} />
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
                { name: 'Mark Rivera',   role: 'FL-1 · Forklift',    cases: 38,  idle: 0.9, eff: 91, ok: true  },
                { name: 'James Chen',    role: 'FL-2 · Forklift',    cases: 21,  idle: 3.1, eff: 58, ok: false },
                { name: 'Sarah Kim',     role: 'FL-3 · Forklift',    cases: 29,  idle: 1.6, eff: 78, ok: true  },
                { name: 'Deon Williams', role: 'PJ-1 · Pallet Jack', cases: 45,  idle: 1.2, eff: 85, ok: true  },
                { name: 'Priya Patel',   role: 'PJ-2 · Pallet Jack', cases: 35,  idle: 2.1, eff: 72, ok: true  },
                { name: 'Tom Nguyen',    role: 'Pick · Order Picker', cases: 312, idle: 0.6, eff: 88, ok: true  },
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
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 22px', boxShadow: CARDSH }}>
            <SectionHead title="Critical Alerts" action="View All →" onAction={() => setSubView('ai')} />
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

          <div style={{ background: T1, borderRadius: 12, padding: '22px', boxShadow: CARDSH }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>3D Shift Replay</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginBottom: 18 }}>
              Watch the full 8-hour shift with real telemetry. Replay congestion events, equipment routes, and dock activity.
            </div>
            <button onClick={() => setSubView('simulation')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 0', borderRadius: 8, background: '#fff', color: T1, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Play size={13} />
              Run Shift Simulation
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARDSH, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '20px 24px 0' }}>
          <SectionHead title="Dock & Receiving Activity" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
              {['Dock', 'Type', 'Carrier', 'Trailer', 'Pallets', 'Capacity', 'Status', 'ETA / Next'].map(h => (
                <th key={h} style={{ padding: '9px 18px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', background: PAGE }}>{h}</th>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: CARDSH }}>
          <SectionHead title="Recent Shift Events" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RECENT_EVENTS.map((e, i) => {
              const s = EVENT_STYLE[e.type];
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: s.bg }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 4 }} />
                  <span style={{ flex: 1, fontSize: 12, color: T1, lineHeight: 1.45 }}>{e.msg}</span>
                  <span style={{ fontSize: 10, color: T3, flexShrink: 0, marginTop: 2 }}>{e.time}</span>
                </div>
              );
            })}
          </div>
        </div>

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
                <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#spk)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: CARDSH }}>
            <SectionHead title="Inventory Movement" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { zone: 'Zone A (High-Vel)', inbound: 384, outbound: 412, delta: -28 },
                { zone: 'Zone B (Med-Vel)',  inbound: 196, outbound: 178, delta: +18 },
                { zone: 'Zone C (Low-Vel)',  inbound:  88, outbound:  62, delta: +26 },
                { zone: 'Staging',           inbound: 143, outbound: 143, delta:   0 },
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
function SimulationView({ setSubView }: { setSubView: (v: SubView) => void }) {
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
        <button onClick={() => setSubView('overview')}
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
          <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Day Shift · Jun 18, 2026</span>
        )}

        <div style={{ flex: 1 }} />

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
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <WarehouseScene />

          {/* Zone legend */}
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px', pointerEvents: 'none', boxShadow: CARDSH }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Zone Map</div>
            {[
              ['#1d4ed8', 'Receiving'],
              ['#ea580c', 'Zone A · Far West'],
              ['#16a34a', 'Zone C · Center'],
              ['#7c3aed', 'Zone D · East'],
              ['#ca8a04', 'Staging / Shipping'],
            ].map(([c, z]) => (
              <div key={z as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c as string, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: T1 }}>{z}</span>
              </div>
            ))}
          </div>

          {/* Dock status */}
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', pointerEvents: 'none', boxShadow: CARDSH, minWidth: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Dock Status</div>
            {truckStates.map(ts => {
              const pct = Math.round(ts.loadPct * 100);
              const barColor = pct > 85 ? '#dc2626' : pct > 50 ? '#d97706' : '#16a34a';
              return (
                <div key={ts.id} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: T1, fontWeight: 600 }}>{ts.label}</span>
                    <span style={{ fontSize: 11, color: ts.visible ? T2 : T3 }}>{ts.visible ? `${pct}%` : 'Away'}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#f0f2f5' }}>
                    <div style={{ height: 4, borderRadius: 2, width: ts.visible ? `${pct}%` : '0%', background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event side panel */}
        {(() => {
          const ev = getActiveEvent(currentTime, improvementScenario);
          if (!ev || ev.id === dismissedEventId) return null;
          const isProblem    = ev.type === 'problem';
          const accentColor  = isProblem ? '#dc2626' : '#16a34a';
          const accentBg     = isProblem ? '#fef2f2' : '#f0fdf4';
          const accentBorder = isProblem ? '#fecaca' : '#bbf7d0';
          const accentLight  = isProblem ? '#fef9f9' : '#f7fff8';
          return (
            <div style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: CARD, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <div style={{ height: 4, background: accentColor, flexShrink: 0 }} />
              <div style={{ padding: '16px 18px', flex: 1 }}>
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

                <div style={{ background: accentLight, border: `1px solid ${accentBorder}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: T1, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{ev.description}</p>
                </div>
                <p style={{ fontSize: 11, color: T2, lineHeight: 1.7, margin: '0 0 16px' }}>{ev.detail}</p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 7, background: accentBg, border: `1px solid ${accentBorder}`, marginBottom: 14 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: accentColor, fontWeight: 600, lineHeight: 1.4 }}>
                    {isProblem ? 'Red beacon marks this area in the 3D view' : 'Green beacon marks the improvement zone'}
                  </span>
                </div>

                {isProblem && (
                  <button onClick={() => setSubView('ai')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T1, color: '#fff', border: 'none' }}>
                    View Recommended Fix <ChevronRight size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* KPI impact strip — only visible when an improvement scenario is active */}
      {improvementScenario && <KPIImpactStrip scenarioKey={improvementScenario} />}

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
        <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Jun 18, 2026 · Day Shift · All Zones</p>
      </div>
      <TrendChart />
    </div>
  );
}

// ── AI Insights View ──────────────────────────────────────────────────────────
function AIView({ setSubView }: { setSubView: (v: SubView) => void }) {
  const { setImprovementScenario, setCurrentTime, setPlaying, setPlaybackSpeed } = useSimulationStore();

  const handleRunImproved = (scenario: string) => {
    setImprovementScenario(scenario);
    setCurrentTime(0);
    setPlaybackSpeed(60);
    setPlaying(true);
    setSubView('simulation');
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

// ── Adaptive Twin — sub-views ─────────────────────────────────────────────────

function ATLiveKPIs({ scenario }: { scenario: string | null }) {
  const s = AT_SCENARIOS.find(s => s.id === scenario);
  const kpis = [
    { label: 'Throughput',      base: AT_BASELINE.throughput,       delta: s?.kpiDelta.throughput ?? 0,       unit: 'cases/hr', good: true  },
    { label: 'Retrieval Time',  base: AT_BASELINE.retrievalTime,    delta: s?.kpiDelta.retrievalTime ?? 0,    unit: 'sec',      good: false },
    { label: 'Conveyor Util',   base: AT_BASELINE.conveyorUtil,     delta: s?.kpiDelta.conveyorUtil ?? 0,     unit: '%',        good: true  },
    { label: 'Palletizer Up',   base: AT_BASELINE.pallatizerUptime, delta: s?.kpiDelta.pallatizerUptime ?? 0, unit: '%',        good: true  },
    { label: 'Order Fill Rate', base: AT_BASELINE.fillRate,         delta: s?.kpiDelta.fillRate ?? 0,         unit: '%',        good: true  },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {kpis.map(k => {
        const current      = k.base + k.delta;
        const hasImprove   = k.delta !== 0 && !!scenario;
        const isGoodDelta  = k.good ? k.delta >= 0 : k.delta <= 0;
        return (
          <div key={k.label} style={{ background: PAGE, borderRadius: 8, padding: '10px 14px', border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</span>
              {hasImprove && (
                <span style={{ fontSize: 10, fontWeight: 700, color: isGoodDelta ? GREEN : RED, background: isGoodDelta ? '#f0fdf4' : '#fef2f2', borderRadius: 4, padding: '1px 6px', border: `1px solid ${isGoodDelta ? '#bbf7d0' : '#fecaca'}` }}>
                  {k.delta > 0 ? '+' : ''}{k.delta}{k.unit === 'sec' ? 's' : k.unit === '%' ? 'pp' : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: T1, letterSpacing: '-0.02em', lineHeight: 1 }}>{current}</span>
              <span style={{ fontSize: 11, color: T2 }}>{k.unit}</span>
              {hasImprove && (
                <span style={{ fontSize: 11, color: T3, marginLeft: 4, textDecoration: 'line-through' }}>{k.base}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ATLiveView({ setAtSubView }: { setAtSubView: (v: ATSubView) => void }) {
  const { atScenario, setAtScenario, setCurrentTime, setPlaying } = useSimulationStore();
  const criticals = AT_ANOMALIES.filter(a => a.severity === 'critical').slice(0, 2);

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* 3D viewport */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <AdaptiveTwinScene />

        {/* Zone legend — matches warehouse ops style */}
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px', pointerEvents: 'none', boxShadow: CARDSH }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            {atScenario ? `Scenario: ${AT_SCENARIO_LABELS[atScenario]}` : 'System Map'}
          </div>
          {[
            { color: '#f59e0b', label: 'ASRS Crane' },
            { color: '#6b7280', label: 'Storage Racks' },
            { color: '#374151', label: 'Conveyor Belt' },
            { color: '#0891b2', label: 'Palletizer Robot' },
            { color: '#9ca3af', label: 'Manual Docks' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: T1 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Scenario badge — top right, matches SimulationView */}
        {atScenario && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', pointerEvents: 'none', boxShadow: CARDSH }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Zap size={12} color="#16a34a" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Improved Scenario Active</span>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — white/light, matches warehouse ops event panel */}
      <div style={{ width: 288, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: CARD, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Live KPIs */}
        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T1, marginBottom: 12 }}>Live KPIs</div>
          <ATLiveKPIs scenario={atScenario} />
        </div>

        {/* Active anomalies */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T1 }}>Active Anomalies</div>
            <button onClick={() => setAtSubView('anomalies')}
              style={{ fontSize: 11, color: T2, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              View All →
            </button>
          </div>
          {criticals.map(a => (
            <div key={a.id} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <AlertTriangle size={11} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#7f1d1d', lineHeight: 1.3 }}>{a.title}</span>
              </div>
              <div style={{ fontSize: 10, color: T2, paddingLeft: 17 }}>{a.metric} · target: {a.baseline}</div>
            </div>
          ))}
          <button onClick={() => setAtSubView('ai-scenarios')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#7c3aed', color: '#fff', border: 'none', marginTop: 4 }}>
            <Brain size={12} />
            View AI Fixes
          </button>
        </div>

        {atScenario && (
          <div style={{ padding: '14px 16px' }}>
            <button onClick={() => { setAtScenario(null); setPlaying(false); setCurrentTime(0); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: PAGE, color: T2, border: `1px solid ${BORDER}` }}>
              <RotateCcw size={11} />
              Reset to Baseline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ATAnomaliesView({ setAtSubView }: { setAtSubView: (v: ATSubView) => void }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>Anomaly Detection</h1>
        <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>AI-detected deviations from specification — real-time sensor analysis</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {AT_ANOMALIES.map(a => {
          const isCrit = a.severity === 'critical';
          return (
            <div key={a.id} style={{ background: CARD, border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}`, borderRadius: 12, padding: '20px 22px', boxShadow: CARDSH }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: isCrit ? '#fef2f2' : '#fffbeb', border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={15} color={isCrit ? RED : '#d97706'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 7px', background: isCrit ? '#fee2e2' : '#fef3c7', color: isCrit ? RED : '#92400e', border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}` }}>
                      {isCrit ? 'CRITICAL' : 'WARNING'}
                    </span>
                    <span style={{ fontSize: 10, color: T3 }}>Since {a.since}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: T2, marginBottom: 10, lineHeight: 1.5 }}>Zone: {a.zone}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: PAGE, borderRadius: 7, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, color: T3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Current</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isCrit ? RED : '#d97706' }}>{a.metric}</div>
                    </div>
                    <div style={{ background: PAGE, borderRadius: 7, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, color: T3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Baseline</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{a.baseline}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: 11, color: RED, fontWeight: 600 }}>Impact: {a.impact}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setAtSubView('ai-scenarios')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T1, color: '#fff', border: 'none' }}>
                <Brain size={12} />
                View AI Fix <ChevronRight size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ATAIScenariosView({ setAtSubView }: { setAtSubView: (v: ATSubView) => void }) {
  const { setAtScenario, setCurrentTime, setPlaybackSpeed, setPlaying } = useSimulationStore();

  const handleRunSim = (scenarioId: string) => {
    setAtScenario(scenarioId);
    setCurrentTime(0);
    setPlaybackSpeed(60);
    setPlaying(true);
    setAtSubView('simulation');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>AI Improvement Scenarios</h1>
        <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Simulated interventions — select a scenario to see the projected impact in 3D</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {AT_SCENARIOS.map(s => {
          const catColor = AT_CATEGORY_COLORS[s.category];
          const anomaly  = AT_ANOMALIES.find(a => a.id === s.anomalyId);
          return (
            <div key={s.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 24px', boxShadow: CARDSH }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: `${catColor}18`, border: `1px solid ${catColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FlaskConical size={16} color={catColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 7px', background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}44` }}>
                      {s.category}
                    </span>
                    {anomaly && (
                      <span style={{ fontSize: 10, color: T3 }}>Fixes: {anomaly.severity === 'critical' ? '🔴' : '🟡'} {anomaly.title.slice(0, 36)}…</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T1, marginBottom: 6, letterSpacing: '-0.01em' }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{s.description}</div>
                </div>
              </div>

              {/* KPI delta preview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Throughput',  delta: s.kpiDelta.throughput,       unit: 'cases/hr', good: true  },
                  { label: 'Retrieval',   delta: s.kpiDelta.retrievalTime,    unit: 'sec',      good: false },
                  { label: 'Conv. Util',  delta: s.kpiDelta.conveyorUtil,     unit: 'pp',       good: true  },
                  { label: 'Palletizer',  delta: s.kpiDelta.pallatizerUptime, unit: 'pp',       good: true  },
                  { label: 'Fill Rate',   delta: s.kpiDelta.fillRate,         unit: 'pp',       good: true  },
                ].map(k => {
                  const isGood = k.good ? k.delta >= 0 : k.delta <= 0;
                  const noChange = k.delta === 0;
                  return (
                    <div key={k.label} style={{ background: noChange ? PAGE : (isGood ? '#f0fdf4' : '#fef2f2'), borderRadius: 7, padding: '8px 10px', border: `1px solid ${noChange ? BORDER : (isGood ? '#bbf7d0' : '#fecaca')}` }}>
                      <div style={{ fontSize: 9, color: T3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: noChange ? T3 : (isGood ? GREEN : RED) }}>
                        {noChange ? '—' : `${k.delta > 0 ? '+' : ''}${k.delta}${k.unit}`}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ padding: '8px 12px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>{s.estimatedImpact}</span>
                </div>
                <button onClick={() => handleRunSim(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: catColor, color: '#fff', border: 'none', boxShadow: `0 2px 8px ${catColor}44` }}>
                  <Play size={12} />
                  Run 3D Simulation
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ATSimulationView({ setAtSubView }: { setAtSubView: (v: ATSubView) => void }) {
  const { atScenario, setAtScenario, setCurrentTime, setPlaying } = useSimulationStore();
  const s = AT_SCENARIOS.find(sc => sc.id === atScenario);

  const backToLive = () => {
    setAtScenario(null);
    setCurrentTime(0);
    setPlaying(false);
    setAtSubView('live');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, background: CARD, flexShrink: 0 }}>
        <button onClick={() => setAtSubView('live')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>
          <ArrowLeft size={12} /> Back
        </button>
        <div style={{ width: 1, height: 16, background: BORDER }} />
        {atScenario && s ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 99, padding: '4px 12px' }}>
            <Zap size={11} color="#7c3aed" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>{AT_SCENARIO_LABELS[atScenario]}</span>
            <span style={{ fontSize: 11, color: T2 }}>— Improved Scenario</span>
          </div>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Adaptive Twin · Baseline Operations</span>
        )}
        <div style={{ flex: 1 }} />
        {atScenario && (
          <>
            <button onClick={() => setAtSubView('control')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#f0fdf4', color: GREEN, border: '1px solid #bbf7d0' }}>
              <Settings size={11} />
              Control System
            </button>
            <button onClick={backToLive}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: T2, background: PAGE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
              <RotateCcw size={11} /> Reset
            </button>
          </>
        )}
      </div>

      {/* 3D full width */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <AdaptiveTwinScene />
      </div>

      {/* KPI impact strip */}
      {atScenario && s && (
        <div style={{ flexShrink: 0, background: '#0f172a', borderTop: '1px solid #1e293b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, marginRight: 8 }}>
            <Zap size={13} color="#fbbf24" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', whiteSpace: 'nowrap' }}>KPI Impact</span>
            <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>vs. baseline</span>
          </div>
          <div style={{ width: 1, height: 32, background: '#1e293b', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flex: 1, overflow: 'hidden' }}>
            {[
              { label: 'Throughput',    before: AT_BASELINE.throughput,       after: AT_BASELINE.throughput + s.kpiDelta.throughput,       delta: `+${s.kpiDelta.throughput}`,                     unit: 'cases/hr' },
              { label: 'Retrieval',     before: AT_BASELINE.retrievalTime,    after: AT_BASELINE.retrievalTime + s.kpiDelta.retrievalTime,  delta: `${s.kpiDelta.retrievalTime}s`,                  unit: 'sec'      },
              { label: 'Conv. Util',    before: AT_BASELINE.conveyorUtil,     after: AT_BASELINE.conveyorUtil + s.kpiDelta.conveyorUtil,    delta: `+${s.kpiDelta.conveyorUtil}pp`,                 unit: '%'        },
              { label: 'Palletizer',    before: AT_BASELINE.pallatizerUptime, after: AT_BASELINE.pallatizerUptime + s.kpiDelta.pallatizerUptime, delta: `+${s.kpiDelta.pallatizerUptime}pp`,        unit: '%'        },
              { label: 'Fill Rate',     before: AT_BASELINE.fillRate,         after: AT_BASELINE.fillRate + s.kpiDelta.fillRate,           delta: `+${s.kpiDelta.fillRate}pp`,                     unit: '%'        },
            ].map(k => (
              <div key={k.label} style={{ flex: 1, minWidth: 0, background: '#1e293b', borderRadius: 8, padding: '6px 10px', border: '1px solid #334155' }}>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'line-through' }}>{k.before}</span>
                  <span style={{ fontSize: 10, color: '#475569' }}>→</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>{k.after}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', background: '#14532d', borderRadius: 4, padding: '1px 5px' }}>{k.delta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <SimulationControls />
    </div>
  );
}

function ATControlSystemView() {
  const { atScenario } = useSimulationStore();
  if (!atScenario) return null;

  const s = AT_SCENARIOS.find(sc => sc.id === atScenario)!;
  const events = AT_CONTROL_EVENTS[atScenario] ?? [];
  const catColor = AT_CATEGORY_COLORS[s.category];

  const improved = {
    throughput:        AT_BASELINE.throughput        + s.kpiDelta.throughput,
    retrievalTime:     AT_BASELINE.retrievalTime     + s.kpiDelta.retrievalTime,
    conveyorUtil:      AT_BASELINE.conveyorUtil      + s.kpiDelta.conveyorUtil,
    pallatizerUptime:  AT_BASELINE.pallatizerUptime  + s.kpiDelta.pallatizerUptime,
    fillRate:          AT_BASELINE.fillRate          + s.kpiDelta.fillRate,
  };

  const kpiRows = [
    { label: 'Throughput',      before: AT_BASELINE.throughput,        after: improved.throughput,        unit: 'cases/hr', icon: Package,     good: true  },
    { label: 'Retrieval Time',  before: AT_BASELINE.retrievalTime,     after: improved.retrievalTime,     unit: 'sec',      icon: Timer,       good: false },
    { label: 'Conveyor Util',   before: AT_BASELINE.conveyorUtil,      after: improved.conveyorUtil,      unit: '%',        icon: Activity,    good: true  },
    { label: 'Palletizer Up',   before: AT_BASELINE.pallatizerUptime,  after: improved.pallatizerUptime,  unit: '%',        icon: Cpu,         good: true  },
    { label: 'Order Fill Rate', before: AT_BASELINE.fillRate,          after: improved.fillRate,          unit: '%',        icon: CheckCircle, good: true  },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px' }}>
      {/* Banner */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '18px 22px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Settings size={20} color={GREEN} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Control System — Improvement Active</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T1, letterSpacing: '-0.01em' }}>{s.title}</div>
          <div style={{ fontSize: 12, color: T2, marginTop: 2 }}>Adaptive Twin is operating with the improved configuration. KPIs reflect live confirmed values.</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>Category</div>
          <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '4px 10px', background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}44` }}>
            {s.category}
          </span>
        </div>
      </div>

      {/* Confirmed KPIs */}
      <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        Confirmed KPIs — Baseline vs. Live Improved
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 22 }}>
        {kpiRows.map(k => {
          const isImproved = k.good ? k.after > k.before : k.after < k.before;
          const delta = k.after - k.before;
          const Icon = k.icon;
          return (
            <div key={k.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', boxShadow: CARDSH }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={13} color={GREEN} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>{k.label}</div>
              </div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T3, marginBottom: 2 }}>BASELINE</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#9ca3af', textDecoration: 'line-through' }}>{k.before}</div>
              </div>
              <div style={{ fontSize: 16, color: '#d1d5db', margin: '6px 0' }}>↓</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: GREEN, marginBottom: 2 }}>CONFIRMED LIVE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: T1, letterSpacing: '-0.03em' }}>{k.after}</div>
                <div style={{ fontSize: 10, color: T2 }}>{k.unit}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px' }}>
                {delta > 0 ? '+' : ''}{delta}{k.unit === '%' ? 'pp' : k.unit === 'sec' ? 's' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Event timeline */}
      <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        Control System Event Log
      </div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', boxShadow: CARDSH }}>
        {events.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderBottom: i < events.length - 1 ? `1px solid ${BORDER}` : 'none', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid #86efac', marginTop: 3 }} />
              {i < events.length - 1 && <div style={{ width: 2, height: 28, background: '#e5e7eb' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T1 }}>{ev.title}</span>
                <span style={{ fontSize: 10, color: T3 }}>· {ev.time}</span>
              </div>
              <p style={{ fontSize: 12, color: T2, margin: 0, lineHeight: 1.6 }}>{ev.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdaptiveTwinView({ atSubView, setAtSubView }: { atSubView: ATSubView; setAtSubView: (v: ATSubView) => void }) {
  const { atScenario } = useSimulationStore();
  const effective: ATSubView = (atSubView === 'control' && !atScenario) ? 'live' : atSubView;
  return (
    <>
      {effective === 'live'        && <ATLiveView        setAtSubView={setAtSubView} />}
      {effective === 'anomalies'   && <ATAnomaliesView   setAtSubView={setAtSubView} />}
      {effective === 'ai-scenarios'&& <ATAIScenariosView setAtSubView={setAtSubView} />}
      {effective === 'simulation'  && <ATSimulationView  setAtSubView={setAtSubView} />}
      {effective === 'control'     && <ATControlSystemView />}
    </>
  );
}

// ── KPI Impact View ───────────────────────────────────────────────────────────
function KPIImpactView() {
  const { improvementScenario } = useSimulationStore();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  if (!improvementScenario) return null;

  const impact = SCENARIO_IMPACTS[improvementScenario];
  if (!impact) return null;

  const scenarioLabel = SCENARIO_LABELS[improvementScenario] ?? improvementScenario;
  const events = SCENARIO_BENEFIT_EVENTS[improvementScenario] ?? [];

  const baseline = { cases: 1847, util: 71, congestion: 67, dwell: 18.3, shipped: 143 };
  const improved = {
    cases:      baseline.cases + impact.casesImprovement,
    util:       Math.min(99, baseline.util + impact.utilizationImprovement),
    congestion: Math.max(5, baseline.congestion - impact.congestionReduction),
    dwell:      Math.max(6, baseline.dwell - baseline.dwell * (impact.congestionReduction / 200)),
    shipped:    Math.min(180, baseline.shipped + Math.round(impact.casesImprovement * 0.08)),
  };

  const kpis = [
    {
      title: 'Case Pick Rate',
      before: baseline.cases.toLocaleString(),
      after:  improved.cases.toLocaleString(),
      delta:  `+${impact.casesImprovement}`,
      pct:    `+${((impact.casesImprovement / baseline.cases) * 100).toFixed(1)}%`,
      unit:   'cases / shift',
      Icon: Package, color: '#3b82f6', bg: '#eff6ff',
    },
    {
      title: 'Forklift Utilization',
      before: `${baseline.util}%`,
      after:  `${improved.util}%`,
      delta:  `+${impact.utilizationImprovement}pp`,
      pct:    `+${((impact.utilizationImprovement / baseline.util) * 100).toFixed(1)}%`,
      unit:   'fleet average',
      Icon: Truck, color: '#16a34a', bg: '#f0fdf4',
    },
    {
      title: 'Congestion Score',
      before: String(baseline.congestion),
      after:  String(improved.congestion),
      delta:  `-${impact.congestionReduction}pts`,
      pct:    `-${((impact.congestionReduction / baseline.congestion) * 100).toFixed(1)}%`,
      unit:   '/ 100 (lower = better)',
      Icon: Activity, color: '#d97706', bg: '#fffbeb',
    },
    {
      title: 'Avg Dwell Time',
      before: `${baseline.dwell}`,
      after:  `${improved.dwell.toFixed(1)}`,
      delta:  `-${(baseline.dwell - improved.dwell).toFixed(1)} min`,
      pct:    `-${(((baseline.dwell - improved.dwell) / baseline.dwell) * 100).toFixed(1)}%`,
      unit:   'min to putaway',
      Icon: Timer, color: '#8b5cf6', bg: '#f5f3ff',
    },
    {
      title: 'Pallets Shipped',
      before: String(baseline.shipped),
      after:  String(improved.shipped),
      delta:  `+${improved.shipped - baseline.shipped}`,
      pct:    `+${(((improved.shipped - baseline.shipped) / baseline.shipped) * 100).toFixed(1)}%`,
      unit:   'pallets / shift',
      Icon: CheckCircle, color: '#0891b2', bg: '#ecfeff',
    },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '24px 28px 28px' }}>

        {/* Scenario banner */}
        <div style={{ background: '#0f172a', borderRadius: 12, padding: '18px 22px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={20} color="#fbbf24" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Active Improvement Scenario</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>{scenarioLabel}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>{impact.description}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Projected Gain</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', letterSpacing: '-0.03em' }}>+{impact.casesImprovement}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>cases / shift</div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          KPI Impact — Baseline vs. Improved
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 22 }}>
          {kpis.map(kpi => (
            <div key={kpi.title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', boxShadow: CARDSH }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <kpi.Icon size={13} color={kpi.color} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>{kpi.title}</div>
              </div>

              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T3, letterSpacing: '0.06em', marginBottom: 2 }}>BASELINE</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#9ca3af', textDecoration: 'line-through', letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.before}</div>
                <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>{kpi.unit}</div>
              </div>

              <div style={{ fontSize: 18, color: '#d1d5db', margin: '8px 0' }}>↓</div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: GREEN, letterSpacing: '0.06em', marginBottom: 2 }}>IMPROVED</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: T1, letterSpacing: '-0.03em', lineHeight: 1 }}>{kpi.after}</div>
                <div style={{ fontSize: 10, color: T2, marginTop: 2 }}>{kpi.unit}</div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px' }}>
                  {kpi.delta}
                </span>
                <span style={{ fontSize: 10, color: T3, fontWeight: 600 }}>{kpi.pct}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Key improvement events */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Key Improvement Events
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => {
            const isOpen = expandedEvent === ev.id;
            return (
              <div key={ev.id} style={{ background: CARD, border: '1px solid #bbf7d0', borderRadius: 10, overflow: 'hidden', boxShadow: CARDSH }}>
                <button
                  onClick={() => setExpandedEvent(isOpen ? null : ev.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={16} color="#16a34a" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginBottom: 2 }}>
                      {ev.timeLabel} — Improvement Active
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{ev.title}</div>
                  </div>
                  <ChevronRight size={14} color={T3} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </button>
                {isOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f0fdf4' }}>
                    <p style={{ fontSize: 13, color: T1, lineHeight: 1.65, margin: '14px 0 10px', fontWeight: 500 }}>{ev.description}</p>
                    <p style={{ fontSize: 12, color: T2, lineHeight: 1.7, margin: 0 }}>{ev.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline pinned at bottom */}
      <SimulationControls />
    </div>
  );
}

// ── Autonomous Dock — colour accent ──────────────────────────────────────────
const AD_COLOR = '#0891b2';

// ── Autonomous Dock — Live Operations ────────────────────────────────────────
function ADLiveOpsView({ setAdSubView }: { setAdSubView: (v: ADSubView) => void }) {
  const CYAN = AD_COLOR;
  const CYAN_BG = '#ecfeff';
  const CYAN_BORDER = '#a5f3fc';

  const recvBays = DOCK_BAYS.filter(b => b.type === 'recv');
  const shipBays = DOCK_BAYS.filter(b => b.type === 'ship');

  const statusStyle: Record<string, { bg: string; color: string; border: string }> = {
    occupied:  { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    staging:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    idle:      { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    departing: { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  };

  const eventDot: Record<string, string> = {
    decision: CYAN, alert: RED, info: '#3b82f6', success: GREEN,
  };
  const eventBg: Record<string, string> = {
    decision: CYAN_BG, alert: '#fef2f2', info: '#eff6ff', success: '#f0fdf4',
  };

  function DockBayCard({ bay }: { bay: DockBay }) {
    const sc = statusStyle[bay.status];
    const loadPct = bay.capacity > 0 ? Math.round((bay.pallets / bay.capacity) * 100) : 0;
    const isRecv = bay.type === 'recv';
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', boxShadow: CARDSH }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: isRecv ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={13} color={isRecv ? '#1d4ed8' : '#16a34a'} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{bay.label}</div>
              <div style={{ fontSize: 10, color: T3 }}>{bay.carrier ?? 'Unoccupied'}</div>
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '3px 9px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
            {bay.status.charAt(0).toUpperCase() + bay.status.slice(1)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f0f2f5' }}>
            <div style={{ height: 6, borderRadius: 3, width: `${loadPct}%`, background: loadPct > 90 ? RED : loadPct > 60 ? '#d97706' : CYAN }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: T2, minWidth: 32 }}>{loadPct}%</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: PAGE, borderRadius: 6, padding: '7px 10px' }}>
            <div style={{ fontSize: 9, color: T3, marginBottom: 2 }}>PALLETS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{bay.pallets} / {bay.capacity}</div>
          </div>
          <div style={{ background: PAGE, borderRadius: 6, padding: '7px 10px' }}>
            <div style={{ fontSize: 9, color: T3, marginBottom: 2 }}>STAGING</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: bay.stagingPallets > 6 ? RED : T1 }}>{bay.stagingPallets} pallets</div>
          </div>
          <div style={{ background: PAGE, borderRadius: 6, padding: '7px 10px' }}>
            <div style={{ fontSize: 9, color: T3, marginBottom: 2 }}>TURN TIME</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: bay.turnTimeMin > 55 ? RED : T1 }}>{bay.turnTimeMin > 0 ? `${bay.turnTimeMin} min` : '—'}</div>
          </div>
          <div style={{ background: PAGE, borderRadius: 6, padding: '7px 10px' }}>
            <div style={{ fontSize: 9, color: T3, marginBottom: 2 }}>PATH DIST</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{bay.distToStorage} m</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px 28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>Autonomous Dock — Live Operations</h1>
          <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Jun 18, 2026 · Day Shift · Real-time dock intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAdSubView('ai-decisions')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: CARD, color: T1, border: `1px solid ${BORDER}` }}>
            <Brain size={13} />
            AI Decisions
          </button>
          <button onClick={() => setAdSubView('simulation')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: CYAN, color: '#fff', border: 'none', boxShadow: `0 2px 8px ${CYAN}44` }}>
            <Play size={13} />
            Run Simulation
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { Icon: Truck,       title: 'Truck Fill Rate',      value: `${DOCK_BASELINE.fillRate}%`,          sub: 'avg across active docks',   color: CYAN,     bg: CYAN_BG,  border: CYAN_BORDER, ok: false },
          { Icon: Package,     title: 'Staging Congestion',   value: `${DOCK_BASELINE.congestionScore}`,    sub: 'pallets in staging area',   color: '#d97706', bg: '#fffbeb', border: '#fde68a',   ok: false },
          { Icon: Timer,       title: 'Avg Turn Time',        value: `${DOCK_BASELINE.turnTimeMin} min`,    sub: 'dock-to-clear per truck',   color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe',   ok: false },
          { Icon: CheckCircle, title: 'Docks Utilised',       value: `${DOCK_BASELINE.docksUtilised} / 6`,  sub: 'of 6 bays active',          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',   ok: true  },
        ].map(({ Icon, title, value, sub, color, bg, border, ok }) => (
          <div key={title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 22px', boxShadow: CARDSH }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: ok ? T1 : RED, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 12, color: T2, marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Receiving & Shipping bay grids */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginBottom: 22 }}>
        {/* Receiving */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1d4ed8' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T1 }}>Receiving Docks</span>
            <span style={{ fontSize: 11, color: T3, marginLeft: 4 }}>— inbound trucks</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recvBays.map(b => <DockBayCard key={b.id} bay={b} />)}
          </div>

          {/* Inbound queue */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Inbound Queue</div>
            {INBOUND_TRUCKS.map(t => (
              <div key={t.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.status === 'approaching' ? CYAN : '#d1d5db', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{t.carrier}</div>
                  <div style={{ fontSize: 10, color: T3 }}>{t.trailer} · {t.pallets} pallets · {t.skuClass}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.etaMin < 15 ? RED : T2 }}>ETA {t.etaMin} min</div>
                  <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 6px', background: t.priority === 'high' ? '#fef2f2' : '#f9fafb', color: t.priority === 'high' ? RED : T3, border: `1px solid ${t.priority === 'high' ? '#fecaca' : BORDER}` }}>
                    {t.priority.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T1 }}>Shipping Docks</span>
            <span style={{ fontSize: 11, color: T3, marginLeft: 4 }}>— outbound orders</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shipBays.map(b => <DockBayCard key={b.id} bay={b} />)}
          </div>

          {/* Outbound queue */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>WMS Pick Waves Pending</div>
            {OUTBOUND_ORDERS.map(o => (
              <div key={o.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: o.deadlineMin < 45 ? RED : '#d1d5db', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{o.carrier} · {o.id}</div>
                  <div style={{ fontSize: 10, color: T3 }}>{o.trailer} · Wave {o.waveId} · {o.pallets} pallets</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: o.deadlineMin < 45 ? RED : T2 }}>Due {o.deadlineMin} min</div>
                  <div style={{ fontSize: 10, color: T2 }}>Fill: {o.fillRate}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event log */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 22px', boxShadow: CARDSH }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 12 }}>Autonomous Decision Log</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DOCK_EVENTS.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: eventBg[e.type] }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: eventDot[e.type], flexShrink: 0, marginTop: 4 }} />
              <span style={{ flex: 1, fontSize: 12, color: T1, lineHeight: 1.45 }}>{e.msg}</span>
              <span style={{ fontSize: 10, color: T3, flexShrink: 0, marginTop: 2 }}>{e.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Autonomous Dock — AI Decisions ────────────────────────────────────────────
function ADAIDecisionsView({ setAdSubView }: { setAdSubView: (v: ADSubView) => void }) {
  const CYAN = AD_COLOR;
  const [recvApplied, setRecvApplied] = useState(false);
  const [shipApplied, setShipApplied] = useState(false);

  // Assign receiving trucks sequentially so each gets a distinct idle dock
  const recvAssignments = (() => {
    const usedDocks = new Set<string>();
    const baysLeft = [...DOCK_BAYS];
    return INBOUND_TRUCKS.map(t => {
      const zone = t.skuClass.split(' · ')[0];
      const zoneKey = zone as 'Zone A' | 'Zone B' | 'Zone C';
      // Sort idle, unassigned bays by distance to this truck's zone
      const distMap: Record<string, number> = { 'R-1': { 'Zone A': 18, 'Zone B': 24, 'Zone C': 31 }[zoneKey] ?? 25, 'R-2': { 'Zone A': 22, 'Zone B': 20, 'Zone C': 26 }[zoneKey] ?? 25, 'R-3': { 'Zone A': 31, 'Zone B': 26, 'Zone C': 19 }[zoneKey] ?? 25 };
      const candidate = baysLeft
        .filter(b => b.type === 'recv' && !usedDocks.has(b.id))
        .sort((a, b2) => (distMap[a.id] ?? 99) - (distMap[b2.id] ?? 99))[0];
      const dockId = candidate?.id ?? 'R-3';
      usedDocks.add(dockId);
      return { truck: t, dock: dockId, reason: `Shortest path to ${zone} storage (${distMap[dockId] ?? '?'} m)` };
    });
  })();

  const shipAssignments = OUTBOUND_ORDERS.map(o => ({
    order: o,
    dock: assignShipDock(o, DOCK_BAYS) ?? 'S-3',
    sequence: getLoadSequence(o),
    optimisedFill: optimisedFillRate(o),
    congestionSaving: Math.max(0, o.congestionScore - 2),
  }));

  const sizeColor = { large: '#1d4ed8', medium: '#d97706', small: '#16a34a' };
  const sizeBg    = { large: '#eff6ff', medium: '#fffbeb', small: '#f0fdf4' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>AI Dock Decisions</h1>
          <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Optimal assignments generated from live queue and dock state</p>
        </div>
        <button onClick={() => setAdSubView('simulation')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: CYAN, color: '#fff', border: 'none', boxShadow: `0 2px 8px ${CYAN}44` }}>
          <Play size={13} />
          Run Simulation
        </button>
      </div>

      {/* Receiving assignments */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 24px', boxShadow: CARDSH, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={15} color="#1d4ed8" />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Receiving</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Truck-to-Dock Sequencing</div>
              <div style={{ fontSize: 12, color: T2 }}>Assign each inbound truck to the dock with shortest pathing to its SKU zone</div>
            </div>
          </div>
          {!recvApplied ? (
            <button onClick={() => setRecvApplied(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#1d4ed8', color: '#fff', border: 'none', flexShrink: 0 }}>
              <CheckCircle size={12} />
              Apply All
            </button>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={11} /> Applied
            </span>
          )}
        </div>

        {/* Pathing matrix */}
        <div style={{ background: PAGE, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Pathing Distance Matrix (metres to zone)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: T3, fontWeight: 600, fontSize: 10 }}>Dock</th>
                  {['Zone A · High-Vel', 'Zone B · Med-Vel', 'Zone C · Low-Vel'].map(z => (
                    <th key={z} style={{ padding: '6px 12px', textAlign: 'center', color: T3, fontWeight: 600, fontSize: 10 }}>{z}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 'R-1', dists: [18, 24, 31] },
                  { id: 'R-2', dists: [22, 20, 26] },
                  { id: 'R-3', dists: [31, 26, 19] },
                ].map(row => (
                  <tr key={row.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: T1 }}>{row.id}</td>
                    {row.dists.map((d, i) => {
                      const minVal = [18, 20, 19][i];
                      return (
                        <td key={i} style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: d === minVal ? 800 : 500, color: d === minVal ? CYAN : T2, background: d === minVal ? '#ecfeff' : 'transparent', borderRadius: 4, padding: d === minVal ? '2px 8px' : '0', border: d === minVal ? `1px solid #a5f3fc` : 'none' }}>
                            {d} m
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recvAssignments.map(({ truck, dock, reason }) => (
            <div key={truck.id} style={{ background: recvApplied ? '#f0fdf4' : PAGE, border: `1px solid ${recvApplied ? '#bbf7d0' : BORDER}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{truck.carrier}</span>
                  <span style={{ fontSize: 10, color: T3 }}>{truck.trailer}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '1px 6px', background: truck.priority === 'high' ? '#fef2f2' : '#f9fafb', color: truck.priority === 'high' ? RED : T3, border: `1px solid ${truck.priority === 'high' ? '#fecaca' : BORDER}` }}>
                    {truck.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
                <div style={{ fontSize: 11, color: T2 }}>{truck.pallets} pallets · ETA {truck.etaMin} min · {truck.skuClass}</div>
                <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{reason}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: T3, marginBottom: 3 }}>ASSIGNED DOCK</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: recvApplied ? GREEN : CYAN, letterSpacing: '-0.02em' }}>{dock}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping assignments */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 24px', boxShadow: CARDSH }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={15} color="#16a34a" />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Shipping</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>WMS Wave Assignment + Load Sequencing</div>
              <div style={{ fontSize: 12, color: T2 }}>Assign dock by lowest staging congestion · sequence items large → medium → small to maximise fill rate</div>
            </div>
          </div>
          {!shipApplied ? (
            <button onClick={() => setShipApplied(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#16a34a', color: '#fff', border: 'none', flexShrink: 0 }}>
              <CheckCircle size={12} />
              Apply All
            </button>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={11} /> Applied
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shipAssignments.map(({ order, dock, sequence, optimisedFill, congestionSaving }) => (
            <div key={order.id} style={{ background: shipApplied ? '#f0fdf4' : PAGE, border: `1px solid ${shipApplied ? '#bbf7d0' : BORDER}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{order.carrier}</span>
                    <span style={{ fontSize: 10, color: T3 }}>Wave {order.waveId} · {order.trailer}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: order.deadlineMin < 45 ? RED : T3, borderRadius: 4, padding: '1px 6px', background: order.deadlineMin < 45 ? '#fef2f2' : '#f9fafb', border: `1px solid ${order.deadlineMin < 45 ? '#fecaca' : BORDER}` }}>
                      Due in {order.deadlineMin} min
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: T2 }}>{order.pallets} pallets · Staging congestion: {order.congestionScore} → {order.congestionScore - congestionSaving} after reassign</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: T3, marginBottom: 3 }}>ASSIGNED DOCK</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: shipApplied ? GREEN : '#16a34a', letterSpacing: '-0.02em' }}>{dock}</div>
                </div>
              </div>

              {/* Load sequence */}
              <div style={{ background: CARD, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Layers size={11} color={T3} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Load Sequence (optimised)</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: GREEN }}>Fill rate: <span style={{ textDecoration: 'line-through', color: T3 }}>{order.fillRate}%</span> → {optimisedFill}%</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {sequence.map((item, idx) => (
                    <div key={item.sku} style={{ flex: 1, background: (sizeBg as any)[item.size], border: `1px solid ${(sizeColor as any)[item.size]}33`, borderRadius: 7, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: (sizeColor as any)[item.size], textTransform: 'uppercase', marginBottom: 3 }}>Step {idx + 1} · {item.size}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T1 }}>{item.sku}</div>
                      <div style={{ fontSize: 10, color: T2 }}>{item.qty} units · {item.weightKg} kg</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Autonomous Dock — Simulation (KPI impact) ─────────────────────────────────
function ADSimulationView({ setAdSubView }: { setAdSubView: (v: ADSubView) => void }) {
  const CYAN = AD_COLOR;
  const [activeTab, setActiveTab] = useState<'dock' | 'truck'>('dock');

  // Dock optimizer state
  const [dockPhase, setDockPhase] = useState<'baseline' | 'optimised'>('baseline');
  const [dockRunning, setDockRunning] = useState(false);

  // Truck load state
  const [loadMode, setLoadMode]     = useState<'baseline' | 'optimised'>('baseline');
  const [loadAnimating, setLoadAnimating] = useState(false);
  const [loadDone, setLoadDone]     = useState(false);

  const handleRunDock = () => {
    setDockRunning(true);
    setTimeout(() => {
      setDockPhase('optimised');
      setDockRunning(false);
    }, 1200);
  };

  const handleOptimisePacking = () => {
    setLoadAnimating(true);
    setLoadMode('optimised');
    setTimeout(() => {
      setLoadAnimating(false);
      setLoadDone(true);
    }, 3000);
  };

  const handleResetDock = () => {
    setDockPhase('baseline');
    setDockRunning(false);
  };

  const handleResetPacking = () => {
    setLoadMode('baseline');
    setLoadAnimating(false);
    setLoadDone(false);
  };

  const kpis = [
    { label: 'Truck Fill Rate',    before: DOCK_BASELINE.fillRate,        after: DOCK_OPTIMISED.fillRate,        unit: '%',         good: true  },
    { label: 'Staging Congestion', before: DOCK_BASELINE.congestionScore, after: DOCK_OPTIMISED.congestionScore, unit: ' pallets',  good: false },
    { label: 'Avg Turn Time',      before: DOCK_BASELINE.turnTimeMin,     after: DOCK_OPTIMISED.turnTimeMin,     unit: ' min',      good: false },
    { label: 'Docks Utilised',     before: DOCK_BASELINE.docksUtilised,   after: DOCK_OPTIMISED.docksUtilised,   unit: ' / 6',      good: true  },
    { label: 'Missed Deadlines',   before: DOCK_BASELINE.missedDeadlines, after: DOCK_OPTIMISED.missedDeadlines, unit: '',          good: false },
  ];

  const tabStyle = (id: 'dock' | 'truck') => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: 6,
    padding: '7px 16px', borderRadius: '8px 8px 0 0', fontSize: 12, fontWeight: 600 as const,
    cursor: 'pointer' as const, border: 'none',
    background: activeTab === id ? CARD : 'transparent',
    color: activeTab === id ? T1 : T2,
    borderBottom: activeTab === id ? `2px solid ${CYAN}` : '2px solid transparent',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: `1px solid ${BORDER}`, background: CARD, flexShrink: 0 }}>
        <button onClick={() => setAdSubView('live-ops')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>
          <ArrowLeft size={12} /> Back
        </button>
        <div style={{ width: 1, height: 16, background: BORDER }} />
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: T1 }}>Visual Simulation</span>
          <span style={{ fontSize: 12, color: T2, marginLeft: 10 }}>Dock routing · Truck load packing</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 2, background: PAGE, borderRadius: 9, padding: 3 }}>
          {[
            { id: 'dock' as const,  label: 'Dock Optimizer', Icon: Truck   },
            { id: 'truck' as const, label: 'Load Planner',   Icon: Package },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: activeTab === id ? CARD : 'transparent',
                color: activeTab === id ? T1 : T2,
                boxShadow: activeTab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: PAGE }}>

        {/* ── TAB: Dock Optimizer ── */}
        {activeTab === 'dock' && (
          <div style={{ padding: '24px 28px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: T1, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Dock Assignment Optimizer</h2>
                <p style={{ fontSize: 12, color: T2, margin: 0 }}>
                  Top-down view — see which truck gets routed to which dock and the path to storage.
                  <strong style={{ color: RED }}> Before:</strong> T-103 (Zone A) placed at R-3 — 31 m wasted path.
                  <strong style={{ color: '#0891b2' }}> After:</strong> each truck matched to closest zone dock.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 20 }}>
                {dockPhase === 'baseline' ? (
                  <button onClick={handleRunDock} disabled={dockRunning}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: CYAN, color: '#fff', border: 'none', opacity: dockRunning ? 0.7 : 1 }}>
                    <Play size={12} />
                    {dockRunning ? 'Optimising…' : 'Run Optimisation'}
                  </button>
                ) : (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px' }}>
                      <CheckCircle size={11} /> Optimised
                    </span>
                    <button onClick={handleResetDock}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: PAGE, color: T2, border: `1px solid ${BORDER}` }}>
                      <RotateCcw size={11} /> Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* SVG dock map */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px', boxShadow: CARDSH, marginBottom: 18 }}>
              <DockLayoutSVG phase={dockPhase} />
            </div>

            {/* KPI strip */}
            <div style={{ background: '#0f172a', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <Zap size={13} color="#fbbf24" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>KPI Impact — Dock Routing</span>
                {dockPhase === 'optimised' && <span style={{ fontSize: 10, color: '#64748b' }}>· optimised</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {kpis.map(k => {
                  const delta   = k.after - k.before;
                  const isGood  = k.good ? delta >= 0 : delta <= 0;
                  const showOpt = dockPhase === 'optimised';
                  return (
                    <div key={k.label} style={{ background: '#1e293b', borderRadius: 8, padding: '10px 12px', border: '1px solid #334155' }}>
                      <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{k.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', textDecoration: showOpt ? 'line-through' : 'none' }}>
                          {k.before}{k.unit}
                        </span>
                        {showOpt && (
                          <>
                            <span style={{ fontSize: 9, color: '#475569' }}>→</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>{k.after}{k.unit}</span>
                          </>
                        )}
                      </div>
                      {showOpt && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: isGood ? '#22c55e' : '#f87171', background: isGood ? '#14532d' : '#7f1d1d', borderRadius: 4, padding: '1px 6px', marginTop: 4, display: 'inline-block' }}>
                          {delta > 0 ? '+' : ''}{delta}{k.unit}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Load Planner ── */}
        {activeTab === 'truck' && (
          <div style={{ padding: '24px 28px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: T1, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Truck Load Planner</h2>
                <p style={{ fontSize: 12, color: T2, margin: 0 }}>
                  Looking into the back of the trailer.
                  <strong style={{ color: RED }}> Before:</strong> random loading — large gaps visible.
                  <strong style={{ color: '#0891b2' }}> After AI:</strong> large boxes floor-first, medium, then small fills every gap. Drag to rotate · scroll to zoom.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 20 }}>
                {loadMode === 'baseline' ? (
                  <button onClick={handleOptimisePacking} disabled={loadAnimating}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: CYAN, color: '#fff', border: 'none', opacity: loadAnimating ? 0.7 : 1 }}>
                    <Zap size={12} />
                    {loadAnimating ? 'Packing…' : 'Apply AI Packing'}
                  </button>
                ) : (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px' }}>
                      <CheckCircle size={11} /> Optimised Packing
                    </span>
                    <button onClick={handleResetPacking}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: PAGE, color: T2, border: `1px solid ${BORDER}` }}>
                      <RotateCcw size={11} /> Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3D truck interior — single viewport, switches between modes */}
            <div style={{
              background: '#0f172a', border: `1px solid ${loadMode === 'optimised' ? '#164e63' : '#1e293b'}`,
              borderRadius: 14, overflow: 'hidden', marginBottom: 18, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              <TruckInterior3D
                mode={loadMode}
                animating={loadAnimating}
                height={460}
              />
            </div>

            {/* Load sequence info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: RED, marginBottom: 10 }}>Before — Baseline Load Sequence</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { step: 1, label: 'Small boxes (SKU-C7)', size: 'SMALL', weight: '96 kg', note: 'loaded first — crushed by heavier items later' },
                    { step: 2, label: 'Large boxes (SKU-A1)', size: 'LARGE', weight: '420 kg', note: 'heavy items stacked on top of small — damage risk' },
                    { step: 3, label: 'Medium boxes (SKU-B3)', size: 'MED',   weight: '280 kg', note: 'gaps left in trailer — 28% wasted space' },
                  ].map(({ step, label, size, weight, note }) => (
                    <div key={step} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: '#fff', borderRadius: 7, border: '1px solid #fecaca' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: RED, minWidth: 16 }}>{step}.</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{label}</div>
                        <div style={{ fontSize: 10, color: RED }}>{note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', marginBottom: 10 }}>After — AI Optimised Load Sequence</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { step: 1, label: 'Large boxes (SKU-A1)',  size: 'LARGE', weight: '420 kg', note: 'floor-first — maximum stability base layer' },
                    { step: 2, label: 'Medium boxes (SKU-B3)', size: 'MED',   weight: '280 kg', note: 'stacked on large — fills mid-height space evenly' },
                    { step: 3, label: 'Small boxes (SKU-C7)',  size: 'SMALL', weight: '96 kg',  note: 'top layer + gap fill — 100% trailer utilisation (AI optimised)' },
                  ].map(({ step, label, note }) => (
                    <div key={step} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: '#fff', borderRadius: 7, border: '1px solid #a5f3fc' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', minWidth: 16 }}>{step}.</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{label}</div>
                        <div style={{ fontSize: 10, color: '#0891b2' }}>{note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Autonomous Dock — root router ─────────────────────────────────────────────
function AutonomousDockView({ adSubView, setAdSubView }: { adSubView: ADSubView; setAdSubView: (v: ADSubView) => void }) {
  return (
    <>
      {adSubView === 'live-ops'     && <ADLiveOpsView     setAdSubView={setAdSubView} />}
      {adSubView === 'ai-decisions' && <ADAIDecisionsView setAdSubView={setAdSubView} />}
      {adSubView === 'simulation'   && <ADSimulationView  setAdSubView={setAdSubView} />}
    </>
  );
}

// ── Network Twin ──────────────────────────────────────────────────────────────

type WHStatus = 'live' | 'building' | 'offline' | 'planned';

interface WarehouseNode {
  id: string;
  name: string;
  location: string;
  status: WHStatus;
  sqft: number;
  docks: number;
  throughput: number;   // cases/hr
  utilisation: number;  // %
  alerts: number;
  costPerCase: number;  // $
  isReal: boolean;
}

const WAREHOUSES: WarehouseNode[] = [
  {
    id: 'wh-1',
    name: 'Warehouse 1',
    location: '',
    status: 'live',
    sqft: 320000,
    docks: 24,
    throughput: 1847,
    utilisation: 78,
    alerts: 3,
    costPerCase: 1.24,
    isReal: true,
  },
  {
    id: 'wh-2',
    name: 'Warehouse 2',
    location: '',
    status: 'building',
    sqft: 480000,
    docks: 36,
    throughput: 0,
    utilisation: 0,
    alerts: 0,
    costPerCase: 0,
    isReal: false,
  },
  {
    id: 'wh-3',
    name: 'Warehouse 3',
    location: '',
    status: 'offline',
    sqft: 210000,
    docks: 16,
    throughput: 0,
    utilisation: 0,
    alerts: 1,
    costPerCase: 0,
    isReal: false,
  },
  {
    id: 'wh-4',
    name: 'Warehouse 4',
    location: '',
    status: 'planned',
    sqft: 390000,
    docks: 28,
    throughput: 0,
    utilisation: 0,
    alerts: 0,
    costPerCase: 0,
    isReal: false,
  },
];

const STATUS_CFG: Record<WHStatus, { label: string; color: string; bg: string; dot: string }> = {
  live:     { label: 'LIVE',     color: '#15803d', bg: '#f0fdf4', dot: '#16a34a' },
  building: { label: 'BUILDING', color: '#92400e', bg: '#fffbeb', dot: '#f59e0b' },
  offline:  { label: 'OFFLINE',  color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  planned:  { label: 'PLANNED',  color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
};

function NetworkKPIBar() {
  const kpis = [
    { label: 'Total Network Throughput', value: '1,847', unit: 'cases/hr', trend: '+6.2%', up: true },
    { label: 'Active Warehouses',        value: '1',     unit: 'of 4',    trend: '',       up: true },
    { label: 'Network Utilisation',      value: '78%',   unit: 'avg',     trend: '-3pp',   up: false },
    { label: 'Avg Cost per Case',        value: '$1.24', unit: '/case',   trend: '-$0.08', up: true },
    { label: 'Open Alerts',             value: '4',     unit: 'total',   trend: '',       up: false },
    { label: 'Fleet Active',            value: '18',    unit: 'trucks',  trend: '',       up: true },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0,
      background: CARD, borderBottom: `1px solid ${BORDER}`,
    }}>
      {kpis.map(({ label, value, unit, trend, up }, i) => (
        <div key={i} style={{
          padding: '14px 20px',
          borderRight: i < 5 ? `1px solid ${BORDER}` : 'none',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: T1, letterSpacing: '-0.02em' }}>{value}</span>
            <span style={{ fontSize: 11, color: T3, fontWeight: 500 }}>{unit}</span>
          </div>
          {trend && (
            <div style={{ fontSize: 10, fontWeight: 700, color: up ? GREEN : RED, marginTop: 2 }}>
              {up ? '▲' : '▼'} {trend}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WarehouseCard({ wh, onLaunch }: { wh: WarehouseNode; onLaunch: () => void }) {
  const st = STATUS_CFG[wh.status];
  const isLive = wh.status === 'live';

  return (
    <div style={{
      background: CARD,
      border: isLive ? '1.5px solid #1d4ed8' : `1px solid ${BORDER}`,
      borderRadius: 14, padding: '22px 24px',
      display: 'flex', flexDirection: 'column', gap: 16,
      position: 'relative', overflow: 'hidden',
      boxShadow: isLive ? '0 2px 12px rgba(29,78,216,0.10)' : CARDSH,
    }}>
      {/* Top accent for live */}
      {isLive && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#1d4ed8', borderRadius: '14px 14px 0 0' }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: isLive ? 6 : 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              color: st.color, background: st.bg, borderRadius: 5, padding: '2px 8px',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
              {st.label}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1, lineHeight: 1.2 }}>{wh.name}</div>
        </div>

        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: isLive ? '#eff6ff' : PAGE,
          border: `1px solid ${isLive ? '#bfdbfe' : BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Layers size={17} color={isLive ? '#1d4ed8' : T3} />
        </div>
      </div>

      {/* Specs */}
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { label: 'Size',  value: `${(wh.sqft / 1000).toFixed(0)}K sq ft` },
          { label: 'Docks', value: `${wh.docks}` },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T2, marginTop: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* KPIs */}
      {isLive ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Throughput',  value: `${wh.throughput.toLocaleString()}`, unit: 'cases/hr', isRed: false },
            { label: 'Utilisation', value: `${wh.utilisation}%`,                unit: 'avg',      isRed: false },
            { label: 'Cost/Case',   value: `$${wh.costPerCase.toFixed(2)}`,      unit: '',         isRed: false },
            { label: 'Alerts',      value: `${wh.alerts}`,                       unit: 'open',     isRed: wh.alerts > 0 },
          ].map(({ label, value, unit, isRed }) => (
            <div key={label} style={{
              background: PAGE, borderRadius: 8, padding: '9px 11px',
              border: `1px solid ${BORDER}`,
            }}>
              <div style={{ fontSize: 9, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: isRed ? RED : T1, letterSpacing: '-0.02em' }}>{value}</span>
                {unit && <span style={{ fontSize: 10, color: T3 }}>{unit}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: PAGE, borderRadius: 8, padding: '16px',
          textAlign: 'center', border: `1px dashed ${BORDER}`,
        }}>
          <div style={{ fontSize: 11, color: T3, fontWeight: 500 }}>
            {wh.status === 'building' && 'Digital twin under construction — estimated Q3 2026'}
            {wh.status === 'offline'  && 'Warehouse offline — data paused'}
            {wh.status === 'planned'  && 'Site acquisition in progress — twin not yet started'}
          </div>
        </div>
      )}

      {/* Action */}
      <div style={{ marginTop: 2 }}>
        {isLive ? (
          <button onClick={onLaunch} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 700,
            boxShadow: '0 1px 4px rgba(29,78,216,0.35)',
          }}>
            <Play size={11} fill="#fff" />
            Launch Warehouse
          </button>
        ) : (
          <button disabled style={{
            width: '100%', padding: '9px 0', borderRadius: 8,
            border: `1px solid ${BORDER}`, cursor: 'not-allowed',
            background: PAGE, color: T3, fontSize: 12, fontWeight: 600,
          }}>
            {wh.status === 'building' ? 'Building…' : 'Unavailable'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Scenario simulation data ──────────────────────────────────────────────────
interface ScenarioKPI {
  label: string;
  before: string;
  after: string;
  delta: string;
  positive: boolean; // true = green (improvement), false = red (degradation)
}

interface NetworkScenario {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  description: string;
  icon: typeof Activity;
  kpis: ScenarioKPI[];
  recommendation: string;
  severity: 'critical' | 'opportunity' | 'warning';
}

const NETWORK_SCENARIOS: NetworkScenario[] = [
  {
    id: 'austin-outage',
    title: 'Warehouse 1 — Site Outage',
    tag: 'CRITICAL RISK',
    tagColor: '#dc2626',
    description: 'Simulate Warehouse 1 going fully offline — equipment failure or weather event. No alternative live sites available.',
    icon: AlertTriangle,
    severity: 'critical',
    recommendation: 'Activate Warehouse 3 on emergency basis + engage 3PL overflow. Estimated recovery: 4.2 days at current backlog rate.',
    kpis: [
      { label: 'Network Throughput',  before: '1,847 cases/hr', after: '0 cases/hr',    delta: '−100%',   positive: false },
      { label: 'Orders at Risk',      before: '0',              after: '312 orders',     delta: '+312',    positive: false },
      { label: 'Daily Cost Impact',   before: '$0',             after: '+$48K/day',      delta: '+$48K',   positive: false },
      { label: 'Est. Backlog Clear',  before: 'n/a',            after: '4.2 days',       delta: '4.2d',    positive: false },
      { label: 'Fill Rate',           before: '91%',            after: '0%',             delta: '−91pp',   positive: false },
      { label: 'Fleet Rerouted',      before: '18 trucks',      after: '0 active',       delta: '−18',     positive: false },
    ],
  },
  {
    id: 'chicago-golive',
    title: 'Warehouse 2 — Early Go-Live',
    tag: 'OPPORTUNITY',
    tagColor: '#16a34a',
    description: 'Bring Warehouse 2 online at 60% capacity, redistributing 40% of Warehouse 1 volume to reduce congestion.',
    icon: Zap,
    severity: 'opportunity',
    recommendation: 'Proceed with early go-live. Break-even on setup cost at day 12. Network cost/case improves by $0.06 sustainably.',
    kpis: [
      { label: 'Network Throughput',  before: '1,847 cases/hr', after: '2,890 cases/hr', delta: '+57%',    positive: true  },
      { label: 'Cost per Case',       before: '$1.24',           after: '$1.18',          delta: '−$0.06',  positive: true  },
      { label: 'WH-1 Utilisation',     before: '78%',             after: '48%',            delta: '−30pp',   positive: true  },
      { label: 'Order Fill Rate',     before: '91%',             after: '96%',            delta: '+5pp',    positive: true  },
      { label: 'Dock Utilisation',    before: '83%',             after: '71%',            delta: '−12pp',   positive: true  },
      { label: 'Daily Go-Live Cost',  before: '$0',              after: '+$14K/day',      delta: '+$14K',   positive: false },
    ],
  },
  {
    id: 'demand-surge',
    title: 'Network-Wide Demand Surge +40%',
    tag: 'WARNING',
    tagColor: '#d97706',
    description: 'Simulate a 40% demand spike across all nodes — peak season or promotional event. Warehouse 1 is the sole active site.',
    icon: TrendingUp,
    severity: 'warning',
    recommendation: 'Add 3rd shift at Warehouse 1 (+620 cases/hr) + activate Warehouse 2. Without action, 739 cases/hr backlog accumulates daily.',
    kpis: [
      { label: 'Required Throughput', before: '1,847 cases/hr', after: '2,586 cases/hr', delta: '+40%',    positive: false },
      { label: 'Capacity Gap',        before: 'none',            after: '−739 cases/hr',  delta: '−739',    positive: false },
      { label: 'Overtime Cost',       before: '$0/day',          after: '+$22K/day',      delta: '+$22K',   positive: false },
      { label: 'Congestion Score',    before: '67 / 100',        after: '94 / 100',       delta: '+27',     positive: false },
      { label: 'Late Shipments',      before: '0',               after: '~48/day',        delta: '+48',     positive: false },
      { label: 'w/ WH-2 Surge',       before: 'n/a',             after: 'Gap closed',     delta: '+56%↑',   positive: true  },
    ],
  },
];

function ScenarioPanel({ scenario, onClose }: { scenario: NetworkScenario; onClose: () => void }) {
  const Icon = scenario.icon;
  const severityGlow =
    scenario.severity === 'critical'    ? 'rgba(220,38,38,0.15)' :
    scenario.severity === 'opportunity' ? 'rgba(22,163,74,0.12)' :
                                          'rgba(217,119,6,0.12)';

  return (
    <div style={{
      background: CARD, border: `1.5px solid ${scenario.tagColor}55`,
      borderRadius: 14, padding: '22px 26px', marginTop: 12,
      boxShadow: `0 2px 12px ${scenario.tagColor}18`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `${scenario.tagColor}12`, border: `1px solid ${scenario.tagColor}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={scenario.tagColor} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{scenario.title}</span>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                color: scenario.tagColor, background: `${scenario.tagColor}12`,
                border: `1px solid ${scenario.tagColor}33`, borderRadius: 4, padding: '2px 7px',
              }}>{scenario.tag}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: T2, maxWidth: 580, lineHeight: 1.5 }}>
              {scenario.description}
            </p>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T3, fontSize: 18, padding: '0 4px', lineHeight: 1,
        }}>✕</button>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
        {scenario.kpis.map(kpi => (
          <div key={kpi.label} style={{
            background: PAGE, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 9, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>
              Before: <span style={{ color: T2, fontWeight: 600 }}>{kpi.before}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: kpi.positive ? GREEN : RED, letterSpacing: '-0.01em' }}>
              {kpi.after}
            </div>
            <div style={{
              marginTop: 5, display: 'inline-block', fontSize: 9, fontWeight: 700,
              color: kpi.positive ? GREEN : RED,
              background: kpi.positive ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${kpi.positive ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: 4, padding: '1px 5px',
            }}>
              {kpi.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: '#f5f3ff', border: '1px solid #ddd6fe',
        borderRadius: 10, padding: '12px 16px',
      }}>
        <Brain size={14} color="#7c3aed" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Recommendation · </span>
          <span style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{scenario.recommendation}</span>
        </div>
      </div>
    </div>
  );
}

// ── Build Twin Modal ──────────────────────────────────────────────────────────
interface TwinParams {
  name: string;
  sqft: number;
  recvDocks: number;
  shipDocks: number;
  zoneA: number;
  zoneB: number;
  zoneC: number;
  shifts: 1 | 2 | 3;
  asrs: boolean;
  automation: 'low' | 'medium' | 'high';
}

const DEFAULT_PARAMS: TwinParams = {
  name: 'Warehouse 5',
  sqft: 280000, recvDocks: 12, shipDocks: 10,
  zoneA: 40, zoneB: 35, zoneC: 25,
  shifts: 2, asrs: false, automation: 'medium',
};

function projectKPIs(p: TwinParams) {
  const base = (p.sqft / 320000) * 1847;
  const autoMult = p.automation === 'high' ? 1.38 : p.automation === 'medium' ? 1.12 : 0.88;
  const shiftMult = p.shifts === 3 ? 1.45 : p.shifts === 2 ? 1.0 : 0.62;
  const asrsMult  = p.asrs ? 1.18 : 1.0;
  const throughput = Math.round(base * autoMult * shiftMult * asrsMult);

  const baseCost = 1.48;
  const autoCostSave = p.automation === 'high' ? 0.28 : p.automation === 'medium' ? 0.14 : 0;
  const asrsSave = p.asrs ? 0.09 : 0;
  const costPerCase = +(baseCost - autoCostSave - asrsSave).toFixed(2);

  const goLiveWeeks = Math.round(8 + (p.sqft / 320000) * 14 + (p.asrs ? 6 : 0));

  const util = Math.round(60 + (p.automation === 'high' ? 18 : p.automation === 'medium' ? 10 : 4));

  return { throughput, costPerCase, goLiveWeeks, util };
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  unit: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T2 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8' }}>{value.toLocaleString()} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#1d4ed8', cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: T3 }}>{min.toLocaleString()} {unit}</span>
        <span style={{ fontSize: 9, color: T3 }}>{max.toLocaleString()} {unit}</span>
      </div>
    </div>
  );
}

function BuildTwinModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (name: string, location: string) => void;
}) {
  const [step, setStep]     = useState<1 | 2 | 3>(1);
  const [params, setParams] = useState<TwinParams>(DEFAULT_PARAMS);
  const [creating, setCreating] = useState(false);

  const proj = projectKPIs(params);
  const zoneTotal = params.zoneA + params.zoneB + params.zoneC;

  function setP<K extends keyof TwinParams>(k: K, v: TwinParams[K]) {
    setParams(prev => ({ ...prev, [k]: v }));
  }

  function handleCreate() {
    setCreating(true);
    setTimeout(() => {
      onCreated(params.name, '');
    }, 1400);
  }

  const STEP_LABELS = ['Select Template', 'Configure Parameters', 'Network Preview'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 740, maxHeight: '90vh', overflow: 'auto',
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Modal header */}
        <div style={{
          padding: '20px 28px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T1 }}>Build New Warehouse Twin</div>
            <div style={{ fontSize: 11, color: T2, marginTop: 2 }}>
              Configure from Warehouse 1 template · Customize · Preview network impact
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T3, fontSize: 20, lineHeight: 1, padding: '0 4px',
          }}>✕</button>
        </div>

        {/* Step progress */}
        <div style={{ padding: '16px 28px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done   = step > n;
              const active = step === n;
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < 3 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800,
                      background: done ? '#1d4ed8' : active ? '#eff6ff' : PAGE,
                      border: `1.5px solid ${done || active ? '#1d4ed8' : BORDER}`,
                      color: done ? '#fff' : active ? '#1d4ed8' : T3,
                    }}>
                      {done ? '✓' : n}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? T1 : T3, whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  </div>
                  {n < 3 && <div style={{ flex: 1, height: 1, background: done ? '#bfdbfe' : BORDER, margin: '0 12px' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: '24px 28px', flex: 1 }}>

          {/* ── Step 1: Template ── */}
          {step === 1 && (
            <div>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: T2 }}>
                Choose a starting template. Your new twin will inherit the asset configuration, zone layout, and operation parameters from the selected base — you'll customise the specifics in the next step.
              </p>
              <div style={{
                background: '#eff6ff', border: '1.5px solid #1d4ed8',
                borderRadius: 14, padding: '18px 22px', cursor: 'pointer', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: '#dbeafe', border: '1px solid #bfdbfe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Layers size={18} color="#1d4ed8" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>Warehouse 1 Template</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#1d4ed8', background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 7px' }}>RECOMMENDED</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: T2, lineHeight: 1.5 }}>
                      Full-featured distribution center layout · 24 docks · 3 velocity zones (A/B/C) · WMS + WCS integration · Adaptive Twin enabled
                    </p>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                      {[
                        { label: 'Base throughput', value: '1,847 cases/hr' },
                        { label: 'Automation level', value: 'Medium' },
                        { label: 'Zones', value: '3 (A / B / C)' },
                        { label: 'Live assets', value: '24 docks · ASRS-ready' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 9, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T1, marginTop: 2 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#fff' }}>✓</span>
                  </div>
                </div>
              </div>
              <div style={{
                background: PAGE, border: `1px solid ${BORDER}`,
                borderRadius: 14, padding: '16px 22px', opacity: 0.5, cursor: 'not-allowed',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={18} color={T3} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T2, marginBottom: 2 }}>Blank Template</div>
                    <div style={{ fontSize: 11, color: T3 }}>Start from scratch — coming soon</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Parameters ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Identity</div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Warehouse Name</label>
                  <input
                    value={params.name}
                    onChange={e => setP('name', e.target.value)}
                    placeholder="Warehouse 5"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: PAGE, border: `1px solid ${BORDER}`,
                      borderRadius: 8, padding: '8px 12px', color: T1, fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Physical Layout</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Slider label="Square Footage" value={params.sqft} min={80000} max={600000} step={10000} unit="sq ft" onChange={v => setP('sqft', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Slider label="Receiving Docks" value={params.recvDocks} min={4} max={30} unit="docks" onChange={v => setP('recvDocks', v)} />
                    <Slider label="Shipping Docks"  value={params.shipDocks} min={4} max={30} unit="docks" onChange={v => setP('shipDocks', v)} />
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Storage Zone Split</div>
                  <span style={{ fontSize: 10, color: zoneTotal !== 100 ? RED : GREEN, fontWeight: 700 }}>
                    Total: {zoneTotal}% {zoneTotal !== 100 ? '⚠ must = 100%' : '✓'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'Zone A — High-Vel', key: 'zoneA' as const, color: '#f97316' },
                    { label: 'Zone B — Med-Vel',  key: 'zoneB' as const, color: '#22c55e' },
                    { label: 'Zone C — Low-Vel',  key: 'zoneC' as const, color: '#7c3aed' },
                  ].map(({ label, key, color }) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: T2 }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color }}>{params[key]}%</span>
                      </div>
                      <input type="range" min={5} max={80} value={params[key]}
                        onChange={e => setP(key, Number(e.target.value))}
                        style={{ width: '100%', accentColor: color, cursor: 'pointer' }} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Operations</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Shifts per Day</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([1, 2, 3] as const).map(n => (
                        <button key={n} onClick={() => setP('shifts', n)} style={{
                          flex: 1, padding: '7px 0', borderRadius: 7, border: `1px solid ${params.shifts === n ? '#1d4ed8' : BORDER}`, cursor: 'pointer',
                          background: params.shifts === n ? '#1d4ed8' : PAGE,
                          color: params.shifts === n ? '#fff' : T2,
                          fontSize: 12, fontWeight: 700,
                        }}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Automation Level</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['low', 'medium', 'high'] as const).map(lvl => (
                        <button key={lvl} onClick={() => setP('automation', lvl)} style={{
                          flex: 1, padding: '7px 0', borderRadius: 7, border: `1px solid ${params.automation === lvl ? '#1d4ed8' : BORDER}`, cursor: 'pointer',
                          background: params.automation === lvl ? '#1d4ed8' : PAGE,
                          color: params.automation === lvl ? '#fff' : T2,
                          fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                        }}>{lvl}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>ASRS System</div>
                    <button onClick={() => setP('asrs', !params.asrs)} style={{
                      width: '100%', padding: '7px 0', borderRadius: 7,
                      border: `1px solid ${params.asrs ? '#bbf7d0' : BORDER}`, cursor: 'pointer',
                      background: params.asrs ? '#f0fdf4' : PAGE,
                      color: params.asrs ? GREEN : T2,
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {params.asrs ? '✓ Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#dbeafe', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Layers size={20} color="#1d4ed8" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>{params.name || 'New Warehouse'}</div>
                  <div style={{ fontSize: 12, color: T2 }}>{(params.sqft / 1000).toFixed(0)}K sq ft · {params.recvDocks + params.shipDocks} total docks</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Go-Live</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1d4ed8' }}>{proj.goLiveWeeks} weeks</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Projected KPIs at Full Operation</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Throughput',    value: `${proj.throughput.toLocaleString()}`,  unit: 'cases/hr', compare: '+' + Math.round((proj.throughput / 1847 - 1) * 100) + '% vs WH-1' },
                    { label: 'Cost / Case',   value: `$${proj.costPerCase}`,                  unit: '/case',    compare: proj.costPerCase < 1.24 ? `−$${(1.24 - proj.costPerCase).toFixed(2)} vs WH-1` : `+$${(proj.costPerCase - 1.24).toFixed(2)} vs WH-1` },
                    { label: 'Utilisation',   value: `${proj.util}%`,                          unit: 'est.',     compare: `at ${params.shifts}-shift steady state` },
                    { label: 'Network Total', value: `${(1847 + proj.throughput).toLocaleString()}`, unit: 'cases/hr', compare: 'WH-1 + new site combined' },
                  ].map(({ label, value, unit, compare }) => (
                    <div key={label} style={{
                      background: PAGE, border: `1px solid ${BORDER}`,
                      borderRadius: 10, padding: '14px 16px',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: T1, letterSpacing: '-0.02em' }}>{value}</span>
                        <span style={{ fontSize: 10, color: T3 }}>{unit}</span>
                      </div>
                      <div style={{ fontSize: 9, color: T3, fontWeight: 500 }}>{compare}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Configuration Summary</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    `${params.recvDocks} receiving docks`,
                    `${params.shipDocks} shipping docks`,
                    `Zone A ${params.zoneA}% · B ${params.zoneB}% · C ${params.zoneC}%`,
                    `${params.shifts}-shift operation`,
                    `${params.automation.charAt(0).toUpperCase() + params.automation.slice(1)} automation`,
                    params.asrs ? 'ASRS enabled' : 'No ASRS',
                    'Warehouse 1 template base',
                    'Adaptive Twin included',
                  ].map(chip => (
                    <span key={chip} style={{
                      fontSize: 10, fontWeight: 600, color: '#1d4ed8',
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: 5, padding: '3px 10px',
                    }}>{chip}</span>
                  ))}
                </div>
              </div>

              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <TrendingUp size={14} color={GREEN} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>
                  Adding this site brings network capacity to <strong style={{ color: GREEN }}>{(1847 + proj.throughput).toLocaleString()} cases/hr</strong> and reduces avg cost/case from <strong style={{ color: GREEN }}>$1.24 → ${((1.24 + proj.costPerCase) / 2).toFixed(2)}</strong> across the network.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div style={{
          padding: '16px 28px', borderTop: `1px solid ${BORDER}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <button onClick={step === 1 ? onClose : () => setStep((step - 1) as 1 | 2 | 3)} style={{
            padding: '9px 20px', borderRadius: 8, border: `1px solid ${BORDER}`,
            background: PAGE, color: T2,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step < 3 ? (
            <button
              disabled={step === 2 && zoneTotal !== 100}
              onClick={() => setStep((step + 1) as 2 | 3)}
              style={{
                padding: '9px 24px', borderRadius: 8, border: 'none',
                cursor: zoneTotal !== 100 && step === 2 ? 'not-allowed' : 'pointer',
                background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 700,
                opacity: step === 2 && zoneTotal !== 100 ? 0.45 : 1,
                boxShadow: '0 1px 4px rgba(29,78,216,0.35)',
              }}>
              {step === 1 ? 'Configure Parameters →' : 'Preview Network Impact →'}
            </button>
          ) : (
            <button onClick={handleCreate} disabled={creating} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 24px', borderRadius: 8, border: 'none',
              cursor: creating ? 'default' : 'pointer',
              background: creating ? '#f0fdf4' : '#15803d',
              color: creating ? GREEN : '#fff', fontSize: 12, fontWeight: 700,
              boxShadow: '0 1px 4px rgba(22,163,74,0.35)',
            }}>
              {creating ? (
                <><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `2px solid ${GREEN}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} /> Creating twin…</>
              ) : (
                <><Zap size={12} /> Create Warehouse Twin</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkTwinPage({ onLaunchWarehouse }: { onLaunchWarehouse: () => void }) {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [newSite, setNewSite] = useState<{ name: string; location: string } | null>(null);

  function handleCreated(name: string, location: string) {
    setShowBuildModal(false);
    setNewSite({ name, location });
  }

  function runScenario(id: string) {
    setActiveScenario(null);
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setActiveScenario(id);
    }, 1200);
  }

  const scenarioResult = NETWORK_SCENARIOS.find(s => s.id === activeScenario) ?? null;

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'auto',
      background: PAGE, display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 56, flexShrink: 0,
        borderBottom: `1px solid ${BORDER}`, background: CARD,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: T1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={14} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: T1, letterSpacing: '-0.02em' }}>WareVision</span>
          <span style={{ fontSize: 10, color: T3, marginLeft: 4, borderLeft: `1px solid ${BORDER}`, paddingLeft: 10 }}>
            Network Twin · Command Center
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: GREEN, fontWeight: 600,
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
            1 site live
          </div>
          <button onClick={() => setShowBuildModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 8, border: 'none',
            background: '#1d4ed8', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(29,78,216,0.3)',
          }}>
            <Zap size={12} />
            Build New Warehouse Twin
          </button>
        </div>
      </div>

      {/* Network KPI bar */}
      <NetworkKPIBar />

      {/* Main content */}
      <div style={{ flex: 1, padding: '28px 28px', overflow: 'auto' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T1, letterSpacing: '-0.02em' }}>
              Warehouse Network
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: T2 }}>
              4 sites · 1 live · Launch a warehouse to access full simulation
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['live', 'building', 'offline', 'planned'] as WHStatus[]).map(s => {
              const cfg = STATUS_CFG[s];
              const count = WAREHOUSES.filter(w => w.status === s).length;
              return (
                <div key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                  borderRadius: 6, background: CARD,
                  border: `1px solid ${BORDER}`, fontSize: 10, fontWeight: 700, color: T2,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                  {count} {cfg.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Warehouse grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {WAREHOUSES.map(wh => (
            <WarehouseCard key={wh.id} wh={wh} onLaunch={onLaunchWarehouse} />
          ))}
        </div>

        {/* Fleet + network summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Fleet summary */}
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: '20px 24px', boxShadow: CARDSH,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Truck size={14} color="#1d4ed8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>Fleet Operations</span>
              <span style={{ fontSize: 10, color: T3, marginLeft: 4 }}>across all sites</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Active Trucks', value: '18' },
                { label: 'In Transit',    value: '11' },
                { label: 'At Dock',       value: '7'  },
                { label: 'Avg ETA',       value: '23m' },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}>{value}</div>
                  <div style={{ fontSize: 9, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Network health */}
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: '20px 24px', boxShadow: CARDSH,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Activity size={14} color="#1d4ed8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>Network Health</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Warehouse 1 throughput', pct: 78, color: '#1d4ed8' },
                { label: 'Dock utilisation',       pct: 83, color: '#0891b2' },
                { label: 'Order fill rate',        pct: 91, color: GREEN },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T2, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
                  </div>
                  <div style={{ height: 5, background: BORDER, borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Scenario Simulation ─────────────────────────────────────────── */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T1, letterSpacing: '-0.02em' }}>
                Scenario Simulation
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: T2 }}>
                Model what-if events across your warehouse network and see projected KPI impact
              </p>
            </div>
            {running && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                  border: '2px solid #7c3aed', borderTopColor: 'transparent',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Running simulation…
              </div>
            )}
          </div>

          {/* Scenario cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {NETWORK_SCENARIOS.map(sc => {
              const Icon = sc.icon;
              const isActive = activeScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => isActive ? setActiveScenario(null) : runScenario(sc.id)}
                  style={{
                    background: isActive ? `${sc.tagColor}0c` : CARD,
                    border: `1.5px solid ${isActive ? sc.tagColor + '66' : BORDER}`,
                    borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                    boxShadow: isActive ? `0 4px 16px ${sc.tagColor}18` : CARDSH,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${sc.tagColor}12`, border: `1px solid ${sc.tagColor}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={14} color={sc.tagColor} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T1, lineHeight: 1.2 }}>{sc.title}</div>
                      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', color: sc.tagColor }}>{sc.tag}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: T2, lineHeight: 1.5 }}>
                    {sc.description}
                  </p>
                  <div style={{
                    marginTop: 12, display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, fontWeight: 700,
                    color: isActive ? sc.tagColor : T3,
                  }}>
                    {isActive ? (
                      <><CheckCircle size={12} color={sc.tagColor} /> Results shown below — click to close</>
                    ) : (
                      <><Play size={10} fill="currentColor" /> Run Scenario</>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Results panel */}
          {scenarioResult && (
            <ScenarioPanel scenario={scenarioResult} onClose={() => setActiveScenario(null)} />
          )}
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* New site success banner */}
      {newSite && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, background: CARD,
          border: `1.5px solid #bbf7d0`, borderRadius: 12,
          padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          minWidth: 420,
        }}>
          <CheckCircle size={18} color={GREEN} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>Twin Created — {newSite.name}</div>
            <div style={{ fontSize: 11, color: T2, marginTop: 1 }}>Building phase started · Est. go-live tracked in network</div>
          </div>
          <button onClick={() => setNewSite(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T3, fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Build twin modal */}
      {showBuildModal && (
        <BuildTwinModal
          onClose={() => setShowBuildModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
// ── Landing page ──────────────────────────────────────────────────────────────
function HomePage({ onEnter }: { onEnter: () => void }) {
  return (
    <div style={{
      height: '100vh', width: '100vw',
      background: 'linear-gradient(135deg, #1e0a3c 0%, #3b1278 35%, #6d28d9 65%, #4c1d95 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* Glow blobs */}
      <div style={{
        position: 'absolute', top: '18%', left: '20%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 70%)',
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '18%',
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(167,139,250,0.22) 0%, transparent 70%)',
        filter: 'blur(24px)', pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
        {/* Logo mark */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 64, height: 64, borderRadius: 16, marginBottom: 28,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(8px)',
        }}>
          <Layers size={30} color="#e9d5ff" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 style={{
          margin: 0, fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em',
          color: '#ffffff', lineHeight: 1,
          textShadow: '0 2px 40px rgba(167,139,250,0.5)',
        }}>
          WareVision
        </h1>

        {/* Subtitle */}
        <p style={{
          margin: '14px 0 0', fontSize: 16, fontWeight: 500, letterSpacing: '0.16em',
          color: 'rgba(233,213,255,0.75)', textTransform: 'uppercase',
        }}>
          TCS Operations Intelligence
        </p>

        {/* Divider */}
        <div style={{
          margin: '36px auto', width: 48, height: 2, borderRadius: 2,
          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.7), transparent)',
        }} />

        {/* CTA button */}
        <button
          onClick={onEnter}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 32px', borderRadius: 12, border: 'none',
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            color: '#ffffff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.01em',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.2), 0 8px 32px rgba(109,40,217,0.4)',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px rgba(255,255,255,0.35), 0 12px 40px rgba(109,40,217,0.55)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px rgba(255,255,255,0.2), 0 8px 32px rgba(109,40,217,0.4)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          }}
        >
          <ChevronRight size={16} />
          Enter Your Warehouse
        </button>

        {/* Footer note */}
        <p style={{
          marginTop: 28, fontSize: 11, color: 'rgba(196,181,253,0.45)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Powered by AI · Real-time simulation
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [appView, setAppView]           = useState<AppView>('home');
  const [mainTab, setMainTab]           = useState<MainTab>('warehouse-ops');
  const [subView, setSubView]           = useState<SubView>('overview');
  const [atSubView, setAtSubView]       = useState<ATSubView>('live');
  const [adSubView, setAdSubView]       = useState<ADSubView>('live-ops');
  const { improvementScenario }         = useSimulationStore();

  const effectiveSubView: SubView = (subView === 'kpi-impact' && !improvementScenario) ? 'overview' : subView;

  if (appView === 'home') {
    return <HomePage onEnter={() => setAppView('network')} />;
  }

  if (appView === 'network') {
    return <NetworkTwinPage onLaunchWarehouse={() => setAppView('warehouse')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: PAGE }}>
      <TopNav
        mainTab={mainTab} setMainTab={setMainTab}
        subView={effectiveSubView} setSubView={setSubView}
        atSubView={atSubView} setAtSubView={setAtSubView}
        adSubView={adSubView} setAdSubView={setAdSubView}
        onBackToNetwork={() => setAppView('network')}
      />

      {mainTab === 'warehouse-ops' && (
        <>
          {effectiveSubView === 'overview'    && <Overview    setSubView={setSubView} />}
          {effectiveSubView === 'simulation'  && <SimulationView setSubView={setSubView} />}
          {effectiveSubView === 'analytics'   && <AnalyticsView />}
          {effectiveSubView === 'ai'          && <AIView setSubView={setSubView} />}
          {effectiveSubView === 'kpi-impact'  && <KPIImpactView />}
        </>
      )}
      {mainTab === 'adaptive-twin' && (
        <AdaptiveTwinView atSubView={atSubView} setAtSubView={setAtSubView} />
      )}
      {mainTab === 'autonomous-dock' && (
        <AutonomousDockView adSubView={adSubView} setAdSubView={setAdSubView} />
      )}
    </div>
  );
}
