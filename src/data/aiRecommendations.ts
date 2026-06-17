import type { AIRecommendation } from '../types';

export const AI_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: 'rec-1',
    severity: 'critical',
    category: 'PATHWAY',
    title: 'FL-2 Cross-Zone Backtracking — 327 ft Wasted Per Cycle',
    description:
      'Forklift FL-2 (James Chen) follows a suboptimal multi-zone path: receiving dock → Zone C (far east, incorrect putaway zone) → full backtrack to Zone A (west) → pick lane east → idle in center. Each cycle covers 847 ft of travel versus the optimal 520 ft for a direct dock-to-Zone B route. The Zone C detour alone adds 327 ft of wasted forklift travel per cycle and 47 minutes of non-productive movement per shift.',
    affectedEntities: ['fl-2', 'STORAGE_C', 'STORAGE_A'],
    currentMetric: '847 ft/cycle — Zone C detour + Zone A backtrack',
    targetMetric: '520 ft/cycle — direct dock → Zone B → pick lane',
    estimatedImpact: '−327 ft × 32 cycles = −10,464 ft wasted travel/shift; +11 additional pallets moved',
    improvementPct: 34,
    simulationKey: 'improve_op2',
  },
  {
    id: 'rec-2',
    severity: 'critical',
    category: 'PATHWAY',
    title: 'FL-3 Pick Lane Conflict — Cross-Traffic Creates 14 Near-Misses/Shift',
    description:
      'Forklift FL-3 (Sarah Kim) runs a triangular shipping circuit that crosses the pick lane staging area east-to-west at ground level (z+26 corridor) while pick lane walkers travel north-south. This perpendicular traffic pattern creates 14 near-miss events per shift. Re-routing FL-3 to traverse east-west at the shipping dock level (z+40) eliminates all conflicts without adding meaningful travel distance.',
    affectedEntities: ['fl-3', 'PICK_LANE', 'STAGING'],
    currentMetric: '14 near-misses/shift, 4.1 min avg conflict delay',
    targetMetric: '0 near-misses — traverse at shipping level, not pick lane',
    estimatedImpact: '+18% throughput in shipping zone; safety risk fully eliminated',
    improvementPct: 18,
    simulationKey: 'aisle1_traffic',
  },
  {
    id: 'rec-3',
    severity: 'warning',
    category: 'PATHWAY',
    title: 'FL-1 Single-Zone Assignment — 34% Idle When Zone A Fills',
    description:
      'Forklift FL-1 (Mark Rivera) runs the most efficient forward-and-back route on the floor — straight from the receiving dock to Zone A and back. However, Zone A reaches capacity 40 minutes before Zone B on peak days. When Zone A fills, FL-1 has no secondary assignment and enters a holding pattern, logging 34% idle time while Zone B remains under-served. Expanding FL-1\'s route to cover Zone B when Zone A is at capacity eliminates this gap with zero additional equipment.',
    affectedEntities: ['fl-1', 'STORAGE_A', 'STORAGE_B'],
    currentMetric: '34% idle time — Zone A only (no backup assignment)',
    targetMetric: '<5% idle time — flexible Zone A + Zone B coverage',
    estimatedImpact: '+2.1 picks/hour for FL-1; Zone B backlog cleared 38 min earlier',
    improvementPct: 21,
    simulationKey: 'slotting_opt',
  },
  {
    id: 'rec-4',
    severity: 'warning',
    category: 'EQUIPMENT',
    title: 'Pallet Jack PJ-2 Running at 72% Efficiency — Battery Pattern',
    description:
      'PJ-2 shows recurring slow-down events at ~4-hour intervals consistent with battery sag before scheduled charge. Switching to opportunity charging at 30% battery threshold (vs current 15%) would maintain consistent speed throughout shift.',
    affectedEntities: ['pj-2', 'op-5'],
    currentMetric: '72% efficiency, 3 speed-sag events/shift',
    targetMetric: '88%+ efficiency, 0 speed-sag events',
    estimatedImpact: '+22 cases/shift for Priya Patel route',
    improvementPct: 16,
    simulationKey: 'battery_charging',
  },
  {
    id: 'rec-5',
    severity: 'warning',
    category: 'PROCESS',
    title: 'Receiving-to-Putaway Handoff Gap — 18 min Average Dwell',
    description:
      'Received pallets sit at Receiving dock for an average of 18.3 minutes before putaway begins. During peak receiving hours (06:00–08:00) this reaches 31 minutes. Assigning dedicated putaway forklift during first 2 hours would eliminate backlog.',
    affectedEntities: ['RECEIVING', 'PUTAWAY', 'fl-1'],
    currentMetric: '18.3 min avg dwell (31 min peak)',
    targetMetric: '<5 min dwell time',
    estimatedImpact: 'Unblocks 2.4 inbound trucks/shift, +8% dock utilization',
    improvementPct: 27,
    simulationKey: 'receiving_putaway',
  },
  {
    id: 'rec-6',
    severity: 'info',
    category: 'OPERATOR',
    title: 'Mark Rivera — Best Practice Patterns for Team Training',
    description:
      'Mark Rivera consistently maintains 91% efficiency: pre-planned path selection before each cycle, uses cross-aisle to minimize backtracking, and achieves 94% load density on each pallet. These behaviors account for 34% higher case throughput vs team average.',
    affectedEntities: ['op-1', 'fl-1'],
    currentMetric: '91% efficiency, 38 cycles/shift',
    targetMetric: 'Apply to all forklift operators',
    estimatedImpact: '+410 cases/shift if team matches Mark\'s pattern',
    improvementPct: 22,
    simulationKey: 'best_practice_share',
  },
];

export const SCENARIO_LABELS: Record<string, string> = {
  improve_op2: 'FL-2 Route Fix: Direct Zone-B Path',
  aisle1_traffic: 'FL-3 Route Fix: Shipping-Level Traverse',
  slotting_opt: 'FL-1 Expansion: Zone A + Zone B Coverage',
  battery_charging: 'Opportunity Charging Protocol',
  receiving_putaway: 'Dedicated Putaway Assignment',
  best_practice_share: 'Team Best-Practice Rollout',
};

export const SCENARIO_IMPACTS: Record<string, {
  casesImprovement: number;
  utilizationImprovement: number;
  congestionReduction: number;
  description: string;
}> = {
  improve_op2: {
    casesImprovement: 220,
    utilizationImprovement: 14,
    congestionReduction: 38,
    description: 'Eliminating the Zone C detour cuts FL-2\'s cycle distance by 38%, adding ~220 cases and reducing Zone C congestion.',
  },
  aisle1_traffic: {
    casesImprovement: 180,
    utilizationImprovement: 18,
    congestionReduction: 42,
    description: 'Re-routing FL-3\'s E-W traverse to shipping level eliminates 14 near-misses and frees the pick lane for walkers.',
  },
  slotting_opt: {
    casesImprovement: 195,
    utilizationImprovement: 12,
    congestionReduction: 25,
    description: 'Expanding FL-1 to serve Zone B eliminates the 34% idle window, adding +195 cases and closing the Zone B service gap.',
  },
  battery_charging: {
    casesImprovement: 88,
    utilizationImprovement: 8,
    congestionReduction: 5,
    description: 'Earlier opportunity charging keeps PJ-2 at full speed throughout shift.',
  },
  receiving_putaway: {
    casesImprovement: 140,
    utilizationImprovement: 22,
    congestionReduction: 15,
    description: 'Dedicated putaway forklift during peak receiving clears backlog before it cascades downstream.',
  },
  best_practice_share: {
    casesImprovement: 410,
    utilizationImprovement: 19,
    congestionReduction: 20,
    description: 'Rolling out Mark Rivera\'s path-planning and load-density practices to all operators is the highest-ROI intervention.',
  },
};
