import { useEffect, useRef, useState } from 'react'

/** How long the button has to be held. Long enough not to happen by accident. */
export const HOLD_TO_CONFIRM_MS = 1500

/**
 * A button that acts only when held: a red ring grows around it while it is
 * pressed, and when the ring is full the action happens. Letting go sooner,
 * or sliding off it, cancels. For what cannot be taken back, without a
 * dialog asking "are you sure?". Space or Enter, held, does the same.
 */
export function HoldButton({
  children,
  onConfirm,
  holdMs = HOLD_TO_CONFIRM_MS,
}: {
  children: React.ReactNode
  onConfirm: () => void
  holdMs?: number
}) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const confirm = useRef(onConfirm)
  confirm.current = onConfirm

  function start(): void {
    if (timer.current !== undefined) return
    setHolding(true)
    timer.current = setTimeout(() => {
      timer.current = undefined
      setHolding(false)
      confirm.current()
    }, holdMs)
  }

  function stop(): void {
    clearTimeout(timer.current)
    timer.current = undefined
    setHolding(false)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <button
      type="button"
      className="hold-button"
      data-holding={holding || undefined}
      style={{ '--hold-ms': `${holdMs}ms` } as React.CSSProperties}
      onPointerDown={(event) => {
        // not the right or middle button of a mouse; any touch or pen
        if (!(event.button > 0)) start()
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
          event.preventDefault()
          start()
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') stop()
      }}
      onBlur={stop}
      // a long press on a phone would otherwise open the system menu
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-label">{children}</span>
    </button>
  )
}
