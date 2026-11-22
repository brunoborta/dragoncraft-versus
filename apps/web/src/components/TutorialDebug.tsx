import { useState } from 'react'
import { CHAPTERS, DESSERT } from '../game/tutorial/chapters.js'
import type { Lesson } from '../game/tutorial/script.js'

/**
 * The tutorial's debug panel, with `#debug` in the address: floats at the side,
 * over the coach, and jumps to any chapter or lesson — its first page, its
 * board as built — or to Dessert. Folds away to a tab.
 */
export function TutorialDebug({
  lessons,
  lessonIndex,
  page,
  onJump,
}: {
  lessons: readonly Lesson[]
  lessonIndex: number
  page: { chapter: { number: number; title: string }; page: number; pages: number } | null
  onJump: (index: number) => void
}) {
  const [open, setOpen] = useState(true)
  const indexOf = (id: string) => lessons.findIndex((lesson) => lesson.id === id)
  const current = lessons[lessonIndex]?.id

  if (!open) {
    return (
      <button type="button" className="tutorial-debug-tab" onClick={() => setOpen(true)}>
        Debug
      </button>
    )
  }

  return (
    <aside className="tutorial-debug" aria-label="Tutorial debug">
      <div className="tutorial-debug-head">
        <strong>Tutorial</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fold the debug panel">
          ×
        </button>
      </div>
      <p className="tutorial-debug-where">
        {page ? `Ch. ${page.chapter.number} · ${page.page}/${page.pages} · ${current}` : current ? `${current} · between pages` : DESSERT}
      </p>
      <ol>
        {CHAPTERS.map((chapter) => (
          <li key={chapter.number}>
            <button
              type="button"
              data-current={chapter.lessons.includes(current ?? '') || undefined}
              // a course without this chapter (a test's) has nowhere to go
              disabled={indexOf(chapter.lessons[0]) < 0}
              onClick={() => onJump(indexOf(chapter.lessons[0]))}
            >
              {chapter.number}. {chapter.title}
            </button>
            {chapter.lessons.length > 1 ? (
              <span className="tutorial-debug-lessons">
                {chapter.lessons.map((id) => (
                  <button
                    key={id}
                    type="button"
                    data-current={id === current || undefined}
                    disabled={indexOf(id) < 0}
                    onClick={() => onJump(indexOf(id))}
                  >
                    {id}
                  </button>
                ))}
              </span>
            ) : null}
          </li>
        ))}
        <li>
          <button type="button" data-current={current === undefined || undefined} onClick={() => onJump(lessons.length)}>
            {DESSERT}
          </button>
        </li>
      </ol>
    </aside>
  )
}
