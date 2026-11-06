import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '@fontsource-variable/inter'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/bricolage-grotesque'
import './base.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
