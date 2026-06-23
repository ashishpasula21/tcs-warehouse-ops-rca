/**
 * Module-level singleton that tracks the current world positions of all forklifts
 * and pallet jacks so pedestrians (OperatorModel) can yield to them.
 * Runs in the RAF loop — no React state, no renders triggered.
 *
 * Two separate maps:
 *   _forkliftPositions — only forklifts (registered via updateForkliftPos)
 *   _allPositions      — all heavy equipment (forklifts + PJs)
 *
 * Workers yield to all equipment (_allPositions).
 * PJs yield only to forklifts (_forkliftPositions) so they never deadlock each other.
 */
const _forkliftPositions = new Map<string, { x: number; z: number }>();
const _allPositions      = new Map<string, { x: number; z: number }>();

/** Call this from Forklift — registers in both maps so workers and PJs can detect it. */
export function updateForkliftPos(id: string, x: number, z: number) {
  _forkliftPositions.set(id, { x, z });
  _allPositions.set(id, { x, z });
}

/** Call this from PalletJack / RandomPalletJack — registers in all-equipment map only. */
export function updateAgentPos(id: string, x: number, z: number) {
  _allPositions.set(id, { x, z });
}

/** Workers: yield to any heavy equipment (forklifts + PJs). */
export function isHeavyEquipmentNear(myX: number, myZ: number, minDist = 3.0): boolean {
  for (const pos of _allPositions.values()) {
    const dx = pos.x - myX;
    const dz = pos.z - myZ;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}

/** PJs: yield only to forklifts — prevents PJ↔PJ deadlock. */
export function isForkliftNear(myX: number, myZ: number, minDist = 4.0): boolean {
  for (const pos of _forkliftPositions.values()) {
    const dx = pos.x - myX;
    const dz = pos.z - myZ;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}

/** @deprecated Use isForkliftNear for PJs (avoids self-deadlock). */
export function isOtherEquipmentNear(selfId: string, myX: number, myZ: number, minDist = 4.0): boolean {
  for (const [id, pos] of _allPositions.entries()) {
    if (id === selfId) continue;
    const dx = pos.x - myX;
    const dz = pos.z - myZ;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}
