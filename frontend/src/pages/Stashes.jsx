import { useState, useEffect } from 'react'
import { Archive, RefreshCw, Search, Plus, Trash2, ChevronDown, X } from 'lucide-react'
import axios from 'axios'
const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function Stashes() {
  const [stashes, setStashes] = useState([])
  const [selected, setSelected] = useState('')
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(true)
  const [itemSearch, setItemSearch] = useState('')
  const [lastUpdate, setLastUpdate] = useState(null)

  // Add item form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCount, setNewItemCount] = useState(1)
  const [addingItem, setAddingItem] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  const fetchStashes = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/api/stashes`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } })
      setStashes(data); setLastUpdate(new Date())
    } catch { setStashes([]); setLastUpdate(new Date()) }
    setLoading(false)
  }

  const fetchContents = async (id) => {
    setSelected(id)
    try {
      const { data } = await axios.get(`${API}/api/stashes/${id}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } })
      setContents(data.items || [])
    } catch { setContents([]) }
  }

  const handleAddItem = async () => {
    if (!selected) return
    if (!newItemName.trim()) {
      setAddError('يرجى إدخال اسم العنصر')
      return
    }
    if (newItemCount < 1) {
      setAddError('يجب أن تكون الكمية 1 على الأقل')
      return
    }

    setAddingItem(true)
    setAddError('')
    setAddSuccess('')

    try {
      await axios.post(
        `${API}/api/stashes/${selected}/items`,
        { name: newItemName.trim(), count: newItemCount },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}` } }
      )
      setAddSuccess(`تمت إضافة "${newItemName}" × ${newItemCount} بنجاح`)
      setNewItemName('')
      setNewItemCount(1)
      // Refresh contents to show the new item
      await fetchContents(selected)
      // Clear success message after 3 seconds
      setTimeout(() => setAddSuccess(''), 3000)
    } catch (err) {
      setAddError(err.response?.data?.error || 'فشل في إضافة العنصر')
    } finally {
      setAddingItem(false)
    }
  }

  useEffect(() => { fetchStashes() }, [])

  const filteredContents = contents.filter(i => !itemSearch || i.name?.toLowerCase().includes(itemSearch.toLowerCase()))

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">المخازن</h1>
          <p className="text-gray-400 text-sm">المخازن الفتاحة</p>
        </div>
        {lastUpdate && <span className="text-xs text-gray-500 bg-dark-700 px-2 py-1 rounded">آخر تحديث: {lastUpdate.toLocaleTimeString('en-US')}</span>}
      </div>
      <div className="card space-y-4">
        {/* Stash Selector */}
        <div className="flex gap-3 flex-wrap">
          <select
            className="input-field w-56"
            value={selected}
            onChange={e => fetchContents(e.target.value)}
          >
            <option value="">اختر مخزناً</option>
            {stashes.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={fetchStashes} className="btn-secondary text-xs"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</button>
            <button className="btn-secondary text-xs"><Archive size={13} /> فتح</button>
            <button className="btn-secondary text-xs"><ChevronDown size={13} /> Pick</button>
          </div>
        </div>

        {selected && (
          <>
            <p className="text-gray-500 text-xs">خيبة: ابحث داخل القائمة المتسلسلة ويمكنك أيضاً إضافة عنصر مخصص مباشرةً (المستخدم →)</p>

            {/* Item Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input className="input-field pr-9" placeholder="ابحث بإسم العنصر أو اسمه" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
              </div>
              <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary text-xs"><Plus size={13} /> إضافة عنصر</button>
              <button className="btn-secondary text-xs text-red-400"><Trash2 size={13} /> مسح</button>
            </div>

            {/* Add Item Form */}
            {showAddForm && (
              <div className="bg-dark-700/50 border border-dark-500 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white text-sm font-medium">إضافة عنصر جديد إلى المخزن</h3>
                  <button onClick={() => { setShowAddForm(false); setAddError(''); setAddSuccess('') }} className="text-gray-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-gray-400 text-xs block mb-1">اسم العنصر</label>
                    <input
                      className="input-field w-full"
                      placeholder="مثال: water_bottle"
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-gray-400 text-xs block mb-1">الكمية</label>
                    <input
                      type="number"
                      className="input-field w-full"
                      min="1"
                      value={newItemCount}
                      onChange={e => setNewItemCount(Math.max(1, parseInt(e.target.value) || 1))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                    />
                  </div>
                  <button
                    onClick={handleAddItem}
                    disabled={addingItem}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    {addingItem ? (
                      <><RefreshCw size={13} className="animate-spin" /> جارٍ الإضافة...</>
                    ) : (
                      <><Plus size={13} /> إضافة</>
                    )}
                  </button>
                </div>
                {addError && <p className="text-red-400 text-xs">{addError}</p>}
                {addSuccess && <p className="text-green-400 text-xs">{addSuccess}</p>}
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-500 text-xs text-gray-500">
                  <th className="text-right py-2 px-3 font-medium">العنصر</th>
                  <th className="text-right py-2 px-3 font-medium">الكمية</th>
                  <th className="text-right py-2 px-3 font-medium">النوع</th>
                </tr>
              </thead>
              <tbody>
                {filteredContents.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-8 text-gray-600 text-xs">لا توجد عناصر</td></tr>
                ) : filteredContents.map((item, i) => (
                  <tr key={i} className="table-row">
                    <td className="py-2 px-3 text-white">
                      <div className="flex items-center gap-2">
                        <img 
                          src={`${API}/uploads/items/${item.name}.png`} 
                          alt={item.name}
                          className="w-8 h-8 rounded object-contain bg-dark-800 p-0.5 flex-shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{item.count}</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">{item.type || 'item'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!selected && (
          <div className="text-center py-12 text-gray-600">
            <Archive size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">اختر مخزناً لعرض محتوياته</p>
          </div>
        )}
      </div>
    </div>
  )
}
