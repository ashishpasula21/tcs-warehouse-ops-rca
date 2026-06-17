import type { Zone } from '../types';

// Warehouse is 200ft x 120ft, scaled to 100x60 Three.js units
export const WAREHOUSE_WIDTH = 100;
export const WAREHOUSE_DEPTH = 60;

export interface ZoneDefinition {
  id: Zone;
  label: string;
  color: string;
  x: number;  // center x
  z: number;  // center z
  w: number;  // width
  d: number;  // depth
  description: string;
}

export const ZONES: ZoneDefinition[] = [
  { id: 'RECEIVING', label: 'Receiving', color: '#3b82f6', x: -42, z: -22, w: 14, d: 16, description: 'Inbound truck dock area' },
  { id: 'PUTAWAY', label: 'Put-Away', color: '#8b5cf6', x: -30, z: -22, w: 10, d: 16, description: 'Staging for putaway tasks' },
  { id: 'STORAGE_A', label: 'Zone A', color: '#10b981', x: -20, z: -20, w: 20, d: 30, description: 'High-velocity SKU storage' },
  { id: 'STORAGE_B', label: 'Zone B', color: '#f59e0b', x: 5, z: -20, w: 20, d: 30, description: 'Medium-velocity SKU storage' },
  { id: 'STORAGE_C', label: 'Zone C', color: '#ef4444', x: 30, z: -20, w: 20, d: 30, description: 'Low-velocity SKU storage' },
  { id: 'PICKING', label: 'Pick Lane', color: '#06b6d4', x: 0, z: 15, w: 60, d: 10, description: 'Active order picking zone' },
  { id: 'STAGING', label: 'Staging', color: '#f97316', x: 0, z: 22, w: 60, d: 8, description: 'Order consolidation & staging' },
  { id: 'SHIPPING', label: 'Shipping', color: '#ec4899', x: 40, z: -22, w: 14, d: 16, description: 'Outbound truck dock area' },
  { id: 'AISLE_1', label: 'Aisle 1', color: '#64748b', x: -8, z: -5, w: 4, d: 30, description: 'Primary forklift aisle' },
  { id: 'AISLE_2', label: 'Aisle 2', color: '#64748b', x: 18, z: -5, w: 4, d: 30, description: 'Secondary forklift aisle' },
  { id: 'AISLE_3', label: 'Cross Aisle', color: '#64748b', x: 0, z: 5, w: 80, d: 4, description: 'Cross-dock aisle' },
];

export interface ShelvingRack {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  zone: Zone;
}

export const SHELVING_RACKS: ShelvingRack[] = [
  // Zone A - high velocity
  { x: -22, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_A' },
  { x: -18, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_A' },
  { x: -14, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_A' },
  // Zone B - medium velocity
  { x: 2, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_B' },
  { x: 6, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_B' },
  { x: 10, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_B' },
  // Zone C - low velocity
  { x: 26, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_C' },
  { x: 30, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_C' },
  { x: 34, z: -24, w: 3, d: 24, h: 5, zone: 'STORAGE_C' },
];

export interface WaypointPath {
  id: string;
  points: { x: number; z: number }[];
  zone: Zone;
}

export const FORKLIFT_PATHS: WaypointPath[] = [
  {
    id: 'receiving_to_storage_a',
    points: [
      { x: -42, z: -22 }, { x: -35, z: -22 }, { x: -20, z: -5 }, { x: -20, z: -20 }
    ],
    zone: 'STORAGE_A',
  },
  {
    id: 'receiving_to_storage_b',
    points: [
      { x: -42, z: -22 }, { x: -30, z: -22 }, { x: 5, z: -5 }, { x: 5, z: -20 }
    ],
    zone: 'STORAGE_B',
  },
  {
    id: 'storage_a_to_picking',
    points: [
      { x: -20, z: -20 }, { x: -8, z: -5 }, { x: -8, z: 10 }, { x: 0, z: 15 }
    ],
    zone: 'PICKING',
  },
  {
    id: 'storage_b_to_picking',
    points: [
      { x: 5, z: -20 }, { x: 18, z: -5 }, { x: 18, z: 10 }, { x: 5, z: 15 }
    ],
    zone: 'PICKING',
  },
  {
    id: 'staging_to_shipping',
    points: [
      { x: 0, z: 22 }, { x: 20, z: 22 }, { x: 40, z: 5 }, { x: 40, z: -22 }
    ],
    zone: 'SHIPPING',
  },
];
