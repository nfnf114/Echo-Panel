import { useState, useEffect } from 'react'
import { Search, ExternalLink, Copy } from 'lucide-react'
import axios from 'axios'
import PlayerProfile from './PlayerProfile'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const PER_PAGE = 20

function getHeaders() {
  return {
    Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`,
    'x-server-id': localStorage.getItem('active_server_id') || ''
  }
}

function parseJ(v) {
  try { return typeof v === 'string' ? JSON.parse(v) : (v || {}) } catch { return {} }
}

export default function Players() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('default')
  const [page, setPage] = useState(1)
  const [profilePlayer, setProfilePlayer] = useState(null)

  const fetchPlayers = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/players`, { headers: getHeaders() })
      setPlayers(Array.isArray(data) ? data : [])
    } catch { setPlayers([]) }
    setLoading(false)
  }

  useEffect(() => { fetchPlayers() }, [])

  const normalized = players.map(p => {
    const ci = parseJ(p.charinfo)
    const job = parseJ(p.job)
    const gang = parseJ(p.gang)
    const money = parseJ(p.money)
    return {
      ...p,
      name: ci.firstname ? `${ci.firstname} ${ci.lastname}` : p.citizenid,
      profilepic: ci.profilepic,
      jobLabel: job?.label || 'مواطن - عاطل',
      gangLabel: gang?.label || gang?.name || 'No Gang - Unaffiliated',
      cash: money?.cash || 0,
      bank: money?.bank || 0,
    }
  })

  const filtered = normalized.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.citizenid?.toLowerCase().includes(q) || p.license?.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || (statusFilter === 'online' && p.online) || (statusFilter === 'offline' && !p.online)
    return matchSearch && matchStatus
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'cash') return b.cash - a.cash
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    return 0
  })

  const totalPages = Math.ceil(sorted.length / PER_PAGE) || 1
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const openProfile = async (p) => {
    try {
      const { data } = await axios.get(`${API}/api/players/${p.citizenid}`, { headers: getHeaders() })
      setProfilePlayer(data)
    } catch {
      setProfilePlayer(p)
    }
  }

  const handleClear = () => {
    setSearch('')
    setStatusFilter('all')
    setSortBy('default')
    setPage(1)
  }

  if (profilePlayer) {
    return <PlayerProfile player={profilePlayer} onClose={() => setProfilePlayer(null)} />
  }

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        
        {/* Header & Filters */}
        <div className="flex flex-col gap-4 mb-6 border-b border-dark-600 pb-6">
          <h2 className="text-lg font-bold text-white text-right">الشخصيات</h2>
          
          <div className="flex flex-wrap items-end justify-between gap-4">
            
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="flex flex-col gap-1 w-32">
                <label className="text-xs font-bold text-gray-400 text-right">الحالة</label>
                <select className="w-full bg-[#111317] border border-dark-600 focus:border-brand-red rounded-lg px-3 py-2 text-xs text-gray-300 font-semibold transition-colors outline-none cursor-pointer" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
                  <option value="all">الكل</option>
                  <option value="online">متصل</option>
                  <option value="offline">غير متصل</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 w-32">
                <label className="text-xs font-bold text-gray-400 text-right">الفرز حسب</label>
                <select className="w-full bg-[#111317] border border-dark-600 focus:border-brand-red rounded-lg px-3 py-2 text-xs text-gray-300 font-semibold transition-colors outline-none cursor-pointer" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="default">الافتراضي</option>
                  <option value="cash">الكاش</option>
                  <option value="name">الاسم</option>
                </select>
              </div>

              <div className="flex items-end mb-0.5">
                <button onClick={handleClear} className="bg-[#111317] border border-dark-600 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg px-4 py-2 text-xs font-bold transition-colors">مسح</button>
              </div>

              <div className="flex items-end mb-0.5 gap-2 flex-1 max-w-xl">
                 <button className="bg-dark-600 hover:bg-dark-500 text-white rounded-lg px-4 py-2 text-xs font-bold transition-colors flex items-center gap-2 border border-dark-500">
                    <Search size={14} /> بحث
                 </button>
                 <div className="relative flex-1">
                   <input
                     className="w-full bg-[#0d0f14] border border-dark-600 focus:border-brand-red rounded-lg px-4 py-2 text-xs text-right text-gray-300 transition-colors outline-none"
                     placeholder="...name, citizenid, license, discord"
                     value={search}
                     onChange={e => setSearch(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && setPage(1)}
                   />
                 </div>
              </div>
            </div>

            <div className="flex flex-col justify-end min-w-[50px]">
               <label className="text-xs font-bold text-gray-400 text-right mb-1">بحث</label>
            </div>
            
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[11px] font-bold text-gray-400 border-b border-dark-600">
                <th className="pb-3 px-4 text-center w-16">إدارة</th>
                <th className="pb-3 px-4">العصابة</th>
                <th className="pb-3 px-4">الوظيفة</th>
                <th className="pb-3 px-4">البنك</th>
                <th className="pb-3 px-4">نقد</th>
                <th className="pb-3 px-4 text-center">الحالة</th>
                <th className="pb-3 px-4">CitizenID</th>
                <th className="pb-3 px-4">الشخصية</th>
                <th className="pb-3 px-4 text-center w-16">الصورة</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr><td colSpan="9" className="py-10 text-center"><div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan="9" className="py-10 text-center text-gray-500">لا توجد بيانات</td></tr>
              ) : paginated.map(p => (
                <tr key={p.citizenid} className="bg-[#111317] hover:bg-[#15171d] transition-colors border border-dark-600 rounded-lg group">
                  <td className="p-3 text-center rounded-l-lg border-y border-l border-dark-600">
                    <button onClick={() => openProfile(p)} className="p-1.5 bg-dark-800 border border-dark-600 rounded text-gray-400 hover:text-white hover:border-brand-red transition-all mx-auto block">
                      <ExternalLink size={14} />
                    </button>
                  </td>
                  <td className="p-3 text-gray-300 font-mono border-y border-dark-600">{p.gangLabel}</td>
                  <td className="p-3 text-gray-300 font-mono border-y border-dark-600">{p.jobLabel}</td>
                  <td className="p-3 text-[#3b82f6] font-mono font-bold border-y border-dark-600">${p.bank.toLocaleString()}</td>
                  <td className="p-3 text-[#22c55e] font-mono font-bold border-y border-dark-600">${p.cash.toLocaleString()}</td>
                  <td className="p-3 text-center border-y border-dark-600">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-bold ${p.online ? 'bg-accent-green/20 text-accent-green' : 'bg-gray-500/20 text-gray-400'}`}>
                      {p.online ? 'متصل' : 'غير متصل'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-gray-300 border-y border-dark-600">
                    <div className="flex items-center gap-2">
                       <Copy size={12} className="text-gray-500 cursor-pointer hover:text-white" onClick={() => navigator.clipboard.writeText(p.citizenid)} />
                       <span>{p.citizenid}</span>
                    </div>
                  </td>
                  <td className="p-3 font-bold text-white border-y border-dark-600">{p.name}</td>
                  <td className="p-3 text-center rounded-r-lg border-y border-r border-dark-600">
                    <div className="w-8 h-8 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center overflow-hidden mx-auto relative group-hover:scale-110 transition-transform">
                      <img 
                        src={p.profilepic && p.profilepic !== "none" && p.profilepic !== "" ? p.profilepic : `${API}/uploads/avatars/${p.citizenid}_face.png`} 
                        alt={p.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-300 font-bold bg-dark-600 z-[-1]">{p.name.substring(0, 2)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="mt-4 pt-4 border-t border-dark-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="bg-[#111317] border border-dark-600 text-gray-400 px-4 py-1.5 rounded-lg text-xs font-bold hover:text-white disabled:opacity-50 transition-colors">السابق</button>
            <span className="text-xs text-gray-400 font-bold bg-[#111317] border border-dark-600 px-3 py-1.5 rounded-lg">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="bg-[#111317] border border-dark-600 text-gray-400 px-4 py-1.5 rounded-lg text-xs font-bold hover:text-white disabled:opacity-50 transition-colors">التالي</button>
          </div>
          <span className="text-xs text-gray-500 font-bold">عرض {paginated.length} من {sorted.length}</span>
        </div>

      </div>
    </div>
  )
}
