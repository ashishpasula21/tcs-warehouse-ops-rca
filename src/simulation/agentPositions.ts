/**
 * Module-level singleton that tracks the current world positions of all forklifts
 * and pallet jacks so pedestrians (OperatorModel) can yield to them.
 * Runs in the RAF loop — no React state, no renders triggered.
 */
const _positions = new Map<string, { x: number; z: number }>();

export function updateAgentPos(id: string, x: number, z: number) {
  _positions.set(id, { x, z });
}

/** Returns true if any registered heavy-equipment agent is within minDist units. */
export function isHeavyEquipmentNear(myX: number, myZ: number, minDist = 3.0): boolean {
  for (const pos of _positions.values()) {
    const dx = pos.x - myX;
    const dz = pos.z - myZ;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}
