import { useState, useEffect } from 'react'
import axios from 'axios'
import { parseJ, parseArr, issueCommand } from './PlayerProfileUtils'
import { MoneyModal, JobModal, GangModal, KickModal, BanModal, JailModal, TeleportModal, CharInfoModal, MetaModal, DMModal, PermissionsModal, DeleteCharModal, GiveItemModal } from './PlayerModals'
import { Search } from 'lucide-react'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
function getH() {
  return { Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`, 'x-server-id': localStorage.getItem('active_server_id') || '' }
}

export default function PlayerProfile({ player: initialPlayer, onClose }) {
  const [player, setPlayer] = useState(initialPlayer)
  const [modal, setModal] = useState(null)
  const [tab, setTab] = useState('inventory') // inventory or vehicles
  const [search, setSearch] = useState('')
  const [ssUrl, setSsUrl] = useState(`${API}/uploads/screenshots/${player.citizenid}.webp`)
  const [onlineCids, setOnlineCids] = useState(new Set())

  // Fetch online players to determine real online status
  useEffect(() => {
    axios.get(`${API}/api/online`, { headers: getH() }).then(({ data }) => {
      const cids = new Set((data || []).map(p => p.citizenid).filter(Boolean))
      setOnlineCids(cids)
    }).catch(() => {})
  }, [])

  // Auto-refresh live screenshot every 2 seconds when player is online
  useEffect(() => {
    const interval = setInterval(() => {
      setSsUrl(`${API}/uploads/screenshots/${player.citizenid}.webp?t=${Date.now()}`)
    }, 2000)
    return () => clearInterval(interval)
  }, [player.citizenid])

  const ci = parseJ(player.charinfo)
  const job = parseJ(player.job)
  const gang = parseJ(player.gang)
  const money = parseJ(player.money)
  const inv = parseArr(player.inventory)
  const vehs = Array.isArray(player.vehicles) ? player.vehicles : []
  const name = ci.firstname ? `${ci.firstname} ${ci.lastname}` : player.name || player.citizenid
  // Online status: check from live online cache, or fallback to player.online flag
  const isOnline = onlineCids.size > 0 ? onlineCids.has(player.citizenid) : !!player.online

  const refreshPlayer = async () => {
    try {
      const { data } = await axios.get(`${API}/api/players/${player.citizenid}`, { headers: getH() })
      setPlayer({ ...data, online: isOnline })
    } catch {}
  }

  const done = () => { setModal(null); setTimeout(refreshPlayer, 800) }

  const quick = async (type, payload = {}) => {
    try {
      await issueCommand(type, player.citizenid, payload)
      if (type === 'screenshot') {
        setTimeout(() => setSsUrl(`${API}/uploads/screenshots/${player.citizenid}.webp?t=${Date.now()}`), 2000)
      }
    } catch (e) {
      alert(`فشل: ${e.message}`)
    }
  }

  const removeItem = async (itemName, slot) => {
    if (!confirm(`هل تريد حذف (${itemName}) من حقيبة اللاعب؟`)) return
    try {
      await issueCommand('remove_item', player.citizenid, { item: itemName, slot })
      done()
    } catch (e) { alert(`فشل: ${e.message}`) }
  }

  const clearInventory = async () => {
    if (!confirm('تحذير: هذا سيحذف جميع عناصر حقيبة اللاعب. هل أنت متأكد؟')) return
    try {
      await issueCommand('clear_inventory', player.citizenid, {})
      done()
    } catch (e) { alert(`فشل: ${e.message}`) }
  }

  const removeVehicle = async (plate) => {
    if (!confirm(`هل تريد حذف المركبة ذات اللوحة (${plate}) نهائياً؟`)) return
    try {
      await issueCommand('remove_vehicle', player.citizenid, { plate })
      done()
    } catch (e) { alert(`فشل: ${e.message}`) }
  }

  return (
    <>
      {modal === 'money' && <MoneyModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'job' && <JobModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'gang' && <GangModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'kick' && <KickModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'ban' && <BanModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'jail' && <JailModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'teleport' && <TeleportModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'charinfo' && <CharInfoModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'meta' && <MetaModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'dm' && <DMModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'permissions' && <PermissionsModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'delete' && <DeleteCharModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'give_item' && <GiveItemModal player={player} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'give_vehicle' && <GiveVehicleModal player={player} onClose={() => setModal(null)} onDone={done} />}

      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] flex justify-center bg-[#0d0f14] overflow-y-auto" dir="rtl">
        <div className="w-full max-w-[1600px] min-h-screen flex flex-col p-6 animate-fade-in">
          
          {/* Top Header */}
          <div className="flex flex-col mb-6">
            <div className="flex justify-between items-center w-full mb-4">
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-sm font-bold bg-[#111317] border border-dark-600 px-4 py-1.5 rounded-lg">إغلاق</button>
              <div className="text-xs font-bold text-gray-500">الشخصيات / <span className="text-gray-400">{player.citizenid}</span></div>
            </div>

            <div className="flex items-center justify-end gap-4 mb-3">
              <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${isOnline ? 'bg-accent-green/10 text-accent-green border-accent-green/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                {isOnline ? 'متصل' : 'غير متصل'}
              </div>
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <div className="w-12 h-12 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                <img 
                  src={ci.profilepic && ci.profilepic !== "none" && ci.profilepic !== "" ? ci.profilepic : `${API}/uploads/avatars/${player.citizenid}_face.png`} 
                  alt={name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 font-bold bg-dark-600 z-[-1]">{name.substring(0, 2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-6 text-[11px] font-mono font-bold text-gray-500 flex-wrap">
              <span>FiveM <span className="text-gray-300">{player.id || 'N/A'}</span></span>
              <span>Discord <span className="text-gray-300">{player.discord || 'N/A'}</span></span>
              <span>License <span className="text-gray-300">{player.license || 'N/A'}</span></span>
              <span>CitizenID <span className="text-gray-300">{player.citizenid}</span></span>
              <span>CID <span className="text-gray-300">{player.cid || 'N/A'}</span></span>
            </div>
          </div>

          {/* 4 Quadrants */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Top Right: Character Summary */}
            <div className="bg-[#111317] border border-dark-600 rounded-xl p-5 flex flex-col">
              <h2 className="text-lg font-bold text-white mb-6 text-right">ملخص الشخصية</h2>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-6 text-sm text-right">
                <div className="flex flex-col gap-4 items-end">
                  <div className="flex gap-2 w-full justify-between"><span className="text-gray-300 font-bold text-left w-full">{job?.label || 'مواطن - عاطل'}</span><span className="text-gray-500 font-bold whitespace-nowrap">الوظيفة:</span></div>
                  <div className="flex gap-2 w-full justify-between"><span className="text-[#22c55e] font-mono font-bold text-left w-full">${(money?.cash || 0).toLocaleString()}</span><span className="text-gray-500 font-bold whitespace-nowrap">النقد:</span></div>
                  <div className="flex gap-2 w-full justify-between"><span className="text-gray-300 font-mono font-bold text-left w-full">{ci.phone || '—'}</span><span className="text-gray-500 font-bold whitespace-nowrap">الهاتف:</span></div>
                  <div className="flex gap-2 w-full justify-between"><span className="text-gray-300 font-mono font-bold text-left w-full">{ci.gender === 0 ? 'Male' : 'Female'}</span><span className="text-gray-500 font-bold whitespace-nowrap">الجنس:</span></div>
                </div>
                <div className="flex flex-col gap-4 items-end">
                  <div className="flex gap-2 w-full justify-between"><span className="text-gray-300 font-bold text-left w-full">{gang?.label || gang?.name || 'No Gang - Unaffiliated'}</span><span className="text-gray-500 font-bold whitespace-nowrap">العصابة:</span></div>
                  <div className="flex gap-2 w-full justify-between"><span className="text-[#3b82f6] font-mono font-bold text-left w-full">${(money?.bank || 0).toLocaleString()}</span><span className="text-gray-500 font-bold whitespace-nowrap">البنك:</span></div>
                  <div className="flex gap-2 w-full justify-between">
                    <span className="text-gray-300 font-mono font-bold text-left w-full">
                      {player.playTime ? (
                        <>
                          {Math.floor(player.playTime / 3600)} ساعة {Math.floor((player.playTime % 3600) / 60)} دقيقة
                        </>
                      ) : '0 دقيقة'}
                    </span>
                    <span className="text-gray-500 font-bold whitespace-nowrap">وقت اللعب:</span>
                  </div>
                  <div className="flex gap-2 w-full justify-between"><span className="text-gray-300 font-mono font-bold text-left w-full">{ci.birthdate || '—'}</span><span className="text-gray-500 font-bold whitespace-nowrap">تاريخ الميلاد:</span></div>
                  <div className="flex gap-2 w-full justify-between"><span className="text-gray-300 font-bold text-left w-full">{ci.nationality || '—'}</span><span className="text-gray-500 font-bold whitespace-nowrap">الجنسية:</span></div>
                </div>
              </div>

              <div className="mt-auto border-t border-dark-600 pt-5">
                <h3 className="text-xs font-bold text-gray-500 mb-3 text-right">الشخصيات المرتبطة</h3>
                <div className="flex flex-wrap gap-2 justify-end">
                  <div className="bg-[#0d0f14] border border-brand-red/30 rounded-lg p-2 px-3 flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`}></span>
                    <span className="text-base font-bold text-white">{name} - <span className="text-gray-400 text-sm">{player.citizenid}</span></span>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-500'}`}>{isOnline ? 'متصل' : 'غير متصل'}</span>
                  </div>
                  {player.relatedCharacters?.map(r => {
                    const rCi = parseJ(r.charinfo)
                    const rName = rCi.firstname ? `${rCi.firstname} ${rCi.lastname}` : r.citizenid
                    const rOnline = onlineCids.has(r.citizenid)
                    return (
                      <div key={r.citizenid} className="bg-[#111317] border border-dark-600 rounded-lg p-2 px-3 flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${rOnline ? 'bg-emerald-400' : 'bg-gray-600'}`}></span>
                        <span className="text-base font-bold text-gray-300 hover:text-white transition-colors">{rName} - <span className="text-gray-500 text-sm">{r.citizenid}</span></span>
                        <span className={`text-[11px] font-bold px-2 py-1 rounded flex-shrink-0 ${rOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-500'}`}>{rOnline ? 'متصل' : 'غير متصل'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>


            {/* Top Left: Quick Actions */}
            <div className="bg-[#111317] border border-dark-600 rounded-xl p-5 flex flex-col">
              <h2 className="text-lg font-bold text-white mb-6 text-right">الإجراءات السريعة</h2>
              <div className="grid grid-cols-3 gap-3 h-full">
                {/* Col 1 (Right in RTL) */}
                <div className="flex flex-col gap-3">
                  <button onClick={() => setModal('teleport')} disabled={!isOnline} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 disabled:opacity-30 disabled:hover:border-dark-600 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">نقل فوري</button>
                  <button onClick={() => setModal('ban')} className="w-full bg-brand-red text-white py-3 rounded-lg text-sm font-bold hover:bg-brand-red-dark transition-all border border-transparent hover:scale-105 active:scale-95 duration-200">حظر</button>
                  <button onClick={() => setModal('job')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">تعديل الوظيفة/الرتبة</button>
                  <button onClick={() => setModal('gang')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">تعديل العصابة/الرتبة</button>
                  <button onClick={() => quick('fixveh')} disabled={!isOnline} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 disabled:opacity-30 disabled:hover:border-dark-600 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">إصلاح مركبة</button>
                </div>
                {/* Col 2 (Middle) */}
                <div className="flex flex-col gap-3">
                  <button onClick={() => setModal('dm')} disabled={!isOnline} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 disabled:opacity-30 disabled:hover:border-dark-600 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">رسالة مباشرة</button>
                  <button onClick={() => setModal('money')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">إدارة الأموال</button>
                  <button onClick={() => quick('revive')} disabled={!isOnline} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 disabled:opacity-30 disabled:hover:border-dark-600 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">إنعاش</button>
                  <button onClick={() => quick('kill')} disabled={!isOnline} className="w-full bg-red-900/20 border border-red-800/40 hover:border-red-600 hover:bg-red-800/30 disabled:opacity-30 text-red-400 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">قتل</button>
                  <button onClick={() => setModal('charinfo')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">تعديل الهوية</button>
                </div>
                {/* Col 3 (Left in RTL) */}
                <div className="flex flex-col gap-3">
                  <button onClick={() => setModal('kick')} disabled={!isOnline} className="w-full bg-brand-red/10 border border-brand-red/20 text-brand-red disabled:opacity-30 disabled:hover:bg-brand-red/10 disabled:hover:text-brand-red hover:bg-brand-red hover:text-white py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">طرد</button>
                  <button onClick={() => setModal('give_item')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">إعطاء غرض</button>
                  <button onClick={() => setModal('give_vehicle')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">إعطاء مركبة</button>
                  <button onClick={() => setModal('permissions')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">الصلاحيات</button>
                  <button onClick={() => setModal('meta')} className="w-full bg-[#0d0f14] border border-dark-600 hover:border-gray-500 text-gray-300 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 duration-200">تعديل Metadata</button>
                  <button onClick={() => setModal('delete')} className="w-full bg-brand-red hover:bg-brand-red-dark text-white py-3 rounded-lg text-sm font-bold transition-all mt-auto border border-transparent hover:scale-105 active:scale-95 duration-200">حذف الشخصية</button>
                </div>
              </div>
            </div>

            {/* Bottom Right: Live Screenshot */}
            <div className="bg-[#111317] border border-dark-600 rounded-xl p-5 flex flex-col h-[400px]">
              <h2 className="text-lg font-bold text-white mb-6 text-right">اللقطة المباشرة</h2>
              <div 
                className={`flex-1 bg-[#0d0f14] border border-dark-600 rounded-lg overflow-hidden relative ${isOnline ? 'cursor-pointer' : ''}`} 
                onClick={() => isOnline && quick('screenshot')}
              >
                {isOnline ? (
                  <img src={ssUrl} alt="Live View" className="w-full h-full object-contain" onError={(e) => {e.target.src=`${API}/uploads/avatars/${player.citizenid}_face.png`; e.target.onerror=(e2)=>{e2.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(name||'?')}&background=14151a&color=fff&size=400`;}}} />
                ) : (
                  <div className="w-full h-full relative">
                    <img src={ci.profilepic && ci.profilepic !== "none" && ci.profilepic !== "" ? ci.profilepic : `${API}/uploads/avatars/${player.citizenid}_face.png`} alt="Last Known" className="w-full h-full object-contain opacity-60 grayscale-[0.5]" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    <div className="absolute inset-0 flex items-center justify-center" style={{display:'none'}}>
                       <span className="text-gray-500 font-bold text-sm">اللاعب غير متصل</span>
                    </div>
                    <div className="absolute top-2 right-2 bg-dark-800/80 px-2 py-1 rounded text-[10px] text-gray-400 border border-dark-600">آخر صورة محفوظة (أوفلاين)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Left: Details (Inventory/Vehicles) */}
            <div className="bg-[#111317] border border-dark-600 rounded-xl p-5 flex flex-col h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white text-right">التفاصيل</h2>
                <div className="flex bg-[#0d0f14] rounded-lg p-1 border border-dark-600">
                  <button onClick={() => setTab('inventory')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-colors ${tab === 'inventory' ? 'bg-[#1a1d24] text-white' : 'text-gray-500 hover:text-gray-300'}`}>الحقيبة</button>
                  <button onClick={() => setTab('vehicles')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-colors ${tab === 'vehicles' ? 'bg-[#1a1d24] text-white' : 'text-gray-500 hover:text-gray-300'}`}>المركبات</button>
                </div>
              </div>

              {tab === 'inventory' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <span className="text-xs font-mono text-gray-500">{inv.length} slots - {inv.reduce((a,b)=>a+(b.amount||1),0)} items</span>
                    <div className="flex-1 max-w-[200px] relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-[#0d0f14] border border-dark-600 focus:border-brand-red rounded-lg pl-9 pr-3 py-2 text-xs text-left text-gray-300 outline-none" 
                        placeholder="Search item..." 
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setModal('give_item')} className="bg-[#0d0f14] border border-dark-600 hover:bg-dark-700 text-gray-300 px-4 py-2 rounded-lg text-xs font-bold transition-colors">إعطاء غرض</button>
                      <button onClick={clearInventory} className="bg-brand-red hover:bg-brand-red-dark text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors border border-transparent">مسح</button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <table className="w-full text-right border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-[11px] font-bold text-gray-500 border-b border-dark-600">
                          <th className="pb-2 pl-4 text-left">الإجراءات</th>
                          <th className="pb-2 px-2 text-center">المخزن</th>
                          <th className="pb-2 px-2">التفاصيل</th>
                          <th className="pb-2 px-2 text-center">الكمية</th>
                          <th className="pb-2 px-2">العنصر</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {inv.filter(item => (item.label || '').toLowerCase().includes(search.toLowerCase()) || (item.name || '').toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                          <tr><td colSpan="5" className="py-8 text-center text-gray-500 font-bold">لا توجد عناصر</td></tr>
                        ) : inv.filter(item => (item.label || '').toLowerCase().includes(search.toLowerCase()) || (item.name || '').toLowerCase().includes(search.toLowerCase())).map((item, i) => (
                          <tr key={i} className="bg-[#0d0f14] border border-dark-600 rounded-lg group">
                            <td className="p-3 text-left rounded-l-lg border-y border-l border-dark-600">
                              <button onClick={() => removeItem(item.name, item.slot)} className="bg-[#111317] border border-dark-500 group-hover:border-brand-red group-hover:text-brand-red text-gray-400 px-4 py-1.5 rounded text-[11px] font-bold transition-colors">إزالة</button>
                            </td>
                            <td className="p-3 text-center text-gray-500 border-y border-dark-600">-</td>
                            <td className="p-3 border-y border-dark-600">
                              <span className="bg-[#111317] border border-dark-500 px-3 py-1 rounded text-[10px] font-mono text-gray-300">وزن {item.weight || 0}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-white border-y border-dark-600">{item.amount || 1}</td>
                            <td className="p-3 rounded-r-lg border-y border-r border-dark-600">
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex flex-col items-end">
                                  <span className="font-bold text-white">{item.label || item.name}</span>
                                  <span className="text-[10px] font-mono text-gray-500">{item.name}</span>
                                </div>
                                <img 
                                  src={`${API}/uploads/items/${item.name}.png`} 
                                  alt={item.label || item.name}
                                  className="w-8 h-8 rounded object-contain bg-dark-800 p-0.5 flex-shrink-0"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'vehicles' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <span className="text-xs font-mono text-gray-500">{vehs.length} vehicles</span>
                    <div className="flex-1 max-w-[200px] relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-[#0d0f14] border border-dark-600 focus:border-brand-red rounded-lg pl-9 pr-3 py-2 text-xs text-left text-gray-300 outline-none" 
                        placeholder="Search vehicle..." 
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setModal('give_vehicle')} className="bg-[#0d0f14] border border-dark-600 hover:bg-dark-700 text-gray-300 px-4 py-2 rounded-lg text-xs font-bold transition-colors">إعطاء مركبة</button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <table className="w-full text-right border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-[11px] font-bold text-gray-500 border-b border-dark-600">
                          <th className="pb-2 pl-4 text-left">الإجراءات</th>
                          <th className="pb-2 px-2 text-center">الحالة</th>
                          <th className="pb-2 px-2">الكراج</th>
                          <th className="pb-2 px-2">اللوحة</th>
                          <th className="pb-2 px-2">المركبة</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {vehs.filter(v => (v.vehicle || '').toLowerCase().includes(search.toLowerCase()) || (v.plate || '').toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                          <tr><td colSpan="5" className="py-8 text-center text-gray-500 font-bold">لا يوجد مركبات</td></tr>
                        ) : vehs.filter(v => (v.vehicle || '').toLowerCase().includes(search.toLowerCase()) || (v.plate || '').toLowerCase().includes(search.toLowerCase())).map((v, i) => (
                          <tr key={i} className="bg-[#0d0f14] border border-dark-600 rounded-lg group">
                            <td className="p-3 text-left rounded-l-lg border-y border-l border-dark-600">
                              <button onClick={() => removeVehicle(v.plate)} className="bg-[#111317] border border-dark-500 group-hover:border-brand-red group-hover:text-brand-red text-gray-400 px-4 py-1.5 rounded text-[11px] font-bold transition-colors">إزالة</button>
                            </td>
                            <td className="p-3 text-center border-y border-dark-600">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.state === 1 || v.state === '1' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                {v.state === 1 || v.state === '1' ? 'في الكراج' : 'خارج الكراج'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-300 font-mono border-y border-dark-600">{v.garage || '—'}</td>
                            <td className="p-3 font-mono font-bold text-gray-400 border-y border-dark-600">{v.plate}</td>
                            <td className="p-3 rounded-r-lg border-y border-r border-dark-600 font-bold text-white uppercase">{v.vehicle}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
