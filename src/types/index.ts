export type Zone = 'RECEIVING' | 'PUTAWAY' | 'STORAGE_A' | 'STORAGE_B' | 'STORAGE_C' | 'PICKING' | 'STAGING' | 'SHIPPING' | 'AISLE_1' | 'AISLE_2' | 'AISLE_3';

export type EquipmentType = 'FORKLIFT' | 'PALLET_JACK';
export type TaskType = 'RECEIVING' | 'PUTAWAY' | 'PICKING' | 'SHIPPING' | 'IDLE' | 'TRAVEL';
export type OperatorStatus = 'ACTIVE' | 'IDLE' | 'BREAK';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface TelemetryPoint {
  timestamp: number; // ms since shift start
  position: Position;
  speed: number; // mph
  zone: Zone;
  task: TaskType;
  batteryLevel?: number;
  loadWeight?: number;
  isLoaded: boolean;
}

export interface Equipment {
  id: string;
  type: EquipmentType;
  operatorId: string;
  telemetry: TelemetryPoint[];
  color: string;
}

export interface Operator {
  id: string;
  name: string;
  role: string;
  equipmentId?: string;
  telemetry: TelemetryPoint[];
  color: string;
  efficiency: number; // 0-1
}

export interface TaskEvent {
  id: string;
  timestamp: number;
  operatorId: string;
  equipmentId?: string;
  type: TaskType;
  zone: Zone;
  palletId: string;
  duration: number; // ms
  casesHandled: number;
}

export interface ShiftData {
  date: string;
  shiftStart: number; // epoch ms
  shiftEnd: number;
  shiftDuration: number; // ms
  operators: Operator[];
  equipment: Equipment[];
  events: TaskEvent[];
  totalCasesPicked: number;
  totalPalletsReceived: number;
  totalPalletsShipped: number;
}

export interface KPI {
  casePickRate: number; // cases/hour
  forkliftUtilization: number; // 0-1
  operatorUtilization: number; // 0-1
  palletJackUtilization: number; // 0-1
  avgTravelSpeedForklift: number; // mph
  avgTravelSpeedPalletJack: number; // mph
  totalCasesPicked: number;
  totalDistanceTraveled: number; // feet
  congestionZones: { zone: Zone; score: number }[];
  throughputByHour: { hour: number; cases: number }[];
  zoneActivityHeatmap: { zone: Zone; hour: number; activity: number }[][];
}

export interface AIRecommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'OPERATOR' | 'EQUIPMENT' | 'PATHWAY' | 'ZONE' | 'PROCESS';
  title: string;
  description: string;
  affectedEntities: string[];
  currentMetric: string;
  targetMetric: string;
  estimatedImpact: string;
  improvementPct: number;
  simulationKey: string;
}

export interface SimulationState {
  currentTime: number; // ms from shift start
  isPlaying: boolean;
  playbackSpeed: number;
  showHeatmap: boolean;
  heatmapMode: 'CONGESTION' | 'ACTIVITY' | 'EFFICIENCY';
  selectedOperator: string | null;
  selectedEquipment: string | null;
  activeView: 'SIMULATION' | 'ANALYTICS' | 'RECOMMENDATIONS';
  improvementScenario: string | null;
  atScenario: string | null;
}
