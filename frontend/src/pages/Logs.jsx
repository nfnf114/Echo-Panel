import { useState, useEffect } from 'react'
import { FileText, RefreshCw, ChevronDown, Search, Filter } from 'lucide-react'
import axios from 'axios'
const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ action: 'الكل', target: '', from: '', to: '', period: 'آخر 24 ساعة' })

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/logs`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } })
      setLogs(data)
    } catch { setLogs([]) }
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [])

  const actionColors = { 'رسالة مباشرة': 'text-accent-blue', 'حظر': 'text-brand-red', 'كيك': 'text-yellow-400', 'تعديل': 'text-accent-green' }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">سجلات النظام</h1>
          <p className="text-gray-400 text-sm mt-1">مراقبة جميع التحركات والإجراءات الإدارية في السيرفر</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary font-bold">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث السجلات
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Filter size={16} className="text-brand-red" /> تصفية السجلات
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">الإجراء</p>
            <select className="w-full bg-dark-900 border border-dark-600 focus:border-brand-red rounded-xl px-4 py-2.5 text-sm text-gray-300 transition-colors" value={filters.action} onChange={e => setFilters(f => ({...f, action: e.target.value}))}>
              <option>الكل</option><option>رسالة مباشرة</option><option>حظر</option><option>كيك</option>
            </select>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">نوع الهدف</p>
            <select className="w-full bg-dark-900 border border-dark-600 focus:border-brand-red rounded-xl px-4 py-2.5 text-sm text-gray-300 transition-colors"><option>أي</option></select>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">من تاريخ</p>
            <input className="w-full bg-dark-900 border border-dark-600 focus:border-brand-red rounded-xl px-4 py-2.5 text-sm text-gray-300 transition-colors" type="date" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">إلى تاريخ</p>
            <input className="w-full bg-dark-900 border border-dark-600 focus:border-brand-red rounded-xl px-4 py-2.5 text-sm text-gray-300 transition-colors" type="date" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-dark-600">
          <div className="relative flex-1 min-w-[200px]">
             <Search size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
             <input className="w-full bg-dark-900 border border-dark-600 focus:border-brand-red rounded-xl py-2.5 pr-10 pl-4 text-sm text-gray-300 transition-colors" placeholder="ابحث في تفاصيل السجل..." />
          </div>
          
          <div className="flex bg-dark-900 rounded-xl p-1 border border-dark-600">
            {['آخر 24 ساعة', 'آخر 3 أيام', 'أسبوع'].map(p => (
              <button key={p} onClick={() => setFilters(f => ({...f, period: p}))}
                className={`text-xs px-4 py-1.5 rounded-lg font-bold transition-all ${filters.period === p ? 'bg-dark-700 text-brand-red' : 'text-gray-500 hover:text-gray-300'}`}>
                {p}
              </button>
            ))}
          </div>
          
          <button onClick={fetchLogs} className="btn-primary text-sm px-6 py-2.5 rounded-xl">تطبيق الفلاتر</button>
          <button className="btn-secondary text-sm px-4 py-2.5 rounded-xl border-dark-600 hover:bg-dark-700">مسح</button>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm flex justify-between items-center">
           <h3 className="text-sm font-bold text-white flex items-center gap-2">
             <FileText size={16} className="text-brand-red" /> أحدث السجلات
           </h3>
           <span className="text-xs font-bold text-gray-400 bg-dark-700 px-3 py-1 rounded-full border border-dark-500">{logs.length} سجل</span>
        </div>
        
        <div className="p-3 space-y-2">
          {loading ? (
             <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin"></div></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <FileText size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">لا توجد سجلات مطابقة للبحث</p>
            </div>
          ) : logs.map((log, i) => (
            <div key={i} className="bg-dark-900 hover:bg-dark-750 border border-dark-700 hover:border-dark-500 transition-all rounded-xl p-4 flex items-start justify-between group cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-dark-700 border border-dark-600 flex-shrink-0 flex items-center justify-center font-bold text-gray-300 text-sm group-hover:border-brand-red/50 transition-colors">
                  {log.admin?.[0] || '?'}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-bold">{log.admin}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-dark-700 border border-dark-600 ${actionColors[log.action] || 'text-gray-400'}`}>
                      {log.action}
                    </span>
                    <span className="text-xs font-mono text-gray-400 bg-dark-800 px-2 py-0.5 rounded border border-dark-600">الهدف: {log.target}</span>
                  </div>
                  <p className="text-sm text-gray-400">{log.details}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-[11px] font-mono text-gray-500 bg-dark-800 px-2 py-1 rounded border border-dark-700">{log.date || new Date().toLocaleDateString('en-US')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
