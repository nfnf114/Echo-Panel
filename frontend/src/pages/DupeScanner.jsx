import { useState, useEffect } from 'react'
import { Search, ShieldAlert, Package, User, Hash, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function DupeScanner() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, high_risk, low_risk

  const scan = async () => {
    setLoading(true)
    try {
      const { data: response } = await axios.get(`${API}/api/scan-dupes`, { 
        headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } 
      })
      setData(response)
    } catch { setData([]) }
    setLoading(false)
  }

  useEffect(() => { scan() }, [])

  const filtered = data.filter(item => {
    const q = search.toLowerCase()
    const matches = (item.label || '').toLowerCase().includes(q) || (item.serial || '').toLowerCase().includes(q)
    if (filter === 'high_risk') return matches && item.count > 3
    if (filter === 'low_risk') return matches && item.count <= 3
    return matches
  })

  const totalDupes = data.reduce((a, b) => a + (b.count - 1), 0)
  const highRiskCount = data.filter(i => i.count > 3).length

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="text-red-500 w-8 h-8" />
            فحص التدبيل المتقدم
          </h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">نظام المراقبة الذكي للأسلحة والعناصر النادرة</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-red-500 transition-colors">
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="بحث بالسيريال أو الاسم..." 
              className="bg-dark-800 border border-dark-600 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white w-64 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={scan} 
            disabled={loading} 
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95"
          >
            <ScanLine size={18} className={loading ? 'animate-spin' : ''} />
            {loading ? 'جاري الفحص...' : 'بدء الفحص'}
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-dark-900/50 backdrop-blur-xl border border-dark-600 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-dark-800/80 border-b border-dark-600">
                <th className="py-4 px-6 text-sm font-bold text-gray-300">السلاح</th>
                <th className="py-4 px-6 text-sm font-bold text-gray-300">السيريال</th>
                <th className="py-4 px-6 text-sm font-bold text-gray-300 text-center">عدد مرات التدبيل</th>
                <th className="py-4 px-6 text-sm font-bold text-gray-300 text-center">تاريخ الإبلاغ</th>
                <th className="py-4 px-6 text-sm font-bold text-gray-300 text-center">ملاحظات</th>
                <th className="py-4 px-6 text-sm font-bold text-gray-300 text-center">السهم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {!results ? (
                <tr>
                  <td colSpan="6" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <ScanLine size={48} className="text-gray-500" />
                      <div className="space-y-1">
                        <p className="text-lg font-bold text-white">نظام الحماية جاهز</p>
                        <p className="text-sm text-gray-400">اضغط على "بدء الفحص" لتحليل بيانات المخازن واللاعبين</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <p className="text-gray-500 font-medium">لم يتم رصد أي محاولات تدبيل مشبوهة</p>
                  </td>
                </tr>
              ) : filteredResults.map((r, i) => (
                <tr key={i} className="group hover:bg-white/5 transition-colors duration-200">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center border border-dark-600 group-hover:border-red-500/30 transition-colors">
                        <img 
                          src={`https://cfx-nui-qb-inventory/html/images/${r.name}.png`} 
                          onError={(e) => e.target.src = 'https://cdn-icons-png.flaticon.com/512/2223/2223615.png'}
                          className="w-8 h-8 object-contain"
                          alt=""
                        />
                      </div>
                      <span className="font-bold text-white text-sm tracking-wide uppercase">{r.item}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-mono text-gray-400 text-sm bg-dark-800/50 px-3 py-1 rounded-md border border-dark-700">{r.serial}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-red-500 font-black text-lg">{r.count}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-gray-300 text-sm font-medium">{new Date().toLocaleDateString('en-CA')}</span>
                      <span className="text-gray-500 text-[10px] uppercase font-bold flex items-center gap-1">
                        <Clock size={10} /> {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button className="p-2 hover:bg-yellow-500/10 rounded-lg text-gray-500 hover:text-yellow-500 transition-all" title="إضافة ملاحظة">
                      <MessageSquare size={18} />
                    </button>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all transform hover:-translate-x-1">
                      <ChevronLeft size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer Stats */}
        {results && (
          <div className="bg-dark-800/50 p-4 border-t border-dark-600 flex items-center justify-between text-xs text-gray-500 px-8">
            <div className="flex gap-6">
              <span className="flex items-center gap-2 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                إجمالي المجموعات: <span className="text-white font-bold">{counters.groups}</span>
              </span>
              <span className="flex items-center gap-2 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                إجمالي القطع: <span className="text-white font-bold">{counters.items}</span>
              </span>
            </div>
            <p>تعتمد هذه البيانات على الفحص العميق لكافة المخازن واللاعبين المتصلين وغير المتصلين</p>
          </div>
        )}
      </div>
    </div>
  )
}
