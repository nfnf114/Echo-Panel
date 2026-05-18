import { useState, useEffect } from 'react'
import { Users, Car, Shield, Archive, Activity, RefreshCw, TrendingUp, ImageIcon, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function getHeaders() {
  return {
    Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`,
    'x-server-id': localStorage.getItem('active_server_id') || ''
  }
}

function parseCharInfo(p) {
  try { const parsed = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo) : p.charinfo; return parsed || {} } catch { return {} }
}
function parseJob(p) {
  try { const parsed = typeof p.job === 'string' ? JSON.parse(p.job) : p.job; return parsed || { label: '—' } } catch { return { label: '—' } }
}

function StatCard({ icon: Icon, label, value, color = 'red', sub }) {
  const colors = {
    red: 'text-brand-red bg-brand-red/10',
    blue: 'text-sky-400 bg-sky-400/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    yellow: 'text-amber-400 bg-amber-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
  }
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 hover:border-brand-red/30 transition-all duration-300 group cursor-default relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand-red/5 rounded-full blur-2xl group-hover:bg-brand-red/10 transition-all"></div>
      <div className="flex items-start justify-between mb-4 relative">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]} border border-white/5`}>
          <Icon size={22} />
        </div>
        <TrendingUp size={16} className="text-gray-600 group-hover:text-brand-red transition-colors" />
      </div>
      <div className="relative">
        <p className="text-3xl font-bold text-white tracking-tight">{value ?? <span className="text-gray-600">—</span>}</p>
        <p className="text-sm font-medium text-gray-400 mt-1">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-1 font-mono">{sub}</p>}
      </div>
    </div>
  )
}

// ── Online Players Widget ──────────────────────────────────
function OnlinePlayersWidget({ players, loading, t, lang }) {
  const navigate = useNavigate()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const displayPlayers = players.slice(0, 10) // Show top 10

  return (
    <div className="card h-full flex flex-col border-dark-600/50 relative overflow-hidden p-0">
      <div className="p-5 border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {lang === 'ar' ? 'اللاعبين المتصلين' : 'Online Players'}
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-1">{lang === 'ar' ? `إجمالي المتصلين: ${players.length}` : `Total Online: ${players.length}`}</p>
        </div>
        <button onClick={() => navigate('/panel/online')} className="text-xs bg-dark-700 hover:bg-brand-red text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-dark-500 hover:border-brand-red font-bold">
          {lang === 'ar' ? 'عرض الكل' : 'View All'}
        </button>
      </div>

      <div className="p-4">
        <input 
          type="text" 
          placeholder={lang === 'ar' ? "ابحث عن لاعب..." : "Search player..."}
          className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:border-brand-red transition-colors mb-2"
          disabled
        />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : players.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-600 min-h-[300px]">
          <Users size={32} className="mb-3 opacity-20" />
          <p className="text-sm font-bold">{lang === 'ar' ? 'لا يوجد لاعبون متصلون' : 'No players online'}</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px] px-4 pb-4 scrollbar-thin">
          {displayPlayers.map((p, i) => {
            const charinfo = parseCharInfo(p)
            // اسم الشخصية يأتي من charinfo أولاً ثم من name الذي أصبح يحمل firstname+lastname
            const charName = charinfo.firstname
              ? `${charinfo.firstname} ${charinfo.lastname || ''}`
              : (p.name || p.citizenid)
            const job = parseJob(p)
            return (
              <button
                key={p.citizenid || i}
                onClick={() => navigate(`/panel/players?focus=${p.citizenid || p.license}`)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl bg-dark-800 hover:bg-dark-700 transition-all border border-dark-600 hover:border-dark-500 group`}
              >
                <div className={`flex flex-col gap-1.5 flex-1 min-w-0 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <div className="flex justify-between items-start w-full">
                    <div className="flex flex-col gap-1">
                      <p className="text-gray-400 text-[11px] font-mono">
                        {lang === 'ar' ? 'الوظيفة:' : 'Job:'} <span className="text-gray-400">{job?.label || '—'}</span>
                      </p>
                      <p className="text-gray-500 text-[10px] font-mono truncate">CID: {p.citizenid || '—'}</p>
                    </div>
                    <div className="flex gap-3 items-center flex-shrink-0">
                       <div className="flex flex-col items-end">
                         <span className="text-white font-bold text-sm group-hover:text-brand-red transition-colors">{charName}</span>
                         <span className="text-gray-500 text-[10px] font-mono bg-dark-900 px-1.5 py-0.5 rounded mt-0.5 border border-dark-700">ID: {p.id || p.source || '—'}</span>
                       </div>
                       <div className="w-10 h-10 rounded-full bg-dark-700 border-2 border-dark-500 group-hover:border-brand-red/50 flex items-center justify-center text-gray-300 font-bold text-sm overflow-hidden transition-colors">
                         <img src={`${API}/uploads/avatars/${p.citizenid}_face.png`} alt={charName} className="w-full h-full object-cover" onError={e=>{e.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(charName||'?')}&background=14151a&color=fff&size=40`}}/>
                       </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Live Screenshots Widget ──────────────────────────────────
function LiveScreenshotsWidget({ players, lang }) {
  const navigate = useNavigate()
  const [tick, setTick] = useState(Date.now())
  const displayScreenshots = players.slice(0, 6)

  // Auto-refresh image cache every 5 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="card h-full flex flex-col border-dark-600/50 p-0 overflow-hidden">
      <div className="p-5 border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Camera size={18} className="text-brand-red animate-pulse" />
            {lang === 'ar' ? '\u0627\u0644\u0644\u0642\u0637\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629' : 'Live Screenshots'}
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-1">{lang === 'ar' ? '\u062a\u062a\u062d\u062f\u062b \u0643\u0644 5 \u062b\u0648\u0627\u0646\u064a' : 'Auto-refreshes every 5 seconds'}</p>
        </div>
        <button onClick={() => navigate('/panel/screenshots')} className="text-xs bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-brand-red/20 hover:border-brand-red font-bold flex items-center gap-1">
          <ImageIcon size={12} /> {lang === 'ar' ? '\u0641\u062a\u062d \u0627\u0644\u0645\u0639\u0631\u0636' : 'Open Gallery'}
        </button>
      </div>

      <div className="p-5 flex-1 bg-dark-900/50">
        {displayScreenshots.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-600 h-full">
             <ImageIcon size={48} className="mb-4 opacity-20" />
             <p className="text-sm font-bold">{lang === 'ar' ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0644\u0642\u0637\u0627\u062a \u062d\u0627\u0644\u064a\u0627\u064b' : 'No screenshots available'}</p>
           </div>
        ) : (
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
             {displayScreenshots.map((p, i) => {
               const charinfo = parseCharInfo(p)
               const charName = charinfo.firstname ? `${charinfo.firstname} ${charinfo.lastname || ''}` : (p.name || p.citizenid)
               return (
                 <div key={i} onClick={() => navigate(`/panel/players?focus=${p.citizenid || p.license}`)} className="aspect-video bg-dark-800 rounded-xl border border-dark-600 overflow-hidden relative group cursor-pointer hover:border-brand-red/50 transition-colors">
                   <img
                     src={`${API}/uploads/avatars/${p.citizenid}_face.png?t=${tick}`}
                     alt="Screenshot"
                     className="w-full h-full object-cover"
                     onError={e=>{e.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(charName||'?')}&background=14151a&color=fff&size=200`}}
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80"></div>
                   <div className="absolute bottom-2 right-2 left-2 text-right">
                      <p className="text-white text-xs font-bold truncate group-hover:text-brand-red transition-colors">{charName}</p>
                      <p className="text-gray-400 text-[9px] font-mono">ID: {p.id || p.source}</p>
                   </div>
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                      <Camera size={24} className="text-white" />
                   </div>
                 </div>
               )
             })}
           </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const { t, lang } = useLanguage()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API}/api/stats`, { headers: getHeaders() })
      setStats(data)
    } catch {
      setStats({ online: false, players: 0, maxPlayers: 0, vehicles: 0, gangs: 0, stashes: 0, characters: 0, bans: 0 })
    } finally {
      setLoading(false)
    }
  }

  const fetchOnline = async () => {
    setLoadingPlayers(true)
    try {
      const { data } = await axios.get(`${API}/api/online`, { headers: getHeaders() })
      setOnlinePlayers(Array.isArray(data) ? data : [])
    } catch {
      setOnlinePlayers([])
    }
    setLoadingPlayers(false)
  }

  useEffect(() => {
    fetchStats()
    fetchOnline()
    const i1 = setInterval(fetchStats, 30000)
    const i2 = setInterval(fetchOnline, 15000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [])

  return (
    <div className={`space-y-6 ${dir === 'rtl' ? 'font-arabic' : ''}`} dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</h1>
          <p className="text-gray-400 text-sm mt-1">{lang === 'ar' ? 'مرحباً بك في لوحة تحكم سيرفرك' : 'Welcome to your server dashboard'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchStats(); fetchOnline() }} className="btn-secondary text-xs px-4 py-2 font-bold">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {lang === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard icon={Users} label={lang === 'ar' ? 'إجمالي الشخصيات' : 'Total Characters'} value={stats?.characters} color="red" />
        <StatCard 
          icon={Activity} 
          label={lang === 'ar' ? 'اللاعبين المتصلين' : 'Online Players'} 
          value={onlinePlayers.length} 
          color="green" 
          sub={stats?.maxPlayers ? `${onlinePlayers.length} / ${stats.maxPlayers} ${lang === 'ar' ? 'الحد الأقصى' : 'max'}` : undefined} 
        />
        <StatCard icon={Shield} label={lang === 'ar' ? 'إجمالي الحسابات' : 'Total Accounts'} value={stats?.characters} color="blue" sub={lang === 'ar' ? 'الحسابات المسجلة' : 'Registered Accounts'} />
        <StatCard icon={Car} label={lang === 'ar' ? 'إجمالي المركبات' : 'Total Vehicles'} value={stats?.vehicles} color="orange" />
      </div>

      {/* Main Content Grid: Live Screenshots (Left) & Online Players (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
        
        {/* Right Column (Online Players) - takes 4/12 */}
        <div className="lg:col-span-5 xl:col-span-4 h-[600px]">
          <OnlinePlayersWidget players={onlinePlayers} loading={loadingPlayers} t={t} lang={lang} />
        </div>

        {/* Left Column (Live Screenshots) - takes 8/12 */}
        <div className="lg:col-span-7 xl:col-span-8 h-[600px] order-last lg:order-first">
          <LiveScreenshotsWidget players={onlinePlayers} lang={lang} />
        </div>

      </div>
    </div>
  )
}
