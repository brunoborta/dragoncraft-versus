import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LESSONS } from '../game/tutorial/lessons.js'
import { TutorialDebug } from './TutorialDebug.js'

describe('TutorialDebug', () => {
  const index = (id: string) => LESSONS.findIndex((lesson) => lesson.id === id)

  it('jumps to the first lesson of a chapter, to a lesson, and to Dessert', () => {
    const onJump = vi.fn()
    render(<TutorialDebug lessons={LESSONS} lessonIndex={0} page={null} onJump={onJump} />)
    fireEvent.click(screen.getByRole('button', { name: '4. Main Course' }))
    expect(onJump).toHaveBeenLastCalledWith(index('meat-alone'))
    fireEvent.click(screen.getByRole('button', { name: 'iron' }))
    expect(onJump).toHaveBeenLastCalledWith(index('iron'))
    fireEvent.click(screen.getByRole('button', { name: 'Dessert' }))
    expect(onJump).toHaveBeenLastCalledWith(LESSONS.length)
  })

  it('says where the tutorial is, and folds away', () => {
    render(
      <TutorialDebug
        lessons={LESSONS}
        lessonIndex={index('iron')}
        page={{ chapter: { number: 4, title: 'Main Course' }, page: 9, pages: 20 }}
        onJump={() => {}}
      />,
    )
    expect(screen.getByText('Ch. 4 · 9/20 · iron')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fold the debug panel' }))
    expect(screen.getByRole('button', { name: 'Debug' })).toBeTruthy()
  })
})
