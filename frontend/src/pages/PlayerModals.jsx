import { useState, useEffect } from 'react'
import { Modal, Inp, Sel, Btns, Field, issueCommand, SearchableSelect } from './PlayerProfileUtils'
import axios from 'axios'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
function getH() {
  return { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`, 'x-server-id': localStorage.getItem('active_server_id') || '' }
}

// Fetch server data once and cache (don't cache empty results)
let _sdCache = null
let _sdCacheTime = 0
async function getServerData() {
  const now = Date.now()
  if (_sdCache && (now - _sdCacheTime) < 60000) return _sdCache
  try {
    const { data } = await axios.get(`${API}/api/server-data`, { headers: getH() })
    // Only cache if we got actual data
    if (data && (data.jobs?.length > 0 || data.gangs?.length > 0 || data.items?.length > 0)) {
      _sdCache = data
      _sdCacheTime = now
    }
    return data || { jobs: [], gangs: [], items: [] }
  } catch { return { jobs: [], gangs: [], items: [] } }
}

// ── Money ────────────────────────────────────────────────────
export function MoneyModal({ player, onClose, onDone }) {
  const [mode, setMode] = useState('give_money')
  const [mtype, setMtype] = useState('cash')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (!amount) return
    setLoading(true)
    try { await issueCommand(mode, player.citizenid, { moneyType: mtype, amount: parseInt(amount), reason }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="إدارة الأموال" subtitle="Manage cash or bank from the panel" onClose={onClose}>
      <div className="space-y-6">
        <Field label="الإجراء">
          <Sel value={mode} onChange={e => setMode(e.target.value)}>
            <option value="give_money">Give</option>
            <option value="take_money">Take</option>
          </Sel>
        </Field>
        <Field label="الحساب">
          <Sel value={mtype} onChange={e => setMtype(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="crypto">Crypto</option>
          </Sel>
        </Field>
        <Field label="الكمية">
          <Inp type="number" min="1" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
        <Field label="السبب">
          <Inp placeholder="...Optional note" value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── Job ──────────────────────────────────────────────────────
export function JobModal({ player, onClose, onDone }) {
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [grades, setGrades] = useState([])
  const [grade, setGrade] = useState('0')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getServerData().then(d => setJobs(d.jobs || []))
  }, [])

  useEffect(() => {
    const j = jobs.find(j => j.name === selectedJob)
    setGrades(j?.grades?.sort((a,b) => a.grade - b.grade) || [])
    setGrade('0')
  }, [selectedJob, jobs])

  const submit = async () => {
    setLoading(true)
    try { await issueCommand('set_job', player.citizenid, { job: selectedJob, grade: parseInt(grade) }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }

  return (
    <Modal title="تعيين الوظيفة / الرتبة" subtitle="Apply this change from the panel" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="الوظيفة">
            <SearchableSelect 
              value={selectedJob} 
              onChange={setSelectedJob} 
              placeholder="— اختر وظيفة —"
              options={jobs.sort((a,b) => (a.label||a.name).localeCompare(b.label||b.name)).map(j => ({
                value: j.name,
                label: j.label || j.name,
                subLabel: j.name
              }))}
            />
          </Field>
          {grades.length > 0 ? (
            <Field label="الرتبة">
              <Sel value={grade} onChange={e => setGrade(e.target.value)}>
                {grades.map(g => (
                  <option key={g.grade} value={g.grade}>{g.grade} — {g.label || g.name}</option>
                ))}
              </Sel>
            </Field>
          ) : (
            <Field label="الرتبة">
              <Inp type="number" min="0" placeholder="0" value={grade} onChange={e => setGrade(e.target.value)} disabled={!selectedJob} />
            </Field>
          )}
        </div>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── Gang ────────────────────────────────────────────────────
export function GangModal({ player, onClose, onDone }) {
  const [gangs, setGangs] = useState([])
  const [selectedGang, setSelectedGang] = useState('')
  const [grades, setGrades] = useState([])
  const [grade, setGrade] = useState('0')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getServerData().then(d => setGangs(d.gangs || []))
  }, [])

  useEffect(() => {
    const g = gangs.find(g => g.name === selectedGang)
    setGrades(g?.grades?.sort((a,b) => a.grade - b.grade) || [])
    setGrade('0')
  }, [selectedGang, gangs])

  const submit = async () => {
    setLoading(true)
    try { await issueCommand('set_gang', player.citizenid, { gang: selectedGang, grade: parseInt(grade) }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }

  return (
    <Modal title="تعيين العصابة / الرتبة" subtitle="Apply this change from the panel" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="العصابة">
            <SearchableSelect 
              value={selectedGang} 
              onChange={setSelectedGang} 
              placeholder="— اختر عصابة —"
              options={gangs.sort((a,b) => (a.label||a.name).localeCompare(b.label||b.name)).map(g => ({
                value: g.name,
                label: g.label || g.name,
                subLabel: g.name
              }))}
            />
          </Field>
          {grades.length > 0 ? (
            <Field label="الرتبة">
              <Sel value={grade} onChange={e => setGrade(e.target.value)}>
                {grades.map(g => (
                  <option key={g.grade} value={g.grade}>{g.grade} — {g.label || g.name}</option>
                ))}
              </Sel>
            </Field>
          ) : (
            <Field label="الرتبة">
              <Inp type="number" min="0" placeholder="0" value={grade} onChange={e => setGrade(e.target.value)} disabled={!selectedGang} />
            </Field>
          )}
        </div>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} submitText="Update Gang" />
      </div>
    </Modal>
  )
}

// ── Kick ────────────────────────────────────────────────────
export function KickModal({ player, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { await issueCommand('kick', player.citizenid, { reason: reason || 'Kicked by admin' }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="طرد اللاعب" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">سيتم طرد <span className="text-white font-semibold">{player.citizenid}</span> من السيرفر.</p>
        <Field label="سبب الطرد (اختياري)">
          <Inp placeholder="سبب الطرد..." value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} danger />
      </div>
    </Modal>
  )
}

// ── Ban ─────────────────────────────────────────────────────
export function BanModal({ player, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('permanent')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { await issueCommand('ban', player.citizenid, { reason: reason || 'Banned by admin', duration }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="حظر اللاعب" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">سيتم حظر <span className="text-white font-semibold">{player.citizenid}</span> بشكل دائم.</p>
        <Field label="سبب الحظر">
          <Inp placeholder="سبب الحظر..." value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        <Field label="مدة الحظر">
          <Sel value={duration} onChange={e => setDuration(e.target.value)}>
            <option value="permanent">دائم</option>
            <option value="1d">يوم واحد</option>
            <option value="3d">3 أيام</option>
            <option value="7d">أسبوع</option>
            <option value="30d">شهر</option>
          </Sel>
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} danger />
      </div>
    </Modal>
  )
}

// ── Jail ────────────────────────────────────────────────────
export function JailModal({ player, onClose, onDone }) {
  const [time, setTime] = useState('10')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { await issueCommand('jail', player.citizenid, { time: parseInt(time) }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="إيداع السجن" onClose={onClose}>
      <div className="space-y-4">
        <Field label="مدة السجن (بالدقائق)">
          <Inp type="number" min="1" placeholder="10" value={time} onChange={e => setTime(e.target.value)} />
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── Teleport ────────────────────────────────────────────────
export function TeleportModal({ player, onClose, onDone }) {
  const [locs, setLocs] = useState([])
  const [selectedLoc, setSelectedLoc] = useState('')
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [z, setZ] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/teleport-locations`, { headers: getH() }).then(res => {
      const data = res.data || []
      const defaultLocs = [
        { id: 'def1', name: 'Legion Square', x: 198.43, y: -933.29, z: 30.68 },
        { id: 'def2', name: 'MRPD (Police)', x: 428.23, y: -984.28, z: 30.71 },
        { id: 'def3', name: 'Pillbox Hospital', x: 298.54, y: -584.58, z: 43.26 },
        { id: 'def4', name: 'Airport', x: -1037.74, y: -2737.8, z: 20.16 },
        { id: 'def5', name: 'Sandy Shores', x: 1852.88, y: 3683.01, z: 34.26 },
        { id: 'def6', name: 'Paleto Bay', x: -121.28, y: 6469.75, z: 31.62 },
      ]
      setLocs([...defaultLocs, ...data])
    }).catch(()=>{})
  }, [])

  const handleLocChange = (val) => {
    setSelectedLoc(val)
    const loc = locs.find(l => l.id.toString() === val)
    if (loc) {
      setX(loc.x.toString()); setY(loc.y.toString()); setZ(loc.z.toString())
    }
  }

  const submit = async () => {
    setLoading(true)
    try { await issueCommand('teleport', player.citizenid, { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="نقل اللاعب" onClose={onClose}>
      <div className="space-y-4">
        {locs.length > 0 && (
          <Field label="اختر موقع محفوظ">
            <Sel value={selectedLoc} onChange={e => handleLocChange(e.target.value)}>
              <option value="">— اختر موقع —</option>
              {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Sel>
          </Field>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Field label="X"><Inp placeholder="0.0" value={x} onChange={e => setX(e.target.value)} /></Field>
          <Field label="Y"><Inp placeholder="0.0" value={y} onChange={e => setY(e.target.value)} /></Field>
          <Field label="Z"><Inp placeholder="0.0" value={z} onChange={e => setZ(e.target.value)} /></Field>
        </div>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── CharInfo ────────────────────────────────────────────────
export function CharInfoModal({ player, onClose, onDone }) {
  const ci = typeof player.charinfo === 'string' ? JSON.parse(player.charinfo || '{}') : (player.charinfo || {})
  const [firstname, setFirstname] = useState(ci.firstname || '')
  const [lastname, setLastname] = useState(ci.lastname || '')
  const [birthdate, setBirthdate] = useState(ci.birthdate || '')
  const [nationality, setNationality] = useState(ci.nationality || '')
  const [gender, setGender] = useState(ci.gender === undefined ? '0' : ci.gender.toString())
  const [phone, setPhone] = useState(ci.phone || '')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { await issueCommand('set_charinfo', player.citizenid, { firstname, lastname, birthdate, nationality, phone, gender: parseInt(gender) }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="Edit Identity" subtitle={`Update character identity fields for ${firstname} ${lastname}. If the player is online, they will be kicked automatically and changes will apply shortly.`} onClose={onClose} width="max-w-2xl">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="الاسم الأول">
            <Inp value={firstname} onChange={e => setFirstname(e.target.value)} />
          </Field>
          <Field label="اسم العائلة">
            <Inp value={lastname} onChange={e => setLastname(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <Field label="الجنس">
              <Sel value={gender} onChange={e => setGender(e.target.value)}>
                <option value="0">Male</option>
                <option value="1">Female</option>
              </Sel>
            </Field>
            <p className="text-[10px] text-gray-500 text-right mt-1 font-mono">Stored as 0/1 (QBCore convention).</p>
          </div>
          <Field label="تاريخ الميلاد">
            <Inp type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <Field label="الهاتف">
              <Inp value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <p className="text-[10px] text-gray-500 text-right mt-1 font-mono">Digits only. Non-numeric characters are removed automatically.</p>
          </div>
          <Field label="الجنسية">
            <Inp value={nationality} onChange={e => setNationality(e.target.value)} />
          </Field>
        </div>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} submitText="حفظ" />
      </div>
    </Modal>
  )
}

// ── Meta ────────────────────────────────────────────────────
export function MetaModal({ player, onClose, onDone }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { await issueCommand('set_metadata', player.citizenid, { key, value }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="تعديل الميتا داتا" onClose={onClose}>
      <div className="space-y-4">
        <Field label="المفتاح (key)">
          <Sel value={key} onChange={e => setKey(e.target.value)}>
            <option value="">— اختر مفتاح —</option>
            {['hunger','thirst','armor','stress','ishandcuffed','injail','phone','fingerprint'].map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </Sel>
        </Field>
        <Field label="القيمة الجديدة"><Inp placeholder="القيمة..." value={value} onChange={e => setValue(e.target.value)} /></Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── DM (Direct Message) ─────────────────────────────────────
export function DMModal({ player, onClose, onDone }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (!message) return
    setLoading(true)
    try { await issueCommand('dm', player.citizenid, { message }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="إرسال رسالة مباشرة" onClose={onClose}>
      <div className="space-y-4">
        <Field label="نص الرسالة">
          <textarea 
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red placeholder-gray-600 resize-none h-24"
            placeholder="اكتب رسالتك هنا..." 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
          />
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── Permissions (Admin/Group) ───────────────────────────────
export function PermissionsModal({ player, onClose, onDone }) {
  const [group, setGroup] = useState('user')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    setLoading(true)
    try { await issueCommand('set_permission', player.citizenid, { group }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  return (
    <Modal title="تعديل الصلاحيات" onClose={onClose}>
      <div className="space-y-4">
        <Field label="مجموعة الصلاحيات (Group)">
          <Sel value={group} onChange={e => setGroup(e.target.value)}>
            <option value="user">User (مستخدم عادي)</option>
            <option value="admin">Admin (إداري)</option>
            <option value="superadmin">Superadmin (إداري عليا)</option>
          </Sel>
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── Delete Character ────────────────────────────────────────
export function DeleteCharModal({ player, onClose, onDone }) {
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  
  const submit = async () => {
    if (confirmText !== player.citizenid) {
      alert('يرجى كتابة الـ CitizenID بشكل صحيح للتأكيد.')
      return
    }
    setLoading(true)
    try { await issueCommand('delete_character', player.citizenid, {}); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }
  
  return (
    <Modal title="حذف الشخصية (خطر)" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-400 text-sm">
          <strong>تحذير:</strong> هذا الإجراء سيقوم بحذف الشخصية <span className="font-mono text-white">{player.citizenid}</span> بشكل نهائي من قاعدة البيانات ولا يمكن التراجع عنه.
        </div>
        <Field label={`لتأكيد الحذف، اكتب: ${player.citizenid}`}>
          <Inp placeholder={player.citizenid} value={confirmText} onChange={e => setConfirmText(e.target.value)} />
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} danger />
      </div>
    </Modal>
  )
}

// ── Give Item ───────────────────────────────────────────────
export function GiveItemModal({ player, onClose, onDone }) {
  const [items, setItems] = useState([])
  const [selectedItem, setSelectedItem] = useState('')
  const [amount, setAmount] = useState('1')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getServerData().then(d => setItems(d.items || []))
  }, [])

  const submit = async () => {
    if (!selectedItem) return
    setLoading(true)
    try { await issueCommand('give_item', player.citizenid, { item: selectedItem, amount: parseInt(amount), reason }); onDone() } catch (e) { alert(e.message) }
    setLoading(false)
  }

  return (
    <Modal title="إعطاء غرض" subtitle="Give an item to this character." onClose={onClose}>
      <div className="space-y-6">
        <Field label="العنصر">
          <SearchableSelect 
            value={selectedItem} 
            onChange={setSelectedItem} 
            placeholder="— اختر غرض —"
            options={items.sort((a,b) => (a.label||a.name).localeCompare(b.label||b.name)).map(i => ({
              value: i.name,
              label: i.label || i.name,
              subLabel: i.name
            }))}
          />
        </Field>
        <Field label="الكمية">
          <Inp type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
        <Field label="السبب">
          <Inp placeholder="...Optional note" value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── Give Vehicle ───────────────────────────────────────────
export function GiveVehicleModal({ player, onClose, onDone }) {
  const [vehicles, setVehicles] = useState([])
  const [garages, setGarages] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [selectedGarage, setSelectedGarage] = useState('alta')
  const [plate, setPlate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/shared/vehicles`, { headers: getH() }).then(res => setVehicles(res.data || []))
    axios.get(`${API}/api/shared/garages`, { headers: getH() }).then(res => setGarages(res.data || []))
    setPlate(Math.random().toString(36).substring(2, 10).toUpperCase())
  }, [])

  const submit = async () => {
    if (!selectedVehicle || !plate) return
    setLoading(true)
    try { 
      await issueCommand('give_vehicle', player.citizenid, { 
        model: selectedVehicle, 
        plate, 
        garage: selectedGarage 
      }); 
      onDone() 
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  return (
    <Modal title="إعطاء مركبة" subtitle="Give a vehicle to this character." onClose={onClose}>
      <div className="space-y-6">
        <Field label="المركبة">
          <SearchableSelect 
            value={selectedVehicle} 
            onChange={setSelectedVehicle} 
            placeholder="— اختر مركبة —"
            options={vehicles.map(v => ({
              value: v.model,
              label: `${v.brand} ${v.name}`,
              subLabel: v.model
            }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="رقم اللوحة">
            <Inp value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} maxLength={8} />
          </Field>
          <Field label="الكراج">
            <Sel value={selectedGarage} onChange={e => setSelectedGarage(e.target.value)}>
              {garages.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Sel>
          </Field>
        </div>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} />
      </div>
    </Modal>
  )
}

// ── Create Ban (with Player Search) ────────────────────────
export function CreateBanModal({ onClose, onDone }) {
  const [players, setPlayers] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('permanent')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/players`, { headers: getH() }).then(res => {
      const list = res.data || []
      setPlayers(list.map(p => {
        const ci = typeof p.charinfo === 'string' ? JSON.parse(p.charinfo) : p.charinfo
        return {
          id: p.citizenid,
          name: `${ci.firstname} ${ci.lastname}`,
          license: p.license
        }
      }))
    })
  }, [])

  const submit = async () => {
    if (!selectedPlayer) return
    setLoading(true)
    try { 
      await issueCommand('ban', selectedPlayer, { 
        reason: reason || 'Banned by admin', 
        duration 
      }); 
      onDone() 
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  return (
    <Modal title="إنشاء حظر جديد" subtitle="Search and select a player to ban" onClose={onClose}>
      <div className="space-y-6">
        <Field label="البحث عن لاعب">
          <SearchableSelect 
            value={selectedPlayer} 
            onChange={setSelectedPlayer} 
            placeholder="— ابحث باسم الشخصية —"
            options={players.map(p => ({
              value: p.id,
              label: p.name,
              subLabel: p.id
            }))}
          />
        </Field>
        <Field label="السبب">
          <Inp placeholder="سبب الحظر..." value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        <Field label="المدة">
          <Sel value={duration} onChange={e => setDuration(e.target.value)}>
            <option value="permanent">دائم</option>
            <option value="1d">يوم واحد</option>
            <option value="3d">3 أيام</option>
            <option value="7d">أسبوع</option>
            <option value="30d">شهر</option>
          </Sel>
        </Field>
        <Btns onClose={onClose} onSubmit={submit} loading={loading} danger submitText="تأكيد الحظر" />
      </div>
    </Modal>
  )
}
