import { useState, useEffect } from 'react'
import { Server, ChevronRight, ChevronLeft, LogOut, Loader2, Info, Lock } from 'lucide-react'
import axios from 'axios'
import { useLanguage } from '../contexts/LanguageContext'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const PLAN_META = {
  'Echo Trial': { label: 'TRIAL', color: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  'Echo Lite':  { label: 'LITE', color: 'text-gray-400', badge: 'bg-gray-500/10 text-gray-300 border-gray-500/20' },
  'Echo Pro':   { label: 'PRO', color: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  'Echo Max':   { label: 'MAX', color: 'text-brand-red', badge: 'bg-brand-red/10 text-brand-red border-brand-red/20' },
}

export default function ServerSelection({ onSelectServer, onLogout }) {
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState(null)
  const { t, lang } = useLanguage()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const { data } = await axios.get(`${API}/api/my-servers`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` }
        })
        setServers(data)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    fetchServers()
  }, [])

  return (
    <div className={`min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4 relative overflow-hidden ${dir === 'rtl' ? 'font-arabic' : ''}`} dir={dir}>
      {/* Background Styling identical to Portal */}
      <div className="absolute inset-0 bg-stripes pointer-events-none opacity-[0.15]"></div>
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-brand-red/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      <div className="w-full max-w-5xl relative z-10 flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-dark-800/80 backdrop-blur-xl border border-dark-600 p-6 rounded-2xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center overflow-hidden border border-brand-red/40">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
              <Server size={28} className="text-brand-red hidden" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">{t('Select Your Server')}</h1>
              <p className="text-gray-400 text-sm mt-1">{t('Choose a server to manage')}</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 p-3 px-5 bg-dark-700 hover:bg-brand-red/20 hover:border-brand-red/50 text-gray-400 hover:text-brand-red rounded-xl transition-all border border-dark-600" title={t('Logout')}>
            <span className="font-bold hidden sm:inline">{t('Logout')}</span>
            <LogOut size={20} />
          </button>
        </div>

        {/* Server Grid */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-4 bg-dark-800/60 backdrop-blur-xl border border-dark-600 rounded-2xl">
              <Loader2 size={48} className="text-brand-red animate-spin" />
              <p className="text-gray-400 font-medium">{t('Loading')}</p>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center max-w-md mx-auto bg-dark-800/60 backdrop-blur-xl border border-dark-600 rounded-2xl">
              <div className="w-20 h-20 bg-dark-700 border border-dark-600 rounded-full flex items-center justify-center mb-6">
                <Info size={32} className="text-gray-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('No Servers Found')}</h3>
              <p className="text-gray-400 leading-relaxed px-4">
                {lang === 'ar' ? 'لا يوجد لديك أي تراخيص نشطة حالياً. يرجى التواصل مع الإدارة لشراء ترخيص أو تفعيله.' : 'You don\'t have an active license. Please contact the admin to purchase or activate one.'}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servers.map((srv, index) => {
                const plan = srv.plan || 'Echo Trial'
                const meta = PLAN_META[plan] || PLAN_META['Echo Trial']
                
                const isLinked = srv.server_id != null
                const isOnline = isLinked && srv.online === 1
                const isHovered = hoveredId === srv.id
                
                const displayName = srv.server_display_name || srv.lic_name || (lang === 'ar' ? 'سيرفر غير مسجل' : 'Unregistered Server')
                
                return (
                  <button
                    key={srv.id || index}
                    onClick={() => {
                      if(isLinked) {
                        onSelectServer({ ...srv, plan, id: srv.server_id })
                      }
                    }}
                    onMouseEnter={() => setHoveredId(srv.id || index)}
                    onMouseLeave={() => setHoveredId(null)}
                    disabled={!isLinked}
                    className={`group text-start relative overflow-hidden rounded-2xl transition-all duration-300 border backdrop-blur-xl ${
                      isLinked 
                        ? (isHovered ? 'bg-dark-700 border-brand-red/50 -translate-y-2' : 'bg-dark-800/80 border-dark-600') 
                        : 'bg-dark-900/80 border-dark-700 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {/* Top Accent Line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 transition-colors ${isOnline ? 'bg-accent-green' : (isLinked ? 'bg-brand-red' : 'bg-gray-600')}`}></div>
                    
                    {/* Hover Glow Background */}
                    {isLinked && (
                      <div className={`absolute inset-0 bg-gradient-to-b from-brand-red/5 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}></div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex gap-4 items-center">
                          <div className="relative">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors ${isOnline ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' : (isLinked ? 'bg-brand-red/10 border-brand-red/30 text-brand-red' : 'bg-dark-700 border-dark-600 text-gray-500')}`}>
                              {isOnline ? <Server size={24} /> : <Lock size={24} />}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-dark-800 ${isOnline ? 'bg-accent-green' : (isLinked ? 'bg-brand-red' : 'bg-gray-500')}`}></div>
                          </div>
                          
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1.5 group-hover:text-brand-red transition-colors">{displayName}</h3>
                            <span className={`text-[11px] font-bold px-2 py-1 rounded-md border uppercase tracking-wider ${meta.badge}`}>
                              {meta.label} {plan}
                            </span>
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        {isLinked && (
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 ${isHovered ? 'bg-brand-red border-brand-red text-white' : 'bg-dark-700 border-dark-600 text-gray-400'}`}>
                            {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                          </div>
                        )}
                      </div>

                      <div className="bg-dark-900/50 rounded-xl p-3 border border-dark-600/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{t('License Key')}</span>
                          <span className="text-gray-400 font-mono tracking-wider">{srv.key || srv.license_key}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-dark-600/50">
                          <span className="text-gray-500">{lang === 'ar' ? 'الآي بي' : 'Server IP'}</span>
                          <span className="text-gray-400 font-mono tracking-wider">{srv.server_ip || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-dark-600/50">
                          <span className="text-gray-500">{t('Bridge')}</span>
                          <span className={`font-medium ${isOnline ? 'text-accent-green' : (isLinked ? 'text-brand-red' : 'text-gray-500')}`}>
                            {isOnline 
                              ? (lang === 'ar' ? 'متصل — السكربت يعمل' : 'Connected — Bridge Active')
                              : (isLinked ? (lang === 'ar' ? 'مفصول — يرجى تشغيل السكربت' : 'Offline — Start script') : (lang === 'ar' ? 'غير مرتبط بأي سيرفر' : 'Not Linked to Server'))
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
