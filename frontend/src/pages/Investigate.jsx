import { useState } from 'react'
import { Search } from 'lucide-react'
import axios from 'axios'
const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function Investigate() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/investigate?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` }
      })
      setResults(data)
    } catch { setResults({ error: true }) }
    setLoading(false)
  }

  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-2xl font-bold text-white">البحث المتقدم</h1>

      <div className="card space-y-4">
        <div className="bg-dark-800 border border-dark-500 rounded-lg p-3 text-xs text-gray-400 flex items-center gap-2">
          <span className="text-accent-blue">ℹ</span> ملاحظة
        </div>
        <div>
          <p className="text-sm text-gray-300 mb-2">الاستعلام</p>
          <p className="text-xs text-gray-500 mb-2">ابحث برمز المرور أو القيادة، أو القيادة أو الموبيل أو license أو مفتاح المخزن</p>
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="btn-primary" disabled={loading}>
              <Search size={14} /> {loading ? 'جاري...' : 'بحث'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">النتائج</h3>
        {results === null && (
          <p className="text-center text-gray-600 text-xs py-8">ستبحث أيضاً في الشخصيات، والمركبات، والمحتوى، والمخازن والصندوق الأمامي</p>
        )}
        {results?.error && <p className="text-center text-brand-red text-xs py-8">حدث خطأ أثناء البحث</p>}
        {results && !results.error && (
          <div className="space-y-4">
            {results.players?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">شخصيات ({results.players.length})</p>
                {results.players.map((p, i) => (
                  <div key={i} className="bg-dark-800 rounded-lg p-3 text-sm flex items-center justify-between">
                    <span className="text-white">{p.name}</span>
                    <span className="text-gray-500 text-xs font-mono">{p.citizenid}</span>
                  </div>
                ))}
              </div>
            )}
            {(!results.players?.length && !results.vehicles?.length) && (
              <p className="text-center text-gray-600 text-xs py-4">لا توجد نتائج لـ "{query}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
