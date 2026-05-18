import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Loading fallback for lazy-loaded components
function RootFallback() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<RootFallback />}>
      <App />
    </Suspense>
  </StrictMode>,
)
