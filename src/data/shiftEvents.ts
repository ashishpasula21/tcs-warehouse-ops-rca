// ms from shift start (06:00 = 0)
const H = (h: number, m = 0) => (h * 60 + m) * 60_000;

export interface ShiftEvent {
  id: string;
  time: number;
  timeLabel: string;
  title: string;
  description: string;
  detail: string; // shown in the 3D overlay card
  type: 'problem' | 'benefit';
  x: number;
  z: number;
  radius: number;
}

// ── Yesterday's Shift — problem events ───────────────────────────────────────
export const PROBLEM_EVENTS: ShiftEvent[] = [
  {
    id: 'recv-dwell',
    time: H(1, 45),       // 07:45
    timeLabel: '07:45',
    title: 'Receiving Dock Backlog',
    description: '31-minute pallet dwell time at Receiving Dock R-1. No dedicated putaway forklift during peak inbound window.',
    detail: 'Pallets are sitting idle on the dock floor. No forklift has been dispatched to begin putaway. This creates a chain reaction — inbound trucks cannot unload, backing up the yard.',
    type: 'problem',
    x: -38, z: -26,
    radius: 9,
  },
  {
    id: 'fl3-conflict',
    time: H(1, 20),       // 07:20
    timeLabel: '07:20',
    title: 'FL-3 Pick Lane Conflict — Near-Miss Zone',
    description: 'FL-3 (Sarah Kim) crosses through the pick lane staging corridor east-to-west while walkers are working north-south. 4 near-miss events in this window alone.',
    detail: 'FL-3\'s triangular circuit requires crossing the staging zone perpendicular to pick lane walkers. A forklift travelling at 6 mph through a pedestrian zone at ground level is a serious safety hazard. This conflict happens on every lap of FL-3\'s route.',
    type: 'problem',
    x: 0, z: 26,
    radius: 10,
  },
  {
    id: 'fl2-zigzag',
    time: H(3, 10),       // 09:10
    timeLabel: '09:10',
    title: 'FL-2 Zone C Detour — Cross-Zone Backtracking',
    description: 'FL-2 (James Chen) has diverted to Zone C (far east aisle) with a pallet that belongs in Zone A (west). This unnecessary cross-aisle backtrack happens on every cycle.',
    detail: 'FL-2 travelled east along the east aisle to Zone C (x=+28), deposited the pallet, then reversed course all the way back west to Zone A (x=-38) via the cross-aisle — a 66-unit backtrack. Without a fixed zone assignment, FL-2 makes ad-hoc routing decisions that consistently add distance. At 32 cycles per shift this adds up to 10,464 ft of wasted travel.',
    type: 'problem',
    x: 28, z: -5,
    radius: 8,
  },
  {
    id: 'pj2-battery',
    time: H(5, 0),        // 11:00
    timeLabel: '11:00',
    title: 'PJ-2 Battery Sag — Priya Patel',
    description: 'Pallet Jack PJ-2 battery at 30% charge. Operating at reduced speed — 72% efficiency. This is the 2nd speed-sag event this shift.',
    detail: 'PJ-2 was charged to only 15% threshold before the shift started. By 11:00 the battery has drained to critical level, causing automatic speed reduction. A 30% opportunity-charge threshold would have prevented this entirely.',
    type: 'problem',
    x: 26, z: -8,
    radius: 6,
  },
];

// ── Improved scenarios — benefit events ───────────────────────────────────────
export const SCENARIO_BENEFIT_EVENTS: Record<string, ShiftEvent[]> = {
  improve_op2: [
    {
      id: 'op2-b1',
      time: H(2, 0),      // 08:00
      timeLabel: '08:00',
      title: 'FL-2 Direct Route Active — Zone C Detour Eliminated',
      description: 'FL-2 now travels dock → Zone B → pick lane directly. The 327-ft Zone C detour is gone. Cycle time down 38%.',
      detail: 'FL-2 has been assigned a fixed zone (Zone B) and a direct dock-to-putaway path. The forklift now travels straight north to Zone B and straight to the pick lane — no backtracking across zones. Each cycle is 327 feet shorter and the operator is no longer making ad-hoc routing decisions.',
      type: 'benefit',
      x: 0, z: -5,
      radius: 8,
    },
    {
      id: 'op2-b2',
      time: H(5, 30),     // 11:30
      timeLabel: '11:30',
      title: '+220 Cases Added — Route Fix Compounding',
      description: 'FL-2 has completed 31 cycles by 11:30 vs 18 at this point in the baseline. Saved travel distance now exceeds 8,500 ft.',
      detail: 'By eliminating the cross-zone backtrack on every cycle, FL-2 fits more complete cycles into the same shift window. The per-cycle time saving of 4 minutes compounds across 31 cycles, delivering +220 additional cases handled versus the baseline.',
      type: 'benefit',
      x: 0, z: +14,
      radius: 8,
    },
  ],

  aisle1_traffic: [
    {
      id: 'aisle1-b1',
      time: H(1, 20),     // 07:20 — same time as the conflict problem
      timeLabel: '07:20',
      title: 'FL-3 Rerouted — Pick Lane Clear of Forklift Traffic',
      description: 'FL-3 now traverses east-west at shipping dock level (z+40) instead of at pick lane height. Zero near-misses since reroute.',
      detail: 'By shifting FL-3\'s east-west leg to the shipping dock level, the pick lane is now a forklift-free zone during pick operations. The route is slightly longer (adds 28 ft per leg) but eliminates all perpendicular traffic conflicts. Pick lane walkers now move without interruption.',
      type: 'benefit',
      x: 0, z: 29,
      radius: 10,
    },
    {
      id: 'aisle1-b2',
      time: H(2, 30),     // 08:30
      timeLabel: '08:30',
      title: '+18% Shipping Throughput — No Conflict Delays',
      description: 'Two hours in — FL-3 has completed its circuit without a single conflict event. Pick lane walkers are operating at full speed.',
      detail: 'Without conflict stops in the pick lane, both FL-3 and the pick lane walkers are operating at full speed simultaneously. The 4.1-minute average delay per conflict is now zero. Shipping throughput is tracking 18% above the baseline shift.',
      type: 'benefit',
      x: 20, z: 29,
      radius: 9,
    },
  ],

  slotting_opt: [
    {
      id: 'slot-b1',
      time: H(1, 30),     // 07:30
      timeLabel: '07:30',
      title: 'FL-1 Serving Zone B — Idle Window Eliminated',
      description: 'FL-1 detected Zone A at capacity and has begun serving Zone B. No holding pattern, no idle time. FL-1 utilization: 96%.',
      detail: 'With a dual-zone assignment, FL-1 (Mark Rivera) transitions seamlessly to Zone B when Zone A fills. The 34% idle window that previously appeared at this time has been replaced with productive Zone B putaway cycles. Rivera\'s efficient forward-and-back pattern now covers both zones.',
      type: 'benefit',
      x: -8, z: -8,
      radius: 8,
    },
    {
      id: 'slot-b2',
      time: H(4, 0),      // 10:00
      timeLabel: '10:00',
      title: 'Zone B Backlog Cleared 38 Minutes Early',
      description: 'Zone B putaway backlog cleared at 09:22 vs 10:00 in the baseline — 38 minutes ahead of schedule. +195 cases on track.',
      detail: 'FL-1\'s expanded coverage kept Zone B putaway current throughout the shift. By 10:00 both zones are fully serviced with no backlog. The cases that previously waited for Zone B slots have already been put away, making them available for pick orders earlier in the afternoon.',
      type: 'benefit',
      x: -16, z: -8,
      radius: 9,
    },
  ],

  battery_charging: [
    {
      id: 'batt-b1',
      time: H(5, 0),      // 11:00 — same time as the battery sag problem
      timeLabel: '11:00',
      title: 'PJ-2 Maintaining Full Speed — No Sag',
      description: 'Opportunity charging at 30% threshold prevented the 11:00 battery sag. PJ-2 running at 88% efficiency, up from 72%.',
      detail: 'PJ-2 received a 12-minute opportunity charge at 10:20 when battery hit 31%. This kept the battery above the sag threshold. The operator experienced no speed reduction and is tracking for 22 additional cases versus the baseline shift.',
      type: 'benefit',
      x: 26, z: -8,
      radius: 7,
    },
  ],

  receiving_putaway: [
    {
      id: 'putaway-b1',
      time: H(0, 30),     // 06:30
      timeLabel: '06:30',
      title: 'Dedicated Putaway Forklift Active',
      description: 'FL-4 assigned exclusively to putaway during the 06:00–08:00 peak receiving window. Dock dwell time: 3.2 min vs previous 31 min.',
      detail: 'A fourth forklift (FL-4) starts each shift dedicated solely to clearing the receiving dock. As soon as a pallet is unloaded from a truck, FL-4 moves it into storage. Trucks can unload faster and turn around sooner.',
      type: 'benefit',
      x: -38, z: -26,
      radius: 9,
    },
    {
      id: 'putaway-b2',
      time: H(2, 0),      // 08:00
      timeLabel: '08:00',
      title: '2.4 Extra Trucks Processed',
      description: 'Faster dock clearance allowed 2.4 additional inbound trucks to unload during the peak window. Dock utilization up 8%.',
      detail: 'Because pallets are being moved immediately, the dock floor is always clear for the next truck. Two trucks that would have waited in the yard have already unloaded and departed. This directly increases inventory availability for afternoon picks.',
      type: 'benefit',
      x: -38, z: -26,
      radius: 10,
    },
  ],

  best_practice_share: [
    {
      id: 'bp-b1',
      time: H(2, 0),      // 08:00
      timeLabel: '08:00',
      title: 'Team Pre-Planning Protocol Active',
      description: "All operators following Mark Rivera's pre-cycle path selection. Average load density up to 89% across team.",
      detail: "Mark Rivera's habit of selecting the optimal pick path before starting each cycle has been trained across the team. All operators now plan their route mentally before moving. This eliminates backtracking and increases load density per pallet.",
      type: 'benefit',
      x: -38, z: -10,
      radius: 10,
    },
    {
      id: 'bp-b2',
      time: H(4, 30),     // 10:30
      timeLabel: '10:30',
      title: '+410 Cases on Track — Full Team at Target',
      description: 'All 5 equipment operators running at or above their individual efficiency targets for the first time this month.',
      detail: "With Rivera's cross-aisle path technique applied team-wide, all forklifts and pallet jacks are minimizing backtracking. By 10:30, the team is tracking for 410 additional cases versus the baseline — the highest-ROI improvement available.",
      type: 'benefit',
      x: 0, z: 0,
      radius: 12,
    },
  ],
};

// ── Utility ───────────────────────────────────────────────────────────────────
const SHOW_BEFORE = 120_000;  // 2 sim-min before event
const SHOW_AFTER  = 480_000;  // 8 sim-min after event

export function getActiveEvent(currentTime: number, scenario: string | null): ShiftEvent | null {
  const pool = scenario
    ? (SCENARIO_BENEFIT_EVENTS[scenario] ?? [])
    : PROBLEM_EVENTS;

  // Find the most recently triggered event that is still within the window
  const active = pool
    .filter(e => currentTime >= e.time - SHOW_BEFORE && currentTime <= e.time + SHOW_AFTER)
    .sort((a, b) => Math.abs(currentTime - a.time) - Math.abs(currentTime - b.time));

  return active[0] ?? null;
}

export function getEventsForTimeline(scenario: string | null): ShiftEvent[] {
  return scenario ? (SCENARIO_BENEFIT_EVENTS[scenario] ?? []) : PROBLEM_EVENTS;
}
