import { create } from 'zustand';
import type { SimulationState } from '../types';
import { SHIFT_DATA } from '../data/mockTelemetry';

interface SimulationStore extends SimulationState {
  setCurrentTime: (t: number) => void;
  setPlaying: (v: boolean) => void;
  setPlaybackSpeed: (s: number) => void;
  setShowHeatmap: (v: boolean) => void;
  setHeatmapMode: (m: SimulationState['heatmapMode']) => void;
  setSelectedOperator: (id: string | null) => void;
  setSelectedEquipment: (id: string | null) => void;
  setActiveView: (v: SimulationState['activeView']) => void;
  setImprovementScenario: (key: string | null) => void;
  setAtScenario: (key: string | null) => void;
  tick: (deltaMs: number) => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 60, // 60x realtime (1 hour = 1 min)
  showHeatmap: true,
  heatmapMode: 'CONGESTION',
  selectedOperator: null,
  selectedEquipment: null,
  activeView: 'SIMULATION',
  improvementScenario: null,
  atScenario: null,

  setCurrentTime: (t) => set({ currentTime: Math.max(0, Math.min(t, SHIFT_DATA.shiftDuration)) }),
  setPlaying: (v) => set({ isPlaying: v }),
  setPlaybackSpeed: (s) => set({ playbackSpeed: s }),
  setShowHeatmap: (v) => set({ showHeatmap: v }),
  setHeatmapMode: (m) => set({ heatmapMode: m }),
  setSelectedOperator: (id) => set({ selectedOperator: id }),
  setSelectedEquipment: (id) => set({ selectedEquipment: id }),
  setActiveView: (v) => set({ activeView: v }),
  setImprovementScenario: (key) => set({ improvementScenario: key }),
  setAtScenario: (key) => set({ atScenario: key }),

  tick: (deltaMs) => {
    const { isPlaying, currentTime, playbackSpeed } = get();
    if (!isPlaying) return;
    const next = currentTime + deltaMs * playbackSpeed;
    if (next >= SHIFT_DATA.shiftDuration) {
      set({ currentTime: SHIFT_DATA.shiftDuration, isPlaying: false });
    } else {
      set({ currentTime: next });
    }
  },
}));
