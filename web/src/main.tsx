import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@contracts/design-tokens.css'
import './styles/app.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
