/**
 * A fresh game's seed.
 *
 * `packages/engine` forbids `Math.random` on purpose: given a seed it must
 * replay identically, which is what lets the machine simulate, the tests
 * repeat and a future server stay in step with a client. Choosing the seed is
 * not part of that — it is an input to the game, picked out here and handed
 * in, exactly as a constant used to be.
 *
 * Six digits: varied enough for a game, short enough to read out and type back.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000)
}
