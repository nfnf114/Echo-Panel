import { useState, useEffect } from 'react'
import { Users, Search, RefreshCw, MessageSquare, Ban } from 'lucide-react'
import axios from 'axios'
import PlayerProfile from './PlayerProfile'
import { Modal, Inp, Btns, issueCommand } from './PlayerProfileUtils'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function getH() {
  return {
    Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`,
    'x-server-id': localStorage.getItem('active_server_id') || ''
  }
}

function parseJ(v) { try { return typeof v === 'string' ? JSON.parse(v) : (v||{}) } catch { return {} } }

function MessageModal({ player, onClose }) {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { await issueCommand('dm', player.citizenid, { message: msg }); onClose() } catch(e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title={`إشعار — ${player.name||player.citizenid}`} onClose={onClose}>
      <div className="space-y-3">
        <Inp placeholder="نص الرسالة..." value={msg} onChange={e=>setMsg(e.target.value)} />
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

import { useLanguage } from '../contexts/LanguageContext'

export default function OnlinePlayers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [msgTarget, setMsgTarget] = useState(null)
  const [profilePlayer, setProfilePlayer] = useState(null)
  const { lang, t } = useLanguage()

  const fetchPlayers = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/online`, { headers: getH() })
      const normalized = (Array.isArray(data) ? data : []).map(p => {
        // The heartbeat sends: name (already resolved charname), firstname, lastname, citizenid, job, gang
        const fName = p.firstname
        const lName = p.lastname
        // Build charName from firstname/lastname if available, otherwise use p.name which is already the character name
        const charName = fName ? `${fName} ${lName || ''}`.trim() : (p.name || p.citizenid)
        // job and gang may be strings (labels) or objects
        const jobObj = typeof p.job === 'object' ? p.job : { label: p.job || '—' }
        const gangObj = typeof p.gang === 'object' ? p.gang : { label: p.gang || 'No Gang' }
        return { ...p, online: true, charName, jobLabel: jobObj.label || p.job || '—', gangLabel: gangObj.label || p.gang || '—', cash: 0 }
      })
      setPlayers(normalized)
    } catch { setPlayers([]) }
    setLoading(false)
  }

  useEffect(() => { fetchPlayers(); const t = setInterval(fetchPlayers, 15000); return () => clearInterval(t) }, [])

  const filtered = players.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name?.toLowerCase().includes(q) || p.citizenid?.toLowerCase().includes(q)
  })

  const openProfile = async (p) => {
    try {
      const { data } = await axios.get(`${API}/api/players/${p.citizenid}`, { headers: getH() })
      setProfilePlayer({ ...data, online: true })
    } catch { setProfilePlayer(p) }
  }

  return (
    <div className="space-y-5" dir="rtl">
      {msgTarget && <MessageModal player={msgTarget} onClose={() => setMsgTarget(null)} />}
      {profilePlayer && <PlayerProfile player={profilePlayer} onClose={() => setProfilePlayer(null)} />}

      {/* Header */}
      <div className="card">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex gap-3">
             <button onClick={() => setMsgTarget({ name: lang === 'ar' ? 'الجميع' : 'Everyone', citizenid: -1 })} className="btn-secondary">
                {lang === 'ar' ? 'إشعار جميع اللاعبين' : 'Notify All Players'}
             </button>
             <button onClick={() => window.location.href = '/panel/screenshots'} className="btn-primary bg-brand-red hover:bg-brand-red/90 text-white">
                {lang === 'ar' ? 'فتح اللقطات المباشرة' : 'Open Live Screenshots'}
             </button>
          </div>
          
          <div className={`text-right flex flex-col items-end`}>
            <h1 className="text-2xl font-bold text-white tracking-wide">{lang === 'ar' ? 'اللاعبين المتصلين' : 'Online Players'}</h1>
            <p className="text-gray-400 text-sm mt-1 font-bold">{lang === 'ar' ? `إجمالي المتصلين: ${players.length}` : `Total Online: ${players.length}`}</p>
            <p className="text-gray-500 text-xs mt-0.5">{lang === 'ar' ? 'حالة الاتصال: قائمة اللاعبين جاهزة' : 'Connection: Player list ready'}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 w-full">
           <div className="relative w-full">
             <input 
               className={`input-field w-full py-3 bg-dark-800 border border-dark-600 focus:border-brand-red ${lang === 'ar' ? 'pl-4 pr-5' : 'pl-5 pr-4'} rounded-xl transition-all text-sm`} 
               placeholder="Search (name / CID / license / discord)" 
               value={search} 
               onChange={e => setSearch(e.target.value)} 
             />
           </div>
        </div>

        {/* List of Players */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Users size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">{lang === 'ar' ? 'لا يوجد لاعبون متصلون الآن' : 'No players currently online'}</p>
          </div>
        ) : (
          <div className="space-y-3">
             {filtered.map(p => {
               const displayName = p.charName || p.name || p.citizenid

               return (
               <div key={p.citizenid} className={`w-full flex items-center justify-between p-4 rounded-xl bg-dark-750/50 hover:bg-dark-700 transition-all border border-dark-600 hover:border-dark-500`}>
                 
                 {/* Action Buttons (Left side) */}
                 <div className="flex items-center gap-2">
                   <button onClick={() => openProfile(p)} className="w-10 h-10 rounded-lg bg-brand-red/10 hover:bg-brand-red border border-brand-red/20 hover:border-brand-red flex items-center justify-center text-brand-red hover:text-white transition-all" title="Ban/Kick">
                     <Ban size={16} />
                   </button>
                   <button onClick={() => openProfile(p)} className="w-10 h-10 rounded-lg bg-dark-600 hover:bg-dark-500 border border-dark-500 flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Profile">
                     <Users size={16} />
                   </button>
                   <button onClick={() => setMsgTarget(p)} className="w-10 h-10 rounded-lg bg-dark-600 hover:bg-dark-500 border border-dark-500 flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Message">
                     <MessageSquare size={16} />
                   </button>
                 </div>

                 {/* Player Info (Right side) */}
                 <div className={`flex items-center gap-4 cursor-pointer text-right flex-1 justify-end min-w-0`} onClick={() => openProfile(p)}>
                    <div className="flex flex-col items-end min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider bg-dark-800 px-2 py-0.5 rounded border border-dark-600">ID: {p.id || p.source || '—'}</span>
                        <span className="text-white font-bold text-base hover:text-brand-red transition-colors">{displayName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
                         <p className="text-gray-400 text-xs font-mono">
                           {lang === 'ar' ? 'الاسم:' : 'Name:'} <span className="text-white font-semibold">{charName ? displayName : (p.name || p.citizenid)}</span>
                         </p>
                          <p className="text-gray-400 text-xs font-mono">
                            {lang === 'ar' ? 'الوظيفة:' : 'Job:'} <span className="text-gray-300">{p.jobLabel || '—'}</span>
                          </p>
                          <p className="text-gray-400 text-xs font-mono">
                            {lang === 'ar' ? 'العصابة:' : 'Gang:'} <span className="text-gray-300">{p.gangLabel || '—'}</span>
                          </p>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-dark-600 border-2 border-dark-500 flex items-center justify-center overflow-hidden flex-shrink-0 text-gray-300 font-bold relative">
                       <img 
                         src={p.profilepic && p.profilepic !== "none" && p.profilepic !== "" ? p.profilepic : `${API}/uploads/avatars/${p.citizenid}_face.png`} 
                         alt={displayName} 
                         className="w-full h-full object-cover"
                         onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                       />
                       <span className="absolute inset-0 flex items-center justify-center" style={{display:'none'}}>{displayName.substring(0,3)}</span>
                    </div>
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
