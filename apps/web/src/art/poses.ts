/**
 * Professor Maple's poses, one per kind of thing he talks about, as
 * `apps/web/scripts/art.mjs` makes them from `designs/art/maple/`.
 */
export const MAPLE_POSES = [
  'explaining',
  'thumbs-up',
  'portrait',
  'scroll',
  'thinking',
  'cards',
  'feast',
  'magnifier',
  'coin',
  'surprised',
  'welcoming',
  'pointing',
] as const
export type MaplePose = (typeof MAPLE_POSES)[number]
