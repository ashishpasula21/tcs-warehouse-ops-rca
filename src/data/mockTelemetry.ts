import type { ShiftData, TelemetryPoint, TaskEvent, Zone, TaskType } from '../types';
import { FORKLIFT_PATHS } from './warehouseLayout';

const SHIFT_DURATION = 8 * 60 * 60 * 1000; // 8 hours in ms
const SHIFT_START = new Date('2026-06-15T06:00:00').getTime();

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolatePath(
  path: { x: number; z: number }[],
  t: number
): { x: number; z: number } {
  if (t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];
  const segment = t * (path.length - 1);
  const i = Math.floor(segment);
  const frac = segment - i;
  const a = path[Math.min(i, path.length - 1)];
  const b = path[Math.min(i + 1, path.length - 1)];
  return { x: lerp(a.x, b.x, frac), z: lerp(a.z, b.z, frac) };
}

function generateTelemetryAlongPaths(
  paths: { x: number; z: number }[][],
  totalDuration: number,
  idlePeriods: { start: number; end: number }[],
  efficiency: number
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const step = 10000; // 10s intervals

  for (let t = 0; t <= totalDuration; t += step) {
    const isIdle = idlePeriods.some(p => t >= p.start && t <= p.end);
    const cycleTime = 12 * 60 * 1000; // 12min cycle
    const cyclePos = (t % cycleTime) / cycleTime;
    const pathIdx = Math.floor(t / cycleTime) % paths.length;
    const path = paths[pathIdx % paths.length];

    const pos = isIdle
      ? path[0]
      : interpolatePath(path, cyclePos);

    const jitter = isIdle ? 0 : (1 - efficiency) * 2;
    const speed = isIdle ? 0 : (efficiency * 5 + Math.random() * 2);

    const zones: Zone[] = ['RECEIVING', 'STORAGE_A', 'STORAGE_B', 'PICKING', 'SHIPPING', 'AISLE_1'];
    const taskTypes: TaskType[] = ['RECEIVING', 'PUTAWAY', 'PICKING', 'SHIPPING', 'TRAVEL', 'IDLE'];

    points.push({
      timestamp: t,
      position: {
        x: pos.x + (Math.random() - 0.5) * jitter,
        y: 0,
        z: pos.z + (Math.random() - 0.5) * jitter,
      },
      speed,
      zone: isIdle ? 'RECEIVING' : zones[pathIdx % zones.length],
      task: isIdle ? 'IDLE' : taskTypes[Math.floor(cyclePos * 4) % taskTypes.length],
      batteryLevel: Math.max(10, 100 - (t / totalDuration) * 70),
      isLoaded: cyclePos > 0.2 && cyclePos < 0.7,
      loadWeight: cyclePos > 0.2 && cyclePos < 0.7 ? 800 + Math.random() * 400 : 0,
    });
  }
  return points;
}

function generateOperatorTelemetry(
  baseX: number, baseZ: number,
  totalDuration: number,
  idlePeriods: { start: number; end: number }[],
  efficiency: number
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const step = 8000;
  const routes = [
    [{ x: baseX, z: baseZ }, { x: baseX + 10, z: baseZ + 5 }, { x: baseX + 5, z: baseZ + 15 }],
    [{ x: baseX + 5, z: baseZ + 15 }, { x: baseX - 5, z: baseZ + 10 }, { x: baseX, z: baseZ }],
  ];

  for (let t = 0; t <= totalDuration; t += step) {
    const isIdle = idlePeriods.some(p => t >= p.start && t <= p.end);
    const cycleTime = 8 * 60 * 1000;
    const cyclePos = (t % cycleTime) / cycleTime;
    const routeIdx = Math.floor(t / cycleTime) % routes.length;
    const route = routes[routeIdx];

    const pos = isIdle ? { x: baseX, z: baseZ } : interpolatePath(route, cyclePos);
    const speed = isIdle ? 0 : (efficiency * 3.5 + Math.random() * 0.5);

    const zones: Zone[] = ['PICKING', 'STAGING', 'STORAGE_A', 'STORAGE_B'];
    points.push({
      timestamp: t,
      position: { x: pos.x, y: 0, z: pos.z },
      speed,
      zone: isIdle ? 'STAGING' : zones[routeIdx % zones.length],
      task: isIdle ? 'IDLE' : (cyclePos < 0.5 ? 'PICKING' : 'TRAVEL'),
      isLoaded: cyclePos > 0.3 && cyclePos < 0.6,
    });
  }
  return points;
}

function generateEvents(
  operatorId: string, equipmentId: string,
  totalDuration: number,
  casesPerHour: number
): TaskEvent[] {
  const events: TaskEvent[] = [];
  const avgInterval = (3600 * 1000) / casesPerHour * 5;
  const zones: Zone[] = ['PICKING', 'STORAGE_A', 'STORAGE_B', 'RECEIVING', 'SHIPPING'];
  const tasks: TaskType[] = ['PICKING', 'PUTAWAY', 'RECEIVING', 'SHIPPING'];

  let t = 0;
  let idx = 0;
  while (t < totalDuration) {
    const duration = avgInterval * (0.8 + Math.random() * 0.4);
    const cases = Math.floor(3 + Math.random() * 8);
    events.push({
      id: `evt-${operatorId}-${idx++}`,
      timestamp: t,
      operatorId,
      equipmentId,
      type: tasks[idx % tasks.length],
      zone: zones[idx % zones.length],
      palletId: `PLT-${1000 + idx}`,
      duration,
      casesHandled: cases,
    });
    t += duration + avgInterval * 0.2;
  }
  return events;
}

// Forklift 1 - Mark Rivera (high performer)
const fl1Paths = [FORKLIFT_PATHS[0].points, FORKLIFT_PATHS[2].points, FORKLIFT_PATHS[4].points];
const fl1Idle = [{ start: 90 * 60000, end: 120 * 60000 }]; // 30min lunch

// Forklift 2 - James Chen (underperformer - slow in Zone C, long detours)
const fl2Paths = [FORKLIFT_PATHS[1].points, FORKLIFT_PATHS[3].points, FORKLIFT_PATHS[4].points];
const fl2Idle = [
  { start: 90 * 60000, end: 120 * 60000 },
  { start: 200 * 60000, end: 225 * 60000 }, // extra idle - inefficiency
  { start: 320 * 60000, end: 340 * 60000 },
];

// Forklift 3 - Sarah Kim (normal)
const fl3Paths = [FORKLIFT_PATHS[2].points, FORKLIFT_PATHS[0].points, FORKLIFT_PATHS[3].points];
const fl3Idle = [{ start: 90 * 60000, end: 120 * 60000 }];

export const SHIFT_DATA: ShiftData = {
  date: '2026-06-15',
  shiftStart: SHIFT_START,
  shiftEnd: SHIFT_START + SHIFT_DURATION,
  shiftDuration: SHIFT_DURATION,
  operators: [
    {
      id: 'op-1',
      name: 'Mark Rivera',
      role: 'Forklift Operator',
      equipmentId: 'fl-1',
      color: '#10b981',
      efficiency: 0.91,
      telemetry: generateOperatorTelemetry(-40, -20, SHIFT_DURATION, fl1Idle, 0.91),
    },
    {
      id: 'op-2',
      name: 'James Chen',
      role: 'Forklift Operator',
      equipmentId: 'fl-2',
      color: '#ef4444',
      efficiency: 0.58,
      telemetry: generateOperatorTelemetry(5, -20, SHIFT_DURATION, fl2Idle, 0.58),
    },
    {
      id: 'op-3',
      name: 'Sarah Kim',
      role: 'Forklift Operator',
      equipmentId: 'fl-3',
      color: '#f59e0b',
      efficiency: 0.78,
      telemetry: generateOperatorTelemetry(28, -18, SHIFT_DURATION, fl3Idle, 0.78),
    },
    {
      id: 'op-4',
      name: 'Deon Williams',
      role: 'Pallet Jack Operator',
      equipmentId: 'pj-1',
      color: '#3b82f6',
      efficiency: 0.85,
      telemetry: generateOperatorTelemetry(-5, 15, SHIFT_DURATION, fl1Idle, 0.85),
    },
    {
      id: 'op-5',
      name: 'Priya Patel',
      role: 'Pallet Jack Operator',
      equipmentId: 'pj-2',
      color: '#8b5cf6',
      efficiency: 0.72,
      telemetry: generateOperatorTelemetry(10, 18, SHIFT_DURATION, fl3Idle, 0.72),
    },
    {
      id: 'op-6',
      name: 'Tom Nguyen',
      role: 'Picker',
      color: '#06b6d4',
      efficiency: 0.88,
      telemetry: generateOperatorTelemetry(0, 14, SHIFT_DURATION, fl1Idle, 0.88),
    },
  ],
  equipment: [
    {
      id: 'fl-1',
      type: 'FORKLIFT',
      operatorId: 'op-1',
      color: '#10b981',
      telemetry: generateTelemetryAlongPaths(fl1Paths, SHIFT_DURATION, fl1Idle, 0.91),
    },
    {
      id: 'fl-2',
      type: 'FORKLIFT',
      operatorId: 'op-2',
      color: '#ef4444',
      telemetry: generateTelemetryAlongPaths(fl2Paths, SHIFT_DURATION, fl2Idle, 0.58),
    },
    {
      id: 'fl-3',
      type: 'FORKLIFT',
      operatorId: 'op-3',
      color: '#f59e0b',
      telemetry: generateTelemetryAlongPaths(fl3Paths, SHIFT_DURATION, fl3Idle, 0.78),
    },
    {
      id: 'pj-1',
      type: 'PALLET_JACK',
      operatorId: 'op-4',
      color: '#3b82f6',
      telemetry: generateTelemetryAlongPaths(
        [FORKLIFT_PATHS[2].points, FORKLIFT_PATHS[3].points],
        SHIFT_DURATION, fl1Idle, 0.85
      ),
    },
    {
      id: 'pj-2',
      type: 'PALLET_JACK',
      operatorId: 'op-5',
      color: '#8b5cf6',
      telemetry: generateTelemetryAlongPaths(
        [FORKLIFT_PATHS[3].points, FORKLIFT_PATHS[4].points],
        SHIFT_DURATION, fl3Idle, 0.72
      ),
    },
  ],
  events: [
    ...generateEvents('op-1', 'fl-1', SHIFT_DURATION, 38),
    ...generateEvents('op-2', 'fl-2', SHIFT_DURATION, 21),
    ...generateEvents('op-3', 'fl-3', SHIFT_DURATION, 29),
    ...generateEvents('op-4', 'pj-1', SHIFT_DURATION, 45),
    ...generateEvents('op-5', 'pj-2', SHIFT_DURATION, 35),
    ...generateEvents('op-6', undefined as unknown as string, SHIFT_DURATION, 52),
  ],
  totalCasesPicked: 1847,
  totalPalletsReceived: 68,
  totalPalletsShipped: 74,
};

export function getTelemetryAtTime(telemetry: TelemetryPoint[], currentMs: number): TelemetryPoint {
  let lo = 0, hi = telemetry.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (telemetry[mid].timestamp <= currentMs) lo = mid;
    else hi = mid;
  }
  const a = telemetry[lo];
  const b = telemetry[hi];
  if (!b || a.timestamp === b.timestamp) return a;
  const t = (currentMs - a.timestamp) / (b.timestamp - a.timestamp);
  return {
    ...a,
    position: {
      x: lerp(a.position.x, b.position.x, t),
      y: lerp(a.position.y, b.position.y, t),
      z: lerp(a.position.z, b.position.z, t),
    },
    speed: lerp(a.speed, b.speed, t),
  };
}

export function computeHeatmap(
  allTelemetry: TelemetryPoint[][],
  gridW = 20, gridH = 12,
  currentMs: number
): number[][] {
  const grid = Array.from({ length: gridH }, () => new Array(gridW).fill(0));
  const warehouseW = 100, warehouseD = 60;

  for (const telemetry of allTelemetry) {
    for (const pt of telemetry) {
      if (pt.timestamp > currentMs) break;
      const gx = Math.floor(((pt.position.x + warehouseW / 2) / warehouseW) * gridW);
      const gz = Math.floor(((pt.position.z + warehouseD / 2) / warehouseD) * gridH);
      if (gx >= 0 && gx < gridW && gz >= 0 && gz < gridH) {
        grid[gz][gx] += 1;
      }
    }
  }
  return grid;
}
