import { useState, useEffect, useContext } from 'react'
import { Shield, Plus, Trash2, Edit2, Users, Save, X, Check } from 'lucide-react'
import axios from 'axios'
import { ServerContext } from '../App'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const PERMISSIONS = {
  "اللاعبون": [
    { id: 'view_players', label: 'عرض اللاعبين' },
    { id: 'kick_player', label: 'طرد' },
    { id: 'revive_player', label: 'إنعاش' },
    { id: 'feed_player', label: 'إطعام' },
    { id: 'give_money', label: 'إعطاء أموال' },
    { id: 'take_money', label: 'سحب أموال' },
    { id: 'set_money', label: 'تعيين الأموال' },
    { id: 'give_items', label: 'إعطاء عناصر' },
    { id: 'remove_items', label: 'إزالة عناصر' },
    { id: 'clear_inventory', label: 'مسح الحقيبة' },
    { id: 'delete_character', label: 'حذف الشخصية' },
    { id: 'teleport_player', label: 'نقل فوري' },
    { id: 'set_job', label: 'تعيين الوظيفة' },
    { id: 'set_gang', label: 'تعيين العصابة' },
    { id: 'set_identity', label: 'تعيين الهوية' },
    { id: 'set_metadata', label: 'تعيين البيانات الوصفية' },
    { id: 'set_permissions', label: 'تعيين الصلاحيات' },
    { id: 'live_screens', label: 'اللقطات المباشرة' },
    { id: 'dm_player', label: 'رسالة مباشرة' }
  ],
  "اللاعبين المتصلين": [
    { id: 'view_online', label: 'عرض المتصلين' },
    { id: 'broadcast_message', label: 'إشعار الجميع' }
  ],
  "المركبات": [
    { id: 'view_vehicles', label: 'عرض المركبات' },
    { id: 'give_vehicles', label: 'إعطاء مركبات' },
    { id: 'delete_vehicles', label: 'حذف المركبات' },
    { id: 'transfer_vehicles', label: 'نقل المركبات' },
    { id: 'change_plate', label: 'تغيير اللوحة' },
    { id: 'edit_vehicle_condition', label: 'تعديل الحالة' }
  ],
  "المخازن": [
    { id: 'view_stashes', label: 'عرض المخازن' },
    { id: 'add_stash_items', label: 'إضافة عناصر' },
    { id: 'remove_stash_items', label: 'إزالة عناصر' },
    { id: 'clear_stashes', label: 'تفريغ المخازن' }
  ],
  "الانتظار والأولوية": [
    { id: 'view_queue', label: 'عرض الانتظار' },
    { id: 'set_priority', label: 'تعيين الأولوية' },
    { id: 'remove_priority', label: 'إزالة الأولوية' },
    { id: 'remove_from_queue', label: 'إزالة من الانتظار' }
  ],
  "الحظر والتدقيق": [
    { id: 'view_bans', label: 'عرض الحظر' },
    { id: 'add_bans', label: 'إضافة حظر' },
    { id: 'remove_bans', label: 'إزالة حظر' },
    { id: 'view_audit_logs', label: 'سجلات التدقيق' }
  ],
  "أخرى": [
    { id: 'investigate', label: 'البحث المتقدم' },
    { id: 'view_dupes', label: 'كشف التكرار (Dupes)' },
    { id: 'delete_all_dupes', label: 'حذف جميع التكرارات' },
    { id: 'view_gangs', label: 'عرض العصابات' },
    { id: 'manage_gangs', label: 'إدارة العصابات' },
    { id: 'manage_settings', label: 'إدارة الإعدادات' },
    { id: 'manage_admins', label: 'إدارة الرتب والإداريين' }
  ]
}

export default function Admins() {
  const { activeServer, permissions, isOwner } = useContext(ServerContext)
  const [activeTab, setActiveTab] = useState('admins') // 'admins' or 'ranks'
  const [ranks, setRanks] = useState([])
  const [admins, setAdmins] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Rank Form
  const [creatingRank, setCreatingRank] = useState(false)
  const [rankName, setRankName] = useState('')
  const [selectedPerms, setSelectedPerms] = useState([])

  // Admin Form
  const [discordId, setDiscordId] = useState('')
  const [selectedRank, setSelectedRank] = useState('')

  const canManage = isOwner || permissions.includes('*') || permissions.includes('manage_admins')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`, 'x-server-id': activeServer.id }
      const [rRes, aRes] = await Promise.all([
        axios.get(`${API}/api/ranks`, { headers }),
        axios.get(`${API}/api/admins`, { headers })
      ])
      setRanks(rRes.data || [])
      setAdmins(aRes.data || [])
    } catch (e) {
      console.error(e)
      const msg = e.response?.data?.error || e.message || 'حدث خطأ أثناء تحميل البيانات'
      setError(msg)
      setRanks([])
      setAdmins([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [activeServer])

  const handleTogglePerm = (id) => {
    if (selectedPerms.includes(id)) setSelectedPerms(selectedPerms.filter(p => p !== id))
    else setSelectedPerms([...selectedPerms, id])
  }

  const handleSaveRank = async () => {
    if (!rankName || selectedPerms.length === 0) return
    setError('')
    try {
      await axios.post(`${API}/api/ranks`, { name: rankName, permissions: selectedPerms }, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`, 'x-server-id': activeServer.id }
      })
      setCreatingRank(false)
      setRankName('')
      setSelectedPerms([])
      fetchData()
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'حدث خطأ أثناء حفظ الرتبة'
      setError(msg)
    }
  }

  const handleDeleteRank = async (id) => {
    if(!confirm('هل أنت متأكد من حذف هذه الرتبة؟')) return
    setError('')
    try {
      await axios.delete(`${API}/api/ranks/${id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`, 'x-server-id': activeServer.id }
      })
      fetchData()
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'حدث خطأ أثناء حذف الرتبة'
      setError(msg)
    }
  }

  const handleAddAdmin = async () => {
    if (!discordId || !selectedRank) return
    setError('')
    try {
      await axios.post(`${API}/api/admins`, { discord_id: discordId, rank_id: selectedRank }, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`, 'x-server-id': activeServer.id }
      })
      setDiscordId('')
      setSelectedRank('')
      fetchData()
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'حدث خطأ أثناء إضافة الإداري'
      setError(msg)
    }
  }

  const handleDeleteAdmin = async (id) => {
    if(!confirm('هل أنت متأكد من إزالة هذا الإداري؟')) return
    setError('')
    try {
      await axios.delete(`${API}/api/admins/${id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`, 'x-server-id': activeServer.id }
      })
      fetchData()
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'حدث خطأ أثناء إزالة الإداري'
      setError(msg)
    }
  }

  if (!canManage) {
    return <div className="text-center py-20 text-gray-400">ليس لديك صلاحية الوصول لإدارة الرتب.</div>
  }

  return (
    <div className="space-y-6" dir="rtl">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-auto">
            <X size={16} />
          </button>
        </div>
      )}
      {loading && (
        <div className="text-center py-8 text-gray-400">جاري تحميل البيانات...</div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-white">الإدارة والرتب</h1>
        <p className="text-gray-400 text-sm">إدارة فريق العمل، تعيين الصلاحيات، وتخصيص الوصول.</p>
      </div>

      <div className="flex gap-2 bg-dark-800 p-1 rounded-xl w-fit border border-dark-600">
        <button onClick={() => setActiveTab('admins')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'admins' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'}`}>الإداريين</button>
        <button onClick={() => setActiveTab('ranks')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'ranks' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'}`}>الرتب والصلاحيات</button>
      </div>

      {activeTab === 'admins' && (
        <div className="space-y-6">
          <div className="card bg-dark-800/80 p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users size={18} className="text-brand-red" /> إضافة إداري جديد</h2>
            <div className="flex gap-4">
              <input type="text" className="input-field flex-1" placeholder="Discord ID (مثال: 123456789012345678)" value={discordId} onChange={e => setDiscordId(e.target.value)} />
              <select className="input-field w-48" value={selectedRank} onChange={e => setSelectedRank(e.target.value)}>
                <option value="">اختر الرتبة...</option>
                {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={handleAddAdmin} className="btn-primary whitespace-nowrap"><Plus size={16} /> إضافة</button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-700/50 text-gray-400 border-b border-dark-600">
                  <th className="py-3 px-4 text-right">المعرف (Discord ID)</th>
                  <th className="py-3 px-4 text-right">الرتبة</th>
                  <th className="py-3 px-4 text-right">تم الإضافة بواسطة</th>
                  <th className="py-3 px-4 text-center w-24">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-8 text-gray-500">لا يوجد إداريين مضافين حالياً.</td></tr>
                ) : admins.map(a => (
                  <tr key={a.id} className="border-b border-dark-600/50 hover:bg-dark-700/30">
                    <td className="py-3 px-4 text-white font-mono">{a.discord_id}</td>
                    <td className="py-3 px-4"><span className="bg-brand-red/10 text-brand-red px-2 py-1 rounded text-xs border border-brand-red/20">{a.rank_name}</span></td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{a.added_by || 'Owner'}</td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => handleDeleteAdmin(a.id)} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ranks' && (
        <div className="space-y-6">
          {!creatingRank ? (
            <>
              <button onClick={() => setCreatingRank(true)} className="btn-primary"><Plus size={16} /> إنشاء رتبة جديدة</button>
              <div className="grid md:grid-cols-3 gap-4">
                {ranks.map(r => (
                  <div key={r.id} className="card bg-dark-800/60 hover:bg-dark-800 border-dark-600">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-white font-bold flex items-center gap-2"><Shield size={16} className="text-blue-400" /> {r.name}</h3>
                      <button onClick={() => handleDeleteRank(r.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">الصلاحيات: {r.permissions.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {r.permissions.slice(0, 3).map(p => <span key={p} className="bg-dark-600 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">{p}</span>)}
                      {r.permissions.length > 3 && <span className="bg-dark-600 text-gray-500 text-[10px] px-1.5 py-0.5 rounded">+{r.permissions.length - 3}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between border-b border-dark-600 pb-4">
                <h2 className="text-lg font-bold text-white">تفاصيل الرتبة الجديدة</h2>
                <button onClick={() => setCreatingRank(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">اسم الرتبة (مثال: دعم فني)</label>
                <input type="text" className="input-field w-full max-w-md" value={rankName} onChange={e => setRankName(e.target.value)} />
              </div>

              <div>
                <h3 className="text-white font-bold mb-4">تحديد الصلاحيات</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(PERMISSIONS).map(([category, perms]) => (
                    <div key={category} className="bg-dark-700/30 p-4 rounded-xl border border-dark-600/50">
                      <h4 className="text-brand-red font-bold text-sm mb-3 border-b border-dark-600 pb-2">{category}</h4>
                      <div className="space-y-2">
                        {perms.map(p => (
                          <label key={p.id} onClick={(e) => { e.preventDefault(); handleTogglePerm(p.id); }} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedPerms.includes(p.id) ? 'bg-brand-red border-brand-red text-white' : 'border-gray-500 group-hover:border-gray-400'}`}>
                              {selectedPerms.includes(p.id) && <Check size={12} strokeWidth={3} />}
                            </div>
                            <span className={`text-sm ${selectedPerms.includes(p.id) ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-dark-600 flex justify-end gap-3">
                <button onClick={() => setCreatingRank(false)} className="btn-secondary">إلغاء</button>
                <button onClick={handleSaveRank} className="btn-primary"><Save size={16} /> حفظ الرتبة</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
