import { describe, expect, it } from 'vitest'
import { CHAPTERS, chapterOf, pageOf } from './chapters.js'
import { LESSONS } from './lessons.js'

const pagesIn = (ids: readonly string[]) =>
  LESSONS.filter((lesson) => ids.includes(lesson.id)).reduce(
    (sum, lesson) => sum + lesson.steps.filter((step) => step.kind !== 'play').length,
    0,
  )

describe('chapters', () => {
  it('puts every lesson in exactly one chapter, in the order the lessons run', () => {
    expect(CHAPTERS.flatMap((chapter) => chapter.lessons)).toEqual(LESSONS.map((lesson) => lesson.id))
  })

  it('names the seven courses of the menu', () => {
    expect(CHAPTERS.map((chapter) => chapter.title)).toEqual([
      'The Menu',
      'Starters',
      'Seconds, Please',
      'Main Course',
      "Chef's Specials",
      'House Rules',
      'The Bill',
    ])
    expect(chapterOf('iron').number).toBe(4)
  })

  it('counts the pages of a chapter across its lessons', () => {
    const first = LESSONS.findIndex((lesson) => lesson.id === 'meat-alone')
    const at = pageOf(LESSONS, first, 0)
    expect(at.chapter.title).toBe('Main Course')
    expect(at.page).toBe(1)
    expect(at.pages).toBe(pagesIn(['meat-alone', 'meat-card', 'iron', 'potion']))

    const second = LESSONS.findIndex((lesson) => lesson.id === 'meat-card')
    const pagesBefore = pagesIn(['meat-alone'])
    expect(pageOf(LESSONS, second, 0).page).toBe(pagesBefore + 1)
  })

  it("leaves Maple's moves out of the count", () => {
    const lesson = LESSONS.findIndex((candidate) => candidate.id === 'first-turn')
    const steps = LESSONS[lesson].steps
    const play = steps.findIndex((step) => step.kind === 'play')
    expect(pageOf(LESSONS, lesson, play).page).toBe(pageOf(LESSONS, lesson, play - 1).page)
  })
})
