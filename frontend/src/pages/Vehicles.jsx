import { useState, useEffect } from 'react'
import { Car, Search, RefreshCw } from 'lucide-react'
import axios from 'axios'
const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('المعروض 0')

  const fetch = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/vehicles`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } })
      setVehicles(data)
      setStatus(`المعروض ${data.length}`)
    } catch { setVehicles([]); setStatus('المعروض 0') }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase()
    return !q || v.plate?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q) || v.citizenid?.toLowerCase().includes(q) || v.ownerDiscord?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">المركبات</h1>
          <p className="text-gray-400 text-sm">{status}</p>
        </div>
        <button onClick={fetch} className="btn-secondary text-xs">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>
      <div className="card">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input-field pr-9" placeholder="اللوحة، الموديل، citizen_id، license، owner discord id" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field w-28">
            <option>أي</option><option>متوقف</option><option>مُستدعى</option>
          </select>
          <button className="btn-secondary text-xs"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> مسح</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-500 text-xs text-gray-500">
                <th className="text-right py-2 px-3 font-medium">اللوحة</th>
                <th className="text-right py-2 px-3 font-medium">الموديل</th>
                <th className="text-right py-2 px-3 font-medium">المالك</th>
                <th className="text-right py-2 px-3 font-medium">الحالة / الجراج</th>
                <th className="text-right py-2 px-3 font-medium">الوقود</th>
                <th className="text-right py-2 px-3 font-medium">المحرك</th>
                <th className="text-right py-2 px-3 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-12 text-gray-600 text-xs">
                  <Car size={28} className="mx-auto mb-2 opacity-30" />لا توجد مركبات
                </td></tr>
              ) : filtered.map((v, i) => (
                <tr key={i} className="table-row">
                  <td className="py-2.5 px-3 font-mono text-xs bg-dark-600/50 text-white">{v.plate}</td>
                  <td className="py-2.5 px-3 text-white">{v.model}</td>
                  <td className="py-2.5 px-3 text-gray-300 text-xs">{v.owner || v.citizenid}</td>
                  <td className="py-2.5 px-3">
                    <span className={v.out ? 'badge-online' : 'badge-offline'}>{v.out ? 'مستدعى' : `جراج ${v.garage || '—'}`}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-dark-600 rounded-full h-1.5">
                        <div className="bg-accent-blue h-1.5 rounded-full" style={{width: `${v.fuel ?? 0}%`}}></div>
                      </div>
                      <span className="text-xs text-gray-400">{v.fuel ?? '—'}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-dark-600 rounded-full h-1.5">
                        <div className="bg-accent-green h-1.5 rounded-full" style={{width: `${(v.engine ?? 0)}%`}}></div>
                      </div>
                      <span className="text-xs text-gray-400">{v.engine ?? '—'}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500 text-xs">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
