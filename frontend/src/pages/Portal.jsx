import { useState, useEffect, useContext } from 'react'
import {
  Server, Package, ChevronRight, LogOut, ChevronLeft, Globe, Activity, Users, Shield,
  Monitor, ShieldCheck, Settings2, Camera, RefreshCw, UserCheck, Code2, Lock, Cpu, User
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useLanguage } from '../contexts/LanguageContext'
import { ServerContext } from '../App'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const features = [
  { icon: Monitor, titleKey: 'features.realtime.title', descKey: 'features.realtime.desc' },
  { icon: ShieldCheck, titleKey: 'features.security.title', descKey: 'features.security.desc' },
  { icon: Settings2, titleKey: 'features.management.title', descKey: 'features.management.desc' },
  { icon: Lock, titleKey: 'features.permissions.title', descKey: 'features.permissions.desc' },
  { icon: Camera, titleKey: 'features.screenshots.title', descKey: 'features.screenshots.desc' },
  { icon: RefreshCw, titleKey: 'features.updates.title', descKey: 'features.updates.desc' },
]

const teamMembers = [
  { nameKey: 'team.member1.name', roleKey: 'team.member1.role', icon: Code2 },
  { nameKey: 'team.member2.name', roleKey: 'team.member2.role', icon: Cpu },
  { nameKey: 'team.member3.name', roleKey: 'team.member3.role', icon: UserCheck },
  { nameKey: 'team.member4.name', roleKey: 'team.member4.role', icon: Shield },
]

export default function Portal({ user, onLogout }) {
  const navigate = useNavigate()
  const { lang, setLang, t } = useLanguage()
  const { handleChangeServer } = useContext(ServerContext)
  const [stats, setStats] = useState({ servers: 0, licenses: 0, users: 0 })
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    axios.get(`${API}/api/global-stats`).then(res => setStats(res.data)).catch(() => {})
  }, [])

  return (
    <div className={`min-h-screen bg-dark-900 flex flex-col relative overflow-hidden ${dir === 'rtl' ? 'font-arabic' : ''}`} dir={dir}>
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-red/5 rounded-full blur-[200px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-brand-red/3 rounded-full blur-[180px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand-red/3 rounded-full blur-[120px] pointer-events-none animate-pulse-glow"></div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between p-4 sm:px-8 sm:py-5 border-b border-dark-600/40 bg-dark-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onLogout} className="flex items-center gap-2 p-2 hover:bg-dark-700 text-gray-400 hover:text-white rounded-xl transition-all border border-transparent hover:border-dark-600" title={t('Logout')}>
            <LogOut size={18} />
          </button>

          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-600 text-gray-300 text-sm font-bold transition-all hover:border-brand-red/50 hover:text-white"
          >
            {lang === 'ar' ? (
              <><span className="text-sm font-bold">EN</span></>
            ) : (
              <><span className="text-sm font-bold">AR</span></>
            )}
          </button>

          <div className="h-8 w-px bg-dark-600 mx-1 hidden sm:block"></div>

          <div className="hidden sm:flex items-center gap-3">
            <img
              src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://ui-avatars.com/api/?name=${user?.username}&background=2d2d35&color=fff`}
              alt="Avatar"
              className="w-9 h-9 rounded-xl border border-dark-600"
            />
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{t('Welcome back')}</p>
              <p className="text-white text-sm font-bold">{user?.username}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-end hidden sm:block">
            <h2 className="text-lg font-bold text-white tracking-wide">{t('Echo Store')}</h2>
            <p className="text-xs text-gray-400">{t('Customer Portal')}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-dark-800 flex items-center justify-center overflow-hidden border border-brand-red/30">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
            <Server size={18} className="text-brand-red hidden" />
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="relative z-10 flex-1">

        {/* ==================== HERO SECTION ==================== */}
        <section className="portal-section flex flex-col items-center justify-center text-center py-20 sm:py-28 px-6">
          <div className="max-w-3xl mx-auto">
            {/* Small brand label */}
            <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-red/30 bg-brand-red/5 mb-8">
              <div className="w-2 h-2 rounded-full bg-brand-red animate-pulse-glow"></div>
              <span className="text-brand-red text-xs font-bold uppercase tracking-widest">{t('hero.subtitle')}</span>
            </div>

            {/* Main Title */}
            <h1 className="animate-fade-up delay-100 text-6xl sm:text-7xl md:text-8xl font-black tracking-tight mb-6">
              <span className="hero-gradient-text">{t('hero.title')}</span>
            </h1>

            {/* Description */}
            <p className="animate-fade-up delay-200 text-gray-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              {t('hero.description')}
            </p>

            {/* CTA Buttons */}
            <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => { handleChangeServer(); navigate('/panel') }}
                className="btn-primary py-3 px-8 rounded-xl font-bold text-[15px] flex items-center gap-2 transition-all hover:brightness-110"
              >
                <span>{t('hero.cta')}</span>
                {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
              <button
                onClick={() => navigate('/client')}
                className="btn-secondary py-3 px-8 rounded-xl font-bold text-[15px] flex items-center gap-2 transition-all"
              >
                <Package size={18} />
                <span>{t('Open Client Area')}</span>
              </button>
            </div>
          </div>

          {/* Decorative line */}
          <div className="w-full max-w-md mx-auto mt-16">
            <div className="h-px bg-gradient-to-r from-transparent via-brand-red/30 to-transparent animate-draw-line delay-500"></div>
          </div>
        </section>

        {/* ==================== FEATURES SECTION ==================== */}
        <section className="portal-section py-16 sm:py-24 px-6">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-14 animate-fade-up">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                {t('features.title')}
              </h2>
              <p className="text-gray-400 text-base max-w-lg mx-auto">
                {t('features.subtitle')}
              </p>
              <div className="w-16 h-0.5 bg-brand-red mx-auto mt-6"></div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.titleKey}
                    className={`group relative bg-dark-800/60 border border-dark-600/60 rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:border-brand-red/40 hover:bg-dark-800/90 animate-fade-up delay-${(index + 1) * 100}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-dark-700/80 border border-dark-600 flex items-center justify-center transition-all duration-300 group-hover:bg-brand-red/10 group-hover:border-brand-red/40">
                        <Icon size={22} className="text-gray-400 group-hover:text-brand-red transition-colors duration-300" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-bold text-base mb-1.5">{t(feature.titleKey)}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{t(feature.descKey)}</p>
                      </div>
                    </div>
                    <div className="feature-card-line mt-5 rounded-full"></div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ==================== QUICK ACCESS SECTION ==================== */}
        <section className="portal-section py-16 sm:py-24 px-6">
          <div className="max-w-5xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-14 animate-fade-up">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                {t('quickaccess.title')}
              </h2>
              <p className="text-gray-400 text-base max-w-lg mx-auto">
                {t('quickaccess.subtitle')}
              </p>
              <div className="w-16 h-0.5 bg-brand-red mx-auto mt-6"></div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Client Area Card */}
              <div className="group relative bg-dark-800/80 border border-dark-600/60 rounded-3xl p-8 sm:p-10 text-center flex flex-col items-center justify-center gap-5 overflow-hidden transition-all duration-500 hover:border-brand-red/50 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-brand-red/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative z-10">
                  <div className="w-18 h-18 mx-auto bg-dark-700/80 rounded-2xl flex items-center justify-center mb-5 border border-dark-600 group-hover:border-brand-red/50 group-hover:bg-brand-red/10 transition-all duration-300" style={{ width: '72px', height: '72px' }}>
                    <Package size={32} className="text-gray-400 group-hover:text-brand-red transition-colors" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3 tracking-wide">{t('Client Area')}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto mb-7">
                    {t('Review your products, licenses, updates, and download the newest releases linked to your account.')}
                  </p>

                  <button
                    onClick={() => navigate('/client')}
                    className="btn-primary w-full max-w-[240px] py-3.5 px-6 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 group/btn"
                  >
                    <span>{t('Open Client Area')}</span>
                    {dir === 'rtl' ? <ChevronLeft size={18} className="group-hover/btn:-translate-x-1 transition-transform" /> : <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />}
                  </button>
                </div>
              </div>

              {/* Server Management Card */}
              <div className="group relative bg-dark-800/80 border border-dark-600/60 rounded-3xl p-8 sm:p-10 text-center flex flex-col items-center justify-center gap-5 overflow-hidden transition-all duration-500 hover:border-blue-500/50 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative z-10">
                  <div className="w-18 h-18 mx-auto bg-dark-700/80 rounded-2xl flex items-center justify-center mb-5 border border-dark-600 group-hover:border-blue-500/50 group-hover:bg-blue-500/10 transition-all duration-300" style={{ width: '72px', height: '72px' }}>
                    <Server size={32} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3 tracking-wide">{t('Server Management')}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto mb-7">
                    {t('Open the server selection screen, then proceed to the live panel, permissions and operational tools.')}
                  </p>

                  <button
                    onClick={() => { handleChangeServer(); navigate('/panel') }}
                    className="w-full max-w-[240px] py-3.5 px-6 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 bg-accent-blue hover:brightness-110 text-white transition-all group/btn"
                  >
                    <span>{t('Go to Server Management')}</span>
                    {dir === 'rtl' ? <ChevronLeft size={18} className="group-hover/btn:-translate-x-1 transition-transform" /> : <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== STATS SECTION ==================== */}
        <section className="portal-section py-16 sm:py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="bg-dark-800/40 border border-dark-600/40 rounded-3xl p-8 sm:p-12">
              <div className="text-center mb-10">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Activity size={20} className="text-brand-red" />
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {lang === 'ar' ? 'إحصائيات الشبكة' : 'Network Statistics'}
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">
                  {lang === 'ar' ? 'بيانات حية من شبكتنا العالمية' : 'Live data from our global network'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 sm:gap-6">
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 animate-count-up delay-100">
                  <div className="w-14 h-14 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mb-4">
                    <Activity size={24} className="text-accent-green" />
                  </div>
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">{stats.servers}</p>
                  <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-semibold">{lang === 'ar' ? 'سيرفر نشط' : 'Active Servers'}</p>
                </div>
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 animate-count-up delay-300">
                  <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mb-4">
                    <Users size={24} className="text-accent-blue" />
                  </div>
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">{stats.users}</p>
                  <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-semibold">{lang === 'ar' ? 'عميل نشط' : 'Total Users'}</p>
                </div>
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 animate-count-up delay-500">
                  <div className="w-14 h-14 rounded-2xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center mb-4">
                    <Shield size={24} className="text-brand-red" />
                  </div>
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">{stats.licenses}</p>
                  <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-semibold">{lang === 'ar' ? 'تراخيص مسجلة' : 'Registered Licenses'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== TEAM SECTION ==================== */}
        <section className="portal-section py-16 sm:py-24 px-6">
          <div className="max-w-5xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-14 animate-fade-up">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
                {t('team.title')}
              </h2>
              <p className="text-gray-400 text-base max-w-lg mx-auto">
                {t('team.subtitle')}
              </p>
              <div className="w-16 h-0.5 bg-brand-red mx-auto mt-6"></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {teamMembers.map((member, index) => {
                const Icon = member.icon
                return (
                  <div
                    key={member.nameKey}
                    className={`group text-center bg-dark-800/50 border border-dark-600/50 rounded-2xl p-6 transition-all duration-300 hover:border-brand-red/30 hover:bg-dark-800/80 animate-fade-up delay-${(index + 1) * 100}`}
                  >
                    <div className="team-avatar mx-auto mb-4">
                      <Icon size={28} className="text-gray-500 group-hover:text-brand-red transition-colors duration-300" />
                    </div>
                    <h4 className="text-white font-bold text-sm mb-1">{t(member.nameKey)}</h4>
                    <p className="text-gray-500 text-xs">{t(member.roleKey)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-dark-600/30 bg-dark-900/60">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center border border-brand-red/20">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover rounded-lg" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                <Server size={14} className="text-brand-red hidden" />
              </div>
              <span className="text-white font-bold text-sm">{t('Echo Store')}</span>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs">&copy; 2026 Echo Store. All rights reserved.</p>
              <p className="text-gray-600 text-[10px] mt-1">High Performance FiveM SaaS Platform</p>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-gray-500" />
              <span className="text-gray-500 text-xs">{lang === 'ar' ? 'العربية' : 'English'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
