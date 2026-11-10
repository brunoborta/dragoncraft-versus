import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Only the Latin subset and the two weights the design uses (v3 plan, 3.2).
import '@fontsource/alegreya/latin-400.css'
import '@fontsource/alegreya/latin-700.css'
import '@fontsource/alegreya-sans/latin-400.css'
import '@fontsource/alegreya-sans/latin-700.css'
import { App } from './App.js'
import { ArtScope } from './art/ArtContext.js'
import { SvgDefs } from './components/SvgDefs.js'
import { MotionRoot } from './motion.js'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root element')

createRoot(root).render(
  <StrictMode>
    <MotionRoot>
      <SvgDefs />
      <ArtScope>
        <App />
      </ArtScope>
    </MotionRoot>
  </StrictMode>,
)
