import { useState, useEffect, useRef } from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ComposableMap, Geographies, Geography, Marker, Annotation } from 'react-simple-maps';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import statesGeo from 'us-atlas/states-10m.json';
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
import { DockOptimizerSim } from './components/AutonomousDock/DockOptimizerSim';
import { TruckInterior3D, WORKER_TOTAL } from './components/AutonomousDock/TruckInterior3D';
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
type ATSubView  = 'live' | 'anomalies' | 'ai-scenarios' | 'control';
type ADSubView  = 'live-ops' | 'ai-decisions' | 'simulation' | 'kpi-impact' | 'load-kpi';

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
  adSubView, setAdSubView, dockPhase, loadMode, onBackToNetwork,
}: {
  mainTab: MainTab; setMainTab: (t: MainTab) => void;
  subView: SubView; setSubView: (v: SubView) => void;
  atSubView: ATSubView; setAtSubView: (v: ATSubView) => void;
  adSubView: ADSubView; setAdSubView: (v: ADSubView) => void;
  dockPhase: 'baseline' | 'optimised';
  loadMode: 'baseline' | 'optimised';
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
          </div>
        );
      })()}

      {/* Secondary bar — autonomous dock sub-tabs */}
      {mainTab === 'autonomous-dock' && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {([
              { id: 'live-ops'     as ADSubView, label: 'Live Operations',   Icon: Radio   },
              { id: 'ai-decisions' as ADSubView, label: 'AI Decisions',      Icon: Brain   },
              { id: 'simulation'   as ADSubView, label: 'Visual Simulation', Icon: Play    },
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
            {dockPhase === 'optimised' && (
              <button onClick={() => setAdSubView('kpi-impact')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                  background: adSubView === 'kpi-impact' ? PAGE : 'transparent',
                  color: adSubView === 'kpi-impact' ? '#15803d' : '#16a34a',
                  borderBottom: adSubView === 'kpi-impact' ? `2px solid #16a34a` : '2px solid transparent',
                }}>
                <Zap size={12} />
                KPI Impact
              </button>
            )}
            {loadMode === 'optimised' && (
              <button onClick={() => setAdSubView('load-kpi')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                  background: adSubView === 'load-kpi' ? PAGE : 'transparent',
                  color: adSubView === 'load-kpi' ? '#15803d' : '#16a34a',
                  borderBottom: adSubView === 'load-kpi' ? `2px solid #16a34a` : '2px solid transparent',
                }}>
                <TrendingUp size={12} />
                Load KPI Impact
              </button>
            )}
          </div>
        </div>
      )}

      {/* Secondary bar — sub-tabs (only for warehouse-ops, hidden during simulation) */}
      {mainTab === 'warehouse-ops' && subView !== 'simulation' && (
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
              background: '#1d4ed8',
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
        <span style={{ fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 99, padding: '4px 10px' }}>
          ● Behind Target
        </span>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px', borderBottom: `1px solid ${BORDER}`, background: CARD, flexShrink: 0 }}>
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

          {/* Operator legend */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(255,255,255,0.92)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px', pointerEvents: 'none', boxShadow: CARDSH, display: 'flex', gap: 12 }}>
            {[
              { color: '#f5c518', label: 'FL-1 Rivera' },
              { color: '#e8a000', label: 'FL-2 Chen' },
              { color: '#d49000', label: 'FL-3 Kim' },
              { color: '#cc2200', label: 'PJ-1 Williams' },
              { color: '#aa1a00', label: 'PJ-2 Patel' },
            ].map(e => (
              <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: T1, fontWeight: 600 }}>{e.label}</span>
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
  const { atScenario, setAtScenario, setCurrentTime, setPlaybackSpeed, setPlaying } = useSimulationStore();

  const handleRunSim = (scenarioId: string) => {
    setAtScenario(scenarioId);
    setCurrentTime(0);
    setPlaybackSpeed(60);
    setPlaying(true);
    setAtSubView('live');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>AI Improvement Scenarios</h1>
        <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Simulated interventions — select a scenario to see the projected impact in 3D</p>
      </div>

      {/* Active scenario indicator — mirrors Warehouse Ops improved-simulation banner */}
      {atScenario && (() => {
        const activeS = AT_SCENARIOS.find(s => s.id === atScenario);
        const activeAnomaly = activeS ? AT_ANOMALIES.find(a => a.id === activeS.anomalyId) : null;
        return activeS ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={16} color={GREEN} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>AI Fix Active — Improved Scenario Running</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T1 }}>{activeS.title}</div>
              {activeAnomaly && (
                <div style={{ fontSize: 12, color: T2, marginTop: 2 }}>Fixing: {activeAnomaly.title}</div>
              )}
            </div>
            <button onClick={() => { setAtScenario(null); setPlaying(false); setCurrentTime(0); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: T2, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 11px', cursor: 'pointer', flexShrink: 0 }}>
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
        ) : null;
      })()}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {AT_SCENARIOS.map(s => {
          const catColor = AT_CATEGORY_COLORS[s.category];
          const anomaly  = AT_ANOMALIES.find(a => a.id === s.anomalyId);
          const isActive = atScenario === s.id;
          return (
            <div key={s.id} style={{ background: CARD, border: isActive ? '2px solid #16a34a' : `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 24px', boxShadow: isActive ? '0 0 0 3px #bbf7d033' : CARDSH, position: 'relative', overflow: 'hidden' }}>
              {/* Active top bar — same pattern as Warehouse Ops simulation toolbar */}
              {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#16a34a' }} />}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: `${catColor}18`, border: `1px solid ${catColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FlaskConical size={16} color={catColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 7px', background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}44` }}>
                      {s.category}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 7px', background: '#f0fdf4', color: GREEN, border: '1px solid #bbf7d0' }}>
                        ● ACTIVE
                      </span>
                    )}
                    {anomaly && !isActive && (
                      <span style={{ fontSize: 10, color: T3 }}>Fixes: {anomaly.severity === 'critical' ? '🔴' : '🟡'} {anomaly.title.slice(0, 36)}…</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T1, marginBottom: 6, letterSpacing: '-0.01em' }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{s.description}</div>
                </div>
              </div>

              {/* What this fixes — anomaly problem description */}
              {anomaly && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Problem Being Fixed</div>
                  <div style={{ fontSize: 12, color: '#7f1d1d', fontWeight: 600 }}>{anomaly.title}</div>
                  <div style={{ fontSize: 11, color: T2, marginTop: 3 }}>{anomaly.metric} (target: {anomaly.baseline}) · Impact: {anomaly.impact}</div>
                </div>
              )}

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
                {isActive ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setAtSubView('live')}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#f0fdf4', color: GREEN, border: '1px solid #86efac' }}>
                      View Live 3D
                    </button>
                    <button onClick={() => { setAtScenario(null); setPlaying(false); setCurrentTime(0); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: PAGE, color: T2, border: `1px solid ${BORDER}` }}>
                      <RotateCcw size={11} /> Reset
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleRunSim(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: catColor, color: '#fff', border: 'none', boxShadow: `0 2px 8px ${catColor}44` }}>
                    <Play size={12} />
                    Run Simulation
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
        <button onClick={() => setAdSubView('ai-decisions')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: CARD, color: T1, border: `1px solid ${BORDER}` }}>
          <Brain size={13} />
          AI Decisions
        </button>
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>AI Dock Decisions</h1>
        <p style={{ fontSize: 13, color: T2, margin: '4px 0 0' }}>Optimal assignments generated from live queue and dock state</p>
      </div>

      {/* Receiving assignments */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 24px', boxShadow: CARDSH, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
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

        {/* Problem / Solution callout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={12} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Problem</span>
            </div>
            <p style={{ fontSize: 12, color: '#7f1d1d', margin: 0, lineHeight: 1.55 }}>
              Trucks are assigned to docks sequentially — no consideration of which storage zone the cargo belongs to. T-103 (Zone A SKUs) is currently staged at R-3, the furthest dock from Zone A, adding 13 m of extra forklift travel per pallet and inflating turn time by ~18 min.
            </p>
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <Zap size={12} color="#1d4ed8" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI Solution</span>
            </div>
            <p style={{ fontSize: 12, color: '#1e3a5f', margin: 0, lineHeight: 1.55 }}>
              AI scores each truck against every idle dock using zone-distance matrix. Each truck gets the dock with the shortest path to its primary SKU storage zone. Result: avg pathing distance drops from 24 m to 18 m — saving 31 forklift trips per shift and recovering ~22 min of turn time across all active bays.
            </p>
          </div>
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

        {/* Problem / Solution callout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={12} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Problem</span>
            </div>
            <p style={{ fontSize: 12, color: '#7f1d1d', margin: 0, lineHeight: 1.55 }}>
              WMS assigns dock doors by wave arrival order regardless of staging congestion. Wave W-04 (38 pallets) is staged at S-2 where congestion is at 8 — the highest in the yard — adding pick-path conflicts and delaying dispatch. Load sequencing is also random: small boxes loaded first get crushed by heavy items, wasting up to 28% of trailer space.
            </p>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <Zap size={12} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI Solution</span>
            </div>
            <p style={{ fontSize: 12, color: '#14532d', margin: 0, lineHeight: 1.55 }}>
              AI re-routes each wave to the dock with the lowest staging congestion score, cutting conflicts and enabling parallel unload. Load sequencing is reordered large → medium → small: heavy items create a stable base layer, medium fill mid-height, and smalls plug remaining gaps — boosting trailer fill rate from ~72% to 93%+ across all active waves.
            </p>
          </div>
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

// ── Dock Timeline (professional Gantt schedule) ───────────────────────────────
function DockTimeline({ phase }: { phase: 'baseline' | 'optimised' }) {
  const isOpt = phase === 'optimised';

  type Block = { start: number; end: number; truck: string; carrier: string; zone: string; path: string; flag?: 'warn' | 'ok' | 'idle' };
  type Row   = { id: string; type: 'recv' | 'ship'; blocks: Block[] };

  const ROWS_BASE: Row[] = [
    { id: 'R-1', type: 'recv', blocks: [{ start: 0,  end: 48, truck: 'T-101', carrier: 'XPO Logistics',  zone: 'Zone B', path: '22 m' }] },
    { id: 'R-2', type: 'recv', blocks: [{ start: 0,  end: 35, truck: 'T-102', carrier: 'FedEx Freight',  zone: 'Zone B', path: '20 m' }, { start: 40, end: 97, truck: 'T-104', carrier: 'Estes Express', zone: 'Zone B', path: '20 m' }] },
    { id: 'R-3', type: 'recv', blocks: [{ start: 12, end: 62, truck: 'T-103', carrier: 'Old Dominion',   zone: 'Zone A', path: '31 m', flag: 'warn' }] },
    { id: 'S-1', type: 'ship', blocks: [{ start: 0,  end: 35, truck: 'W-06',  carrier: 'Wave 06',        zone: 'Ship',   path: '92%' }] },
    { id: 'S-2', type: 'ship', blocks: [{ start: 0,  end: 91, truck: 'W-07',  carrier: 'Wave 07',        zone: 'Ship',   path: '71%', flag: 'warn' }] },
    { id: 'S-3', type: 'ship', blocks: [] },
  ];
  const ROWS_OPT: Row[] = [
    { id: 'R-1', type: 'recv', blocks: [{ start: 0,  end: 48, truck: 'T-101', carrier: 'XPO Logistics',  zone: 'Zone A', path: '18 m', flag: 'ok' }, { start: 52, end: 95, truck: 'T-103', carrier: 'Old Dominion', zone: 'Zone A', path: '18 m', flag: 'ok' }] },
    { id: 'R-2', type: 'recv', blocks: [{ start: 0,  end: 35, truck: 'T-102', carrier: 'FedEx Freight',  zone: 'Zone B', path: '20 m', flag: 'ok' }, { start: 35, end: 75, truck: 'T-104', carrier: 'Estes Express', zone: 'Zone B', path: '20 m', flag: 'ok' }] },
    { id: 'R-3', type: 'recv', blocks: [{ start: 41, end: 72, truck: 'T-105', carrier: 'Saia LTL',       zone: 'Zone C', path: '19 m', flag: 'ok' }] },
    { id: 'S-1', type: 'ship', blocks: [{ start: 0,  end: 35, truck: 'W-06',  carrier: 'Wave 06',        zone: 'Ship',   path: '98%', flag: 'ok' }] },
    { id: 'S-2', type: 'ship', blocks: [{ start: 0,  end: 55, truck: 'W-07',  carrier: 'Wave 07',        zone: 'Ship',   path: '100%', flag: 'ok' }] },
    { id: 'S-3', type: 'ship', blocks: [{ start: 20, end: 68, truck: 'W-08',  carrier: 'Wave 08',        zone: 'Ship',   path: '94%', flag: 'ok' }] },
  ];

  type Event = { at: number; label: string; type: 'warn' | 'decision' | 'ok' };
  const EVENTS_BASE: Event[] = [
    { at: 12,  label: 'T-103 assigned R-3 — zone mismatch',         type: 'warn'     },
    { at: 35,  label: 'T-102 unload complete',                       type: 'ok'       },
    { at: 40,  label: 'T-104 queued 5 min — all bays occupied',      type: 'warn'     },
    { at: 62,  label: 'T-103 departs — 50 min turn (target 41)',     type: 'warn'     },
    { at: 91,  label: 'S-2 loading extended — staging congested',    type: 'warn'     },
  ];
  const EVENTS_OPT: Event[] = [
    { at: 12,  label: 'T-103 routed R-1 — zone match, 18 m path',   type: 'decision' },
    { at: 20,  label: 'S-3 activated — congestion pre-empted',       type: 'decision' },
    { at: 35,  label: 'T-102 done · T-104 enters immediately',       type: 'ok'       },
    { at: 55,  label: 'W-07 dispatched · fill rate 100%',            type: 'ok'       },
    { at: 75,  label: 'All receiving bays cleared on schedule',      type: 'ok'       },
  ];

  const rows   = isOpt ? ROWS_OPT   : ROWS_BASE;
  const events = isOpt ? EVENTS_OPT : EVENTS_BASE;

  const TICKS  = [0, 15, 30, 45, 60, 75, 90, 105, 120];
  const NOW    = 65; // "current time" indicator
  const LW     = 72; // label column width
  const ROW_H  = 36;
  const HEADER = 22;
  const SVG_W  = 820;
  const TW     = SVG_W - LW - 4;
  const toX    = (t: number) => LW + (t / 120) * TW;
  const SVG_H  = rows.length * ROW_H + HEADER + 4;

  const RECV_COL = '#3b82f6';
  const SHIP_COL = '#8b5cf6';
  const WARN_COL = '#f59e0b';
  const OK_COL   = '#22c55e';

  const flagColor = (f?: Block['flag']) =>
    f === 'warn' ? '#dc2626' : f === 'ok' ? '#0891b2' : '#475569';

  return (
    <div style={{ background: '#0f172a', borderRadius: 12, padding: '16px 18px', marginBottom: 18, border: '1px solid #1e293b' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Clock size={12} color="#64748b" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.02em' }}>DOCK ACTIVITY SCHEDULE</span>
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>· 2-hour operational window · T+0 = 13:00</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b', fontWeight: 600 }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: RECV_COL, display: 'inline-block' }} /> RECEIVING
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b', fontWeight: 600 }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: SHIP_COL, display: 'inline-block' }} /> SHIPPING
            </span>
            {!isOpt && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b', fontWeight: 600 }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: '#dc2626', display: 'inline-block' }} /> SUBOPTIMAL
            </span>}
            {isOpt && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b', fontWeight: 600 }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: OK_COL, display: 'inline-block' }} /> AI-ROUTED
            </span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1e293b', borderRadius: 6, padding: '4px 10px', border: '1px solid #334155' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>NOW 13:05</span>
          </div>
        </div>
      </div>

      {/* Gantt SVG */}
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="recv-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={RECV_COL} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="ship-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={SHIP_COL} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="warn-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="ok-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0891b2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Column header: time ticks */}
        <rect x={LW} y={0} width={TW} height={HEADER} fill="#0f172a" />
        {TICKS.map(t => {
          const x = toX(t);
          const hh = String(13 + Math.floor(t / 60)).padStart(2, '0');
          const mm = String(t % 60).padStart(2, '0');
          return (
            <g key={t}>
              <line x1={x} y1={HEADER - 5} x2={x} y2={SVG_H} stroke="#1e293b" strokeWidth={1} />
              <text x={x} y={12} textAnchor="middle" fontSize={8} fill="#475569" fontWeight={600}>{hh}:{mm}</text>
            </g>
          );
        })}

        {/* Rows */}
        {rows.map((row, ri) => {
          const y    = HEADER + ri * ROW_H;
          const isR  = row.type === 'recv';
          const hasBlocks = row.blocks.length > 0;
          return (
            <g key={row.id}>
              {/* Alternating row bg */}
              <rect x={0} y={y} width={SVG_W} height={ROW_H}
                fill={ri % 2 === 0 ? '#0f172a' : '#111827'} />

              {/* Separator */}
              <line x1={0} y1={y + ROW_H} x2={SVG_W} y2={y + ROW_H} stroke="#1e293b" strokeWidth={0.5} />

              {/* Label column */}
              <rect x={0} y={y} width={LW - 1} height={ROW_H} fill="#0f172a" />
              <line x1={LW - 1} y1={y} x2={LW - 1} y2={y + ROW_H} stroke="#1e293b" strokeWidth={1} />
              <text x={6} y={y + 14} fontSize={9} fontWeight={700} fill={isR ? RECV_COL : SHIP_COL}>{row.id}</text>
              <text x={6} y={y + 25} fontSize={7.5} fill="#475569" fontWeight={500}>{isR ? 'RECEIVING' : 'SHIPPING'}</text>

              {/* Idle track */}
              <rect x={LW} y={y + 10} width={TW} height={ROW_H - 20} rx={2} fill="#1e293b" />

              {/* Blocks */}
              {row.blocks.map((b, bi) => {
                const x1  = toX(b.start);
                const bw  = toX(b.end) - x1;
                const grad = b.flag === 'warn' ? 'url(#warn-grad)' : b.flag === 'ok' ? 'url(#ok-grad)' : isR ? 'url(#recv-grad)' : 'url(#ship-grad)';
                const col  = flagColor(b.flag);
                return (
                  <g key={bi}>
                    <rect x={x1} y={y + 8} width={bw} height={ROW_H - 16} rx={3} fill={grad} />
                    <rect x={x1} y={y + 8} width={3} height={ROW_H - 16} rx={1} fill={col} opacity={0.9} />
                    {bw > 45 && (
                      <>
                        <text x={x1 + 8} y={y + 20} fontSize={8.5} fontWeight={700} fill="#fff">{b.truck}</text>
                        <text x={x1 + 8} y={y + 29} fontSize={7} fill="rgba(255,255,255,0.65)">{b.carrier.split(' ')[0]} · {b.path}</text>
                      </>
                    )}
                    {bw > 0 && bw <= 45 && (
                      <text x={x1 + 5} y={y + 22} fontSize={7.5} fontWeight={700} fill="#fff">{b.truck}</text>
                    )}
                  </g>
                );
              })}

              {/* Idle label if empty */}
              {!hasBlocks && (
                <text x={LW + 8} y={y + 22} fontSize={8} fill="#334155" fontStyle="italic">idle — unused capacity</text>
              )}
            </g>
          );
        })}

        {/* Receiving / Shipping section divider */}
        <line x1={0} y1={HEADER + 3 * ROW_H} x2={SVG_W} y2={HEADER + 3 * ROW_H} stroke="#334155" strokeWidth={1.5} strokeDasharray="4 3" />
        <rect x={LW + 4} y={HEADER + 3 * ROW_H - 9} width={46} height={11} rx={2} fill="#334155" />
        <text x={LW + 27} y={HEADER + 3 * ROW_H - 1} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight={700}>SHIPPING</text>

        {/* NOW line */}
        <line x1={toX(NOW)} y1={HEADER} x2={toX(NOW)} y2={SVG_H} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        <rect x={toX(NOW) - 12} y={HEADER} width={24} height={12} rx={2} fill="#14532d" />
        <text x={toX(NOW)} y={HEADER + 8} textAnchor="middle" fontSize={7} fill="#22c55e" fontWeight={700}>NOW</text>
      </svg>

      {/* Event log strip */}
      <div style={{ marginTop: 12, borderTop: '1px solid #1e293b', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>AI Decision Log</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 4 }}>
          {events.map((e, i) => {
            const hh = String(13 + Math.floor(e.at / 60)).padStart(2, '0');
            const mm = String(e.at % 60).padStart(2, '0');
            const col = e.type === 'warn' ? '#f59e0b' : e.type === 'ok' ? '#22c55e' : '#38bdf8';
            const bg  = e.type === 'warn' ? '#1c1400' : e.type === 'ok' ? '#052e16' : '#0c1a2e';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: bg, borderRadius: 5, padding: '5px 8px', border: `1px solid ${col}22` }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: col, minWidth: 34, paddingTop: 1, fontVariantNumeric: 'tabular-nums' }}>{hh}:{mm}</span>
                <span style={{ fontSize: 8.5, color: '#94a3b8', lineHeight: 1.35 }}>{e.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Autonomous Dock — 3D Simulation (full warehouse replica) ──────────────────
function ADSimulationView({
  setAdSubView,
  dockPhase,
  setDockPhase,
  loadMode,
  setLoadMode,
}: {
  setAdSubView: (v: ADSubView) => void;
  dockPhase: 'baseline' | 'optimised';
  setDockPhase: (p: 'baseline' | 'optimised') => void;
  loadMode: 'baseline' | 'optimised';
  setLoadMode: (m: 'baseline' | 'optimised') => void;
}) {
  const CYAN = AD_COLOR;
  const [activeTab,    setActiveTab]    = useState<'dock' | 'load'>('dock');
  const [dockRunning,  setDockRunning]  = useState(false);
  const [loadAnimating,setLoadAnimating]= useState(false);
  const [loadSpeed,    setLoadSpeed]    = useState<1|2|3|5|10|50>(1);
  const [loadedCount,  setLoadedCount]  = useState(0);
  const [loadPaused,   setLoadPaused]   = useState(false);
  const [dismissedEv,  setDismissedEv] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const handleRunDock = () => {
    setDockRunning(true);
    setTimeout(() => { setDockPhase('optimised'); setDockRunning(false); }, 1400);
  };
  const handleResetDock = () => { setDockPhase('baseline'); setDockRunning(false); };
  const handleOptimisePacking = () => {
    setLoadAnimating(true);
    setLoadMode('optimised');
    setLoadedCount(0);
    setTimeout(() => setLoadAnimating(false), 3000);
  };
  const handleResetPacking = () => {
    setLoadMode('baseline');
    setLoadAnimating(false);
    setLoadedCount(0);
    setLoadSpeed(1);
    setLoadPaused(false);
  };

  const dockKPIs = [
    { label: 'Truck Fill Rate',    before: DOCK_BASELINE.fillRate,        after: DOCK_OPTIMISED.fillRate,        unit: '%',        good: true  },
    { label: 'Staging Congestion', before: DOCK_BASELINE.congestionScore, after: DOCK_OPTIMISED.congestionScore, unit: ' pallets', good: false },
    { label: 'Avg Turn Time',      before: DOCK_BASELINE.turnTimeMin,     after: DOCK_OPTIMISED.turnTimeMin,     unit: ' min',     good: false },
    { label: 'Docks Utilised',     before: DOCK_BASELINE.docksUtilised,   after: DOCK_OPTIMISED.docksUtilised,   unit: ' / 6',     good: true  },
    { label: 'Missed Deadlines',   before: DOCK_BASELINE.missedDeadlines, after: DOCK_OPTIMISED.missedDeadlines, unit: '',         good: false },
  ];

  // Active dock event for side panel
  const activeDocEv = DOCK_EVENTS[0];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, background: CARD, flexShrink: 0 }}>
        <button onClick={() => setAdSubView('live-ops')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>
          <ArrowLeft size={12} /> Back
        </button>
        <div style={{ width: 1, height: 16, background: BORDER }} />

        {/* Phase indicator */}
        {activeTab === 'dock' && (dockPhase === 'optimised' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 99, padding: '4px 12px' }}>
            <CheckCircle size={11} color="#16a34a" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>AI Dock Routing Active</span>
          </div>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Autonomous Dock — Live Operations</span>
        ))}
        {activeTab === 'load' && (
          <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Truck Load Planner</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Load planner controls */}
        {(activeTab === 'load') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {loadMode === 'optimised' && (
              <>
                <span style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: '0.05em' }}>SPEED</span>
                {([1, 2, 3, 5, 10, 50] as const).map(s => (
                  <button key={s} onClick={() => setLoadSpeed(s)} style={{
                    padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', border: 'none',
                    background: loadSpeed === s ? CYAN : PAGE,
                    color:      loadSpeed === s ? '#fff' : T2,
                  }}>
                    {s}×
                  </button>
                ))}
                <div style={{ width: 1, height: 16, background: BORDER, margin: '0 2px' }} />
                <button onClick={() => setLoadPaused(p => !p)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', border: `1px solid ${BORDER}`,
                  background: loadPaused ? '#fffbeb' : PAGE,
                  color: loadPaused ? '#d97706' : T2,
                }}>
                  {loadPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <div style={{ width: 1, height: 16, background: BORDER, margin: '0 2px' }} />
              </>
            )}
            {loadMode === 'baseline' ? (
              <button onClick={handleOptimisePacking} disabled={loadAnimating}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: CYAN, color: '#fff', border: 'none', opacity: loadAnimating ? 0.7 : 1 }}>
                <Zap size={11} /> Apply AI Packing
              </button>
            ) : (
              <button onClick={handleResetPacking}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: PAGE, color: T2, border: `1px solid ${BORDER}` }}>
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 2, background: PAGE, borderRadius: 9, padding: 3 }}>
          {([
            { id: 'dock' as const, label: 'Dock Optimizer', Icon: Truck    },
            { id: 'load' as const, label: 'Load Planner',   Icon: Package  },
          ]).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: activeTab === id ? CARD : 'transparent',
                color: activeTab === id ? T1 : T2,
                boxShadow: activeTab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── DOCK OPTIMIZER: 2.5D simulation ── */}
      {activeTab === 'dock' && (
        <DockOptimizerSim dockPhase={dockPhase} setDockPhase={setDockPhase} />
      )}


      {/* ── LOAD PLANNER ── */}
      {activeTab === 'load' && (
        <div style={{ flex: 1, overflowY: 'auto', background: PAGE }}>
          <div style={{ padding: '20px 24px 32px' }}>
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: T1, margin: '0 0 3px', letterSpacing: '-0.01em' }}>Truck Load Planner</h2>
              <p style={{ fontSize: 12, color: T2, margin: 0 }}>
                {loadMode === 'baseline'
                  ? <><strong style={{ color: RED }}>Baseline:</strong> random load order — gaps, damage risk. Click <strong>Apply AI Packing</strong> to watch a worker load optimally in real time.</>
                  : <><strong style={{ color: CYAN }}>AI Packing active</strong> — worker loads Large → Medium → Small. Adjust speed with 1×–10× controls in the toolbar.</>}
              </p>
            </div>

            {/* KPI strip */}
            <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={11} color="#fbbf24" />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Load Optimisation KPI</span>
                {loadMode === 'baseline'
                  ? <span style={{ fontSize: 9, color: '#64748b' }}>· apply AI packing to see improvement</span>
                  : <span style={{ fontSize: 9, color: '#22c55e', background: '#052e16', border: '1px solid #14532d', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>AI active</span>}
              </div>
              {[
                { label: 'Fill Rate',     before: '72%',    after: '94%',    delta: '+22%'   },
                { label: 'Load Time',     before: '28 min', after: '19 min', delta: '−9 min' },
                { label: 'Damage Risk',   before: 'HIGH',   after: 'LOW',    delta: '↓ 85%'  },
                { label: 'Space Used',    before: '72%',    after: '94%',    delta: '+22%'   },
                { label: 'Wt Compliance', before: '0%',     after: '100%',   delta: '+100%'  },
              ].map(k => {
                const show = loadMode === 'optimised';
                return (
                  <div key={k.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 8, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: show ? '#475569' : '#94a3b8', textDecoration: show ? 'line-through' : 'none' }}>{k.before}</span>
                      {show && <>
                        <span style={{ fontSize: 8, color: '#334155' }}>→</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>{k.after}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#22c55e', background: '#14532d', borderRadius: 3, padding: '1px 5px' }}>{k.delta}</span>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3D truck view */}
            <div style={{ background: '#0f172a', border: `1px solid ${loadMode === 'optimised' ? '#164e63' : '#1e293b'}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
              <TruckInterior3D
                mode={loadMode === 'baseline' ? 'baseline' : 'optimised'}
                animating={false}
                height={440}
                workerMode={loadMode === 'optimised'}
                workerSpeed={loadSpeed}
                workerPaused={loadPaused}
                loadedCount={loadedCount}
                onBoxLoaded={() => setLoadedCount(c => Math.min(c + 1, WORKER_TOTAL))}
              />
            </div>

            {/* Load sequence reference */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: RED, marginBottom: 8 }}>Baseline — Random Sequence</div>
                {[
                  { step: 1, label: 'Small first', note: 'crushed by heavier boxes later' },
                  { step: 2, label: 'Large mixed in', note: 'heavy on small = damage risk' },
                  { step: 3, label: 'Medium last', note: '28% wasted trailer space' },
                ].map(({ step, label, note }) => (
                  <div key={step} style={{ display: 'flex', gap: 8, padding: '6px 8px', background: '#fff', borderRadius: 6, border: '1px solid #fecaca', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: RED, minWidth: 14 }}>{step}.</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{label}</div>
                      <div style={{ fontSize: 10, color: RED }}>{note}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: CYAN, marginBottom: 8 }}>AI Optimised — L → M → S</div>
                {[
                  { step: 1, label: 'Large first (floor)', note: 'maximum stability base layer' },
                  { step: 2, label: 'Medium middle',       note: 'fills mid-height space evenly' },
                  { step: 3, label: 'Small on top',        note: '94% trailer utilisation' },
                ].map(({ step, label, note }) => (
                  <div key={step} style={{ display: 'flex', gap: 8, padding: '6px 8px', background: '#fff', borderRadius: 6, border: '1px solid #a5f3fc', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CYAN, minWidth: 14 }}>{step}.</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{label}</div>
                      <div style={{ fontSize: 10, color: CYAN }}>{note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Load Planner — KPI Impact View ───────────────────────────────────────────
function LoadPlannerKPIView({
  loadMode,
  setAdSubView,
}: {
  loadMode: 'baseline' | 'optimised';
  setAdSubView: (v: ADSubView) => void;
}) {
  const CYAN = AD_COLOR;
  const show = loadMode === 'optimised';

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '28px 32px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={16} color="#d97706" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T1, margin: 0, letterSpacing: '-0.02em' }}>Load Planner — KPI Impact</h1>
            <p style={{ fontSize: 13, color: T2, margin: '2px 0 0' }}>Before vs. after AI packing optimisation across trailer fill, load time, damage risk, and cost</p>
          </div>
        </div>
        {show
          ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '4px 12px', marginTop: 8 }}>
              <CheckCircle size={11} color="#16a34a" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>AI packing applied — optimised data shown</span>
            </div>
          : <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f9fafb', border: `1px solid ${BORDER}`, borderRadius: 99, padding: '4px 12px', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: T3 }}>Showing baseline — apply AI packing from Load Planner to see live improvement</span>
            </div>
        }
      </div>

      {/* Primary KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { Icon: TrendingUp,    title: 'Trailer Fill Rate',  before: '72%',    after: '94%',    delta: '+22pp',  unit: 'of trailer capacity used',  color: CYAN,      bg: '#ecfeff', bd: '#a5f3fc' },
          { Icon: Timer,         title: 'Load Time',          before: '28 min', after: '19 min', delta: '−9 min', unit: 'avg time to load trailer',   color: '#8b5cf6', bg: '#f5f3ff', bd: '#ddd6fe' },
          { Icon: AlertTriangle, title: 'Damage Risk',        before: 'HIGH',   after: 'LOW',    delta: '↓ 85%',  unit: 'item damage probability',    color: '#16a34a', bg: '#f0fdf4', bd: '#bbf7d0' },
          { Icon: Zap,           title: 'Weight Compliance',  before: '0%',     after: '100%',   delta: '+100pp', unit: 'axle weight within limits',  color: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
        ].map(({ Icon, title, before, after, delta, unit, color, bg, bd }) => (
          <div key={title} style={{ background: CARD, border: `1px solid ${show ? bd : BORDER}`, borderRadius: 14, padding: '20px 22px', boxShadow: CARDSH, transition: 'border-color 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, border: `1px solid ${bd}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color={color} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3 }}>{title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: show ? '#94a3b8' : T2, textDecoration: show ? 'line-through' : 'none', transition: 'all 0.3s' }}>{before}</span>
              {show && <>
                <span style={{ fontSize: 11, color: T3 }}>→</span>
                <span style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{after}</span>
              </>}
            </div>
            {show && <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', background: '#14532d', borderRadius: 5, padding: '2px 8px' }}>{delta}</span>}
            <div style={{ fontSize: 11, color: T3, marginTop: 8 }}>{unit}</div>
          </div>
        ))}
      </div>

      {/* Before / After breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={14} color={RED} />
            <span style={{ fontSize: 12, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Baseline Load — What Goes Wrong</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { title: 'Random packing order',     body: 'Small boxes placed first get buried under heavy items. No weight-stacking rules — fragile SKUs are crushed before the truck leaves the yard.' },
              { title: '28% trailer space wasted', body: 'Gaps appear between mismatched box sizes. No column fill logic means irregular stacks leave air pockets that reduce effective capacity.' },
              { title: 'Axle weight violation risk', body: 'Heavy pallets loaded without regard to axle position. Front-heavy or rear-heavy loads can cause DOT weight distribution violations.' },
              { title: 'Long load time: 28 min',   body: 'Workers improvise placement with no pre-planned sequence. Repositioning mistakes add 8–12 min per trailer.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 9, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9f1239', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 11, color: '#7f1d1d', lineHeight: 1.55 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CheckCircle size={14} color={CYAN} />
            <span style={{ fontSize: 12, fontWeight: 800, color: CYAN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Optimised Load — How It Fixes It</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { title: 'Layer-by-layer sequence',      body: 'Large heavy boxes form a dense floor layer first. Medium on top. Small boxes fill remaining space. Sequence is pre-planned and handed to warehouse workers.' },
              { title: '94% trailer utilisation',      body: 'Column packing matches box footprints to fill every available column. No gaps remain — reducing dead air by ~22 pp.' },
              { title: '100% axle weight compliance',  body: 'Weight is distributed front-to-back per DOT axle load guidelines. Heavy SKUs placed in the optimal axle zone — 53/47 split maintained.' },
              { title: 'Load time: 19 min',            body: 'Workers follow a digital manifest: exact position for every box. No repositioning needed. Saves ~9 min × 6 trips = ~54 min / shift.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ background: '#f0fdfe', border: '1px solid #a5f3fc', borderRadius: 9, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0e7490', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 11, color: '#0c4a6e', lineHeight: 1.55 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shift-level impact table */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 24px', boxShadow: CARDSH, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T1, marginBottom: 16 }}>Shift-Level Impact — 6 Outbound Trailers / Shift</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: PAGE }}>
                {['Metric', 'Baseline', 'AI Optimised', 'Improvement'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: i === 1 ? RED : i === 2 ? CYAN : i === 3 ? GREEN : T3, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { metric: 'Avg trailer fill rate',        base: '72%',           opt: '94%',          gain: '+22pp per trailer'       },
                { metric: 'Total load time (6 trailers)', base: '168 min',        opt: '114 min',      gain: '−54 min / shift'         },
                { metric: 'Wasted trailer space',         base: '28% of volume',  opt: '6% of volume', gain: '−22% dead air / trailer' },
                { metric: 'Damage incidents / week',      base: '~3–5 claims',    opt: '< 0.5 claims', gain: '−85% damage rate'        },
                { metric: 'Axle weight violations',       base: '~2 / week',      opt: '0',            gain: 'Full compliance'         },
                { metric: 'Labour cost saved / shift',    base: '—',              opt: '+$340',        gain: '0.9 FTE-hour saved'      },
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, background: i % 2 === 0 ? 'transparent' : PAGE }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: T1 }}>{row.metric}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: RED, fontWeight: 600 }}>{row.base}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: CYAN, fontWeight: 700 }}>{row.opt}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, padding: '2px 8px' }}>{row.gain}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA — go to Load Planner 3D view */}
      <div style={{ background: '#0f172a', borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
            {show ? 'See the optimised load in 3D' : 'Ready to see the improvement in 3D?'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {show ? 'Open the Load Planner to view the AI-packed truck in real time.' : 'Switch to Load Planner and click "Apply AI Packing" to watch boxes re-sequence live.'}
          </div>
        </div>
        <button onClick={() => setAdSubView('simulation')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: CYAN, color: '#fff', border: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <Play size={11} /> Open Load Planner
        </button>
      </div>
    </div>
  );
}

// ── Autonomous Dock — KPI Impact View ────────────────────────────────────────
function ADKPIImpactView({ dockPhase }: { dockPhase: 'baseline' | 'optimised' }) {
  const CYAN  = AD_COLOR;
  const isOpt = dockPhase === 'optimised';
  const [expandedEv, setExpandedEv] = useState<string | null>(null);

  const dockKPIs = [
    {
      title: 'Truck Turn Time',
      before: `${DOCK_BASELINE.turnTimeMin} min`, after: `${DOCK_OPTIMISED.turnTimeMin} min`,
      delta: `-${DOCK_BASELINE.turnTimeMin - DOCK_OPTIMISED.turnTimeMin} min`,
      pct:   `-${(((DOCK_BASELINE.turnTimeMin - DOCK_OPTIMISED.turnTimeMin) / DOCK_BASELINE.turnTimeMin) * 100).toFixed(0)}%`,
      unit: 'avg dock turn time', Icon: Timer,       color: '#0891b2', bg: '#ecfeff', good: true,
    },
    {
      title: 'Dock Utilization',
      before: `${DOCK_BASELINE.docksUtilised} / 6`, after: `${DOCK_OPTIMISED.docksUtilised} / 6`,
      delta: `+${DOCK_OPTIMISED.docksUtilised - DOCK_BASELINE.docksUtilised} docks`,
      pct:   `+${(((DOCK_OPTIMISED.docksUtilised - DOCK_BASELINE.docksUtilised) / DOCK_BASELINE.docksUtilised) * 100).toFixed(0)}%`,
      unit: 'simultaneous docks active', Icon: Truck,  color: '#16a34a', bg: '#f0fdf4', good: true,
    },
    {
      title: 'Staging Congestion',
      before: `${DOCK_BASELINE.congestionScore}`, after: `${DOCK_OPTIMISED.congestionScore}`,
      delta: `-${DOCK_BASELINE.congestionScore - DOCK_OPTIMISED.congestionScore} pallets`,
      pct:   `-${(((DOCK_BASELINE.congestionScore - DOCK_OPTIMISED.congestionScore) / DOCK_BASELINE.congestionScore) * 100).toFixed(0)}%`,
      unit: 'pallets queued in staging', Icon: Package, color: '#d97706', bg: '#fffbeb', good: true,
    },
    {
      title: 'Avg Path Distance',
      before: '31 m', after: '18 m',
      delta: '−13 m',
      pct:   '−42%',
      unit: 'truck to storage zone', Icon: GitBranch, color: '#8b5cf6', bg: '#f5f3ff', good: true,
    },
    {
      title: 'On-Time Departures',
      before: '61%', after: '94%',
      delta: '+33 pp',
      pct:   '+54%',
      unit: 'trucks departing on schedule', Icon: CheckCircle, color: '#1d4ed8', bg: '#eff6ff', good: true,
    },
    {
      title: 'Missed Deadlines',
      before: String(DOCK_BASELINE.missedDeadlines), after: String(DOCK_OPTIMISED.missedDeadlines),
      delta: `-${DOCK_BASELINE.missedDeadlines}`,
      pct:   '−100%',
      unit: 'per shift', Icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', good: true,
    },
  ];

  const loadKPIs = [
    { title: 'Trailer Fill Rate', before: '72%',    after: '94%',    delta: '+22%',    pct: '+31%',   unit: 'cubic utilisation',       Icon: Package,     color: '#0891b2', bg: '#ecfeff' },
    { title: 'Load Time',         before: '28 min', after: '19 min', delta: '−9 min',  pct: '−32%',   unit: 'avg per trailer',         Icon: Timer,       color: '#16a34a', bg: '#f0fdf4' },
    { title: 'Damage Risk',       before: 'HIGH',   after: 'LOW',    delta: '↓ 85%',   pct: '−85%',   unit: 'cargo damage incidents',  Icon: AlertTriangle,color: '#d97706', bg: '#fffbeb' },
    { title: 'Space Utilised',    before: '72%',    after: '94%',    delta: '+22%',    pct: '+31%',   unit: 'volumetric efficiency',   Icon: Layers,      color: '#8b5cf6', bg: '#f5f3ff' },
    { title: 'Weight Compliance', before: '0%',     after: '100%',   delta: '+100%',   pct: '+100%',  unit: 'axle weight compliance',  Icon: CheckCircle, color: '#1d4ed8', bg: '#eff6ff' },
  ];

  const improvements = [
    {
      id: 'dock-routing',
      time: '13:52',
      title: 'Truck T-103 routed to optimal dock via zone-affinity matching',
      description: 'T-103 (Old Dominion, 44 pallets — Zone A high-velocity SKUs) was auto-assigned to Recv-1 based on minimum path distance to Zone A storage (18 m vs. 31 m at Recv-3). Turn time reduced by 13 minutes.',
      detail: 'Zone-affinity routing ensures each inbound truck docks closest to its destination storage zone, eliminating cross-warehouse pallet travel and reducing forklift cycle time by up to 42%.',
    },
    {
      id: 'congestion-preempt',
      time: '13:48',
      title: 'S-3 activated proactively to pre-empt staging congestion',
      description: 'AI detected rising staging congestion at S-1 / S-2 (8 pallets queued, forklift queue blocked). S-3 was automatically activated and Wave W-08 re-routed 12 minutes before a predicted jam.',
      detail: 'Predictive congestion scoring runs every 90 seconds. When staging pallet count exceeds threshold on adjacent docks, the system pre-activates idle bays and redistributes wave assignments.',
    },
    {
      id: 'load-sequence',
      time: '13:41',
      title: 'Wave W-07 load sequence reordered: large → medium → small',
      description: 'AI detected that SKU-C7 (small, 96 kg) was placed first in trailer TRL-6615. Sequence was corrected to large-first (SKU-A1, 420 kg) before loading started, raising projected fill rate from 71% to 94%.',
      detail: 'The size-stratified loading algorithm places the heaviest, largest items as the base layer, medium items as the structural mid-layer, and small items as gap-fillers. This eliminates structural voids and prevents crush damage.',
    },
    {
      id: 'rebalance',
      time: '12:33',
      title: 'Dynamic dock rebalance: T-104 rerouted R-3 → R-1, saving 13 m',
      description: 'When T-102 completed unloading at R-2 ahead of schedule, the AI immediately freed R-1 for T-104 (closer path), reducing its storage walk distance from 31 m to 18 m.',
      detail: 'Real-time dock rebalancing runs on every truck departure event. The optimizer re-evaluates all queued trucks against current dock availability and path distances, issuing re-assignments within 2 seconds.',
    },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', background: PAGE, padding: '24px 28px 32px' }}>

        {/* Banner — always visible, but headline/stat reflects phase */}
        <div style={{ background: '#0f172a', borderRadius: 12, padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot size={22} color={CYAN} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: CYAN, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Autonomous Dock AI — Full Impact Analysis</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Dock Routing + Load Optimisation</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>Combining zone-affinity truck routing with AI-sequenced load packing across all 6 docks.</div>
          </div>
          {isOpt ? (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Turn-Time Reduction</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', letterSpacing: '-0.03em' }}>−{DOCK_BASELINE.turnTimeMin - DOCK_OPTIMISED.turnTimeMin} min</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>per truck avg</div>
            </div>
          ) : (
            <div style={{ textAlign: 'right', flexShrink: 0, background: '#1e293b', borderRadius: 10, padding: '10px 14px', border: '1px solid #334155' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Avg Turn Time</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{DOCK_BASELINE.turnTimeMin} min</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>baseline</div>
            </div>
          )}
        </div>

        {/* No-optimisation prompt */}
        {!isOpt && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Zap size={16} color="#d97706" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>AI optimisation not yet applied</div>
              <div style={{ fontSize: 12, color: '#78350f' }}>Go to <strong>Visual Simulation</strong> and click <strong>Run AI Optimisation</strong> to unlock the before/after comparison and key AI decisions.</div>
            </div>
          </div>
        )}

        {/* Section: Dock Operations KPIs */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          {isOpt ? 'Dock Operations — Baseline vs. AI Optimised' : 'Dock Operations — Current Baseline'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }}>
          {dockKPIs.map(kpi => (
            <div key={kpi.title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', boxShadow: CARDSH }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <kpi.Icon size={13} color={kpi.color} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>{kpi.title}</div>
              </div>
              <div style={{ marginBottom: isOpt ? 4 : 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T3, letterSpacing: '0.06em', marginBottom: 2 }}>BASELINE</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: isOpt ? '#9ca3af' : T1, textDecoration: isOpt ? 'line-through' : 'none', letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.before}</div>
                <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>{kpi.unit}</div>
              </div>
              {isOpt && (
                <>
                  <div style={{ fontSize: 18, color: '#d1d5db', margin: '8px 0' }}>↓</div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: GREEN, letterSpacing: '0.06em', marginBottom: 2 }}>OPTIMISED</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: T1, letterSpacing: '-0.03em', lineHeight: 1 }}>{kpi.after}</div>
                    <div style={{ fontSize: 10, color: T2, marginTop: 2 }}>{kpi.unit}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px' }}>{kpi.delta}</span>
                    <span style={{ fontSize: 10, color: T3, fontWeight: 600 }}>{kpi.pct}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Section: Load Optimisation KPIs */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          {isOpt ? 'Load Optimisation — Baseline vs. AI Packing' : 'Load Optimisation — Current Baseline'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {loadKPIs.map(kpi => (
            <div key={kpi.title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', boxShadow: CARDSH }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <kpi.Icon size={13} color={kpi.color} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>{kpi.title}</div>
              </div>
              <div style={{ marginBottom: isOpt ? 4 : 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T3, letterSpacing: '0.06em', marginBottom: 2 }}>BASELINE</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: isOpt ? '#9ca3af' : T1, textDecoration: isOpt ? 'line-through' : 'none', letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.before}</div>
              </div>
              {isOpt && (
                <>
                  <div style={{ fontSize: 18, color: '#d1d5db', margin: '8px 0' }}>↓</div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: GREEN, letterSpacing: '0.06em', marginBottom: 2 }}>OPTIMISED</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: T1, letterSpacing: '-0.03em', lineHeight: 1 }}>{kpi.after}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px' }}>{kpi.delta}</span>
                    <span style={{ fontSize: 10, color: T3, fontWeight: 600 }}>{kpi.pct}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Section: Key improvement decisions — only after optimisation */}
        {isOpt && <>
        <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Key AI Decisions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {improvements.map(ev => {
            const isOpen = expandedEv === ev.id;
            return (
              <div key={ev.id} style={{ background: CARD, border: '1px solid #a5f3fc', borderRadius: 10, overflow: 'hidden', boxShadow: CARDSH }}>
                <button
                  onClick={() => setExpandedEv(isOpen ? null : ev.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: '#ecfeff', border: '1px solid #a5f3fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={16} color={CYAN} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: CYAN, marginBottom: 2 }}>{ev.time} — AI Decision</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{ev.title}</div>
                  </div>
                  <ChevronRight size={14} color={T3} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </button>
                {isOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid #ecfeff' }}>
                    <p style={{ fontSize: 13, color: T1, lineHeight: 1.65, margin: '14px 0 10px', fontWeight: 500 }}>{ev.description}</p>
                    <p style={{ fontSize: 12, color: T2, lineHeight: 1.7, margin: 0 }}>{ev.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>}
      </div>
    </div>
  );
}

// ── Autonomous Dock — root router ─────────────────────────────────────────────
function AutonomousDockView({ adSubView, setAdSubView, dockPhase, setDockPhase, loadMode, setLoadMode }: {
  adSubView: ADSubView; setAdSubView: (v: ADSubView) => void;
  dockPhase: 'baseline' | 'optimised'; setDockPhase: (p: 'baseline' | 'optimised') => void;
  loadMode: 'baseline' | 'optimised'; setLoadMode: (m: 'baseline' | 'optimised') => void;
}) {
  return (
    <>
      {adSubView === 'live-ops'     && <ADLiveOpsView     setAdSubView={setAdSubView} />}
      {adSubView === 'ai-decisions' && <ADAIDecisionsView setAdSubView={setAdSubView} />}
      {adSubView === 'simulation'   && <ADSimulationView  setAdSubView={setAdSubView} dockPhase={dockPhase} setDockPhase={setDockPhase} loadMode={loadMode} setLoadMode={setLoadMode} />}
      {adSubView === 'kpi-impact'   && <ADKPIImpactView   dockPhase={dockPhase} />}
      {adSubView === 'load-kpi'     && <LoadPlannerKPIView loadMode={loadMode} setAdSubView={setAdSubView} />}
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
    name: 'Warehouse 1 — Cincinnati',
    location: 'Cincinnati, OH',
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
    name: 'Warehouse 2 — Chicago',
    location: 'Chicago, IL',
    status: 'live',
    sqft: 485000,
    docks: 36,
    throughput: 2240,
    utilisation: 84,
    alerts: 5,
    costPerCase: 1.18,
    isReal: false,
  },
  {
    id: 'wh-3',
    name: 'Warehouse 3 — Indianapolis',
    location: 'Indianapolis, IN',
    status: 'live',
    sqft: 275000,
    docks: 20,
    throughput: 1580,
    utilisation: 71,
    alerts: 1,
    costPerCase: 1.31,
    isReal: false,
  },
  {
    id: 'wh-4',
    name: 'Warehouse 4 — Milwaukee',
    location: 'Milwaukee, WI',
    status: 'offline',
    sqft: 190000,
    docks: 14,
    throughput: 0,
    utilisation: 0,
    alerts: 2,
    costPerCase: 0,
    isReal: false,
  },
];

// Geographic coordinates for each warehouse (real Midwest city locations)
// lon is stored as positive; map usage negates it: coordinates={[-geo.lon, geo.lat]}
const WH_GEO: Record<string, { lon: number; lat: number; city: string; state: string }> = {
  'wh-1': { lon: 84.51, lat: 39.10, city: 'Cincinnati',   state: 'OH' },
  'wh-2': { lon: 87.63, lat: 41.88, city: 'Chicago',      state: 'IL' },
  'wh-3': { lon: 86.16, lat: 39.77, city: 'Indianapolis', state: 'IN' },
  'wh-4': { lon: 87.91, lat: 43.04, city: 'Milwaukee',    state: 'WI' },
};

const STATUS_CFG: Record<WHStatus, { label: string; color: string; bg: string; dot: string }> = {
  live:     { label: 'LIVE',     color: '#15803d', bg: '#f0fdf4', dot: '#16a34a' },
  building: { label: 'BUILDING', color: '#92400e', bg: '#fffbeb', dot: '#f59e0b' },
  offline:  { label: 'OFFLINE',  color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  planned:  { label: 'PLANNED',  color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
};

function NetworkKPIBar({ activeScenario }: { activeScenario?: NetworkScenario }) {
  const proj = activeScenario?.projectedKPIBar;
  const kpis = [
    { label: 'Total Network Throughput', value: proj ? proj.throughput  : '5,667', unit: 'cases/hr' },
    { label: 'Active Warehouses',        value: proj ? '4' : '3',                   unit: 'of 4'     },
    { label: 'Network Utilisation',      value: proj ? proj.utilisation : '78%',    unit: 'avg'      },
    { label: 'Avg Cost per Case',        value: proj ? proj.costPerCase : '$1.24',  unit: '/case'    },
    { label: 'Order Fill Rate',          value: proj ? proj.fillRate    : '93%',    unit: ''         },
    { label: 'Fleet Active',             value: '42',                                unit: 'trucks'   },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0,
      background: proj ? `${activeScenario!.tagColor}06` : CARD,
      borderBottom: `1px solid ${proj ? activeScenario!.tagColor + '33' : BORDER}`,
      transition: 'background 0.3s ease',
    }}>
      {kpis.map(({ label, value, unit }, i) => (
        <div key={i} style={{
          padding: '14px 20px',
          borderRight: i < 5 ? `1px solid ${proj ? activeScenario!.tagColor + '22' : BORDER}` : 'none',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            {label}
            {proj && <span style={{ marginLeft: 5, fontSize: 8, fontWeight: 700, color: activeScenario!.tagColor, letterSpacing: '0.04em' }}>PROJ</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: proj ? activeScenario!.tagColor : T1, letterSpacing: '-0.02em' }}>{value}</span>
            <span style={{ fontSize: 11, color: T3, fontWeight: 500 }}>{unit}</span>
          </div>
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
  story: string[];
  affectedWHs: string[];
  projectedKPIBar?: { throughput: string; utilisation: string; costPerCase: string; fillRate: string };
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
    affectedWHs: ['wh-1'],
    story: [
      'Warehouse 1 (Chicago) is the network\'s only live site. A full outage drops throughput to zero immediately.',
      '312 open orders across 14 customers have no fulfilment path. Backlog accumulates at 1,847 cases/hr.',
      'Without emergency 3PL activation within 6 hours, next-day SLAs breach for all Midwest accounts.',
    ],
    projectedKPIBar: { throughput: '0', utilisation: '0%', costPerCase: 'N/A', fillRate: '0%' },
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
    affectedWHs: ['wh-1', 'wh-2'],
    story: [
      'WH-1 (Chicago) is running at 78% utilisation. Activating WH-2 (Indianapolis) at 60% capacity offloads 40% of volume.',
      'Network throughput jumps to 2,890 cases/hr. WH-1 congestion eases to 48%, eliminating weekend overtime.',
      'Break-even on go-live setup cost at day 12. Sustained $0.06/case improvement applies to the full network.',
    ],
    projectedKPIBar: { throughput: '2,890', utilisation: '54%', costPerCase: '$1.18', fillRate: '96%' },
    recommendation: 'Proceed with early go-live. Break-even on setup cost at day 12. Network cost/case improves by $0.06 sustainably.',
    kpis: [
      { label: 'Network Throughput',  before: '1,847 cases/hr', after: '2,890 cases/hr', delta: '+57%',    positive: true  },
      { label: 'Cost per Case',       before: '$1.24',           after: '$1.18',          delta: '−$0.06',  positive: true  },
      { label: 'WH-1 Utilisation',    before: '78%',             after: '48%',            delta: '−30pp',   positive: true  },
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
    affectedWHs: ['wh-1'],
    story: [
      'A +40% demand event (peak season or promo) requires 2,586 cases/hr. WH-1 can only deliver 1,847 — a 739 case/hr gap.',
      'Without intervention, ~48 late shipments accumulate daily. Congestion score hits 94/100, triggering dock delays.',
      'Adding a 3rd shift at WH-1 closes 84% of the gap. Activating WH-2 closes it entirely and absorbs future spikes.',
    ],
    projectedKPIBar: { throughput: '1,847', utilisation: '94%', costPerCase: '$1.56', fillRate: '71%' },
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

      {/* Network Story */}
      <div style={{
        background: `${scenario.tagColor}07`,
        border: `1px solid ${scenario.tagColor}22`,
        borderRadius: 10, padding: '14px 18px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: scenario.tagColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Network Story
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {scenario.story.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                background: `${scenario.tagColor}18`, border: `1px solid ${scenario.tagColor}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, color: scenario.tagColor, marginTop: 1,
              }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: T2, lineHeight: 1.55 }}>{line}</span>
            </div>
          ))}
        </div>
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

// Midwest cities available for new warehouse placement (excludes existing sites)
const AVAILABLE_CITIES: { label: string; city: string; state: string; lon: number; lat: number }[] = [
  { label: 'Minneapolis, MN', city: 'Minneapolis', state: 'MN', lon: 93.27, lat: 44.98 },
  { label: 'St. Louis, MO',   city: 'St. Louis',   state: 'MO', lon: 90.20, lat: 38.63 },
  { label: 'Detroit, MI',     city: 'Detroit',      state: 'MI', lon: 83.05, lat: 42.33 },
  { label: 'Cincinnati, OH',    city: 'Columbus',     state: 'OH', lon: 82.99, lat: 39.96 },
  { label: 'Cleveland, OH',   city: 'Cleveland',    state: 'OH', lon: 81.70, lat: 41.50 },
  { label: 'Green Bay, WI',   city: 'Green Bay',    state: 'WI', lon: 87.65, lat: 44.52 },
  { label: 'Des Moines, IA',  city: 'Des Moines',   state: 'IA', lon: 93.62, lat: 41.60 },
  { label: 'Kansas City, MO', city: 'Kansas City',  state: 'MO', lon: 94.58, lat: 39.10 },
  { label: 'Louisville, KY',  city: 'Louisville',   state: 'KY', lon: 85.76, lat: 38.25 },
  { label: 'Madison, WI',     city: 'Madison',      state: 'WI', lon: 89.40, lat: 43.07 },
  { label: 'Omaha, NE',       city: 'Omaha',        state: 'NE', lon: 95.93, lat: 41.26 },
  { label: 'Milwaukee, WI',   city: 'Milwaukee',    state: 'WI', lon: 87.91, lat: 43.04 },
];

interface TwinParams {
  name: string;
  cityKey: string;  // key into AVAILABLE_CITIES
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
  cityKey: 'Minneapolis, MN',
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

// Free-type number input that only validates on blur / Enter
function NumInput({ value, min, max, step = 1, color = '#1d4ed8', width = 72, onChange }: {
  value: number; min: number; max: number; step?: number;
  color?: string; width?: number; onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = (s: string) => {
    const n = parseFloat(s);
    const clamped = isNaN(n) ? value : Math.min(max, Math.max(min, Math.round(n / step) * step));
    onChange(clamped);
    setText(String(clamped));
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => commit(text)}
      onKeyDown={e => { if (e.key === 'Enter') { commit(text); (e.target as HTMLInputElement).blur(); } }}
      style={{
        width, padding: '3px 7px', borderRadius: 6,
        border: '1.5px solid #cbd5e1', fontSize: 11, fontWeight: 800,
        color, textAlign: 'right', outline: 'none', background: '#fff',
        cursor: 'text',
      }}
    />
  );
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  unit: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T2 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <NumInput value={value} min={min} max={max} step={step} width={72} onChange={onChange} />
          <span style={{ fontSize: 10, color: T3 }}>{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: T3 }}>{min.toLocaleString()} {unit}</span>
        <span style={{ fontSize: 9, color: T3 }}>{max.toLocaleString()} {unit}</span>
      </div>
    </div>
  );
}

function BuildTwinModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (name: string, city: { label: string; city: string; state: string; lon: number; lat: number }) => void;
}) {
  const [step, setStep]     = useState<1 | 2 | 3>(1);
  const [params, setParams] = useState<TwinParams>(DEFAULT_PARAMS);
  const [creating, setCreating] = useState(false);

  const proj = projectKPIs(params);
  const zoneTotal = params.zoneA + params.zoneB + params.zoneC;

  function setP<K extends keyof TwinParams>(k: K, v: TwinParams[K]) {
    setParams(prev => ({ ...prev, [k]: v }));
  }

  const selectedCity = AVAILABLE_CITIES.find(c => c.label === params.cityKey) ?? AVAILABLE_CITIES[0];

  function handleCreate() {
    setCreating(true);
    setTimeout(() => {
      onCreated(params.name, selectedCity);
    }, 1400);
  }

  const STEP_LABELS = ['Select Template', 'Configure Parameters', 'Network Preview'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        input[type="range"] {
          -webkit-appearance: none; appearance: none;
          height: 5px; border-radius: 3px; background: #e2e8f0; outline: none; cursor: pointer;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 5px; border-radius: 3px; background: #e2e8f0;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #1d4ed8; cursor: pointer; margin-top: -5.5px;
          box-shadow: 0 1px 4px rgba(29,78,216,0.35);
        }
        input[type="range"]::-moz-range-track {
          height: 5px; border-radius: 3px; background: #e2e8f0;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 50%;
          background: #1d4ed8; cursor: pointer; border: none;
          box-shadow: 0 1px 4px rgba(29,78,216,0.35);
        }
      `}</style>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Location — City, State</label>
                    <select
                      value={params.cityKey}
                      onChange={e => setP('cityKey', e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: PAGE, border: `1px solid ${BORDER}`,
                        borderRadius: 8, padding: '8px 12px', color: T1, fontSize: 12,
                        outline: 'none', cursor: 'pointer',
                      }}
                    >
                      {AVAILABLE_CITIES.map(c => (
                        <option key={c.label} value={c.label}>{c.label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 9, color: T3, marginTop: 4 }}>Cities shown on the Midwest network map</div>
                  </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: T2 }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <NumInput value={params[key]} min={5} max={80} step={1} color={color} width={52} onChange={v => setP(key, v)} />
                          <span style={{ fontSize: 10, color: T3 }}>%</span>
                        </div>
                      </div>
                      <input type="range" min={5} max={80} value={params[key]}
                        onChange={e => setP(key, Number(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer', accentColor: color }} />
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
                  <div style={{ fontSize: 12, color: T2 }}>📍 {selectedCity.label} · {(params.sqft / 1000).toFixed(0)}K sq ft · {params.recvDocks + params.shipDocks} total docks</div>
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
                    `📍 ${selectedCity.label}`,
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

// ── Midwest Operations Map ────────────────────────────────────────────────────
const GEO_URL = statesGeo;

const MIDWEST_IDS = new Set(['27','55','26','19','17','18','39','29']);

function MidwestMapView({
  warehouses,
  selected,
  onSelect,
  activeScenarioId,
}: {
  warehouses: WarehouseNode[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  activeScenarioId: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSc = NETWORK_SCENARIOS.find(s => s.id === activeScenarioId);
  const isScAffected = (whId: string) => !!(activeSc && activeSc.affectedWHs.includes(whId));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const STATUS_PIN: Record<WHStatus, { fill: string; glow: string }> = {
    live:     { fill: '#1d4ed8', glow: '#3b82f6' },
    building: { fill: '#d97706', glow: '#f59e0b' },
    offline:  { fill: '#dc2626', glow: '#ef4444' },
    planned:  { fill: '#64748b', glow: '#94a3b8' },
  };

  const hoveredWH  = hovered ? warehouses.find(w => w.id === hovered) : null;
  const hoveredGeo = hovered ? WH_GEO[hovered] : null;

  return (
    <div ref={containerRef}
      style={{ position: 'relative', background: '#b8d4e8', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', boxShadow: CARDSH }}
      onMouseMove={handleMouseMove}>

      {/* Toolbar */}
      <div style={{ padding: '11px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network size={14} color="#1d4ed8" />
          <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>Midwest Operations Network</span>
          <span style={{ fontSize: 10, color: T3 }}>· hover for quick info · click pin to inspect</span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {([['#1d4ed8','Live'],['#d97706','Building'],['#dc2626','Offline'],['#64748b','Planned']] as [string,string][]).map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 9, color: T3, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Real geographic map via react-simple-maps + us-atlas TopoJSON */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 1600, center: [-88.5, 43.0] }}
        width={860}
        height={520}
        style={{ width: '100%', display: 'block' }}
      >
        <defs>
          <marker id="map-arrow-blue" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#3b82f6" opacity={0.75} />
          </marker>
          <marker id="map-arrow-grey" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#94a3b8" opacity={0.6} />
          </marker>
        </defs>

        {/* All states grey, white borders */}
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) => geographies.map((geo: any) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={MIDWEST_IDS.has(geo.id) ? '#c8d4dc' : '#b0bec8'}
              stroke="#ffffff"
              strokeWidth={0.8}
              style={{
                default: { outline: 'none' },
                hover:   { outline: 'none' },
                pressed: { outline: 'none' },
              }}
            />
          ))}
        </Geographies>

        {/* State name labels */}
        {([
          [-94.2, 46.4, 'Minnesota'],
          [-89.8, 44.4, 'Wisconsin'],
          [-85.0, 43.8, 'Michigan'],
          [-93.5, 42.0, 'Iowa'],
          [-89.2, 40.0, 'Illinois'],
          [-86.2, 40.0, 'Indiana'],
          [-82.5, 40.2, 'Ohio'],
          [-92.5, 38.5, 'Missouri'],
          [-85.5, 37.8, 'Kentucky'],
        ] as [number, number, string][]).map(([lon, lat, name]) => (
          <Marker key={name} coordinates={[lon, lat]}>
            <text textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#1e293b" style={{ pointerEvents: 'none' }}>{name}</text>
          </Marker>
        ))}

        {/* Reference city dots */}
        {([
          [-93.27, 44.98, 'Minneapolis'],
          [-90.20, 38.63, 'St. Louis'],
          [-83.05, 42.33, 'Detroit'],
          [-84.51, 39.10, 'Cincinnati'],
          [-81.70, 41.50, 'Cleveland'],
          [-87.65, 44.52, 'Green Bay'],
          [-93.62, 41.60, 'Des Moines'],
        ] as [number, number, string][]).map(([lon, lat, name]) => (
          <Marker key={name} coordinates={[lon, lat]}>
            <circle r={4} fill="#1a1a2e" stroke="white" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <text x={8} y={4} fontSize={9} fill="#1a1a2e" fontWeight={700} style={{ pointerEvents: 'none' }}>{name}</text>
          </Marker>
        ))}

        {/* Warehouse pins */}
        {warehouses.map(wh => {
          const geo = WH_GEO[wh.id];
          if (!geo) return null;
          const cfg = STATUS_PIN[wh.status];
          const isSelected = selected === wh.id;
          const isHov = hovered === wh.id;
          const scAff = isScAffected(wh.id);
          const scColor = activeSc?.tagColor ?? cfg.fill;

          return (
            <Marker key={wh.id} coordinates={[-geo.lon, geo.lat]}>
              <g
                onClick={() => onSelect(isSelected ? null : wh.id)}
                onMouseEnter={() => setHovered(wh.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}>
                {/* All y values shifted -10 so the pin tip (formerly y=10) sits exactly on the coordinate */}
                {scAff && <>
                  <circle cy={-18} r={22} fill={scColor} style={{ animation: 'scenarioPulse 1.6s ease-in-out infinite' }} />
                  <circle cy={-18} r={34} fill={scColor} style={{ animation: 'scenarioPulse2 1.6s ease-in-out infinite' }} />
                </>}
                {(isSelected || isHov) && (
                  <circle cy={-18} r={19} fill="none" stroke={cfg.fill} strokeWidth={2.5} opacity={0.45} />
                )}
                <ellipse cy={-2} rx={7} ry={3} fill="rgba(0,0,0,0.22)" />
                <path d="M 0,0 L -11,-14 A 11,11 0 1,1 11,-14 Z" fill={cfg.fill} />
                <circle cy={-18} r={5} fill="rgba(255,255,255,0.90)" />
                {wh.status === 'live' && (
                  <circle cy={-18} r={15} fill="none" stroke={cfg.fill} strokeWidth={1.5} opacity={0.35} />
                )}
                {wh.alerts > 0 && (
                  <g>
                    <circle cx={11} cy={-28} r={7} fill="#ef4444" />
                    <text x={11} y={-24} textAnchor="middle" fontSize={7} fontWeight={800} fill="#fff">{wh.alerts}</text>
                  </g>
                )}
                <rect x={-30} y={4} width={60} height={15} rx={3} fill="rgba(10,18,36,0.75)" />
                <text y={14} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#e2e8f0" style={{ pointerEvents: 'none' }}>
                  {geo.city}, {geo.state}
                </text>
              </g>
            </Marker>
          );
        })}

      </ComposableMap>

      {/* Compass rose — fixed to bottom-right of map container */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        width: 38, height: 38, pointerEvents: 'none',
      }}>
        <svg width={38} height={38} viewBox="-19 -19 38 38">
          <circle r={16} fill="rgba(255,255,255,0.88)" stroke="#b8c8d8" strokeWidth={1} />
          <path d="M 0,-13 L 3.5,-6 L 0,-8 L -3.5,-6 Z" fill="#1d4ed8" />
          <path d="M 0,13 L 3.5,6 L 0,8 L -3.5,6 Z" fill="#94a3b8" />
          <path d="M -13,0 L -6,3.5 L -8,0 L -6,-3.5 Z" fill="#94a3b8" />
          <path d="M 13,0 L 6,3.5 L 8,0 L 6,-3.5 Z" fill="#94a3b8" />
          <text y={-17} textAnchor="middle" fontSize={7} fontWeight={800} fill="#1d4ed8">N</text>
        </svg>
      </div>

      {/* Hover Tooltip */}
      {hoveredWH && hoveredGeo && (
        <div style={{
          position: 'absolute',
          left: (() => {
            const cw = containerRef.current?.offsetWidth ?? 860;
            return mousePos.x + 40 + 230 < cw ? mousePos.x + 40 : mousePos.x - 250;
          })(),
          top: Math.max(mousePos.y - 140, 52),
          background: 'rgba(8,14,28,0.93)',
          border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: 11,
          padding: '13px 17px',
          pointerEvents: 'none',
          zIndex: 200,
          minWidth: 210,
          backdropFilter: 'blur(14px)',
          boxShadow: '0 10px 36px rgba(0,0,0,0.40)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_PIN[hoveredWH.status].fill, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{hoveredWH.name}</span>
            <span style={{ fontSize: 8, fontWeight: 800, color: STATUS_PIN[hoveredWH.status].fill, marginLeft: 'auto',
              background: `${STATUS_PIN[hoveredWH.status].fill}20`, borderRadius: 4, padding: '2px 7px' }}>
              {STATUS_CFG[hoveredWH.status].label}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 11 }}>
            {hoveredGeo.city}, {hoveredGeo.state}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 18px' }}>
            {([
              ['Size',   `${(hoveredWH.sqft / 1000).toFixed(0)}K sq ft`],
              ['Docks',  `${hoveredWH.docks} bays`],
              ...(hoveredWH.status === 'live'
                ? [['Throughput', `${hoveredWH.throughput.toLocaleString()} /hr`], ['Utilisation', `${hoveredWH.utilisation}%`]]
                : [['Est. Go-Live', hoveredWH.status === 'building' ? 'Q3 2026' : '—'], ['Capacity', `${(hoveredWH.sqft/1000).toFixed(0)}K sq ft`]]),
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 8, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 9, color: '#475569' }}>
            Click to open inspection panel →
          </div>
        </div>
      )}
    </div>
  );
}

// ── Volume Transfer helpers ───────────────────────────────────────────────────
interface TransferOutput {
  srcNewThroughput: number;
  srcNewUtil: number;
  tgtNewThroughput: number;
  tgtNewUtil: number;
  netThroughput: number;
  netCostPerCase: number;
  netFillRate: number;
}

function computeTransfer(src: WarehouseNode, tgt: WarehouseNode, pct: number): TransferOutput {
  const vol = src.throughput * (pct / 100);
  const srcNewThroughput = src.throughput - vol;
  const srcNewUtil = src.utilisation * (1 - pct / 100);
  const tgtMaxCap = (tgt.sqft / 320000) * (1847 / 0.78);
  const tgtNewThroughput = Math.min(vol, tgtMaxCap * 0.90);
  const tgtNewUtil = (tgtNewThroughput / tgtMaxCap) * 100;
  const netThroughput = srcNewThroughput + tgtNewThroughput;
  const utilizationSaving = (src.utilisation - srcNewUtil) * 0.004;
  const newSitePremium = tgt.status !== 'live' ? 0.09 * (tgtNewThroughput / netThroughput) : 0;
  const netCostPerCase = Math.max(src.costPerCase - utilizationSaving + newSitePremium, 0.80);
  const fillRate = Math.min(91 + (src.utilisation - srcNewUtil) * 0.15, 99);
  return {
    srcNewThroughput: Math.round(srcNewThroughput),
    srcNewUtil: Math.round(srcNewUtil * 10) / 10,
    tgtNewThroughput: Math.round(tgtNewThroughput),
    tgtNewUtil: Math.round(tgtNewUtil * 10) / 10,
    netThroughput: Math.round(netThroughput),
    netCostPerCase: Math.round(netCostPerCase * 100) / 100,
    netFillRate: Math.round(fillRate * 10) / 10,
  };
}

// ── Warehouse Side Panel ──────────────────────────────────────────────────────
const PANEL_SCENARIOS: Array<{
  id: string;
  label: string;
  desc: string;
  color: string;
  icon: typeof Activity;
}> = [
  { id: 'austin-outage',  label: 'Simulate Site Outage',   desc: 'Full offline event — equipment or weather',    color: '#dc2626', icon: AlertTriangle },
  { id: 'chicago-golive', label: 'Early WH-2 Go-Live',     desc: 'Bring WH-2 online at 60% to absorb volume',   color: '#16a34a', icon: Zap },
  { id: 'demand-surge',   label: 'Demand Surge +40%',      desc: 'Peak season spike across the network',        color: '#d97706', icon: TrendingUp },
];

function WHSidePanel({
  wh,
  onClose,
  onLaunchWarehouse,
  onRunScenario,
  activeScenarioId,
}: {
  wh: WarehouseNode;
  onClose: () => void;
  onLaunchWarehouse: () => void;
  onRunScenario: (id: string) => void;
  activeScenarioId: string | null;
}) {
  const geo  = WH_GEO[wh.id];
  const scfg = STATUS_CFG[wh.status];
  const isLive = wh.status === 'live';

  const otherWHs = WAREHOUSES.filter(w => w.id !== wh.id);
  const [tferTgtId, setTferTgtId] = useState<string>(otherWHs[0]?.id ?? '');
  const [tferPct, setTferPct] = useState<number>(30);
  const [tferResult, setTferResult] = useState<TransferOutput | null>(null);
  const [tferRunning, setTferRunning] = useState(false);

  function runTransfer() {
    const tgt = WAREHOUSES.find(w => w.id === tferTgtId);
    if (!tgt || !isLive) return;
    setTferResult(null);
    setTferRunning(true);
    setTimeout(() => {
      setTferResult(computeTransfer(wh, tgt, tferPct));
      setTferRunning(false);
    }, 900);
  }

  const kpis = isLive
    ? [
        { label: 'Throughput',   value: `${wh.throughput.toLocaleString()}`, unit: 'cases/hr' },
        { label: 'Utilisation',  value: `${wh.utilisation}%`,                unit: ''         },
        { label: 'Active Docks', value: `${wh.docks}`,                       unit: 'docks'    },
        { label: 'Floor Space',  value: `${(wh.sqft / 1000).toFixed(0)}K`,   unit: 'sq ft'    },
        { label: 'Cost/Case',    value: `$${wh.costPerCase.toFixed(2)}`,      unit: '/case'    },
        { label: 'Open Alerts',  value: `${wh.alerts}`,                       unit: 'alerts'   },
      ]
    : [
        { label: 'Floor Space',  value: `${(wh.sqft / 1000).toFixed(0)}K`,   unit: 'sq ft'    },
        { label: 'Planned Docks',value: `${wh.docks}`,                        unit: 'docks'    },
        { label: 'Status',       value: scfg.label,                            unit: ''         },
        { label: 'Throughput',   value: '—',                                   unit: ''         },
        { label: 'Cost/Case',    value: '—',                                   unit: ''         },
        { label: 'Open Alerts',  value: `${wh.alerts}`,                        unit: 'alerts'   },
      ];

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 360, zIndex: 200,
      display: 'flex', flexDirection: 'column',
      background: CARD, borderLeft: `1px solid ${BORDER}`,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
      animation: 'slideInRight 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
              color: scfg.color, background: scfg.bg,
              border: `1px solid ${scfg.dot}44`,
              borderRadius: 4, padding: '2px 6px',
            }}>{scfg.label}</span>
            {wh.alerts > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800,
                background: '#fef2f2', color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: 4, padding: '2px 6px',
              }}>{wh.alerts} ALERT{wh.alerts > 1 ? 'S' : ''}</span>
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T1, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {wh.name}
          </div>
          {geo && (
            <div style={{ fontSize: 11, color: T3, marginTop: 3, fontWeight: 500 }}>
              {geo.city}, {geo.state}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: `1px solid ${BORDER}`,
          borderRadius: 6, width: 28, height: 28, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T3, flexShrink: 0, fontSize: 14,
        }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Open Warehouse button — only for the real simulation warehouse */}
        {isLive && wh.isReal && (
          <button onClick={onLaunchWarehouse} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 700,
            boxShadow: '0 2px 8px rgba(29,78,216,0.35)',
            marginBottom: 20,
          }}>
            <Play size={11} fill="#fff" />
            Open Warehouse
          </button>
        )}

        {/* Under Construction banner for newly-created building warehouses */}
        {wh.status === 'building' && (
          <div style={{
            background: '#fffbeb', border: '1.5px solid #fde68a',
            borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🔨</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Under Construction</span>
            </div>
            <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.55 }}>
              Digital twin has been provisioned and site registration is complete. Physical construction and systems integration are in progress.
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: 'Site Registration',     done: true  },
                { label: 'Digital Twin Created',   done: true  },
                { label: 'Systems Integration',    done: false },
                { label: 'Physical Build-out',     done: false },
                { label: 'Go-Live Certification',  done: false },
              ].map(({ label, done }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 11, color: done ? GREEN : '#d97706' }}>{done ? '✓' : '○'}</span>
                  <span style={{ fontSize: 10, color: done ? T2 : '#92400e', fontWeight: done ? 600 : 400 }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #fde68a', fontSize: 10, color: '#92400e', fontWeight: 600 }}>
              Est. go-live: 14–22 weeks from today
            </div>
          </div>
        )}

        {/* Offline / Shutdown banner */}
        {wh.status === 'offline' && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca',
            borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>⛔</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>Site Offline — Shutdown</span>
            </div>
            <div style={{ fontSize: 11, color: '#7f1d1d', lineHeight: 1.55 }}>
              This facility is currently shut down. Operations have been suspended. Assets are in maintenance hold and the site is not processing any orders.
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#dc2626', fontWeight: 600 }}>
              Reactivation requires network review approval.
            </div>
          </div>
        )}

        {/* KPIs */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Site Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {kpis.map(({ label, value, unit }) => (
              <div key={label} style={{
                background: PAGE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: T1, letterSpacing: '-0.02em' }}>{value}</span>
                  {unit && <span style={{ fontSize: 9, color: T3, fontWeight: 500 }}>{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scenario quick-run */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Scenario Simulation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PANEL_SCENARIOS.map(sc => {
              const Icon = sc.icon;
              const isActive = activeScenarioId === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => onRunScenario(sc.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', borderRadius: 9, cursor: 'pointer',
                    background: isActive ? `${sc.color}0d` : PAGE,
                    border: `1.5px solid ${isActive ? sc.color + '55' : BORDER}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                    background: `${sc.color}14`, border: `1px solid ${sc.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={13} color={sc.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? sc.color : T1, lineHeight: 1.2 }}>
                      {sc.label}
                    </div>
                    <div style={{ fontSize: 9, color: T3, marginTop: 2, lineHeight: 1.4 }}>
                      {sc.desc}
                    </div>
                  </div>
                  <ChevronRight size={12} color={isActive ? sc.color : T3} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume Transfer Simulation */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Volume Transfer Simulator
          </div>

          {!isLive ? (
            <div style={{ fontSize: 11, color: T3, padding: '10px 12px', background: PAGE, borderRadius: 8, border: `1px solid ${BORDER}` }}>
              Only available for live warehouses.
            </div>
          ) : (
            <>
              {/* Source label */}
              <div style={{ fontSize: 10, color: T3, marginBottom: 8 }}>
                From: <strong style={{ color: T1 }}>{wh.name} ({geo?.city})</strong>
              </div>

              {/* Target select */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>
                  To Warehouse
                </label>
                <select
                  value={tferTgtId}
                  onChange={e => { setTferTgtId(e.target.value); setTferResult(null); }}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 7,
                    border: `1px solid ${BORDER}`, background: PAGE, color: T1,
                    fontSize: 12, fontWeight: 600, outline: 'none',
                  }}
                >
                  {otherWHs.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} · {WH_GEO[w.id]?.city} [{STATUS_CFG[w.status].label}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Percentage slider */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Transfer Volume</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <NumInput value={tferPct} min={5} max={80} step={1} width={46}
                      onChange={v => { setTferPct(v); setTferResult(null); }} />
                    <span style={{ fontSize: 10, color: T3 }}>%</span>
                  </div>
                </div>
                <input
                  type="range" min={5} max={80} step={5} value={tferPct}
                  onChange={e => { setTferPct(Number(e.target.value)); setTferResult(null); }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T3 }}>
                  <span>5%</span><span>80%</span>
                </div>
              </div>

              {/* Run button */}
              <button
                onClick={runTransfer}
                disabled={tferRunning}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
                  background: tferRunning ? '#94a3b8' : '#1d4ed8', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: tferRunning ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'background 0.15s',
                }}
              >
                {tferRunning ? (
                  <>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                    Running…
                  </>
                ) : (
                  <><Play size={10} fill="#fff" /> Run Simulation</>
                )}
              </button>

              {/* Results */}
              {tferResult && (() => {
                const tgt = WAREHOUSES.find(w => w.id === tferTgtId)!;
                const tgtGeo = WH_GEO[tferTgtId];
                return (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Projected Impact · {tferPct}% transferred
                    </div>

                    {/* Source row */}
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', marginBottom: 6 }}>
                        {wh.name} (Source)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          { label: 'Throughput', before: `${wh.throughput.toLocaleString()}`, after: `${tferResult.srcNewThroughput.toLocaleString()}/hr` },
                          { label: 'Utilisation', before: `${wh.utilisation}%`, after: `${tferResult.srcNewUtil}%` },
                        ].map(({ label, before, after }) => (
                          <div key={label}>
                            <div style={{ fontSize: 8, color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 9, color: '#64748b', textDecoration: 'line-through' }}>{before}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{after}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Target row */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 6 }}>
                        {tgt.name} · {tgtGeo?.city} (Target)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                          <div style={{ fontSize: 8, color: '#166534', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Throughput</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{tferResult.tgtNewThroughput.toLocaleString()}/hr</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: '#166534', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Utilisation</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{tferResult.tgtNewUtil}%</div>
                        </div>
                      </div>
                      {tgt.status !== 'live' && (
                        <div style={{ fontSize: 9, color: '#d97706', fontWeight: 600, marginTop: 4 }}>⚠ Requires early activation</div>
                      )}
                    </div>

                    {/* Network summary */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 6 }}>
                        Network Impact
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        <div>
                          <div style={{ fontSize: 8, color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Throughput</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{tferResult.netThroughput.toLocaleString()}/hr</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Cost/Case</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>${tferResult.netCostPerCase.toFixed(2)}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: tferResult.netCostPerCase < wh.costPerCase ? GREEN : RED }}>
                            {tferResult.netCostPerCase < wh.costPerCase ? '↓' : '↑'} ${Math.abs(tferResult.netCostPerCase - wh.costPerCase).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Fill Rate</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{tferResult.netFillRate}%</div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: GREEN }}>↑ +{(tferResult.netFillRate - 91).toFixed(1)}pp</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: `1px solid ${BORDER}`,
        fontSize: 10, color: T3, textAlign: 'center',
      }}>
        Click a scenario or run a transfer simulation
      </div>
    </div>
  );
}

function NetworkTwinPage({ onLaunchWarehouse }: { onLaunchWarehouse: () => void }) {
  const [activeScenario, setActiveScenario]   = useState<string | null>(null);
  const [running, setRunning]                 = useState(false);
  const [showBuildModal, setShowBuildModal]   = useState(false);
  const [newSite, setNewSite]                 = useState<{ name: string; city: string } | null>(null);
  const [selectedWH, setSelectedWH]           = useState<string | null>(null);
  const [dynamicWHs, setDynamicWHs]           = useState<WarehouseNode[]>([]);
  const dynamicIdRef                          = useRef(5);

  function handleCreated(name: string, cityEntry: { label: string; city: string; state: string; lon: number; lat: number }) {
    const id = `wh-dyn-${dynamicIdRef.current++}`;
    // Register geo so the map can render the pin
    WH_GEO[id] = { lon: cityEntry.lon, lat: cityEntry.lat, city: cityEntry.city, state: cityEntry.state };
    const newWH: WarehouseNode = {
      id,
      name,
      location: cityEntry.label,
      status: 'building',
      sqft: 280000,
      docks: 22,
      throughput: 0,
      utilisation: 0,
      alerts: 0,
      costPerCase: 0,
      isReal: false,
    };
    setDynamicWHs(prev => [...prev, newWH]);
    setShowBuildModal(false);
    setNewSite({ name, city: cityEntry.label });
    // Auto-select the new warehouse on the map
    setSelectedWH(id);
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
  const allWarehouses  = [...WAREHOUSES, ...dynamicWHs];
  const selectedWHData = selectedWH ? allWarehouses.find(w => w.id === selectedWH) ?? null : null;

  function handlePanelScenario(id: string) {
    if (activeScenario === id) {
      setActiveScenario(null);
    } else {
      runScenario(id);
    }
  }

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
            3 sites live
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

      {/* Scenario-active banner */}
      {scenarioResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '9px 28px', flexShrink: 0,
          background: `${scenarioResult.tagColor}0e`,
          borderBottom: `1.5px solid ${scenarioResult.tagColor}44`,
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: scenarioResult.tagColor,
            boxShadow: `0 0 0 3px ${scenarioResult.tagColor}33`,
            animation: 'spin 2s linear infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: scenarioResult.tagColor }}>
            SIMULATION ACTIVE
          </span>
          <span style={{ fontSize: 11, color: scenarioResult.tagColor, opacity: 0.8 }}>
            · {scenarioResult.title}
          </span>
          <span style={{ fontSize: 10, color: scenarioResult.tagColor, opacity: 0.6, marginLeft: 4 }}>
            — Projected KPIs shown below. No live data is affected.
          </span>
          <button
            onClick={() => setActiveScenario(null)}
            style={{
              marginLeft: 'auto', background: 'none', cursor: 'pointer',
              border: `1px solid ${scenarioResult.tagColor}44`,
              borderRadius: 6, padding: '3px 10px',
              fontSize: 10, fontWeight: 700, color: scenarioResult.tagColor,
            }}
          >
            Clear Simulation
          </button>
        </div>
      )}

      {/* Network KPI bar */}
      <NetworkKPIBar activeScenario={scenarioResult ?? undefined} />

      {/* Main content */}
      <div style={{ flex: 1, padding: '28px 28px', overflow: 'auto' }}>
        {/* Midwest map */}
        <MidwestMapView
          warehouses={allWarehouses}
          selected={selectedWH}
          onSelect={setSelectedWH}
          activeScenarioId={activeScenario}
        />

        {/* Fleet + Network panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>

          {/* ── Fleet Operations ── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', boxShadow: CARDSH, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={14} color="#1d4ed8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>Fleet Operations</span>
              <span style={{ fontSize: 10, color: T3, marginLeft: 4 }}>across all sites</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 7px' }}>LIVE</span>
            </div>

            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {[
                { label: 'Active',    value: '42',  sub: 'trucks',  color: '#1d4ed8' },
                { label: 'In Transit',value: '26',  sub: 'en route',color: '#0891b2' },
                { label: 'At Dock',   value: '16',  sub: 'loading', color: '#7c3aed' },
                { label: 'Avg ETA',   value: '19m', sub: 'delivery',color: T1 },
                { label: 'On-Time',   value: '94%', sub: 'rate',    color: GREEN },
                { label: 'Delayed',   value: '3',   sub: 'trucks',  color: RED },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ textAlign: 'center', background: PAGE, borderRadius: 8, padding: '10px 4px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
                  <div style={{ fontSize: 8, color: T3, marginTop: 1 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Site allocation */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Truck Allocation by Site</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { city: 'Cincinnati, OH',     active: 18, docked: 6,  transit: 12, color: '#1d4ed8' },
                  { city: 'Chicago, IL',      active: 16, docked: 7,  transit: 9,  color: '#0891b2' },
                  { city: 'Indianapolis, IN', active: 8,  docked: 3,  transit: 5,  color: '#7c3aed' },
                ].map(({ city, active, docked, transit, color }) => (
                  <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: T2, fontWeight: 600, minWidth: 140 }}>{city}</span>
                    <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ width: `${(active / 42) * 100}%`, height: '100%', background: color, borderRadius: 3, opacity: 0.85 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 20, textAlign: 'right' }}>{active}</span>
                    <span style={{ fontSize: 9, color: T3 }}>{docked} docked · {transit} moving</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance metrics */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Performance</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Avg Dock Time', value: '42 min' },
                  { label: 'Miles Today',   value: '12,480' },
                  { label: 'Fuel Eff.',     value: '7.2 MPG' },
                  { label: 'Loads Today',   value: '164' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: PAGE, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T1 }}>{value}</div>
                    <div style={{ fontSize: 8, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent events */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Recent Events</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { dot: '#16a34a', msg: 'T-042 docked at Cincinnati DC',    time: '3m ago' },
                  { dot: '#0891b2', msg: 'T-017 departed Indianapolis DC',  time: '11m ago' },
                  { dot: '#f59e0b', msg: 'T-038 ETA revised — Chicago DC',  time: '18m ago' },
                  { dot: '#dc2626', msg: 'T-011 delayed — I-90 congestion', time: '24m ago' },
                ].map(({ dot, msg, time }) => (
                  <div key={msg} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: T2, flex: 1 }}>{msg}</span>
                    <span style={{ fontSize: 9, color: T3, whiteSpace: 'nowrap' }}>{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Network Health ── */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', boxShadow: CARDSH, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} color="#1d4ed8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>Network Health</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#0891b2', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4, padding: '2px 7px' }}>3 SITES MONITORED</span>
            </div>

            {/* Throughput by site */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Throughput vs Capacity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { city: 'Cincinnati OH',     cur: 1847, max: 2400, color: '#1d4ed8' },
                  { city: 'Chicago IL',      cur: 2240, max: 2800, color: '#0891b2' },
                  { city: 'Indianapolis IN', cur: 1580, max: 2200, color: '#7c3aed' },
                  { city: 'Milwaukee WI',    cur: 0,    max: 1600, color: '#dc2626', offline: true },
                ].map(({ city, cur, max, color, offline }) => (
                  <div key={city}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                        <span style={{ fontSize: 11, color: T2, fontWeight: 500 }}>{city}</span>
                        {offline && <span style={{ fontSize: 8, fontWeight: 800, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 3, padding: '1px 5px' }}>OFFLINE</span>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: offline ? '#dc2626' : color }}>
                        {offline ? 'Shutdown' : `${cur.toLocaleString()} / ${max.toLocaleString()} /hr`}
                      </span>
                    </div>
                    <div style={{ height: 5, background: BORDER, borderRadius: 3 }}>
                      <div style={{ width: `${(cur / max) * 100}%`, height: '100%', background: offline ? '#fca5a5' : color, borderRadius: 3, opacity: 0.85 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key metrics bars */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Key Metrics (Active Sites)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { label: 'Order Fill Rate',      pct: 93, color: GREEN,    note: '↑ +2pp WoW' },
                  { label: 'Dock Utilisation',     pct: 82, color: '#0891b2',note: '3 sites avg' },
                  { label: 'Inventory Accuracy',   pct: 98, color: '#1d4ed8', note: 'cycle count' },
                  { label: 'Labor Efficiency',     pct: 87, color: '#7c3aed',note: 'vs standard' },
                  { label: 'Inbound On-Time',      pct: 91, color: '#f59e0b',note: 'last 48hrs' },
                ].map(({ label, pct, color, note }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: T2, fontWeight: 500 }}>{label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: T3 }}>{note}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: BORDER, borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alert summary */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Open Alerts by Site</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { city: 'Chicago DC',      total: 5, critical: 2, color: '#0891b2' },
                  { city: 'Cincinnati DC',     total: 3, critical: 1, color: '#1d4ed8' },
                  { city: 'Indianapolis DC', total: 1, critical: 0, color: '#7c3aed' },
                  { city: 'Milwaukee DC',    total: 2, critical: 0, color: '#dc2626', note: 'maintenance' },
                ].map(({ city, total, critical, color, note }) => (
                  <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: T2, fontWeight: 600, flex: 1 }}>{city}</span>
                    <span style={{ fontSize: 9, color: T3 }}>{note ?? `${critical} critical`}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 800,
                      color: critical > 0 ? RED : T3,
                      background: critical > 0 ? '#fef2f2' : PAGE,
                      border: `1px solid ${critical > 0 ? '#fecaca' : BORDER}`,
                      borderRadius: 4, padding: '1px 7px',
                    }}>{total} open</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Keyframes + global slider styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scenarioPulse {
          0%, 100% { opacity: 0.22; r: 22; }
          50%       { opacity: 0.55; r: 30; }
        }
        @keyframes scenarioPulse2 {
          0%, 100% { opacity: 0.10; r: 34; }
          50%       { opacity: 0.30; r: 44; }
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 5px;
          border-radius: 3px;
          background: #e2e8f0;
          outline: none;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 5px;
          border-radius: 3px;
          background: #e2e8f0;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1d4ed8;
          cursor: pointer;
          margin-top: -5.5px;
          box-shadow: 0 1px 4px rgba(29,78,216,0.35);
        }
        input[type="range"]::-moz-range-track {
          height: 5px;
          border-radius: 3px;
          background: #e2e8f0;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1d4ed8;
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 4px rgba(29,78,216,0.35);
        }
      `}</style>

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
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={18} color={GREEN} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{newSite.name} — Under Construction</div>
            <div style={{ fontSize: 11, color: T2, marginTop: 1 }}>
              📍 {newSite.city} · Site registered in network · Digital twin provisioning…
            </div>
            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginTop: 3 }}>
              🔨 Building phase started · Pin visible on map · Est. go-live: 14–22 weeks
            </div>
          </div>
          <button onClick={() => setNewSite(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T3, fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Build twin modal */}
      {showBuildModal && (
        <BuildTwinModal
          onClose={() => setShowBuildModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Warehouse side panel */}
      {selectedWHData && (
        <WHSidePanel
          wh={selectedWHData}
          onClose={() => setSelectedWH(null)}
          onLaunchWarehouse={onLaunchWarehouse}
          onRunScenario={handlePanelScenario}
          activeScenarioId={activeScenario}
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
  const [dockPhase, setDockPhase]       = useState<'baseline' | 'optimised'>('baseline');
  const [loadMode,  setLoadMode]        = useState<'baseline' | 'optimised'>('baseline');
  const { improvementScenario }         = useSimulationStore();

  const effectiveSubView: SubView = (subView === 'kpi-impact' && !improvementScenario) ? 'overview' : subView;
  const effectiveAdSubView: ADSubView =
    (adSubView === 'kpi-impact' && dockPhase !== 'optimised') ? 'simulation' :
    (adSubView === 'load-kpi'   && loadMode  !== 'optimised') ? 'simulation' :
    adSubView;

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
        adSubView={effectiveAdSubView} setAdSubView={setAdSubView}
        dockPhase={dockPhase}
        loadMode={loadMode}
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
        <AutonomousDockView adSubView={effectiveAdSubView} setAdSubView={setAdSubView} dockPhase={dockPhase} setDockPhase={setDockPhase} loadMode={loadMode} setLoadMode={setLoadMode} />
      )}
    </div>
  );
}
