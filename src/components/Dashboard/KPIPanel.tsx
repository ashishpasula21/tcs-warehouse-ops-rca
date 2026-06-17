import { useMemo } from 'react';
import { SHIFT_DATA } from '../../data/mockTelemetry';
import { useSimulationStore } from '../../store/simulationStore';
import { TrendingUp, TrendingDown, Minus, Forklift, Package, AlertTriangle } from 'lucide-react';

function computeKPIs(currentMs: number, scenario: string | null) {
  const progress = currentMs / SHIFT_DATA.shiftDuration;
  const hoursElapsed = (currentMs / 3600000);

  const baseCases = Math.floor(SHIFT_DATA.totalCasesPicked * progress);
  const scenarioBonus = scenario ? { improve_op2: 0.12, aisle1_traffic: 0.08, slotting_opt: 0.10, best_practice_share: 0.18 }[scenario] ?? 0 : 0;
  const totalCases = Math.floor(baseCases * (1 + scenarioBonus));
  const casePickRate = hoursElapsed > 0 ? totalCases / hoursElapsed : 0;

  // Operator utilization: weighted by efficiency
  const opUtil = SHIFT_DATA.operators.reduce((sum, op) => sum + op.efficiency, 0) / SHIFT_DATA.operators.length;
  const adjOpUtil = Math.min(1, opUtil * (1 + scenarioBonus * 0.5));

  // Forklift utilization: James Chen pulls it down
  const forklifts = SHIFT_DATA.equipment.filter(e => e.type === 'FORKLIFT');
  const baseFlUtil = 0.71;
  const adjFlUtil = Math.min(0.95, baseFlUtil + scenarioBonus * 0.6);

  const pjUtil = Math.min(0.95, 0.79 + scenarioBonus * 0.4);

  return {
    casePickRate: Math.round(casePickRate),
    forkliftUtilization: adjFlUtil,
    operatorUtilization: adjOpUtil,
    palletJackUtilization: pjUtil,
    totalCases,
    palletsMoved: Math.floor(68 * progress),
    congestionScore: scenario === 'aisle1_traffic' ? 24 : 67,
    activeEquipment: forklifts.length + 2,
  };
}

function KPICard({
  label,
  value,
  unit,
  trend,
  icon: Icon,
  color,
  target,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  color: string;
  target?: string;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="rounded-xl p-3 border flex flex-col gap-1" style={{ background: '#111c30', borderColor: '#243550' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
        <Icon size={14} className="opacity-60" color={color} />
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold tracking-tight" style={{ color, textShadow: `0 0 12px ${color}60` }}>{value}</span>
        {unit && <span className="text-xs text-slate-400 mb-1.5 font-medium">{unit}</span>}
      </div>
      <div className="flex items-center justify-between">
        {target && <span className="text-xs text-slate-500">Target: {target}</span>}
        {trend && <TrendIcon size={12} className={trendColor} />}
      </div>
    </div>
  );
}

function UtilizationBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  const isLow = pct < 75;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span style={{ color: isLow ? '#ef4444' : color }} className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: '#1a2d48' }}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: isLow ? '#ef4444' : color, boxShadow: `0 0 6px ${isLow ? '#ef4444' : color}80` }}
        />
      </div>
    </div>
  );
}

export function KPIPanel() {
  const { currentTime, improvementScenario } = useSimulationStore();
  const kpis = useMemo(() => computeKPIs(currentTime, improvementScenario), [currentTime, improvementScenario]);

  const hoursElapsed = currentTime / 3600000;
  const shiftProgress = currentTime / SHIFT_DATA.shiftDuration;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3">
      {/* Shift header */}
      <div className="rounded-xl p-3 border" style={{ background: '#111c30', borderColor: '#243550' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Day Shift</div>
            <div className="text-sm font-bold text-white">Jun 15, 2026 · 06:00–14:00</div>
          </div>
          <div className="text-xs px-2 py-1 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
            {hoursElapsed < 8 ? 'REPLAY' : 'COMPLETE'}
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Progress</span>
          <span>{hoursElapsed.toFixed(1)}h / 8h</span>
        </div>
        <div className="h-2 rounded-full" style={{ background: '#1a2d48' }}>
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${shiftProgress * 100}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
          />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="Case Pick Rate"
          value={kpis.casePickRate}
          unit="cases/hr"
          icon={Package}
          color="#10b981"
          target="280/hr"
          trend={kpis.casePickRate >= 250 ? 'up' : 'down'}
        />
        <KPICard
          label="Cases Picked"
          value={kpis.totalCases.toLocaleString()}
          icon={Package}
          color="#3b82f6"
          target="1,900"
          trend={kpis.totalCases > 1000 ? 'up' : 'neutral'}
        />
        <KPICard
          label="Pallets Received"
          value={kpis.palletsMoved}
          icon={Forklift}
          color="#f59e0b"
          target="68"
          trend="up"
        />
        <KPICard
          label="Congestion Score"
          value={kpis.congestionScore}
          unit="/100"
          icon={AlertTriangle}
          color={kpis.congestionScore > 50 ? '#ef4444' : '#10b981'}
          target="<30"
          trend={kpis.congestionScore > 50 ? 'down' : 'up'}
        />
      </div>

      {/* Utilization bars */}
      <div className="rounded-xl p-3 border flex flex-col gap-2.5" style={{ background: '#111c30', borderColor: '#243550' }}>
        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Utilization</div>
        <UtilizationBar label="Forklift Fleet" value={kpis.forkliftUtilization} color="#10b981" />
        <UtilizationBar label="Operators" value={kpis.operatorUtilization} color="#3b82f6" />
        <UtilizationBar label="Pallet Jacks" value={kpis.palletJackUtilization} color="#8b5cf6" />
      </div>

      {/* Operator list */}
      <div className="rounded-xl p-3 border" style={{ background: '#111c30', borderColor: '#243550' }}>
        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Operator Status</div>
        <div className="flex flex-col gap-1.5">
          {SHIFT_DATA.operators.map(op => {
            const pct = Math.round(op.efficiency * 100);
            const isLow = pct < 75;
            return (
              <div key={op.id} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: op.color }} />
                <span className="text-xs text-slate-300 flex-1 truncate">{op.name}</span>
                <div className="w-16 h-1.5 rounded-full" style={{ background: '#1a2d48' }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: isLow ? '#ef4444' : op.color }} />
                </div>
                <span className={`text-xs font-semibold w-8 text-right ${isLow ? 'text-red-400' : 'text-slate-300'}`}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
