import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Plus, CheckCircle, Loader2, Trash2, MapPin } from 'lucide-react'
import axios from 'axios'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function getH() {
  return {
    Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`,
    'x-server-id': localStorage.getItem('active_server_id') || ''
  }
}

const WEBHOOK_TYPES = [
  { key: 'all',          label: 'الكل',                  desc: 'Receives a compact summary of all logged actions' },
  { key: 'dm',           label: 'DM + DM All',            desc: 'Logs direct messages sent to one player or all players' },
  { key: 'tp',           label: 'نقل فوري',               desc: 'Logs player teleport, bring, and coordinate moves' },
  { key: 'kick',         label: 'طرد',                    desc: 'Logs player kicks and kick reasons' },
  { key: 'ban',          label: 'حظر',                    desc: 'Logs ban creation, edits, removals, and duration changes' },
  { key: 'money',        label: 'إدارة الأموال',           desc: 'Logs cash, bank, and balance changes' },
  { key: 'gang',         label: 'تعيين العصابة',           desc: 'Logs gang and gang grade updates' },
  { key: 'job',          label: 'تعيين الوظيفة',           desc: 'Logs job and job grade updates' },
  { key: 'health',       label: 'Revive / Heal',           desc: 'Logs revive and health restoration actions' },
  { key: 'perms',        label: 'الصلاحيات',               desc: 'Logs permission and access changes' },
  { key: 'repair',       label: 'إصلاح مركبة',             desc: 'Logs vehicle repair actions' },
  { key: 'food',         label: 'إطعام',                  desc: 'Logs hunger and thirst restoration actions' },
  { key: 'bag',          label: 'الحقيبة',                 desc: 'Logs inventory item changes and actions' },
  { key: 'identity',     label: 'Identity + Metadata',     desc: 'Logs profile and metadata changes' },
  { key: 'screenshots',  label: 'Capture All Screens',     desc: 'Logs summary results of mass screenshot capture jobs' },
  { key: 'vehicle_own',  label: 'مركبة',                  desc: 'Logs vehicle ownership and vehicle data changes' },
  { key: 'vehicle_spawns', label: 'ترسبن مركبات',          desc: 'Logs every time a player spawns a vehicle' },
  { key: 'queue',        label: 'الأولوية والإنتظار',       desc: 'Logs queue and priority changes' },
  { key: 'stash',        label: 'المخازن',                 desc: 'Logs stash actions and stash item changes' },
  { key: 'dupe',         label: 'فحص التدبيل',             desc: 'Logs duplicate scans and dupe cleanup actions' },
  { key: 'investigate',  label: 'البحث المتقدم',            desc: 'Logs investigator searches and result summaries' },
  { key: 'admin',        label: 'الإدارة والرتب',           desc: 'Logs admin role and role link changes' },
]

function WebhookRow({ type, url, setUrl }) {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 space-y-2">
      <div>
        <p className="text-sm text-white font-medium">{type.label}</p>
        <p className="text-xs text-gray-500">{type.desc}</p>
      </div>
      <input
        className="input-field text-xs"
        placeholder="https://discord.com/api/webhooks/..."
        value={url || ''}
        onChange={e => setUrl(e.target.value)}
      />
    </div>
  )
}

export default function Settings() {
  // ── Webhooks ──────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState({})
  const [wLoading, setWLoading] = useState(true)
  const [wSaving, setWSaving] = useState(false)
  const [wSaved, setWSaved] = useState(false)

  // ── Teleport Locations ────────────────────────────────────────
  const [locations, setLocations] = useState([])
  const [tLoading, setTLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newX, setNewX] = useState('')
  const [newY, setNewY] = useState('')
  const [newZ, setNewZ] = useState('')
  const [newH, setNewH] = useState('0')
  const [tSaving, setTSaving] = useState(false)

  useEffect(() => {
    // Load webhooks
    axios.get(`${API}/api/webhooks`, { headers: getH() })
      .then(res => { setWebhooks(res.data); setWLoading(false) })
      .catch(() => setWLoading(false))

    // Load teleport locations
    axios.get(`${API}/api/teleport-locations`, { headers: getH() })
      .then(res => { setLocations(res.data || []); setTLoading(false) })
      .catch(() => setTLoading(false))
  }, [])

  const handleSaveWebhooks = async () => {
    setWSaving(true)
    try {
      await axios.post(`${API}/api/webhooks`, webhooks, { headers: getH() })
      setWSaved(true)
      setTimeout(() => setWSaved(false), 3000)
    } catch { alert('فشل حفظ الويب هوكات') }
    setWSaving(false)
  }

  const handleAddLocation = async () => {
    if (!newName.trim() || !newX || !newY || !newZ) {
      alert('يرجى ملء جميع الحقول (الاسم، X، Y، Z)')
      return
    }
    setTSaving(true)
    try {
      await axios.post(`${API}/api/teleport-locations`, {
        name: newName.trim(),
        x: parseFloat(newX),
        y: parseFloat(newY),
        z: parseFloat(newZ),
      }, { headers: getH() })
      // Refresh list
      const res = await axios.get(`${API}/api/teleport-locations`, { headers: getH() })
      setLocations(res.data || [])
      setNewName(''); setNewX(''); setNewY(''); setNewZ(''); setNewH('0')
    } catch (e) { alert('فشل إضافة الموقع: ' + e.message) }
    setTSaving(false)
  }

  const handleDeleteLocation = async (id) => {
    if (!confirm('هل تريد حذف هذا الموقع؟')) return
    try {
      await axios.delete(`${API}/api/teleport-locations/${id}`, { headers: getH() })
      setLocations(prev => prev.filter(l => l.id !== id))
    } catch { alert('فشل الحذف') }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">الإعدادات</h1>
      </div>

      {/* ── Teleport Locations ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <MapPin size={15} className="text-brand-red" /> مواقع الانتقال
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          المواقع المحفوظة التي يمكن استخدامها للانتقال السريع للاعبين من داخل البانل.
        </p>

        {/* Add New Location Form */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-xs font-bold text-gray-400">إضافة موقع جديد</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="input-field text-xs flex-1 min-w-[120px]"
              placeholder="اسم الموقع (مثال: PD Roof)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              className="input-field text-xs w-24"
              placeholder="X"
              type="number"
              value={newX}
              onChange={e => setNewX(e.target.value)}
            />
            <input
              className="input-field text-xs w-24"
              placeholder="Y"
              type="number"
              value={newY}
              onChange={e => setNewY(e.target.value)}
            />
            <input
              className="input-field text-xs w-24"
              placeholder="Z"
              type="number"
              value={newZ}
              onChange={e => setNewZ(e.target.value)}
            />
            <button
              onClick={handleAddLocation}
              disabled={tSaving}
              className="btn-primary text-xs flex items-center gap-1.5 px-4"
            >
              {tSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              إضافة
            </button>
          </div>
        </div>

        {/* Locations Table */}
        {tLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-red" /></div>
        ) : locations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">لا توجد مواقع محفوظة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-500 text-xs text-gray-500">
                  <th className="text-right py-2 px-3 font-medium">الاسم</th>
                  <th className="text-right py-2 px-3 font-medium">الإحداثيات</th>
                  <th className="text-right py-2 px-3 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} className="table-row border-b border-dark-700/50">
                    <td className="py-2.5 px-3 text-white font-bold">{loc.name}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-400">
                      vector4({loc.x}, {loc.y}, {loc.z}, 0.0)
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} /> حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Discord Webhooks ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <SettingsIcon size={15} className="text-brand-red" /> لوق الديسكورد (Webhooks)
          </h3>
          <button
            onClick={handleSaveWebhooks}
            disabled={wSaving || wLoading}
            className={`btn-primary text-xs ${wSaved ? 'bg-accent-green hover:bg-accent-green' : ''}`}
          >
            {wSaving ? <Loader2 size={13} className="animate-spin" /> : (wSaved ? <CheckCircle size={13} /> : <Save size={13} />)}
            {wSaved ? 'تم الحفظ' : 'حفظ اللوقات'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          ضع رابط Webhook الديسكورد في الخانات لتلقي الإشعارات اللحظية. يمكنك وضع نفس الرابط لأكثر من خيار.
        </p>

        <div className="card mb-4 bg-dark-800/50">
          <h4 className="text-xs text-brand-red mb-2 font-bold">تنبيه حماية</h4>
          <p className="text-xs text-gray-500">حافظ على سرية روابط الـ Webhook الخاصة بسيرفرك لضمان عدم إرسال أشخاص آخرين رسائل في خوادم الديسكورد الخاصة بك.</p>
        </div>

        {wLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-red" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {WEBHOOK_TYPES.map(type => (
              <WebhookRow
                key={type.key}
                type={type}
                url={webhooks[type.key]}
                setUrl={(url) => setWebhooks(prev => ({ ...prev, [type.key]: url }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
