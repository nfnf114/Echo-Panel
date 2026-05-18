import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useContext } from 'react'
import { ServerContext } from '../App'
import { useLanguage } from '../contexts/LanguageContext'
import {
  LayoutDashboard, Users, Camera, User, Car, Shield, Archive,
  Clock, Search, Ban, ScanLine, FileText, Crown, Settings,
  LogOut, Server, Menu, Lock, Download, ChevronRight, Hexagon
} from 'lucide-react'

const navGroups = {
  ar: [
    {
      label: 'الرئيسية',
      items: [
        { to: '/panel', label: 'لوحة التحكم', icon: LayoutDashboard, end: true, key: 'dashboard' },
      ]
    },
    {
      label: 'مباشر',
      items: [
        { to: '/panel/online', label: 'اللاعبين المتصلين', icon: Users, key: 'online' },
        { to: '/panel/screenshots', label: 'اللقطات المباشرة', icon: Camera, key: 'screenshots' },
      ]
    },
    {
      label: 'اللاعبون',
      items: [
        { to: '/panel/players', label: 'الشخصيات', icon: User, key: 'players' },
        { to: '/panel/vehicles', label: 'المركبات', icon: Car, key: 'vehicles' },
        { to: '/panel/gangs', label: 'العصابات', icon: Shield, key: 'gangs' },
        { to: '/panel/stashes', label: 'المخازن', icon: Archive, key: 'stashes' },
      ]
    },
    {
      label: 'العمليات',
      items: [
        { to: '/panel/queue', label: 'الأولوية والانتظار', icon: Clock, key: 'queue' },
        { to: '/panel/investigate', label: 'البحث المتقدم', icon: Search, key: 'investigate' },
      ]
    },
    {
      label: 'الحماية',
      items: [
        { to: '/panel/bans', label: 'الحظر', icon: Ban, key: 'bans' },
        { to: '/panel/dupe-scanner', label: 'فحص التدبيل', icon: ScanLine, key: 'dupe-scanner' },
        { to: '/panel/logs', label: 'السجلات', icon: FileText, key: 'logs' },
      ]
    },
    {
      label: 'التنظيم',
      items: [
        { to: '/panel/admins', label: 'الرتب والإدارة', icon: Crown, key: 'admins' },
        { to: '/panel/settings', label: 'الإعدادات', icon: Settings, key: 'settings' },
      ]
    },
  ],
  en: [
    {
      label: 'Main',
      items: [
        { to: '/panel', label: 'Dashboard', icon: LayoutDashboard, end: true, key: 'dashboard' },
      ]
    },
    {
      label: 'Live',
      items: [
        { to: '/panel/online', label: 'Online Players', icon: Users, key: 'online' },
        { to: '/panel/screenshots', label: 'Live Screens', icon: Camera, key: 'screenshots' },
      ]
    },
    {
      label: 'Players',
      items: [
        { to: '/panel/players', label: 'Characters', icon: User, key: 'players' },
        { to: '/panel/vehicles', label: 'Vehicles', icon: Car, key: 'vehicles' },
        { to: '/panel/gangs', label: 'Gangs', icon: Shield, key: 'gangs' },
        { to: '/panel/stashes', label: 'Stashes', icon: Archive, key: 'stashes' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { to: '/panel/queue', label: 'Priority Queue', icon: Clock, key: 'queue' },
        { to: '/panel/investigate', label: 'Advanced Search', icon: Search, key: 'investigate' },
      ]
    },
    {
      label: 'Protection',
      items: [
        { to: '/panel/bans', label: 'Bans', icon: Ban, key: 'bans' },
        { to: '/panel/dupe-scanner', label: 'Dupe Scanner', icon: ScanLine, key: 'dupe-scanner' },
        { to: '/panel/logs', label: 'Logs', icon: FileText, key: 'logs' },
      ]
    },
    {
      label: 'Organization',
      items: [
        { to: '/panel/admins', label: 'Admins & Ranks', icon: Crown, key: 'admins' },
        { to: '/panel/settings', label: 'Settings', icon: Settings, key: 'settings' },
      ]
    },
  ]
}

export default function DashboardLayout({ user, onLogout }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const { lang: language, setLang: setLanguage } = useLanguage()
  const { activeServer, navBlocked, handleChangeServer, permissions, isOwner } = useContext(ServerContext)

  const serverDisplayName = activeServer?.name || activeServer?.lic_name || 'Server'

  const handleLogout = () => {
    if (onLogout) onLogout()
    else { localStorage.removeItem('panel_user'); navigate('/login') }
  }

  const toggleLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar')
  const dir = language === 'ar' ? 'rtl' : 'ltr'

  return (
    <div className={`flex h-screen bg-dark-900 overflow-hidden font-sans`} dir={dir}>
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-[#0d0f14] border-l border-dark-600 flex flex-col transition-all duration-300 relative z-10`}>
        
        {/* Logo Section */}
        <div className="pt-6 pb-3 px-5 flex items-center justify-end gap-3">
          {!collapsed && <span className="font-black text-white text-lg ml-2 tracking-wide">Echo Panel</span>}
          <div className="w-8 h-8 rounded-lg bg-[#111317] border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
            <div className="hidden text-brand-red">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19.5h20L12 2zm0 4l7 13.5H5L12 6z"/></svg>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        {!collapsed && (
          <div className="px-6 mb-4 flex justify-center border-b border-dark-600 pb-4">
            <button onClick={() => setCollapsed(true)} className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white transition-colors bg-dark-800 hover:bg-dark-700 px-4 py-1.5 rounded-lg border border-dark-600 w-full max-w-[120px]">
              <ChevronRight size={16} />
              <span>تصغير</span>
            </button>
          </div>
        )}
        {collapsed && (
          <div className="px-2 mb-4 flex justify-center">
            <button onClick={() => setCollapsed(false)} className="text-gray-400 hover:text-white transition-colors">
              <Menu size={16} />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-4 scrollbar-thin">
          {(navGroups[language] || navGroups.en).map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-[11px] text-gray-500 font-black mb-2 px-2 uppercase tracking-widest text-right">{group.label}</p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const permMap = {
                    'dashboard': '*', 'online': 'view_online', 'screenshots': 'live_screens',
                    'players': 'view_players', 'vehicles': 'view_vehicles', 'gangs': 'view_gangs',
                    'stashes': 'view_stashes', 'queue': 'view_queue', 'investigate': 'investigate',
                    'bans': 'view_bans', 'dupe-scanner': 'view_dupes', 'logs': 'view_audit_logs',
                    'admins': 'manage_admins', 'settings': 'manage_settings'
                  }
                  
                  const requiredPerm = permMap[item.key]
                  const hasPermission = user?.isOwner || isOwner || permissions.includes('*') || permissions.includes(requiredPerm)
                  
                  if (!hasPermission && item.key !== 'dashboard') return null

                  const isBlocked = navBlocked.includes(item.key)
                  if (isBlocked) {
                    return (
                      <div
                        key={item.to}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-not-allowed opacity-30 select-none ${collapsed ? 'justify-center px-2' : ''}`}
                      >
                        <item.icon size={18} className="flex-shrink-0 text-gray-500" />
                        {!collapsed && (
                          <div className="flex items-center justify-between flex-1 min-w-0">
                            <span className="text-gray-500 text-sm font-bold truncate">{item.label}</span>
                            <Lock size={12} className="text-gray-600 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-[13.5px] ${
                          isActive 
                            ? 'bg-brand-red/15 text-brand-red border border-brand-red/20' 
                            : 'text-gray-400 hover:text-white hover:bg-dark-700/60 border border-transparent'
                        } ${collapsed ? 'justify-center px-2' : ''}`
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span className="flex-1 text-right">{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Download Script */}
          <div className="mt-4 mb-3 px-1">
            <a
              href={import.meta.env.VITE_DOWNLOAD_LINK || `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/download-script`}
              target="_blank" rel="noreferrer"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-dark-700/60 hover:text-white transition-all text-[13.5px] font-bold group border border-transparent hover:border-dark-600 ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? 'Download Bridge Script' : undefined}
            >
              <Download size={18} className="flex-shrink-0 group-hover:-translate-y-0.5 transition-transform" />
              {!collapsed && <span className="flex-1 text-right">{language === 'ar' ? 'تحميل السكربت' : 'Download Script'}</span>}
            </a>
          </div>
        </nav>

        {/* User Footer */}
        <div className={`p-4 border-t border-dark-600 flex flex-col gap-3 mt-auto bg-[#0b0c10]`}>
          {!collapsed && (
            <div className="flex items-center justify-between gap-3 min-w-0">
              <button onClick={handleLogout} className="text-gray-500 hover:text-brand-red transition-colors p-1 flex-shrink-0" title="تسجيل الخروج">
                <LogOut size={16} className="rotate-180" />
              </button>
              <div className="flex items-center gap-3 min-w-0 text-right flex-1 justify-end">
                <div className="flex flex-col items-end">
                  <p className="text-white text-xs font-bold truncate">{user?.username || 'daltonop'}</p>
                  <p className="text-gray-500 text-[10px] font-bold">الحساب</p>
                </div>
                <img
                  src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32` : `https://ui-avatars.com/api/?name=${user?.username || 'd'}&background=c91c1c&color=fff&size=32`}
                  className="w-8 h-8 rounded-full flex-shrink-0 border border-dark-500"
                  alt="avatar"
                />
              </div>
            </div>
          )}
          {collapsed && (
            <button onClick={handleLogout} className="text-gray-500 hover:text-brand-red transition-colors w-full flex justify-center p-2" title="تسجيل الخروج">
              <LogOut size={16} className="rotate-180" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-dark-900 z-10 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-[72px] flex-shrink-0 flex items-center justify-between px-8 border-b border-dark-600 bg-dark-900 sticky top-0 z-20">
          
          {/* Right Side (Next to sidebar): Server Dropdown */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-full px-4 py-1.5 cursor-pointer hover:bg-dark-700 transition-colors" onClick={handleChangeServer}>
              <span className="text-sm font-bold text-white tracking-wide">{serverDisplayName}</span>
              <div className={`w-2 h-2 rounded-full ${activeServer?.online ? 'bg-accent-green' : 'bg-red-500'}`}></div>
            </div>
          </div>

          {/* Left Side: Server Status */}
          <div className="flex items-center gap-5">
            <span className={`px-4 py-1 rounded-full text-[11px] font-bold border ${activeServer?.online ? 'bg-accent-green/10 text-accent-green border-accent-green/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              {activeServer?.online ? 'متصل' : 'مفصول'}
            </span>
            
            <span className="text-xs text-gray-500 font-bold font-mono">v1.0.0</span>

            <div className="h-4 w-px bg-dark-600"></div>
            
            <button onClick={toggleLanguage} className="flex items-center gap-2 text-xs text-gray-300 font-bold hover:text-white transition-colors">
              <span>{language === 'ar' ? 'العربية' : 'English'}</span>
              <img src={language === 'ar' ? "https://flagcdn.com/w20/sa.png" : "https://flagcdn.com/w20/us.png"} className="w-4 h-3 object-cover rounded-sm" alt="flag" />
            </button>

            <div className="h-4 w-px bg-dark-600"></div>
            
            <a
              href="https://discord.gg/haPZZ3BpPZ"
              target="_blank"
              rel="noreferrer"
              className="text-[#5865F2] hover:text-[#4752c4] transition-colors"
              title="Discord Store"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
            </a>
          </div>
        </header>

        {/* Page Area */}
        <div className="flex-1 p-8 animate-fade-in relative scrollbar-thin overflow-y-auto">
           <Outlet />
        </div>
      </main>
    </div>
  )
}
