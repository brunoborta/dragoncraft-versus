import { createGame } from '@dcv/engine'
import { Board } from './components/Board.js'

const preview = createGame(1)

export function App() {
  return (
    <main className="app">
      <header />
      <Board board={preview.board} highlights={{}} onSelectHex={() => {}} />
      <footer />
    </main>
  )
}
