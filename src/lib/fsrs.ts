// FSRS-6 with its default parameters, from the open-spaced-repetition algorithm. Pure math, no dates or storage.
// Stability is the number of days until recall drops to 90%. Difficulty runs from 1 to 10.

export interface Memory {
  stability: number;
  difficulty: number;
}

/** 1 Again, 2 Hard, 3 Good, 4 Easy. Drills never give Easy, but difficulty is defined in terms of it. */
export type Rating = 1 | 2 | 3 | 4;

const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
  1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];
const DECAY = -W[20];
const FACTOR = 0.9 ** (1 / DECAY) - 1;
const MIN_STABILITY = 0.001;
const MAX_INTERVAL = 36500;

const clampDifficulty = (d: number) => Math.min(10, Math.max(1, d));
const initialDifficulty = (rating: Rating) => W[4] - Math.exp((rating - 1) * W[5]) + 1;

/** Chance of recalling something `elapsed` days after the last review. */
export function retrievability(elapsed: number, stability: number): number {
  return (1 + (FACTOR * elapsed) / stability) ** DECAY;
}

/** Whole days until recall drops to the 90% target, which is stability by definition. */
export function intervalDays(stability: number): number {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(stability)));
}

export function firstMemory(rating: Rating): Memory {
  return { stability: Math.max(MIN_STABILITY, W[rating - 1]), difficulty: clampDifficulty(initialDifficulty(rating)) };
}

function nextDifficulty(difficulty: number, rating: Rating): number {
  const delta = -W[6] * (rating - 3);
  const damped = difficulty + ((10 - difficulty) * delta) / 9;
  return clampDifficulty(W[7] * initialDifficulty(4) + (1 - W[7]) * damped);
}

function stabilityAfterRecall({ stability: s, difficulty: d }: Memory, r: number, rating: Rating): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus);
}

function stabilityAfterForgetting({ stability: s, difficulty: d }: Memory, r: number): number {
  const long = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp((1 - r) * W[14]);
  return Math.min(long, s / Math.exp(W[17] * W[18]));
}

/** For a second review on the same day, which saving doesn't produce today but the algorithm defines. */
function stabilitySameDay(s: number, rating: Rating): number {
  const change = Math.exp(W[17] * (rating - 3 + W[18])) * s ** -W[19];
  return s * (rating >= 2 ? Math.max(change, 1) : change);
}

export function nextMemory(memory: Memory, rating: Rating, elapsed: number): Memory {
  let stability: number;
  if (elapsed < 1) {
    stability = stabilitySameDay(memory.stability, rating);
  } else {
    const r = retrievability(elapsed, memory.stability);
    stability = rating === 1 ? stabilityAfterForgetting(memory, r) : stabilityAfterRecall(memory, r, rating);
  }
  return { stability: Math.max(MIN_STABILITY, stability), difficulty: nextDifficulty(memory.difficulty, rating) };
}
