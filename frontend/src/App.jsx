import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import React, { useEffect, useState, Suspense, lazy } from 'react'
import { LanguageProvider } from './contexts/LanguageContext'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'

// Route-level code splitting with React.lazy
// These page components are loaded on-demand, reducing initial bundle size
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ServerSelection = lazy(() => import('./pages/ServerSelection'))
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const OnlinePlayers = lazy(() => import('./pages/OnlinePlayers'))
const Screenshots = lazy(() => import('./pages/Screenshots'))
const Players = lazy(() => import('./pages/Players'))
const Vehicles = lazy(() => import('./pages/Vehicles'))
const Gangs = lazy(() => import('./pages/Gangs'))
const Stashes = lazy(() => import('./pages/Stashes'))
const Queue = lazy(() => import('./pages/Queue'))
const Investigate = lazy(() => import('./pages/Investigate'))
const Bans = lazy(() => import('./pages/Bans'))
const DupeScanner = lazy(() => import('./pages/DupeScanner'))
const Logs = lazy(() => import('./pages/Logs'))
const Admins = lazy(() => import('./pages/Admins'))
const Settings = lazy(() => import('./pages/Settings'))
const Portal = lazy(() => import('./pages/Portal'))
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'))

export const ServerContext = React.createContext()

// Lazy loading spinner for route transitions
function PageLoader() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm">Loading page...</p>
      </div>
    </div>
  )
}

function ErrorFallback({ error }) {
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-8 text-center" dir="ltr">
      <div className="bg-dark-800 border border-brand-red p-8 rounded-xl max-w-2xl w-full">
        <h2 className="text-2xl font-bold text-brand-red mb-4">React Runtime Crash Detected</h2>
        <p className="text-gray-300 mb-4">An error occurred while rendering the page. Please send this screenshot to the developer:</p>
        <pre className="text-left bg-dark-900 p-4 rounded text-sm text-red-400 overflow-auto border border-dark-700 whitespace-pre-wrap">
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button onClick={() => window.location.href = '/'} className="mt-6 px-6 py-2 bg-dark-700 text-white rounded hover:bg-dark-600">Return Home</button>
      </div>
    </div>
  )
}

// Plan nav restrictions
const PLAN_BLOCKED = {
  'Echo Trial': [],
  'Echo Lite':  ['gangs', 'stashes', 'investigate', 'dupe-scanner', 'screenshots', 'online', 'queue'],
  'Echo Pro':   ['screenshots', 'online', 'queue'],
  'Echo Max':   [],
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeServer, setActiveServer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('active_server') || 'null') } catch { return null }
  })


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        sessionStorage.setItem('panel_user', JSON.stringify(payload))
        sessionStorage.setItem('panel_token', token)
        setUser(payload)
        window.history.replaceState({}, '', '/')
      } catch {}
    } else {
      const stored = sessionStorage.getItem('panel_user')
      if (stored) {
        try { setUser(JSON.parse(stored)) } catch { sessionStorage.removeItem('panel_user') }
      }
    }
    setLoading(false)
  }, [])

  const handleSelectServer = (srv) => {
    localStorage.setItem('active_server', JSON.stringify(srv))
    localStorage.setItem('active_server_id', srv.id)
    // Store the bridge token so Screenshots page can fetch directly from bridge
    if (srv.fivem_token) sessionStorage.setItem('bridge_token', srv.fivem_token)
    setActiveServer(srv)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('panel_user')
    sessionStorage.removeItem('panel_token')
    localStorage.removeItem('active_server')
    localStorage.removeItem('active_server_id')
    setUser(null)
    setActiveServer(null)
  }

  const handleChangeServer = () => {
    localStorage.removeItem('active_server')
    localStorage.removeItem('active_server_id')
    setActiveServer(null)
  }

  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  )

  const plan = activeServer?.plan || 'Echo Max'
  const navBlocked = PLAN_BLOCKED[plan] || []
  const permissions = activeServer?.permissions || []
  const isOwner = user?.id === activeServer?.discord_id || user?.isOwner
  
  const hasPermission = (perm) => {
    if (isOwner || permissions.includes('*')) return true
    return permissions.includes(perm)
  }

  return (
    <LanguageProvider>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ServerContext.Provider value={{ activeServer, navBlocked, plan, handleChangeServer, permissions, isOwner, hasPermission }}>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={!user ? <LoginPage setUser={setUser} /> : <Navigate to="/" />} />
                
                {/* Authenticated Routes */}
                {user ? (
                  <>
                    <Route path="/" element={<Portal user={user} onLogout={handleLogout} />} />
                    
                    {/* Client Area Routes */}
                    <Route path="/client" element={<Navigate to="/client/dashboard" />} />
                    <Route path="/client/dashboard" element={<ClientDashboard user={user} />} />

                    {/* Panel Routes */}
                    <Route path="/panel" element={
                      activeServer
                        ? <DashboardLayout user={user} onLogout={handleLogout} />
                        : <ServerSelection onSelectServer={handleSelectServer} onLogout={handleLogout} />
                    }>
                      <Route index element={<Dashboard />} />
                      <Route path="online" element={<OnlinePlayers />} />
                      <Route path="screenshots" element={<Screenshots />} />
                      <Route path="players" element={<Players />} />
                      <Route path="vehicles" element={<Vehicles />} />
                      <Route path="gangs" element={<Gangs />} />
                      <Route path="stashes" element={<Stashes />} />
                      <Route path="queue" element={<Queue />} />
                      <Route path="investigate" element={<Investigate />} />
                      <Route path="bans" element={<Bans />} />
                      <Route path="dupe-scanner" element={<DupeScanner />} />
                      <Route path="logs" element={<Logs />} />
                      <Route path="admins" element={<Admins />} />
                      <Route path="settings" element={<Settings />} />
                    </Route>
                  </>
                ) : (
                  <Route path="*" element={<Navigate to="/login" />} />
                )}
                
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ServerContext.Provider>
      </ErrorBoundary>
    </LanguageProvider>
  )
}

export default App
