import { AlertTriangle, AlertCircle, Info, TrendingUp, Zap, X, ArrowRight } from 'lucide-react';
import { AI_RECOMMENDATIONS, SCENARIO_IMPACTS, SCENARIO_LABELS } from '../../data/aiRecommendations';
import { useSimulationStore } from '../../store/simulationStore';
import type { AIRecommendation } from '../../types';

const CARD   = '#ffffff';
const PAGE   = '#f4f6f9';
const BORDER = '#e2e8f0';
const T1     = '#111827';
const T2     = '#6b7280';
const T3     = '#9ca3af';

const SEV = {
  critical: { Icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'CRITICAL' },
  warning:  { Icon: AlertCircle,   color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'WARNING'  },
  info:     { Icon: Info,          color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', label: 'INSIGHT'  },
};

interface AIRecProps {
  onRunImproved?: (scenario: string) => void;
}

function RecCard({ rec, onRunImproved }: { rec: AIRecommendation; onRunImproved?: (s: string) => void }) {
  const { setImprovementScenario, improvementScenario } = useSimulationStore();
  const cfg     = SEV[rec.severity];
  const { Icon } = cfg;
  const active  = improvementScenario === rec.simulationKey;
  const impact  = SCENARIO_IMPACTS[rec.simulationKey];

  const handleRun = () => {
    setImprovementScenario(rec.simulationKey);
    onRunImproved?.(rec.simulationKey);
  };

  return (
    <div style={{
      background: active ? '#f0fdf4' : CARD,
      border: `1.5px solid ${active ? '#86efac' : BORDER}`,
      borderRadius: 14,
      boxShadow: active ? '0 0 0 3px #bbf7d044' : '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: cfg.color, flexShrink: 0 }} />

      <div style={{ padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={17} color={cfg.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 8px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
              <span style={{ fontSize: 10, color: T3, background: PAGE, border: `1px solid ${BORDER}`, borderRadius: 99, padding: '2px 8px' }}>{rec.category}</span>
              {active && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 99, padding: '2px 8px' }}>● SIMULATING</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1, lineHeight: 1.3 }}>{rec.title}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', flexShrink: 0 }}>+{rec.improvementPct}%</div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: T2, lineHeight: 1.65, margin: 0 }}>{rec.description}</p>

        {/* Current → Target */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: T3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Current State</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>{rec.currentMetric}</div>
          </div>
          <ArrowRight size={16} color={T3} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: T3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Target State</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{rec.targetMetric}</div>
          </div>
        </div>

        {/* Impact summary */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#f8fafc', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '11px 13px' }}>
          <TrendingUp size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: T2, lineHeight: 1.55 }}>{rec.estimatedImpact}</span>
        </div>

        {/* Projected lift metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { label: 'Cases / Shift', value: `+${impact.casesImprovement}` },
            { label: 'Utilization',   value: `+${impact.utilizationImprovement}%` },
            { label: 'Congestion ↓',  value: `-${impact.congestionReduction}%` },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center', background: PAGE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 8px' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: T3, marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Action */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={handleRun}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 0', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: active ? '#16a34a' : T1, color: '#fff', border: 'none',
              transition: 'background 0.15s',
            }}>
            <Zap size={13} />
            {active ? '● Live in Simulation' : 'Run Improved Simulation'}
          </button>
          {active && (
            <button onClick={() => setImprovementScenario(null)}
              style={{ padding: '11px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: PAGE, color: T2, border: `1px solid ${BORDER}` }}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AIRecommendations({ onRunImproved }: AIRecProps) {
  const { improvementScenario, setImprovementScenario } = useSimulationStore();

  const counts = {
    critical: AI_RECOMMENDATIONS.filter(r => r.severity === 'critical').length,
    warning:  AI_RECOMMENDATIONS.filter(r => r.severity === 'warning').length,
    info:     AI_RECOMMENDATIONS.filter(r => r.severity === 'info').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary header */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: T3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>AI Analysis · Jun 15, 2026</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Shift Intelligence Report</div>
          <div style={{ fontSize: 13, color: T2, marginTop: 4 }}>6 recommendations across operator, equipment, pathway, and process categories</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: `${counts.critical} Critical`,  bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
            { label: `${counts.warning} Warnings`,   bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
            { label: `${counts.info} Insight`,       bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
          ].map(b => (
            <span key={b.label} style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 99, background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
              {b.label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Max Cases Gain', value: '+410', color: '#16a34a' },
            { label: 'Avg Improvement', value: '+23%', color: '#16a34a' },
            { label: 'Issues Found', value: '6', color: '#dc2626' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T3, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active scenario banner */}
      {improvementScenario && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Zap size={14} color="#16a34a" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
              Improved Simulation Active: {SCENARIO_LABELS[improvementScenario]}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              Switch to the Simulation tab to see the improvement live in the 3D model.
            </div>
          </div>
          <button onClick={() => setImprovementScenario(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Card grid — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, alignItems: 'start' }}>
        {AI_RECOMMENDATIONS.map(rec => (
          <RecCard key={rec.id} rec={rec} onRunImproved={onRunImproved} />
        ))}
      </div>
    </div>
  );
}
