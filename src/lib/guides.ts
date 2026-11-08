import guidesRaw from "../data/guides.json";
import regionalRaw from "../data/regional.json";
import type { Level } from "./level";

export interface GuideExample {
  es: string;
  en: string;
}

export interface GuideRule {
  rule: string;
  examples: GuideExample[];
  note?: string;
}

export interface GuideSection {
  heading: string;
  rules: GuideRule[];
}

export interface Guide {
  slug: string;
  /** Tagged by hand: the level of the first course chapter that uses the guide. */
  level: Level;
  title: string;
  summary: string;
  sections: GuideSection[];
}

export interface RegionalEntry {
  en: string;
  topic: string;
  words: { es: string; where: string }[];
  note?: string;
}

export const GUIDES = guidesRaw as Guide[];
export const REGIONAL = regionalRaw as RegionalEntry[];

export const findGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);