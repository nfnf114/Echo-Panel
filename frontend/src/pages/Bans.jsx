import { useState, useEffect } from 'react'
import { Ban, RefreshCw, Plus, Search, Download } from 'lucide-react'
import axios from 'axios'
import { CreateBanModal } from './PlayerModals'
const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function Bans() {
  const [bans, setBans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/bans`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } })
      setBans(data); setLastUpdate(new Date())
    } catch { setBans([]); setLastUpdate(new Date()) }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const filtered = bans.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q || b.name?.toLowerCase().includes(q) || b.license?.toLowerCase().includes(q) || b.discord?.toLowerCase().includes(q)
    const matchActive = !activeOnly || b.active
    return matchSearch && matchActive
  })

  return (
    <div className="space-y-5" dir="rtl">
      {showCreate && <CreateBanModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); fetch() }} />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">الحظر</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs"><Plus size={13} /> إنشاء حظر</button>
          <button onClick={() => {}} className="btn-secondary text-xs"><Download size={13} /> تصدير JSON</button>
          <button onClick={() => {}} className="btn-secondary text-xs"><Download size={13} /> تصدير CSV</button>
        </div>
      </div>

      <div className="card">
        <div className="bg-dark-800 border border-dark-500 rounded-lg p-3 mb-4 text-xs text-gray-400 flex items-center gap-2">
          <span className="text-brand-red">ℹ</span> ملاحظات
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input-field pr-9" placeholder="...name/license/discord/reason" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary text-xs"><Search size={13} /> بحث</button>
          <button className="btn-secondary text-xs"><RefreshCw size={13} /> مسح</button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveOnly(!activeOnly)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${activeOnly ? 'bg-brand-red' : 'bg-dark-500'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${activeOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-gray-400">الفعال المنتهي</span>
          </div>
        </div>

        {lastUpdate && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span>جنود الضمان cache</span>
            <span>آخر تحديث: {lastUpdate.toLocaleString('en-US')}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-500 text-xs text-gray-500">
                <th className="text-right py-2 px-3 font-medium">الحالة</th>
                <th className="text-right py-2 px-3 font-medium">ID</th>
                <th className="text-right py-2 px-3 font-medium">الاسم</th>
                <th className="text-right py-2 px-3 font-medium">السبب</th>
                <th className="text-right py-2 px-3 font-medium">النقل</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-12 text-gray-600 text-xs">
                  <Ban size={28} className="mx-auto mb-2 opacity-30" />لا توجد حالات حظر
                </td></tr>
              ) : filtered.map((b, i) => (
                <tr key={i} className="table-row">
                  <td className="py-2.5 px-3"><span className={b.active ? 'badge-active' : 'badge-offline'}>{b.active ? 'نشط' : 'منتهي'}</span></td>
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-400">{b.id || i+1}</td>
                  <td className="py-2.5 px-3 text-white">{b.name}</td>
                  <td className="py-2.5 px-3 text-gray-400 text-xs">{b.reason}</td>
                  <td className="py-2.5 px-3 text-gray-500 text-xs">{b.expires ? new Date(b.expires).toLocaleDateString('en-US') : 'دائم'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-gray-600">عرض 0 سنات أفضل</div>
      </div>
    </div>
  )
}
