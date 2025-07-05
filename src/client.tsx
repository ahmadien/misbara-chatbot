import { createRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start'
import { createRouter } from './router'

export default function Client() {
  const router = createRouter()
  return <StartClient router={router} />
}


// Hydrate on the client if we're in the browser
if (typeof document !== 'undefined') {
  let container = document.getElementById('root') as HTMLElement | null
  if (!container) {
    container = document.createElement('div')
    container.id = 'root'
    document.body.appendChild(container)
  }

  // Use createRoot unconditionally to avoid hydration mismatches
  createRoot(container).render(<Client />)
}
