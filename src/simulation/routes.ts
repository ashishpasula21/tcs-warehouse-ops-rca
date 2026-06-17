// Deterministic path-following system for warehouse equipment.
// Position at any simulation time is computed analytically — no physics, no collisions.

export interface Waypoint {
  x: number;
  z: number;
  pauseMs: number;
  task: string;
  carryingLoad: boolean;
}

export interface EquipmentRoute {
  id: string;
  waypoints: Waypoint[];
  speedUPerMs: number;
  offsetMs: number;
}

interface Segment {
  fromIdx: number;
  dx: number; dz: number;
  travelMs: number;
  pauseBeforeMs: number;
  startMs: number;
  angle: number;
  carryingLoad: boolean;
}

interface RouteData { segments: Segment[]; totalMs: number }
const cache = new Map<string, RouteData>();

function buildRoute(r: EquipmentRoute): RouteData {
  if (cache.has(r.id)) return cache.get(r.id)!;
  const n = r.waypoints.length;
  const segments: Segment[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const from = r.waypoints[i];
    const to   = r.waypoints[(i + 1) % n];
    const dx   = to.x - from.x;
    const dz   = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const travelMs = dist / r.speedUPerMs;
    segments.push({ fromIdx: i, dx, dz, travelMs, pauseBeforeMs: from.pauseMs, startMs: t, angle: Math.atan2(dx, dz), carryingLoad: from.carryingLoad });
    t += from.pauseMs + travelMs;
  }
  const data = { segments, totalMs: t };
  cache.set(r.id, data);
  return data;
}

export interface EquipmentState {
  x: number; z: number; angle: number;
  isMoving: boolean; isLoaded: boolean; task: string;
}

// Returns how many complete cycles the route has run — used to cycle through shelf slots
export function getRouteCycleNum(route: EquipmentRoute, globalMs: number): number {
  const { totalMs } = buildRoute(route);
  return Math.floor((globalMs + route.offsetMs) / totalMs);
}

export function getEquipmentState(route: EquipmentRoute, globalMs: number): EquipmentState {
  const { segments, totalMs } = buildRoute(route);
  const t = ((globalMs + route.offsetMs) % totalMs + totalMs) % totalMs;
  for (const seg of segments) {
    const pauseEnd = seg.startMs + seg.pauseBeforeMs;
    const segEnd   = pauseEnd + seg.travelMs;
    if (t < pauseEnd) {
      const wp = route.waypoints[seg.fromIdx];
      return { x: wp.x, z: wp.z, angle: seg.angle, isMoving: false, isLoaded: false, task: wp.task };
    }
    if (t < segEnd) {
      const progress = (t - pauseEnd) / seg.travelMs;
      const from = route.waypoints[seg.fromIdx];
      return { x: from.x + seg.dx * progress, z: from.z + seg.dz * progress, angle: seg.angle, isMoving: true, isLoaded: seg.carryingLoad, task: 'TRAVEL' };
    }
  }
  const wp = route.waypoints[0];
  return { x: wp.x, z: wp.z, angle: 0, isMoving: false, isLoaded: false, task: 'IDLE' };
}

// ── Base Routes ───────────────────────────────────────────────────────────────
// Aisles (yellow lines): x=-38 (west), x=0 (center), x=+28 (east)
// Rack zone: z=-22 to z=+8 — forklifts must stay in aisles here
// Open zones: z<-22 (receiving), z>+8 (staging/shipping) — free movement in x
// Cross-aisle: z≈+11 — designated E-W passage

// FL-1 (Mark Rivera): inbound receiving specialist — far-west dock.
// RECV_DOORS[0]=x=-54. Picks up inbound pallet, carries north on Zone A aisle to far-west
// racks, deposits, returns empty south to dock. Pure forward-and-back. Benchmark route.
export const FL1_ROUTE: EquipmentRoute = {
  id: 'fl-1', speedUPerMs: 0.008, offsetMs: 0,
  waypoints: [
    { x: -54, z: -26, pauseMs: 4000, task: 'RECEIVING', carryingLoad: true  }, // far-west dock: pick up inbound pallet
    { x: -54, z: -10, pauseMs: 2800, task: 'PUTAWAY',   carryingLoad: false }, // Zone A: deposit, return empty
  ],
};

// FL-2 (James Chen): inbound, but wrong-zone putaway every cycle.
// Receives at center dock (x=0). Should go straight north to Zone C (center aisle).
// Instead he detours EAST to Zone D (east aisle), wrong zone for these fast-moving items.
// After depositing he returns via a long backtrack across the receiving area.
export const FL2_ROUTE: EquipmentRoute = {
  id: 'fl-2', speedUPerMs: 0.005, offsetMs: 9000,
  waypoints: [
    { x:  0,  z: -26, pauseMs: 5500, task: 'RECEIVING', carryingLoad: true  }, // center dock: inbound pallet
    { x: +28,  z: -26, pauseMs:    0, task: 'TRAVEL',   carryingLoad: true  }, // carries pallet EAST — wrong direction for Zone C
    { x: +28,  z: -10, pauseMs: 3500, task: 'PUTAWAY',  carryingLoad: false }, // Zone D east aisle: deposits (WRONG zone — low-velocity)
    { x: +28,  z: -26, pauseMs:    0, task: 'TRAVEL',   carryingLoad: false }, // returns south empty
    { x:  0,   z: -26, pauseMs: 4000, task: 'IDLE',     carryingLoad: false }, // center dock: extended idle waiting for next task
  ],
};

// FL-3 (Sarah Kim): outbound shipping loader — drives INTO Zone B aisle to pull
// inventory directly from the racks, carries it north through the staging area,
// and loads the S1 (west) shipping truck.
// PROBLEM BEHAVIOR: on the return trip she takes a diagonal shortcut that cuts
// through the active pick-lane corridor (z≈+18, x=-8) where WALKER_1 is working.
export const FL3_ROUTE: EquipmentRoute = {
  id: 'fl-3', speedUPerMs: 0.007, offsetMs: 16500,
  waypoints: [
    { x: -38, z:  -5, pauseMs: 4500, task: 'PICKING',  carryingLoad: true  }, // Zone B aisle: pick from rack shelf
    { x: -38, z: +11, pauseMs:    0, task: 'TRAVEL',   carryingLoad: true  }, // Exit rack zone (cross-aisle)
    { x:  -4, z: +18, pauseMs:    0, task: 'TRAVEL',   carryingLoad: true  }, // SHORTCUT: diagonals through WALKER_1 zone (x=-4)!
    { x: -30, z: +29, pauseMs: 4000, task: 'SHIPPING', carryingLoad: false }, // S1 west dock: load truck
    { x: -38, z: +11, pauseMs:    0, task: 'TRAVEL',   carryingLoad: false }, // Return south to cross-aisle
  ],
};

// FL-4 (Alex Park): outbound shipping loader — Zone E specialist.
// Drives INTO Zone E aisle (x=+49) to pull inventory directly off the racks,
// carries the pallet north to S3 (SHIP_DOORS[2]=x=+49), loads the truck, and loops back.
// Parks near the dock whenever the S3 truck is not present.
export const FL4_ROUTE: EquipmentRoute = {
  id: 'fl-4-base', speedUPerMs: 0.007, offsetMs: 14000,
  waypoints: [
    { x: +49, z:  -5, pauseMs: 4500, task: 'PICKING',  carryingLoad: true  }, // Zone E aisle: pick from rack shelf
    { x: +49, z: +11, pauseMs:    0, task: 'TRAVEL',   carryingLoad: true  }, // Exit rack zone (cross-aisle)
    { x: +49, z: +29, pauseMs: 3500, task: 'SHIPPING', carryingLoad: false }, // S3 east dock: load truck
    { x: +49, z: +11, pauseMs:    0, task: 'TRAVEL',   carryingLoad: false }, // Return south to rack zone
  ],
};

export const PJ1_ROUTE: EquipmentRoute = {
  id: 'pj-1', speedUPerMs: 0.004, offsetMs: 0,
  waypoints: [
    { x: -42, z: +17, pauseMs: 1800, task: 'PICKING', carryingLoad: false },
    { x:  -6, z: +17, pauseMs: 1800, task: 'PICKING', carryingLoad: true  },
  ],
};

export const PJ2_ROUTE: EquipmentRoute = {
  id: 'pj-2', speedUPerMs: 0.004, offsetMs: 5500,
  waypoints: [
    { x:  +6, z: +17, pauseMs: 1800, task: 'PICKING', carryingLoad: false },
    { x: +42, z: +17, pauseMs: 1800, task: 'PICKING', carryingLoad: true  },
  ],
};

// ── Operator / Walker Routes ──────────────────────────────────────────────────

// Pick lane walkers — shifted to x=-4 / x=+4 so their N-S path does not cross
// the east endpoint of PJ-1 (x=-6, z=+17) or the west start of PJ-2 (x=+6, z=+17).
// FL-3's conflict shortcut is routed through x=-4 to stay visible with WALKER_1.
export const WALKER_1_ROUTE: EquipmentRoute = {
  id: 'walker-1', speedUPerMs: 0.0018, offsetMs: 0,
  waypoints: [
    { x: -4, z: +14, pauseMs: 900,  task: 'PICKING', carryingLoad: false },
    { x: -4, z: +22, pauseMs: 1200, task: 'PICKING', carryingLoad: true  },
  ],
};

export const WALKER_2_ROUTE: EquipmentRoute = {
  id: 'walker-2', speedUPerMs: 0.0020, offsetMs: 4000,
  waypoints: [
    { x: +4, z: +14, pauseMs: 1100, task: 'PICKING', carryingLoad: false },
    { x: +4, z: +22, pauseMs: 1400, task: 'PICKING', carryingLoad: true  },
  ],
};

// Cross-aisle traversal picker (E-W movement through staging cross-aisle)
export const WALKER_3_ROUTE: EquipmentRoute = {
  id: 'walker-3', speedUPerMs: 0.0022, offsetMs: 7000,
  waypoints: [
    { x: -32, z: +11, pauseMs: 2000, task: 'STAGING', carryingLoad: false },
    { x:  -6, z: +11, pauseMs: 1500, task: 'STAGING', carryingLoad: true  },
    { x:  -6, z: +25, pauseMs: 2000, task: 'STAGING', carryingLoad: false },
    { x: -32, z: +25, pauseMs: 1500, task: 'STAGING', carryingLoad: true  },
  ],
};

// Dock workers (near wall, short loops)
export const DOCK_WORKER_1_ROUTE: EquipmentRoute = {
  id: 'dock-worker-1', speedUPerMs: 0.0015, offsetMs: 2000,
  waypoints: [
    { x: -38, z: -26, pauseMs: 4000, task: 'RECEIVING', carryingLoad: false },
    { x: -15, z: -26, pauseMs: 2500, task: 'RECEIVING', carryingLoad: true  },
    { x: -15, z: -27, pauseMs: 1500, task: 'STAGING',   carryingLoad: false },
    { x: -38, z: -27, pauseMs: 1500, task: 'STAGING',   carryingLoad: false },
  ],
};

export const DOCK_WORKER_2_ROUTE: EquipmentRoute = {
  id: 'dock-worker-2', speedUPerMs: 0.0015, offsetMs: 6000,
  waypoints: [
    { x: -5,  z: +29, pauseMs: 4000, task: 'SHIPPING', carryingLoad: false },
    { x: +18, z: +29, pauseMs: 2500, task: 'SHIPPING', carryingLoad: true  },
    { x: +18, z: +27, pauseMs: 1500, task: 'STAGING',  carryingLoad: false },
    { x: -5,  z: +27, pauseMs: 1500, task: 'STAGING',  carryingLoad: false },
  ],
};

// Zone B shelf picker (moves between racks in the storage zone)
export const SHELF_PICKER_1_ROUTE: EquipmentRoute = {
  id: 'shelf-picker-1', speedUPerMs: 0.0016, offsetMs: 3500,
  waypoints: [
    { x: -14, z: -15, pauseMs: 3000, task: 'PICKING', carryingLoad: false },
    { x: -14, z:  +5, pauseMs: 2000, task: 'PICKING', carryingLoad: true  },
    { x: -14, z: +13, pauseMs: 2000, task: 'STAGING', carryingLoad: false },
    { x: -14, z: -15, pauseMs: 0,    task: 'TRAVEL',  carryingLoad: false },
  ],
};

// Zone C shelf picker
export const SHELF_PICKER_2_ROUTE: EquipmentRoute = {
  id: 'shelf-picker-2', speedUPerMs: 0.0016, offsetMs: 8500,
  waypoints: [
    { x: +32, z: -10, pauseMs: 3500, task: 'PICKING', carryingLoad: false },
    { x: +32, z:  +6, pauseMs: 2000, task: 'PICKING', carryingLoad: true  },
    { x: +32, z: +13, pauseMs: 1500, task: 'STAGING', carryingLoad: false },
    { x: +32, z: -10, pauseMs: 0,    task: 'TRAVEL',  carryingLoad: false },
  ],
};

// ── Improved Scenario Routes ──────────────────────────────────────────────────

// improve_op2: FL-2 direct route — center aisle only, dock → Zone B → pick lane
export const FL2_IMPROVED_ROUTE: EquipmentRoute = {
  id: 'fl-2-improved', speedUPerMs: 0.007, offsetMs: 9000,
  waypoints: [
    { x:  0, z: -26, pauseMs: 3000, task: 'RECEIVING', carryingLoad: true  }, // center dock: inbound pallet
    { x:  0, z: -10, pauseMs: 2000, task: 'PUTAWAY',   carryingLoad: false }, // Zone B center aisle: CORRECT zone, straight north — no detour
  ],
};

// aisle1_traffic: FL-3 rerouted — all E-W movement at dock level (z=+36), never enters pick lane
export const FL1_STAGGERED_ROUTE: EquipmentRoute = {
  id: 'fl-1-stag', speedUPerMs: 0.008, offsetMs: 0,
  waypoints: FL1_ROUTE.waypoints,
};
export const FL2_STAGGERED_ROUTE: EquipmentRoute = {
  id: 'fl-2-stag', speedUPerMs: 0.005, offsetMs: 22000,
  waypoints: FL2_ROUTE.waypoints,
};
// FL-3 improved: same Zone B rack pick but goes STRAIGHT to S1 without the diagonal shortcut.
// Base route cuts NE through walker-1's zone (x=-8, z=+18). This route stays in the
// x=-38 aisle and only merges west once clear of walkers — forklift never enters the
// pedestrian corridor.
export const FL3_STAGGERED_ROUTE: EquipmentRoute = {
  id: 'fl-3-stag', speedUPerMs: 0.007, offsetMs: 16500,
  waypoints: [
    { x: -38, z:  -5, pauseMs: 3500, task: 'PICKING',  carryingLoad: true  }, // Zone B aisle: pick from rack shelf
    { x: -38, z: +11, pauseMs:    0, task: 'TRAVEL',   carryingLoad: true  }, // Exit rack zone
    { x: -30, z: +29, pauseMs: 3000, task: 'SHIPPING', carryingLoad: false }, // S1 dock: straight diagonal, stays well west of walkers
    { x: -38, z: +11, pauseMs:    0, task: 'TRAVEL',   carryingLoad: false }, // Return south (no walker crossing)
  ],
};

// slotting_opt: FL-1 becomes a dual-role operator — inbound putaway Zone A, then outbound
// pick from Zone B and deliver to staging. Uses cross-aisle (z=+11) for E-W transit.
// Rivera covers both zones in one loop, eliminating idle time when Zone A fills.
export const FL1_OPTIMIZED_ROUTE: EquipmentRoute = {
  id: 'fl-1-opt', speedUPerMs: 0.008, offsetMs: 0,
  waypoints: [
    { x: -54, z: -26, pauseMs: 3000, task: 'RECEIVING', carryingLoad: true  }, // far-west dock: inbound pallet
    { x: -54, z: -10, pauseMs: 2000, task: 'PUTAWAY',   carryingLoad: false }, // Zone A aisle: deposit inbound
    { x: -54, z: +11, pauseMs:    0, task: 'TRAVEL',    carryingLoad: false }, // north to cross-aisle (empty)
    { x:   0, z: +11, pauseMs:    0, task: 'TRAVEL',    carryingLoad: false }, // east across cross-aisle to center
    { x:   0, z: -10, pauseMs: 2000, task: 'PICKING',   carryingLoad: true  }, // Zone C center aisle: pick outbound pallet
    { x:   0, z: +16, pauseMs: 2000, task: 'STAGING',   carryingLoad: false }, // staging: hand off to order assembly
    { x:   0, z: -26, pauseMs:    0, task: 'TRAVEL',    carryingLoad: false }, // south on center aisle (stops above column)
    { x: -54, z: -26, pauseMs:    0, task: 'TRAVEL',    carryingLoad: false }, // west through open receiving back to dock
  ],
};
export const FL2_OPTIMIZED_ROUTE: EquipmentRoute = {
  id: 'fl-2-opt', speedUPerMs: 0.007, offsetMs: 9000,
  waypoints: FL2_IMPROVED_ROUTE.waypoints,
};
export const FL3_OPTIMIZED_ROUTE: EquipmentRoute = {
  id: 'fl-3-opt', speedUPerMs: 0.007, offsetMs: 4500,
  waypoints: FL3_STAGGERED_ROUTE.waypoints,
};

// receiving_putaway: dedicated FL-4 on west aisle, fast putaway-only shuttle
export const FL4_PUTAWAY_ROUTE: EquipmentRoute = {
  id: 'fl-4', speedUPerMs: 0.009, offsetMs: 3000,
  waypoints: [
    { x: -38, z: -26, pauseMs: 1800, task: 'RECEIVING', carryingLoad: true  }, // west dock
    { x: -38, z:  -5, pauseMs: 2000, task: 'PUTAWAY',   carryingLoad: false }, // Zone A
    { x: -38, z: -26, pauseMs:    0, task: 'TRAVEL',    carryingLoad: false }, // return
  ],
};

// battery_charging: PJ-2 at higher speed (opportunity charging)
export const PJ2_IMPROVED_ROUTE: EquipmentRoute = {
  id: 'pj-2-improved', speedUPerMs: 0.006, offsetMs: 5500,
  waypoints: PJ2_ROUTE.waypoints,
};

// best_practice_share: FL-2 and FL-3 adopting Rivera's direct, no-waste routing
export const FL2_BESTPRACTICE_ROUTE: EquipmentRoute = {
  id: 'fl-2-best', speedUPerMs: 0.008, offsetMs: 9000,
  waypoints: FL2_IMPROVED_ROUTE.waypoints, // same as improved: straight to Zone B
};
export const FL3_BESTPRACTICE_ROUTE: EquipmentRoute = {
  id: 'fl-3-best', speedUPerMs: 0.007, offsetMs: 4500,
  waypoints: FL3_STAGGERED_ROUTE.waypoints, // same as improved: dock-level transit
};

// ── Route Registry ────────────────────────────────────────────────────────────

export const ALL_ROUTES: Record<string, EquipmentRoute> = {
  'fl-1': FL1_ROUTE,
  'fl-2': FL2_ROUTE,
  'fl-3': FL3_ROUTE,
  'pj-1': PJ1_ROUTE,
  'pj-2': PJ2_ROUTE,
  'walker-1':      WALKER_1_ROUTE,
  'walker-2':      WALKER_2_ROUTE,
  'walker-3':      WALKER_3_ROUTE,
  'dock-worker-1': DOCK_WORKER_1_ROUTE,
  'dock-worker-2': DOCK_WORKER_2_ROUTE,
  'shelf-picker-1': SHELF_PICKER_1_ROUTE,
  'shelf-picker-2': SHELF_PICKER_2_ROUTE,
};

// Scenario-specific route overrides
export interface ScenarioConfig {
  forklifts: Array<{ route: EquipmentRoute; beaconColor: string; label: string }>;
  palletJacks: Array<{ route: EquipmentRoute; beaconColor: string }>;
  extraLabel?: string;
}

export function getScenarioConfig(scenario: string | null): ScenarioConfig {
  const base: ScenarioConfig = {
    forklifts: [
      { route: FL1_ROUTE,    beaconColor: '#f5c518', label: 'FL-1' },
      { route: FL2_ROUTE,    beaconColor: '#e8a000', label: 'FL-2' },
      { route: FL3_ROUTE,    beaconColor: '#d49000', label: 'FL-3' },
      { route: FL4_ROUTE,    beaconColor: '#3b82f6', label: 'FL-4' },
    ],
    palletJacks: [
      { route: PJ1_ROUTE, beaconColor: '#cc2200' },
      { route: PJ2_ROUTE, beaconColor: '#aa1a00' },
    ],
  };

  switch (scenario) {
    case 'improve_op2':
      return {
        ...base,
        extraLabel: 'FL-2 Direct Route — Zone D Detour Eliminated',
        forklifts: [
          { route: FL1_ROUTE,          beaconColor: '#f5c518', label: 'FL-1' },
          { route: FL2_IMPROVED_ROUTE, beaconColor: '#22c55e', label: 'FL-2 ↑' },
          { route: FL3_ROUTE,          beaconColor: '#d49000', label: 'FL-3' },
          { route: FL4_ROUTE,          beaconColor: '#3b82f6', label: 'FL-4' },
        ],
      };

    case 'aisle1_traffic':
      return {
        ...base,
        extraLabel: 'FL-3 Rerouted — Shipping-Level Traverse',
        forklifts: [
          { route: FL1_ROUTE,           beaconColor: '#f5c518', label: 'FL-1' },
          { route: FL2_ROUTE,           beaconColor: '#e8a000', label: 'FL-2' },
          { route: FL3_STAGGERED_ROUTE, beaconColor: '#22c55e', label: 'FL-3 ↑' },
          { route: FL4_ROUTE,           beaconColor: '#3b82f6', label: 'FL-4' },
        ],
      };

    case 'slotting_opt':
      return {
        ...base,
        extraLabel: 'FL-1 Expanded — Zone A + Zone B Coverage',
        forklifts: [
          { route: FL1_OPTIMIZED_ROUTE, beaconColor: '#22c55e', label: 'FL-1 ↑' },
          { route: FL2_ROUTE,           beaconColor: '#e8a000', label: 'FL-2' },
          { route: FL3_ROUTE,           beaconColor: '#d49000', label: 'FL-3' },
          { route: FL4_ROUTE,           beaconColor: '#3b82f6', label: 'FL-4' },
        ],
      };

    case 'receiving_putaway':
      return {
        ...base,
        extraLabel: 'FL-4 Dedicated Putaway',
        forklifts: [
          { route: FL1_ROUTE,         beaconColor: '#f5c518', label: 'FL-1' },
          { route: FL2_ROUTE,         beaconColor: '#e8a000', label: 'FL-2' },
          { route: FL3_ROUTE,         beaconColor: '#d49000', label: 'FL-3' },
          { route: FL4_ROUTE,         beaconColor: '#3b82f6', label: 'FL-4' },
          { route: FL4_PUTAWAY_ROUTE, beaconColor: '#60a5fa', label: 'FL-5 NEW' },
        ],
      };

    case 'battery_charging':
      return {
        ...base,
        extraLabel: 'Opportunity Charging Active',
        palletJacks: [
          { route: PJ1_ROUTE,          beaconColor: '#cc2200' },
          { route: PJ2_IMPROVED_ROUTE, beaconColor: '#22c55e' },
        ],
      };

    case 'best_practice_share':
      return {
        ...base,
        extraLabel: 'Rivera Method — All Operators',
        forklifts: [
          { route: FL1_ROUTE,              beaconColor: '#f5c518', label: 'FL-1' },
          { route: FL2_BESTPRACTICE_ROUTE, beaconColor: '#22c55e', label: 'FL-2 ↑' },
          { route: FL3_BESTPRACTICE_ROUTE, beaconColor: '#22c55e', label: 'FL-3 ↑' },
          { route: FL4_ROUTE,              beaconColor: '#3b82f6', label: 'FL-4' },
        ],
      };

    default:
      return base;
  }
}

// Utility: estimate cycles completed for analytics display
export function getRouteCycleLengthMs(route: EquipmentRoute): number {
  return buildRoute(route).totalMs;
}
