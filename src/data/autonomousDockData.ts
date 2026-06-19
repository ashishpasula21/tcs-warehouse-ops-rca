// ── Autonomous Dock — data model ──────────────────────────────────────────────

export type DockType = 'recv' | 'ship';
export type DockStatus = 'occupied' | 'idle' | 'staging' | 'departing';
export type TruckStatus = 'queued' | 'approaching' | 'docked' | 'unloading' | 'loading' | 'departing';
export type ItemSize = 'large' | 'medium' | 'small';

export interface DockBay {
  id: string;
  type: DockType;
  label: string;
  status: DockStatus;
  truckId: string | null;
  carrier: string | null;
  pallets: number;
  capacity: number;
  turnTimeMin: number;
  stagingPallets: number;
  distToStorage: number; // meters — pathing distance to primary storage zone
}

export interface InboundTruck {
  id: string;
  carrier: string;
  trailer: string;
  pallets: number;
  skuClass: string;
  etaMin: number;       // minutes from now
  priority: 'high' | 'normal' | 'low';
  assignedDock: string | null;
  pathingScore: number; // lower = closer to storage zone
  status: TruckStatus;
}

export interface OutboundOrder {
  id: string;
  waveId: string;
  carrier: string;
  trailer: string;
  pallets: number;
  items: { sku: string; size: ItemSize; qty: number; weightKg: number }[];
  deadlineMin: number;  // minutes from now
  assignedDock: string | null;
  congestionScore: number; // staging area congestion near candidate dock
  fillRate: number;         // estimated % after size-optimised sequencing
  status: TruckStatus;
}

export interface DockEvent {
  time: string;
  type: 'decision' | 'alert' | 'info' | 'success';
  msg: string;
  dockId?: string;
}

// ── Dock Bays ─────────────────────────────────────────────────────────────────
export const DOCK_BAYS: DockBay[] = [
  { id: 'R-1', type: 'recv', label: 'Recv 1', status: 'occupied',  truckId: 'T-101', carrier: 'XPO Logistics',  pallets: 38, capacity: 52, turnTimeMin: 48, stagingPallets: 12, distToStorage: 18 },
  { id: 'R-2', type: 'recv', label: 'Recv 2', status: 'occupied',  truckId: 'T-102', carrier: 'FedEx Freight',  pallets: 21, capacity: 52, turnTimeMin: 62, stagingPallets:  5, distToStorage: 22 },
  { id: 'R-3', type: 'recv', label: 'Recv 3', status: 'idle',      truckId: null,    carrier: null,            pallets:  0, capacity: 52, turnTimeMin:  0, stagingPallets:  2, distToStorage: 31 },
  { id: 'S-1', type: 'ship', label: 'Ship 1', status: 'occupied',  truckId: 'T-201', carrier: 'UPS Supply Chain', pallets: 44, capacity: 48, turnTimeMin: 35, stagingPallets:  8, distToStorage: 14 },
  { id: 'S-2', type: 'ship', label: 'Ship 2', status: 'staging',   truckId: 'T-202', carrier: 'Werner Ent.',   pallets: 48, capacity: 48, turnTimeMin: 91, stagingPallets:  1, distToStorage: 19 },
  { id: 'S-3', type: 'ship', label: 'Ship 3', status: 'idle',      truckId: null,    carrier: null,            pallets:  0, capacity: 48, turnTimeMin:  0, stagingPallets:  4, distToStorage: 24 },
];

// ── Inbound Truck Queue ───────────────────────────────────────────────────────
export const INBOUND_TRUCKS: InboundTruck[] = [
  { id: 'T-103', carrier: 'Old Dominion',    trailer: 'TRL-8841', pallets: 44, skuClass: 'Zone A · High-Vel', etaMin: 12, priority: 'high',   assignedDock: null, pathingScore: 1, status: 'approaching' },
  { id: 'T-104', carrier: 'Estes Express',   trailer: 'TRL-3302', pallets: 28, skuClass: 'Zone B · Med-Vel',  etaMin: 27, priority: 'normal', assignedDock: null, pathingScore: 2, status: 'queued' },
  { id: 'T-105', carrier: 'Saia LTL',        trailer: 'TRL-5519', pallets: 18, skuClass: 'Zone C · Low-Vel',  etaMin: 41, priority: 'low',    assignedDock: null, pathingScore: 3, status: 'queued' },
];

// ── Outbound Orders (WMS Pick Waves) ─────────────────────────────────────────
export const OUTBOUND_ORDERS: OutboundOrder[] = [
  {
    id: 'O-441', waveId: 'W-07', carrier: 'Schneider', trailer: 'TRL-6615',
    pallets: 22, deadlineMin: 38, assignedDock: null, congestionScore: 4, fillRate: 71, status: 'queued',
    items: [
      { sku: 'SKU-A1', size: 'large',  qty: 8,  weightKg: 420 },
      { sku: 'SKU-B3', size: 'medium', qty: 10, weightKg: 280 },
      { sku: 'SKU-C7', size: 'small',  qty: 22, weightKg:  96 },
    ],
  },
  {
    id: 'O-442', waveId: 'W-08', carrier: 'KLLM',      trailer: 'TRL-1190',
    pallets: 16, deadlineMin: 72, assignedDock: null, congestionScore: 2, fillRate: 68, status: 'queued',
    items: [
      { sku: 'SKU-A2', size: 'large',  qty: 5,  weightKg: 310 },
      { sku: 'SKU-D1', size: 'medium', qty: 8,  weightKg: 195 },
      { sku: 'SKU-E4', size: 'small',  qty: 14, weightKg:  74 },
    ],
  },
  {
    id: 'O-443', waveId: 'W-09', carrier: 'Hub Group',  trailer: 'TRL-7724',
    pallets: 30, deadlineMin: 95, assignedDock: null, congestionScore: 8, fillRate: 74, status: 'queued',
    items: [
      { sku: 'SKU-B2', size: 'large',  qty: 12, weightKg: 590 },
      { sku: 'SKU-C3', size: 'medium', qty: 14, weightKg: 340 },
      { sku: 'SKU-F9', size: 'small',  qty: 30, weightKg: 115 },
    ],
  },
];

// ── Dock Assignment Logic ─────────────────────────────────────────────────────

// For receiving: assign idle dock with lowest distToStorage
export function assignRecvDock(truck: InboundTruck, bays: DockBay[]): string | null {
  const candidates = bays
    .filter(b => b.type === 'recv' && b.status === 'idle')
    .sort((a, b) => a.distToStorage - b.distToStorage);
  return candidates[0]?.id ?? null;
}

// For shipping: assign idle dock with lowest congestionScore proximity, then optimize fill rate
export function assignShipDock(order: OutboundOrder, bays: DockBay[]): string | null {
  const candidates = bays
    .filter(b => b.type === 'ship' && b.status === 'idle')
    .sort((a, b) => a.stagingPallets - b.stagingPallets);
  return candidates[0]?.id ?? null;
}

// Load sequencing: large → medium → small (maximises space utilisation)
export function getLoadSequence(order: OutboundOrder): typeof order.items {
  const order_ = { large: 0, medium: 1, small: 2 } as const;
  return [...order.items].sort((a, b) => order_[a.size] - order_[b.size]);
}

// Optimised fill rate after proper sequencing (large-first)
export function optimisedFillRate(order: OutboundOrder): number {
  const base = order.fillRate;
  const hasCorrectSeq = order.items[0]?.size === 'large';
  return hasCorrectSeq ? base : Math.min(98, base + 14);
}

// ── KPI Baseline vs Optimised ─────────────────────────────────────────────────
export const DOCK_BASELINE = {
  fillRate:         72,   // %
  congestionScore:  43,   // pallets in staging
  turnTimeMin:      58,   // avg dock turn time
  docksUtilised:     4,   // out of 6
  missedDeadlines:   3,
};

export const DOCK_OPTIMISED = {
  fillRate:         89,
  congestionScore:  18,
  turnTimeMin:      41,
  docksUtilised:     6,
  missedDeadlines:   0,
};

// ── Live Event Log ────────────────────────────────────────────────────────────
export const DOCK_EVENTS: DockEvent[] = [
  { time: '13:52', type: 'decision', msg: 'T-103 (Old Dominion) assigned → R-1: shortest path to Zone A storage (18 m)', dockId: 'R-1' },
  { time: '13:48', type: 'alert',    msg: 'S-3 staging area congestion rising — 4 pallets waiting, forklift queue blocked' },
  { time: '13:41', type: 'decision', msg: 'Wave W-07 load sequence reordered: large → medium → small. Fill rate ↑ 71% → 85%', dockId: 'S-3' },
  { time: '13:35', type: 'success',  msg: 'T-102 unload complete at R-2 — 21 pallets to Zone B in 34 min (target: 40)' },
  { time: '13:28', type: 'info',     msg: 'T-101 truck arriving — auto-assigned R-3 (low congestion, direct Zone A aisle)' },
  { time: '13:10', type: 'decision', msg: 'Wave W-06 dispatched from S-2 — 48/48 pallets loaded, fill rate 100%' },
  { time: '12:54', type: 'alert',    msg: 'R-2 turn time 62 min exceeds target 45 — suggest additional forklift assignment' },
  { time: '12:33', type: 'success',  msg: 'Dock rebalance: T-104 rerouted R-3 → R-1 saving 13 m pathing distance' },
];

// ── Pathing distance matrix (dock → primary storage zone), meters ─────────────
export const PATHING_MATRIX: Record<string, Record<string, number>> = {
  'R-1': { 'Zone A': 18, 'Zone B': 24, 'Zone C': 31 },
  'R-2': { 'Zone A': 22, 'Zone B': 20, 'Zone C': 26 },
  'R-3': { 'Zone A': 31, 'Zone B': 26, 'Zone C': 19 },
};
