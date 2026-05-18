import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Camera, UserSquare, Car, ShieldAlert, 
  Package, Clock, Search, Ban, FileText, 
  Settings, Key, LogOut, ChevronLeft, RefreshCw, Shield, Crown
} from 'lucide-react';
import type { User } from '../types';
import { useLanguage } from '../App';
import LanguageSwitcher from './LanguageSwitcher';
import { fetchWithAuth } from '../utils/api';
import { API_URL } from '../config';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  user: User | null;
}

// Map nav paths to the required permission(s) from the Admins page permission groups
// If the user has any of the listed permissions, the path is unlocked
const PATH_PERMISSIONS: Record<string, string[]> = {
  'dashboard': [], // Always visible
  'players': ['عرض اللاعبين', 'عرض اللاعبين المتصلين'],
  'screenshots': ['اللقطات المباشرة', 'عرض اللاعبين المتصلين'],
  'characters': ['عرض اللاعبين'],
  'vehicles': ['عرض المركبات'],
  'gangs': ['عرض العصابات'],
  'inventory': ['عرض المخازن'],
  'queue': ['عرض الانتظار'],
  'search': ['استخدام أداة التحقيق'],
  'bans': ['عرض الحظر'],
  'dupes': ['عرض التكرارات'],
  'logs': ['عرض سجلات التدقيق'],
  'admins': ['إدارة الإداريين'],
  'settings': ['عرض الإعدادات'],
  'license': [], // Always visible (license info)
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ user }) => {
  const navigate = useNavigate();
  const { serverId } = useParams();
  const { lang, t } = useLanguage();
  const [serverName, setServerName] = useState<string>('...');
  const [status, setStatus] = useState<'online' | 'offline'>('offline');
  const [packageType, setPackageType] = useState<string>('Lite');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Admin permissions state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminRoleName, setAdminRoleName] = useState<string | null>(null);

  const handleNavClick = (path: string, e: React.MouseEvent) => {
    const locked = isLocked(path);
    if (locked) {
      e.preventDefault();
      // Check if locked due to permissions or package
      if (isAdmin && !isOwner && !hasPathPermission(path)) {
        alert(lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى هذا القسم.' : 'You do not have permission to access this section.');
      } else {
        alert(lang === 'ar' ? 'هذه الميزة غير متوفرة في خطتك الحالية. يرجى الترقية للحصول عليها.' : 'This feature is not available in your current plan. Please upgrade to unlock.');
      }
      return;
    }

    // If already on the page or it's just a placeholder, don't trigger loading
    if (path === '#' || window.location.pathname.endsWith(path)) return;

    e.preventDefault();
    setIsNavigating(true);
    
    // 1.5 seconds as requested by user
    setTimeout(() => {
      navigate(`/server/${serverId}/${path}`);
      setIsNavigating(false);
    }, 1500); 
  };

  // Fetch server info
  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const res = await fetch(`${API_URL}/api/server/${serverId}`);
        const data = await res.json();
        if (data.server) {
          // Parse panel settings if string
          const settings = typeof data.server.panel_settings === 'string' 
            ? JSON.parse(data.server.panel_settings || '{}') 
            : (data.server.panel_settings || {});

          // Priority: Custom Display Name > Sync Server Name
          setServerName(settings.server_display_name || data.server.server_name || '...');
          setLogoUrl(settings.server_logo_url || '');
          
          setStatus(data.server.status);
          // Extract package name from product_name (e.g., "Echo Max" -> "Max")
          const pName = data.server.product_name || 'Lite';
          if (pName.includes('Max')) setPackageType('Max');
          else if (pName.includes('Pro')) setPackageType('Pro');
          else if (pName.includes('Lite')) setPackageType('Lite');
          else if (pName.includes('Trial')) setPackageType('Trial');

          // Check expiry
          if (data.server.expires_at) {
            const expiry = new Date(data.server.expires_at);
            if (expiry < new Date()) {
              setIsExpired(true);
            }
          }
        }
      } catch (e) {
        const storedName = localStorage.getItem('selected_server_name');
        if (storedName) setServerName(storedName);
      }
    };
    fetchServerInfo();
  }, [serverId]);

  // Fetch admin permissions for the current server
  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!serverId || !user?.discordId) return;
      try {
        const res = await fetchWithAuth(`${API_URL}/api/check-admin/${serverId}`);
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin || false);
          setIsOwner(data.isOwner || false);
          setAdminPermissions(data.permissions || []);
          setAdminRoleName(data.roleName || null);
        }
      } catch (e) {
        // Silently fail - user might just be the owner via license
      }
    };
    fetchAdminInfo();
  }, [serverId, user?.discordId]);

  const handleLogout = () => {
    localStorage.removeItem('Echo_user');
    localStorage.removeItem('selected_server_name');
    window.location.href = '/login';
  };

  // Check if user has permission for a specific path
  const hasPathPermission = (path: string): boolean => {
    // Owner always has all permissions
    if (isOwner) return true;
    // If user has ADMIN_FULL permission, everything is unlocked
    if (adminPermissions.includes('ADMIN_FULL')) return true;
    // Paths with no required permissions are always accessible
    const requiredPerms = PATH_PERMISSIONS[path];
    if (!requiredPerms || requiredPerms.length === 0) return true;
    // Check if user has any of the required permissions
    return requiredPerms.some(perm => adminPermissions.includes(perm));
  };

  const isLocked = (path: string) => {
    // First check package-based locking
    if (packageType === 'Max') {
      // Max plan: only check permissions
    } else {
      const litePaths = ['dashboard', 'players', 'screenshots'];
      const proPaths = [...litePaths, 'characters', 'vehicles', 'gangs', 'inventory', 'queue'];
  
      if (packageType === 'Trial') {
        if (!litePaths.includes(path)) return true;
      } else if (packageType === 'Lite') {
        const allowed = [...litePaths, 'characters', 'vehicles'];
        if (!allowed.includes(path)) return true;
      } else if (packageType === 'Pro') {
        if (!proPaths.includes(path)) return true;
      }
    }

    // Then check permission-based locking for admin (non-owner) users
    if (isAdmin && !isOwner) {
      return !hasPathPermission(path);
    }

    return false;
  };

  // Filter menu items based on permissions for admin users
  type MenuItem = {
    path: string;
    label: string;
    icon: JSX.Element;
    badge?: string;
  };

  const menuItems: { section: string; items: MenuItem[] }[] = [
    { section: lang === 'ar' ? 'الرئيسية' : 'MAIN', items: [
      { path: 'dashboard', label: t('dashboard'), icon: <LayoutDashboard size={18} /> },
    ]},
    { section: lang === 'ar' ? 'مباشر' : 'LIVE', items: [
      { path: 'players', label: t('connectedPlayers'), icon: <Users size={18} /> },
      { path: 'screenshots', label: t('liveScreenshots'), icon: <Camera size={18} /> },
    ]},
    { section: lang === 'ar' ? 'اللاعبون' : 'PLAYERS', items: [
      { path: 'characters', label: t('characters'), icon: <UserSquare size={18} /> },
      { path: 'vehicles', label: t('vehicles'), icon: <Car size={18} /> },
      { path: 'gangs', label: t('gangs'), icon: <ShieldAlert size={18} /> },
      { path: 'inventory', label: t('inventory'), icon: <Package size={18} /> },
    ]},
    { section: lang === 'ar' ? 'العمليات' : 'OPERATIONS', items: [
      { path: 'queue', label: lang === 'ar' ? 'الأولوية والإنتظار' : 'Queue & Priority', icon: <Clock size={18} /> },
      { path: 'search', label: lang === 'ar' ? 'البحث المتقدم' : 'Advanced Search', icon: <Search size={18} /> },
    ]},
    { section: lang === 'ar' ? 'الحماية' : 'PROTECTION', items: [
      { path: 'bans', label: t('bans'), icon: <Ban size={18} /> },
      { path: 'logs', label: lang === 'ar' ? 'السجلات' : 'Logs', icon: <FileText size={18} /> },
    ]},
    { section: lang === 'ar' ? 'التهيئة' : 'CONFIG', items: [
      { path: 'admins', label: lang === 'ar' ? 'الإدارة والرتب' : 'Admins & Ranks', icon: <UserSquare size={18} /> },
      { path: 'settings', label: lang === 'ar' ? 'الإعدادات' : 'Settings', icon: <Settings size={18} /> },
      { path: 'license', label: t('licenseKey'), icon: <Key size={18} /> },
    ]},
  ];

  // Get the display role for the sidebar
  const getDisplayRole = () => {
    if (isOwner) return lang === 'ar' ? 'المالك' : 'Owner';
    if (adminRoleName) return adminRoleName;
    if (isAdmin) return lang === 'ar' ? 'إداري' : 'Admin';
    return lang === 'ar' ? 'الحساب' : 'Account';
  };

  // Get role badge color
  const getRoleBadgeColor = () => {
    if (isOwner) return '#f1c40f';
    if (adminRoleName) {
      const key = adminRoleName.toLowerCase();
      if (key.includes('admin')) return '#e74c3c';
      if (key.includes('moderator')) return '#3498db';
      if (key.includes('manager')) return '#9b59b6';
      if (key.includes('support')) return '#2ecc71';
    }
    return '#7289da';
  };

  return (
    <div className={`dashboard-layout ${lang}`}>
      {/* Expiry Overlay */}
      {isExpired && (
        <div className="offline-overlay animate-fade-in" style={{ zIndex: 10000 }}>
          <div className="offline-modal glass-panel" style={{ borderColor: '#8b0000' }}>
            <div className="offline-icon-wrapper" style={{ background: 'rgba(139, 0, 0, 0.2)' }}>
              <Clock size={40} color="#8b0000" />
            </div>
            <h2 style={{ color: '#8b0000' }}>{lang === 'ar' ? 'انتهت صلاحية الاشتراك' : 'Subscription Expired'}</h2>
            <p className="offline-desc">
              {lang === 'ar' ? 'عذراً، لقد انتهت صلاحية هذا الليسن كي. يرجى التواصل مع الإدارة لتجديد الاشتراب.' : 'Sorry, this license key has expired. Please contact administration to renew your subscription.'}
            </p>
            <div className="offline-actions" style={{ width: '100%' }}>
              <button className="retry-btn" style={{ width: '100%' }} onClick={() => navigate('/servers')}>
                < ChevronLeft size={16} /> {lang === 'ar' ? 'العودة لقائمة السيرفرات' : 'Back to Servers'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Navigation Loading Overlay */}
      {isNavigating && (
        <div className="nav-loading-overlay animate-fade-in">
          <div className="orbit-loader">
            <div className="orbit-ring ring-1"></div>
            <div className="orbit-ring ring-2"></div>
            <div className="orbit-ring ring-3"></div>
            <div className="orbit-center">
              <img src="/logo.png" alt="logo" className="orbit-logo-img" />
            </div>
          </div>
          <div className="loading-text mt-4" style={{ direction: 'ltr' }}>
             <span>S</span><span>h</span><span>e</span><span>f</span><span>r</span><span>a</span><span>&nbsp;</span><span>P</span><span>a</span><span>n</span><span>e</span><span>l</span>
          </div>
        </div>
      )}

      {!isExpired && status !== 'online' && (
        <div className="offline-overlay animate-fade-in">
          <div className="offline-modal glass-panel">
            <div className="offline-icon-wrapper">
              <RefreshCw size={40} className="spin" />
            </div>
            <h2>{lang === 'ar' ? 'بانتظار البيانات...' : 'Waiting for Data...'}</h2>
            <p className="offline-sub">
              {lang === 'ar' ? 'السيرفر غير متصل (فشل التحقق من الاتصال)' : 'Server not connected (last heartbeat check failed)'}
            </p>
            <p className="offline-desc">
              {lang === 'ar' ? 'ستفتح أدوات البانل تلقائياً بمجرد التحقق من السيرفر واتصاله وجاهزيته' : 'Panel tools will unlock automatically once the server connection is verified and ready.'}
            </p>
            <div className="offline-actions">
              <button className="retry-btn" onClick={() => window.location.reload()}>
                <RefreshCw size={16} /> {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </button>
              <button className="back-btn-alt" onClick={() => navigate('/servers')}>
                {lang === 'ar' ? 'رجوع' : 'Back'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <div className="server-info-flex">
              {logoUrl && <img src={logoUrl} alt="Logo" className="server-logo-mini" />}
              <span className="server-badge">
                {serverName} <span className={`status-dot ${status}`}></span>
                <span className={`package-badge ${packageType.toLowerCase()}`}>{packageType} {lang === 'ar' ? 'خطة' : 'Plan'}</span>
              </span>
              {/* Show admin badge in topbar */}
              {isAdmin && !isOwner && adminRoleName && (
                <span className="package-badge" style={{ background: 'rgba(139, 0, 0, 0.15)', color: getRoleBadgeColor(), fontSize: 10 }}>
                  <Shield size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  {adminRoleName}
                </span>
              )}
            </div>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <button className="back-to-hub" onClick={() => navigate('/servers')} style={{ marginLeft: lang === 'en' ? '12px' : '0', marginRight: lang === 'ar' ? '12px' : '0' }}>
              <ChevronLeft size={16} /> {t('back')}
            </button>
          </div>
        </header>
        
        <div className="dashboard-content-scroll">
          <Outlet />
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand-header">
           <div className="brand-logo-container">
              <img src={logoUrl || '/logo.png'} alt={serverName || 'Echo Panel'} className="sidebar-brand-logo" onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23e6192b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
              }} />
           </div>
           <div className="brand-info">
              <h1 className="brand-name">{serverName || 'Echo Panel'}</h1>
              <span className="brand-tag">Premium Edition</span>
           </div>
        </div>

        <div className="sidebar-scroll">
          {menuItems.map((section, idx) => (
            <div className="sidebar-section" key={idx}>
              <h4 className="section-title">{section.section}</h4>
              {section.items.map((item, i) => {
                const locked = isLocked(item.path);
                return (
                  <NavLink 
                    key={i} 
                    to={locked ? '#' : `/server/${serverId}/${item.path}`} 
                    className={({ isActive }) => `sidebar-link ${isActive && !locked ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    onClick={(e) => handleNavClick(item.path, e)}
                  >
                    {item.icon} {item.label}
                    {item.badge && !locked && <span className="badge-new-small">{item.badge}</span>}
                    {locked && <Key size={14} className="lock-icon" style={{ opacity: 0.5, marginLeft: 'auto' }} />}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="logout-icon-btn" onClick={handleLogout} title={t('logout')}>
            <LogOut size={20} />
          </button>
          <div className="sidebar-user">
            <div className="user-details">
              <span className="username">{user?.username || '—'}</span>
              <span className="role" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isOwner ? (
                  <Crown size={10} style={{ color: '#f1c40f' }} />
                ) : isAdmin ? (
                  <Shield size={10} style={{ color: getRoleBadgeColor() }} />
                ) : null}
                <span style={{ color: isOwner ? '#f1c40f' : isAdmin ? getRoleBadgeColor() : undefined }}>
                  {getDisplayRole()}
                </span>
              </span>
            </div>
            <img 
              src={user?.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'} 
              alt="Avatar" 
              className="sidebar-avatar" 
            />
          </div>
        </div>
      </aside>
    </div>
  );
};

export default DashboardLayout;
