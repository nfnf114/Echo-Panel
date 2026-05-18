import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Hub from './pages/Hub';
import ClientArea from './pages/ClientArea';
import ServerSelect from './pages/ServerSelect';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Characters from './pages/Characters';
import CharacterDetail from './pages/CharacterDetail';
import Screenshots from './pages/Screenshots';
import Vehicles from './pages/Vehicles';
import Gangs from './pages/Gangs';
import Leaderboard from './pages/Leaderboard';
import Inventory from './pages/Inventory';
import Bans from './pages/Bans';
import Admins from './pages/Admins';
import Settings from './pages/Settings';
import LicenseInfo from './pages/LicenseInfo';
import Queue from './pages/Queue';
import AdvancedSearch from './pages/Search';
import DupeScanner from './pages/DupeScanner';
import Dupes from './pages/Dupes';
import Logs from './pages/Logs';
import Packages from './pages/Packages';
import AuthCallback from './pages/AuthCallback';
import type { User } from './types';
import { translations } from './i18n/translations';
import type { Language } from './i18n/translations';
import { NotificationProvider } from './context/NotificationContext';
import { checkActiveSubscription } from './utils/subscription';
import './App.css';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations.ar) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

// Subscription Guard: Only allow access to /client-area if user has an active subscription
const SubscriptionGuard: React.FC<{ user: User }> = ({ user }) => {
  const [checking, setChecking] = React.useState(true);
  const [hasActive, setHasActive] = React.useState(false);

  React.useEffect(() => {
    if (user.discordId) {
      checkActiveSubscription(user.discordId).then((result) => {
        setHasActive(result);
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [user.discordId]);

  if (checking) {
    return (
      <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        <div className="spinner" style={{ width: 32, height: 32, border: '3px solid #333', borderTopColor: '#e6192b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!hasActive) {
    return <Navigate to="/hub" replace />;
  }

  return <ClientArea user={user} />;
};

// Component to handle root path - redirects based on auth state and token in URL
const RootRedirect: React.FC<{ user: User | null; onLogin: (user: User) => void }> = ({ user, onLogin }) => {
  const [processed, setProcessed] = React.useState(false);

  React.useEffect(() => {
    if (processed) return;
    
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      setProcessed(true);
      try {
        // Decode JWT payload (base64url)
        const base64Url = token.split('.')[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - base64.length % 4) % 4;
        if (padding) base64 += '='.repeat(padding);
        const decoded = decodeURIComponent(
          atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        const payload = JSON.parse(decoded);
        
        const discordId = payload.discordId || payload.id || '';
        const username = payload.username || '';
        const avatarUrl = payload.avatarUrl 
          || (payload.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${payload.avatar}.png` : '')
          || `https://cdn.discordapp.com/embed/avatars/0.png`;
        
        if (discordId) {
          const userData: User = { id: discordId, discordId, username, avatarUrl, token };
          onLogin(userData);
        }
      } catch (e) {
        console.error('[RootRedirect] Failed to decode token:', e);
      }
      // Clean URL and redirect to hub
      window.location.href = '/hub';
      return;
    }
    
    setProcessed(true);
  }, [processed, onLogin]);

  // If user is logged in, go to hub; otherwise go to login
  if (user) return <Navigate to="/hub" replace />;
  if (!processed) return <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>جاري التحقق...</div>;
  return <Navigate to="/login" replace />;
};

function App() {
  // Initialize user synchronously from sessionStorage to prevent flash redirect to /login
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = sessionStorage.getItem('Echo_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      sessionStorage.removeItem('Echo_user');
      return null;
    }
  });
  const [lang, setLang] = useState<Language>(() => {
    const savedLang = localStorage.getItem('Echo_lang') as Language;
    return savedLang || 'ar';
  });

  useEffect(() => {
    // Sync language changes to localStorage
    localStorage.setItem('Echo_lang', lang);
  }, [lang]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    sessionStorage.setItem('Echo_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('Echo_user');
    localStorage.removeItem('selected_server_name');
  };

  const t = (key: keyof typeof translations.ar): string => {
    return translations[lang][key] || translations['ar'][key] || key;
  };

  const contextValue = useMemo(() => ({ lang, setLang, t }), [lang]);

  return (
    <NotificationProvider>
      <LanguageContext.Provider value={contextValue}>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={user ? <Navigate to="/hub" replace /> : <Login user={user} onLogin={handleLogin} />} />
            <Route path="/auth-callback" element={<AuthCallback onLogin={handleLogin} />} />
            
            {/* Protected Routes */}
            <Route path="/hub" element={user ? <Hub user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
            <Route path="/client-area" element={user ? <SubscriptionGuard user={user} /> : <Navigate to="/login" replace />} />
            <Route path="/servers" element={user ? <ServerSelect user={user} /> : <Navigate to="/login" replace />} />
            <Route path="/packages" element={user ? <Packages /> : <Navigate to="/login" replace />} />

            {/* Sub-pages */}
            <Route path="/server/:serverId/*" element={user ? <DashboardLayout user={user} /> : (() => {
              localStorage.setItem('redirectAfterLogin', window.location.pathname);
              return <Navigate to="/login" replace />;
            })()}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="players" element={<Players />} />
              <Route path="screenshots" element={<Screenshots />} />
              <Route path="characters" element={<Characters />} />
              <Route path="characters/:citizenid" element={<CharacterDetail />} />
              <Route path="character/:citizenid" element={<CharacterDetail />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="gangs" element={<Gangs />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="bans" element={<Bans />} />
              <Route path="admins" element={<Admins />} />
              <Route path="settings" element={<Settings />} />
              <Route path="license" element={<LicenseInfo />} />
              <Route path="queue" element={<Queue />} />
              <Route path="search" element={<AdvancedSearch />} />
              <Route path="dupes" element={<Dupes />} />
              <Route path="dupe-scanner" element={<DupeScanner />} />
              <Route path="logs" element={<Logs />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Default Redirection - also handle /?token=xxx from some auth routes */}
            <Route path="/" element={<RootRedirect user={user} onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </LanguageContext.Provider>
    </NotificationProvider>
  );
}

export default App;
