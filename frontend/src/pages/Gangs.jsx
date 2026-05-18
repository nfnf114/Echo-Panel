import { useState, useEffect } from 'react'
import { Shield, RefreshCw, Download } from 'lucide-react'
import axios from 'axios'
const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function Gangs() {
  const [gangs, setGangs] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/gangs`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } })
      setGangs(data); setLastUpdate(new Date())
    } catch { setGangs([]); setLastUpdate(new Date()) }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const exportCSV = () => {
    const csv = ['الاسم,الأعضاء,القيادة,البيانات'].concat(gangs.map(g => `${g.name},${g.members},${g.leader},${g.balance}`)).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv); a.download = 'gangs.csv'; a.click()
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">العصابات</h1>
          <p className="text-gray-400 text-sm">البيانات — اضغط أسفل العضو لعرض القائمة الكاملة ويمكنك أيضاً إيقاف عرض القائمة المقتصرة عند الحاجة</p>
        </div>
        <div className="flex gap-2">
          {lastUpdate && <span className="text-xs text-dark-400 text-gray-500 bg-dark-700 px-2 py-1 rounded">آخر تحديث: {lastUpdate.toLocaleTimeString('en-US')} {lastUpdate.toLocaleDateString('en-US')}</span>}
          <button onClick={() => {}} className="btn-secondary text-xs"><Download size={13} /> تصدير JSON</button>
          <button onClick={exportCSV} className="btn-secondary text-xs"><Download size={13} /> تصدير CSV</button>
          <button onClick={fetch} className="btn-primary text-xs"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</button>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-500 text-xs text-gray-500">
                <th className="text-right py-2 px-3 font-medium">المصابة</th>
                <th className="text-right py-2 px-3 font-medium">الأعضاء</th>
                <th className="text-right py-2 px-3 font-medium">القيادة</th>
                <th className="text-right py-2 px-3 font-medium">البيانات</th>
                <th className="text-right py-2 px-3 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {gangs.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-12 text-gray-600 text-xs">
                  <Shield size={28} className="mx-auto mb-2 opacity-30" />
                  {loading ? 'جاري التحميل...' : 'لا توجد بيانات'}
                </td></tr>
              ) : gangs.map((g, i) => (
                <tr key={i} className="table-row">
                  <td className="py-2.5 px-3 text-white font-medium">{g.name}</td>
                  <td className="py-2.5 px-3 text-gray-300">{g.members}</td>
                  <td className="py-2.5 px-3 text-gray-300">{g.leader || '—'}</td>
                  <td className="py-2.5 px-3 text-gray-400 text-xs">{g.balance ? `$${g.balance.toLocaleString()}` : '—'}</td>
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
