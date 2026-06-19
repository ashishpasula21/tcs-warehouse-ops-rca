export interface ATAnomaly {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  zone: string;
  metric: string;
  baseline: string;
  impact: string;
  since: string;
  scenarioId: string; // which scenario fixes this
}

export interface ATScenario {
  id: string;
  category: 'MISSION' | 'SLOT' | 'CONVEYOR' | 'PALLETIZER';
  title: string;
  description: string;
  detail: string;
  kpiDelta: {
    throughput: number;       // cases/hr (positive = gain)
    retrievalTime: number;    // seconds (negative = faster)
    conveyorUtil: number;     // % (positive = gain)
    pallatizerUptime: number; // % (positive = gain)
    fillRate: number;         // % (positive = gain)
  };
  anomalyId: string;
  estimatedImpact: string;
}

export interface ATControlEvent {
  time: string;
  title: string;
  desc: string;
}

// ── Baseline KPIs ────────────────────────────────────────────────────────────
export const AT_BASELINE = {
  throughput:        284,  // cases/hr
  retrievalTime:      42,  // seconds
  conveyorUtil:       67,  // %
  pallatizerUptime:   81,  // %
  fillRate:           88,  // %
};

// ── Live anomaly feed ────────────────────────────────────────────────────────
export const AT_ANOMALIES: ATAnomaly[] = [
  {
    id: 'anom-slot',
    severity: 'critical',
    title: 'High-Velocity SKUs Slotted in Deep Storage',
    zone: 'ASRS — Bays 7–10, All Levels',
    metric: '42s avg retrieval',
    baseline: '28s target',
    impact: '−38 cases/hr vs potential throughput',
    since: '06:00',
    scenarioId: 'at-slotting',
  },
  {
    id: 'anom-conveyor',
    severity: 'critical',
    title: 'Conveyor Mid-Section Jam — Dwell Spike',
    zone: 'Conveyor Zone C (bays 5–8)',
    metric: '4.2s item dwell',
    baseline: '0.8s normal',
    impact: 'ASRS output queue backlog — 22% crane idle',
    since: '07:04',
    scenarioId: 'at-conveyor-fix',
  },
  {
    id: 'anom-mission',
    severity: 'warning',
    title: 'ASRS Mission Queue — No Aisle Proximity Batching',
    zone: 'All Aisles',
    metric: '34% wasted crane travel',
    baseline: 'Optimal: batch by bay proximity',
    impact: '−52 cases/hr vs optimized sequence',
    since: '06:00',
    scenarioId: 'at-mission-seq',
  },
  {
    id: 'anom-palletizer',
    severity: 'warning',
    title: 'Palletizer Arm Cycle Time Increasing',
    zone: 'Palletizer Station 1',
    metric: '8.4s per stack cycle',
    baseline: '5.1s specification',
    impact: '−12% palletizer throughput',
    since: '08:30',
    scenarioId: 'at-palletizer-cal',
  },
];

// ── AI improvement scenarios ─────────────────────────────────────────────────
export const AT_SCENARIOS: ATScenario[] = [
  {
    id: 'at-mission-seq',
    category: 'MISSION',
    title: 'ASRS Mission Resequencing — Batch by Bay Proximity',
    description: 'Current crane mission queue processes orders in arrival order regardless of bay position. Resequencing missions to batch nearby bays reduces crane horizontal travel by 34%.',
    detail: 'The WCS mission queue is a strict FIFO — it dispatches the next order regardless of where the crane currently sits. By inserting a proximity-aware batch scheduler, the system groups missions within 3-bay windows, eliminating unnecessary full-aisle traversals. At 284 cases/hr the crane currently travels an estimated 4.2km/hr of horizontal distance; batching reduces this to 2.8km/hr. Net gain: +52 cases/hr and retrieval time drops from 42s to 28s.',
    kpiDelta: { throughput: 52, retrievalTime: -14, conveyorUtil: 9, pallatizerUptime: 4, fillRate: 6 },
    anomalyId: 'anom-mission',
    estimatedImpact: '+52 cases/hr · retrieval 42s → 28s · fill rate 88% → 94%',
  },
  {
    id: 'at-slotting',
    category: 'SLOT',
    title: 'Dynamic Slot Re-Assignment — High-Velocity SKUs to Front Bays',
    description: 'Move the 14 highest-velocity SKUs from deep storage (bays 7–10) to front positions (bays 1–3). Reduces average crane travel to the top 20% of orders by 41%.',
    detail: 'Velocity analysis shows 14 SKUs account for 38% of all picks but are slotted in bays 7–10, forcing full-aisle traversals on every retrieval. Re-assigning these SKUs to bays 1–3 (within 3m of the output end) cuts their retrieval time from 42s to 24s. The displacement SKUs (low velocity) moving to bays 7–10 are retrieved rarely — the net throughput gain is +38 cases/hr with negligible impact on slow movers.',
    kpiDelta: { throughput: 38, retrievalTime: -18, conveyorUtil: 7, pallatizerUptime: 2, fillRate: 8 },
    anomalyId: 'anom-slot',
    estimatedImpact: '+38 cases/hr · retrieval 42s → 24s · fill rate 88% → 96%',
  },
  {
    id: 'at-conveyor-fix',
    category: 'CONVEYOR',
    title: 'Adaptive Belt Speed Control — Zone C Sensor-Triggered Ramp',
    description: 'Enable the conveyor Zone C adaptive speed controller (currently disabled). Sensor-triggered ramp eliminates item dwell from 4.2s to 0.9s and clears the ASRS backlog within 8 minutes of activation.',
    detail: 'Zone C\'s photo-eye density sensor was disabled during the last maintenance window and never re-enabled. The adaptive speed controller uses this sensor to ramp belt speed when items queue up — without it the belt runs at fixed speed causing accumulation. Re-enabling the controller takes 2 minutes via WCS config. Expected immediate reduction: dwell from 4.2s to 0.9s, conveyor utilization from 67% to 85%, and the ASRS output queue clears within one crane cycle.',
    kpiDelta: { throughput: 28, retrievalTime: -4, conveyorUtil: 18, pallatizerUptime: 6, fillRate: 4 },
    anomalyId: 'anom-conveyor',
    estimatedImpact: '+28 cases/hr · conveyor util 67% → 85% · ASRS queue cleared',
  },
  {
    id: 'at-palletizer-cal',
    category: 'PALLETIZER',
    title: 'Palletizer Recalibration — Axis Lubrication & Speed Profile',
    description: 'Schedule a 14-minute maintenance window to lubricate the palletizer vertical axis and re-tune the speed profile. Cycle time returns to the 5.1s specification.',
    detail: 'The palletizer\'s vertical axis shows increasing friction consistent with scheduled lubrication at 2,000 cycle intervals — the station hit 2,340 cycles with no maintenance. Current 8.4s cycle time will continue degrading. A 14-minute window at the shift mid-point (break overlap) is sufficient for lubrication + recalibration without losing shift throughput. Palletizer uptime recovers from 81% to 94% and cycle time returns to the 5.1s spec.',
    kpiDelta: { throughput: 14, retrievalTime: 0, conveyorUtil: 3, pallatizerUptime: 13, fillRate: 3 },
    anomalyId: 'anom-palletizer',
    estimatedImpact: '+13% palletizer uptime · cycle 8.4s → 5.1s · +14 cases/hr',
  },
];

// ── Control system event feeds (post-implementation) ─────────────────────────
export const AT_CONTROL_EVENTS: Record<string, ATControlEvent[]> = {
  'at-mission-seq': [
    { time: '07:02', title: 'Mission Batcher Online', desc: 'WCS mission scheduler now grouping by 3-bay proximity windows. Crane horizontal travel down 34%.' },
    { time: '07:45', title: 'Throughput +52 Confirmed', desc: '336 cases/hr running — 52 above baseline. ASRS crane idle time dropped from 28% to 6%.' },
    { time: '09:00', title: 'Order Fill Rate 94%', desc: 'Six-point improvement confirmed. All priority pick orders fulfilled within SLA window.' },
    { time: '10:30', title: 'System Stable — No Intervention Needed', desc: 'Mission batcher maintaining performance. Control loop confirmed autonomous.' },
  ],
  'at-slotting': [
    { time: '06:40', title: 'Slot Re-Assignment Transmitted', desc: '14 high-velocity SKUs reassigned to bays 1–3. WCS confirmed slot map update.' },
    { time: '07:15', title: 'Retrieval Time 24s', desc: 'High-velocity SKU avg retrieval: 24s vs 42s baseline. Crane aisle traversal reduced 41%.' },
    { time: '08:30', title: 'Fill Rate 96%', desc: 'Top-velocity orders filling 9 minutes ahead of previous schedule. Downstream palletizer at steady cadence.' },
    { time: '10:00', title: 'Slot Efficiency Locked In', desc: 'No further slot drift detected. Slotting algorithm monitoring for velocity changes.' },
  ],
  'at-conveyor-fix': [
    { time: '07:06', title: 'Zone C Sensor Re-enabled', desc: 'Adaptive speed controller active on Zone C. Photo-eye density signal confirmed.' },
    { time: '07:14', title: 'Dwell Time 0.9s', desc: 'Item dwell dropped from 4.2s to 0.9s. ASRS output queue cleared within 6 crane cycles.' },
    { time: '07:30', title: 'Conveyor Util 85%', desc: '18-point improvement. Downstream palletizer receiving steady item flow — no starvation events.' },
    { time: '09:00', title: 'Belt Running Nominal', desc: 'Conveyor throughput 28 cases/hr above baseline. No re-intervention required.' },
  ],
  'at-palletizer-cal': [
    { time: '10:00', title: 'Maintenance Window Open', desc: 'Palletizer Station 1 taken offline for 14-minute lubrication + recalibration. Conveyor buffer absorbing flow.' },
    { time: '10:14', title: 'Palletizer Back Online', desc: 'Cycle time 5.1s confirmed on first 10 cycles. Vertical axis friction nominal.' },
    { time: '10:30', title: 'Uptime 94% — Back on Spec', desc: '13-point uptime improvement. Palletizer operating within spec for first time this shift.' },
    { time: '12:00', title: 'No Degradation Detected', desc: 'Cycle time holding at 5.2s through shift mid-point. No re-intervention scheduled.' },
  ],
};

export const AT_SCENARIO_LABELS: Record<string, string> = {
  'at-mission-seq':   'Mission Resequencing',
  'at-slotting':      'Dynamic Slot Assignment',
  'at-conveyor-fix':  'Conveyor Zone C Fix',
  'at-palletizer-cal':'Palletizer Recalibration',
};

export const AT_CATEGORY_COLORS: Record<ATScenario['category'], string> = {
  MISSION:    '#7c3aed',
  SLOT:       '#0891b2',
  CONVEYOR:   '#d97706',
  PALLETIZER: '#16a34a',
};
