import { useMemo } from 'react';
import * as THREE from 'three';
import { ALL_ROUTES, getEquipmentState } from '../../simulation/routes';
import { useSimulationStore } from '../../store/simulationStore';

const GRID_W = 60;
const GRID_H = 36;
const WH_W   = 152;
const WH_D   = 82;

// Maps 0–1 activity value to a vivid RGBA color.
// Low  → deep blue (#0a1a6e)
// Mid  → lime green (#84cc16)
// High → bright orange-red (#f97316 → #dc2626)
function heatColor(v: number): [number, number, number, number] {
  const t = Math.min(1, Math.max(0, v));

  let r: number, g: number, b: number;
  if (t < 0.4) {
    const f = t / 0.4;
    // deep blue → cyan-teal
    r = Math.round(10  + f * (0));
    g = Math.round(26  + f * (180 - 26));
    b = Math.round(110 + f * (255 - 110));
  } else if (t < 0.7) {
    const f = (t - 0.4) / 0.3;
    // cyan-teal → lime green
    r = Math.round(0   + f * (132));
    g = Math.round(180 + f * (204 - 180));
    b = Math.round(255 + f * (22  - 255));
  } else {
    const f = (t - 0.7) / 0.3;
    // lime green → orange → red
    r = Math.round(132 + f * (220 - 132));
    g = Math.round(204 + f * (38  - 204));
    b = Math.round(22  + f * (38  - 22));
  }

  // Alpha: minimum 60 so cold zones are always visible; ramps to 230 at peak.
  const a = Math.round(60 + t * 170);

  return [r, g, b, a];
}

export function HeatmapOverlay() {
  const { currentTime, showHeatmap } = useSimulationStore();

  const texture = useMemo(() => {
    const grid = Array.from({ length: GRID_H }, () => new Float32Array(GRID_W));

    const WINDOW_MS = 300_000;
    const step      =   6_000;
    const routeList = Object.values(ALL_ROUTES);
    const tEnd   = currentTime;
    const tStart = Math.max(0, tEnd - WINDOW_MS);

    for (let t = tStart; t <= tEnd; t += step) {
      for (const route of routeList) {
        const s = getEquipmentState(route, t);
        const gx = Math.floor(((s.x + WH_W / 2) / WH_W) * GRID_W);
        const gz = Math.floor(((s.z + WH_D / 2) / WH_D) * GRID_H);
        if (gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_H) {
          grid[gz][gx] += 1;
        }
      }
    }

    // Gaussian blur pass — smooths hard cell edges
    const blurred = Array.from({ length: GRID_H }, () => new Float32Array(GRID_W));
    const kernel = [0.0625, 0.25, 0.375, 0.25, 0.0625]; // 1D Gaussian, applied separably
    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        let sum = 0;
        for (let k = -2; k <= 2; k++) {
          const c = Math.max(0, Math.min(GRID_W - 1, col + k));
          sum += grid[row][c] * kernel[k + 2];
        }
        blurred[row][col] = sum;
      }
    }
    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        let sum = 0;
        for (let k = -2; k <= 2; k++) {
          const r = Math.max(0, Math.min(GRID_H - 1, row + k));
          sum += blurred[r][col] * kernel[k + 2];
        }
        grid[row][col] = sum;
      }
    }

    const maxVal = Math.max(1, ...grid.map(r => Math.max(...r)));
    const data = new Uint8Array(GRID_W * GRID_H * 4);
    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        const norm = grid[row][col] / maxVal;
        const [r, g, b, a] = heatColor(norm);
        const idx = (row * GRID_W + col) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    const tex = new THREE.DataTexture(data, GRID_W, GRID_H, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter   = THREE.LinearFilter;
    tex.minFilter   = THREE.LinearFilter;
    return tex;
  }, [currentTime]);

  if (!showHeatmap) return null;

  return (
    <mesh renderOrder={4} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <planeGeometry args={[WH_W, WH_D]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false}
        polygonOffset polygonOffsetFactor={-5} polygonOffsetUnits={-5} />
    </mesh>
  );
}
