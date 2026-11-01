import vulgarRaw from "../data/vulgar.json";
import type { RegionalEntry } from "./guides";

// Import this dynamically from the browser, so it only loads for accounts with `vulgar: true` on their invite.
export const VULGAR = vulgarRaw as RegionalEntry[];
