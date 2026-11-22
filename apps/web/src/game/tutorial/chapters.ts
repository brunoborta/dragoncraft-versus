import type { Lesson } from './script.js'

/**
 * The tutorial as the dragons' menu (spec 2026-11-21-tutorial-chapters-design):
 * seven courses, each a run of lessons, and Dessert — the warm-up offer —
 * after them, unnumbered.
 */
export type Chapter = { number: number; title: string; lessons: readonly string[] }

export const CHAPTERS: readonly Chapter[] = [
  { number: 1, title: 'The Menu', lessons: ['class'] },
  { number: 2, title: 'Starters', lessons: ['first-turn', 'scoring'] },
  { number: 3, title: 'Seconds, Please', lessons: ['bread', 'crystal'] },
  { number: 4, title: 'Main Course', lessons: ['meat-alone', 'meat-card', 'iron', 'potion'] },
  { number: 5, title: "Chef's Specials", lessons: ['plant', 'dual'] },
  { number: 6, title: 'House Rules', lessons: ['stacks', 'undo', 'coins'] },
  { number: 7, title: 'The Bill', lessons: ['the-end'] },
]

export const DESSERT = 'Dessert'

/** The chapter a lesson belongs to. A lesson outside the menu (a test's) is a chapter of its own. */
export function chapterOf(lessonId: string): Chapter {
  return CHAPTERS.find((chapter) => chapter.lessons.includes(lessonId)) ?? { number: 0, title: lessonId, lessons: [lessonId] }
}

/** Maple's lines and the player's moves are pages; her own moves are not. */
const pages = (lesson: Lesson) => lesson.steps.filter((step) => step.kind !== 'play').length

/**
 * Where a step stands in its chapter: page `page` of `pages`. On one of
 * Maple's moves, the page before it — the one still on screen.
 */
export function pageOf(
  lessons: readonly Lesson[],
  lesson: number,
  step: number,
): { chapter: Chapter; page: number; pages: number } {
  const chapter = chapterOf(lessons[lesson].id)
  const inChapter = lessons.filter((candidate) => chapter.lessons.includes(candidate.id))
  let before = 0
  for (const candidate of inChapter) {
    if (candidate === lessons[lesson]) break
    before += pages(candidate)
  }
  const here = lessons[lesson].steps.slice(0, step + 1).filter((s) => s.kind !== 'play').length
  return { chapter, page: Math.max(1, before + here), pages: inChapter.reduce((sum, c) => sum + pages(c), 0) }
}
