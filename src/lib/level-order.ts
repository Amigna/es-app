import type { Level } from "./level";

// Kept apart from level.ts, which pulls in React hooks, so server pages and data modules can compare levels too.

export const LEVEL_ORDER: Level[] = ["A1", "A2", "B1", "B2"];

/** Whether something at `itemLevel` suits someone at `level`. No level means everything does. */
export const atOrBelow = (itemLevel: Level, level: Level | null | undefined): boolean =>
  !level || LEVEL_ORDER.indexOf(itemLevel) <= LEVEL_ORDER.indexOf(level);
