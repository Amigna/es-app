import raw from "../data/readings.json";
import type { Reading } from "./readings";

export const READINGS = raw as Reading[];

export const findReading = (slug: string) => READINGS.find((r) => r.slug === slug);
