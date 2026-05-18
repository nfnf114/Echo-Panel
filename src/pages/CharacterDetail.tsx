import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Shield, Wallet, Briefcase, Users, Phone, MapPin, 
  Settings as SettingsIcon, Package, Car, Clock, RefreshCw,
  Activity, HeartPulse, LogOut, Trash2, Send, ChevronRight, X, Search, 
  ChevronDown, AlertTriangle, Fingerprint, Globe, Calendar, UserPlus, 
  CheckCircle, Ban, MessageSquare, DollarSign, Utensils,
  Smartphone, Camera, Plus, Lock, ArrowLeft, CreditCard
} from 'lucide-react';
import { fetchWithAuth, invalidateServerCache } from '../utils/api';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../App';
import './CharacterDetail.css';

import { API_URL } from '../config';

const NATIONALITIES = [
  "سعودي", "كويتي", "إماراتي", "قطري", "بحريني", "عماني", "مصري", "عراقي", "أردني", "لبناني", "سوري", "فلسطيني", "يمني", "سوداني", "ليبي", "تونس", "جزائري", "مغربي", "موريتاني", "صومالي", "جيبوتي", "جزر القمر"
];

const CharacterDetail: React.FC = () => {
  const { serverId, citizenid } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { lang, t } = useLanguage();
  
  const [player, setPlayer] = useState<any>(null);
  const [linkedCharacters, setLinkedCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'vehicles'>('inventory');
  const [isOnline, setIsOnline] = useState(false);
  const [onlinePlayer, setOnlinePlayer] = useState<any>(null);
  const [sharedConfig, setSharedConfig] = useState<any>({ jobs: {}, gangs: {}, items: {} });
  const [panelSettings, setPanelSettings] = useState<any>({});
  const [vehicles, setVehicles] = useState<any[]>([]);

  const [actionModal, setActionModal] = useState<{
    show: boolean; title: string; description: string; action?: string; 
    type: 'confirm' | 'prompt' | 'item' | 'job' | 'gang' | 'identity' | 'metadata';
    value?: any;
  }>({ show: false, title: '', description: '', type: 'confirm' });

  const [promptValues, setPromptValues] = useState<any>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = async (skipLoading = false) => {
    try {
      // Run all independent API calls in parallel for faster load
      const [playerRes, serverRes, confRes, setRes, vRes] = await Promise.allSettled([
        fetchWithAuth(`${API_URL}/api/server/${serverId}/player/${citizenid}`),
        fetchWithAuth(`${API_URL}/api/server/${serverId}`),
        fetchWithAuth(`${API_URL}/api/server/${serverId}/shared-config`),
        fetchWithAuth(`${API_URL}/api/server/${serverId}/panel-settings`),
        fetchWithAuth(`${API_URL}/api/server/${serverId}/game-vehicles`)
      ]);

      if (playerRes.status === 'fulfilled' && playerRes.value.ok) {
        const data = await playerRes.value.json();
        setPlayer(data.player || null);
        setLinkedCharacters(data.linkedCharacters || []);
      }

      if (serverRes.status === 'fulfilled' && serverRes.value.ok) {
        const serverData = await serverRes.value.json();
        let onlinePlayers = [];
        try {
           const pData = serverData.server?.players_data;
           onlinePlayers = typeof pData === 'string' ? JSON.parse(pData) : (pData || []);
           if (!Array.isArray(onlinePlayers)) onlinePlayers = [];
        } catch(e) { onlinePlayers = []; }
        const found = onlinePlayers.find((p: any) => p.citizenid === citizenid);
        setIsOnline(!!found);
        setOnlinePlayer(found || null);
      }

      if (confRes.status === 'fulfilled' && confRes.value.ok) setSharedConfig(await confRes.value.json());
      if (setRes.status === 'fulfilled' && setRes.value.ok) setPanelSettings((await setRes.value.json()).settings || {});
      if (vRes.status === 'fulfilled' && vRes.value.ok) {
         const vData = await vRes.value.json();
         setVehicles((vData.vehicles || []).filter((v: any) => v.citizenid === citizenid));
      }

    } catch (e) { 
      console.error('CharacterDetail fetch error:', e);
    } finally { 
      if (!skipLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, [serverId, citizenid]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeAction = async (action: string, value: any = {}) => {
    // Optimistic update: immediately update local state based on action type
    const prevPlayer = player ? { ...player } : null;
    let optimisticUpdate = false;

    if (player) {
      if (action === 'additem' && value?.item) {
        // Add item to local inventory
        const inv = Array.isArray(player.inventory) ? [...player.inventory] : [];
        const existingIdx = inv.findIndex((i: any) => i.name === value.item);
        if (existingIdx >= 0) {
          inv[existingIdx] = { ...inv[existingIdx], amount: (inv[existingIdx].amount || 1) + (parseInt(value.amount) || 1) };
        } else {
          const maxSlot = inv.reduce((max: number, i: any) => Math.max(max, i.slot || 0), 0);
          inv.push({ name: value.item, label: value.label || value.item, amount: parseInt(value.amount) || 1, slot: maxSlot + 1, type: 'item' });
        }
        setPlayer({ ...player, inventory: inv });
        optimisticUpdate = true;
      } else if (action === 'removeitem' && value?.item) {
        const inv = Array.isArray(player.inventory) ? player.inventory.filter((i: any) => i.name !== value.item) : [];
        setPlayer({ ...player, inventory: inv });
        optimisticUpdate = true;
      } else if (action === 'manage_money' && value?.amount) {
        let moneyObj = typeof player.money === 'string' ? JSON.parse(player.money) : { ...(player.money || { cash: 0, bank: 0 }) };
        const amount = parseInt(value.amount) || 0;
        const type = value.type || 'cash';
        if (value.action === 'add') {
          moneyObj[type] = (moneyObj[type] || 0) + amount;
        } else {
          moneyObj[type] = Math.max(0, (moneyObj[type] || 0) - amount);
        }
        setPlayer({ ...player, money: moneyObj });
        optimisticUpdate = true;
      } else if (action === 'setjob' && value?.job) {
        const jobObj = typeof player.job === 'string' ? JSON.parse(player.job) : { ...(player.job || {}) };
        jobObj.name = value.job;
        if (value.grade !== undefined) {
          jobObj.grade = { ...jobObj.grade, level: parseInt(value.grade) || 0 };
        }
        setPlayer({ ...player, job: jobObj });
        optimisticUpdate = true;
      } else if (action === 'setgang' && value?.gang) {
        const gangObj = typeof player.gang === 'string' ? JSON.parse(player.gang) : { ...(player.gang || {}) };
        gangObj.name = value.gang;
        if (value.grade !== undefined) {
          gangObj.grade = { ...gangObj.grade, level: parseInt(value.grade) || 0 };
        }
        setPlayer({ ...player, gang: gangObj });
        optimisticUpdate = true;
      } else if (action === 'feed') {
        let meta = typeof player.metadata === 'string' ? JSON.parse(player.metadata) : { ...(player.metadata || {}) };
        meta.hunger = 100;
        meta.thirst = 100;
        setPlayer({ ...player, metadata: meta });
        optimisticUpdate = true;
      } else if (action === 'revive') {
        let meta = typeof player.metadata === 'string' ? JSON.parse(player.metadata) : { ...(player.metadata || {}) };
        meta.isdead = false;
        meta.inlaststand = false;
        setPlayer({ ...player, metadata: meta });
        optimisticUpdate = true;
      }
    }

    try {
      // Invalidate cache for this server so we get fresh data
      if (serverId) invalidateServerCache(serverId);

      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/player/${citizenid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value })
      });
      if (res.ok) {
        showNotification(t('actionSuccess'), 'success');
        setActionModal({ ...actionModal, show: false });
        setPromptValues({});
        // Quick refresh after action — skip loading state to avoid flicker
        setTimeout(() => fetchData(true), 500);
        if (action === 'screenshot') navigate(`/server/${serverId}/screenshots`);
      } else {
        const data = await res.json();
        showNotification(data.error || (lang === 'ar' ? 'فشل تنفيذ الإجراء' : 'Action failed'), 'error');
        // Revert optimistic update on failure
        if (optimisticUpdate && prevPlayer) setPlayer(prevPlayer);
      }
    } catch (e) {
      showNotification(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Connection error', 'error');
      // Revert optimistic update on error
      if (optimisticUpdate && prevPlayer) setPlayer(prevPlayer);
    }
  };

  const openAction = (title: string, description: string, action: string, type: any = 'confirm') => {
    if (type === 'identity') {
       const char = player?.charinfo || {};
       setPromptValues({ firstname: char.firstname, lastname: char.lastname, birthdate: char.birthdate, gender: char.gender, nationality: char.nationality, phone: char.phone });
    } else if (action === 'manage_money') {
       setPromptValues({ action: 'add', type: 'cash', amount: 0 });
    } else { setPromptValues({}); }
    setSearchFilter('');
    setActionModal({ show: true, title, description, action, type });
  };

  if (loading) return <div className="loading-state glass-panel"><RefreshCw className="spin" /> {t('loading')}</div>;
  if (!player) return <div className="error-state glass-panel">{lang === 'ar' ? 'لم يتم العثور على الشخصية' : 'Character not found'}</div>;

  let charinfo: any = {};
  let money: any = { cash: 0, bank: 0, crypto: 0 };
  let metadata: any = {};
  
  try { charinfo = typeof player.charinfo === 'string' ? JSON.parse(player.charinfo) : (player.charinfo || {}); } catch(e) {}
  try { money = typeof player.money === 'string' ? JSON.parse(player.money) : (player.money || { cash: 0, bank: 0, crypto: 0 }); } catch(e) {}
  try { metadata = typeof player.metadata === 'string' ? JSON.parse(player.metadata) : (player.metadata || {}); } catch(e) {}

  const charName = `${charinfo.firstname || ''} ${charinfo.lastname || ''}`;

  
  const dbPlayTime = metadata.playtime || metadata.total_playtime || player.playTime || player.playtime || 0;
  const playTime = dbPlayTime + (player.session_minutes || 0);
  
  const itemsList = Object.keys(sharedConfig.items || {}).map(key => ({
    name: key, label: sharedConfig.items[key].label || key, image: sharedConfig.items[key].image || (key + '.png')
  }));

  const filteredResults = itemsList.filter(it => 
    (it.label && it.label.toLowerCase().includes(searchFilter.toLowerCase())) || 
    (it.name && it.name.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const jobsList = Object.keys(sharedConfig.jobs || {}).map(key => ({
    name: key, label: sharedConfig.jobs[key].label || key, grades: sharedConfig.jobs[key].grades || {}
  }));

  const gangsList = Object.keys(sharedConfig.gangs || {}).map(key => ({
    name: key, label: sharedConfig.gangs[key].label || key, grades: sharedConfig.gangs[key].grades || {}
  }));

  const vehiclesList = Object.keys(sharedConfig.vehicles || {}).map(key => {
    const v = sharedConfig.vehicles[key];
    return {
      model: key,
      name: v.name || v.brand || key,
      brand: v.brand || ''
    };
  });

  const filteredVehicles = vehiclesList.filter(v => 
    (v.name && v.name.toLowerCase().includes(searchFilter.toLowerCase())) || 
    (v.model && v.model.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="char-detail-page animate-fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* IDENTIFIERS BAR */}
      <div className="identifiers-row glass-panel">
        <div className="id-item"><span className="label">FiveM ID:</span> <span className="val">{(player.source || onlinePlayer?.source || 0).toLocaleString('en-US')}</span></div>
        <div className="id-item"><span className="label">CitizenID:</span> <span className="val">{player.citizenid}</span></div>
        <div className="id-item"><span className="label">Discord:</span> <span className="val">{onlinePlayer ? (onlinePlayer.discord || 'NOT LINKED') : (player.discord || 'OFFLINE')}</span></div>
        <div className="id-item"><span className="label">License:</span> <span className="val">{player.license?.slice(8, 20)}...</span></div>
      </div>

      {/* HEADER SECTION */}
      <div className="profile-main-header glass-panel">
        <div className="profile-left">
          <div className="avatar-wrapper avatar-wrapper-large">
             <img 
               src={charinfo.profilepic && charinfo.profilepic !== 'none' && charinfo.profilepic.trim() !== '' 
                 ? charinfo.profilepic 
                 : `${API_URL}/uploads/avatars/${citizenid}_face.png`} 
               alt={charName}
               onError={(e: any) => {
                 e.target.onerror = null;
                 const screenshotUrl = `${API_URL}/uploads/screenshots/${citizenid}.webp`;
                 if (e.target.src !== screenshotUrl) {
                   e.target.src = screenshotUrl;
                   e.target.onerror = (e2: any) => {
                      e2.target.onerror = null;
                      e2.target.src = `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(charName)}`;
                   };
                 } else {
                   e.target.src = `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(charName)}`;
                 }
               }}
             />
             <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}></div>
             <div className="avatar-label">{isOnline ? (lang === 'ar' ? 'متصل' : 'Online') : (lang === 'ar' ? 'غير متصل' : 'Offline')}</div>
          </div>
          <div className="name-section">
            <h1>{charName}</h1>
            <div className="sub-info"><Clock size={14} /> {playTime.toLocaleString('en-US')} {lang === 'ar' ? 'دقيقة لعب' : 'mins played'} • {isOnline ? t('online') : t('offline')}</div>
          </div>
        </div>
        
        <div className="header-stats">
          <div className="h-stat-box bank"><Wallet size={20} /><div className="details"><span className="lbl">{lang === 'ar' ? 'البنك' : 'Bank'}</span><span className="val">${(money.bank || 0).toLocaleString('en-US')}</span></div></div>
          <div className="h-stat-box cash"><DollarSign size={20} /><div className="details"><span className="lbl">{lang === 'ar' ? 'كاش' : 'Cash'}</span><span className="val">${(money.cash || 0).toLocaleString('en-US')}</span></div></div>
        </div>

        <div className="header-nav-back">
           <button className="back-btn-top glass-panel" onClick={() => navigate(-1)}>
             <ArrowLeft size={18} />
             <span>{t('back')}</span>
           </button>
        </div>
      </div>

      <div className="detail-content-grid">
        <div className="main-area-column">
          <div className="summary-card glass-panel">
            <div className="card-header-icon"><Shield size={20} /> <h2>{lang === 'ar' ? 'ملخص الشخصية' : 'Character Summary'}</h2></div>
            <div className="summary-table mt-3">
              <div className="s-item"><span className="label">{t('job')}:</span> <span className="value">{player.job?.label} ({player.job?.grade?.name})</span></div>
              <div className="s-item"><span className="label">{t('gangs')}:</span> <span className="value">{player.gang?.label || (lang === 'ar' ? 'لا يوجد' : 'None')}</span></div>
              <div className="s-item"><span className="label">{lang === 'ar' ? 'الهاتف' : 'Phone'}:</span> <span className="value">{charinfo.phone || '—'}</span></div>
              <div className="s-item"><span className="label">{lang === 'ar' ? 'تاريخ الميلاد' : 'Birthdate'}:</span> <span className="value">{charinfo.birthdate || '—'}</span></div>
              <div className="s-item"><span className="label">{lang === 'ar' ? 'الجنس' : 'Gender'}:</span> <span className="value">{charinfo.gender == 1 ? (lang === 'ar' ? 'أنثى' : 'Female') : (lang === 'ar' ? 'ذكر' : 'Male')}</span></div>
              <div className="s-item"><span className="label">{lang === 'ar' ? 'الجنسية' : 'Nationality'}:</span> <span className="value">{charinfo.nationality || '—'}</span></div>
            </div>

            {linkedCharacters.length > 0 && (
              <div className="linked-chars-section mt-4">
                <h4><Users size={16} /> {lang === 'ar' ? 'شخصيات أخرى لهذا اللاعب' : 'Other characters for this player'}</h4>
                <div className="linked-list">
                  {linkedCharacters.map((c, i) => (
                    <div key={i} className="linked-pill" onClick={() => navigate(`/server/${serverId}/characters/${c.citizenid}`)}>
                       {c.charinfo?.firstname} {c.charinfo?.lastname} • {c.citizenid}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* INVENTORY SECTION */}
          <div className="inventory-container glass-panel mt-4">
             <div className="inv-header">
               <div className="inv-tabs">
                 <button className={`inv-tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}><Package size={18} /> {t('inventory')}</button>
                 <button className={`inv-tab ${activeTab === 'vehicles' ? 'active' : ''}`} onClick={() => setActiveTab('vehicles')}><Car size={18} /> {t('vehicles')} ({vehicles.length.toLocaleString('en-US')})</button>
               </div>
               <button className="btn-red-solid" onClick={() => openAction(lang === 'ar' ? 'إعطاء غرض' : 'Give Item', lang === 'ar' ? 'إضافة عنصر جديد من قائمة العناصر المتاحة' : 'Add a new item from the available list', 'additem', 'item')}><Plus size={16} /> {lang === 'ar' ? 'إعطاء غرض' : 'Give Item'}</button>
             </div>
             
             <div className="inv-grid mt-3">
               {activeTab === 'inventory' ? (
                 (player.inventory || []).map((item: any, idx: number) => (
                    <div key={idx} className="inv-card-premium">
                      <div className="amount">{item.amount.toLocaleString('en-US')}x</div>
                      <div className="img-box">
                                <img 
                                  src={`${API_URL}/uploads/items/${item.image || (item.name + '.png')}`} 
                                  onError={(e: any) => {
                                    if (!e.target.src.includes('/np_')) {
                                      e.target.src = `${API_URL}/uploads/items/np_${item.image || (item.name + '.png')}`;
                                    } else {
                                      e.target.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
                                    }
                                  }} 
                                  alt="item" 
                                />
                      </div>
                      <div className="info">
                        <span className="label">{item.label || item.name}</span>
                        <span className="name">{item.name}</span>
                      </div>
                      <button className="delete-btn" onClick={() => executeAction('removeitem', { item: item.name, slot: item.slot })}><Trash2 size={12} /></button>
                    </div>
                 ))
               ) : (
                 vehicles.map((v, i) => (
                    <div key={i} className="vehicle-card-premium">
                       <div className="img-box"><Car size={24} /></div>
                       <div className="info">
                         <span className="label">{v.vehicle}</span>
                         <span className="name">{lang === 'ar' ? 'لوحة' : 'Plate'}: {v.plate}</span>
                       </div>
                    </div>
                 ))
               )}
             </div>
          </div>

          <div className="player-info-card glass-panel mt-4">
             <h3>{lang === 'ar' ? 'معلومات اللاعب' : 'Player Information'}</h3>
             <div className="info-list-lux-grid mt-3">
                <div className="info-item-lux">
                   <span className="label">{lang === 'ar' ? 'رقم الهوية' : 'CitizenID'}</span>
                   <span className="val">{player.citizenid}</span>
                </div>
                <div className="info-item-lux">
                   <span className="label">{lang === 'ar' ? 'رقم الجوال' : 'Phone'}</span>
                   <span className="val">{charinfo.phone || '—'}</span>
                </div>
                <div className="info-item-lux">
                   <span className="label">{lang === 'ar' ? 'اليسن' : 'License'}</span>
                   <span className="val" style={{fontSize: '11px'}}>{player.license || '—'}</span>
                </div>
                <div className="info-item-lux">
                   <span className="label">{lang === 'ar' ? 'ايدي الديسكورد' : 'Discord ID'}</span>
                   <span className="val" style={{fontSize: '12px', color: '#7289da'}}>
                     {onlinePlayer
                       ? (onlinePlayer.discord || 'NOT LINKED')
                       : (player.discord
                           ? (typeof player.discord === 'string' && player.discord.startsWith('discord:')
                               ? player.discord.replace('discord:', '')
                               : player.discord)
                           : 'OFFLINE')}
                   </span>
                </div>
                <div className="info-item-lux">
                   <span className="label">{lang === 'ar' ? 'الوظيفة' : 'Job'}</span>
                   <span className="val">{player.job?.label} ({player.job?.grade?.name})</span>
                </div>
                <div className="info-item-lux">
                   <span className="label">{lang === 'ar' ? 'الكاش' : 'Cash'}</span>
                   <span className="val success">${(money.cash || 0).toLocaleString('en-US')}</span>
                </div>
                <div className="info-item-lux">
                   <span className="label">{lang === 'ar' ? 'البنك' : 'Bank'}</span>
                   <span className="val info">${(money.bank || 0).toLocaleString('en-US')}</span>
                </div>
             </div>
          </div>

        </div>

        <div className="side-actions-column">
          <div className="quick-actions-card glass-panel">
            <h3>{t('quickActions')}</h3>
            <div className="quick-actions-grid mt-3">
               <button className="q-action-btn danger" onClick={() => openAction(t('kickPlayer'), lang === 'ar' ? 'فصل اللاعب فوراً من السيرفر' : 'Disconnect player', 'kick', 'prompt')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><UserPlus size={18} /><span>{lang === 'ar' ? 'طرد' : 'Kick'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(lang === 'ar' ? 'رسالة للاعب' : 'Send Message', lang === 'ar' ? 'أدخل نص الرسالة التي ستظهر للاعب' : 'Message shown to player', 'message', 'prompt')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><MessageSquare size={18} /><span>{lang === 'ar' ? 'رسالة' : 'Msg'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(t('teleportTo'), lang === 'ar' ? 'انتقل إلى اللاعب أو انقله إليك' : 'Teleport to player or bring them', 'teleport', 'prompt')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><MapPin size={18} /><span>{lang === 'ar' ? 'نقل' : 'TP'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(lang === 'ar' ? 'إعطاء غرض' : 'Give Item', lang === 'ar' ? 'إضافة عنصر جديد للاعب' : 'Add a new item to player', 'additem', 'item')}><Package size={18} /><span>{lang === 'ar' ? 'إعطاء غرض' : 'Give Item'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(lang === 'ar' ? 'إعطاء مركبة' : 'Give Vehicle', lang === 'ar' ? 'إرسال مركبة لكراج اللاعب' : 'Send vehicle to player garage', 'addvehicle', 'prompt')}><Car size={18} /><span>{lang === 'ar' ? 'مركبة' : 'Veh'}</span></button>
               <button className="q-action-btn" onClick={() => executeAction('clothing')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><User size={18} /><span>{lang === 'ar' ? 'ملابس' : 'Clothing'}</span></button>
               <button className="q-action-btn danger" onClick={() => openAction(t('banPlayer'), lang === 'ar' ? 'منع اللاعب من الدخول' : 'Ban player permanently', 'ban', 'prompt')}><Ban size={18} /><span>{lang === 'ar' ? 'حظر' : 'Ban'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(t('setJob'), lang === 'ar' ? 'تغيير الوظيفة والرتبة' : 'Change job and grade', 'setjob', 'job')}><Briefcase size={18} /><span>{lang === 'ar' ? 'وظيفة' : 'Job'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(t('setGang'), lang === 'ar' ? 'تغيير العصابة والرتبة' : 'Change gang and grade', 'setgang', 'gang')}><Users size={18} /><span>{lang === 'ar' ? 'عصابة' : 'Gang'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(t('wallets'), lang === 'ar' ? 'إدارة الأموال' : 'Money management', 'manage_money', 'prompt')}><DollarSign size={18} /><span>{lang === 'ar' ? 'أموال' : 'Money'}</span></button>
               <button className="q-action-btn" onClick={() => openAction(t('identity'), lang === 'ar' ? 'تعديل بيانات الهوية الشخصية' : 'Edit personal identity data', 'edit_identity', 'identity')}><Fingerprint size={18} /><span>{lang === 'ar' ? 'هوية' : 'ID'}</span></button>
               <button className="q-action-btn" onClick={() => executeAction('revive')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><HeartPulse size={18} /><span>{t('revive')}</span></button>
               <button className="q-action-btn" onClick={() => executeAction('feed')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><Utensils size={18} /><span>{lang === 'ar' ? 'إطعام' : 'Feed'}</span></button>
               <button className="q-action-btn" onClick={() => executeAction('repair_vehicle')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><SettingsIcon size={18} /><span>{lang === 'ar' ? 'إصلاح' : 'Fix'}</span></button>
               <button className="q-action-btn" onClick={() => executeAction('screenshot')} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><Camera size={18} /><span>{t('screenshot')}</span></button>
               <button className="q-action-btn" onClick={() => executeAction('freeze', { freeze: true })} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><Activity size={18} /><span>{t('freezePlayer')}</span></button>
               <button className="q-action-btn success" onClick={() => executeAction('freeze', { freeze: false })} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><Activity size={18} /><span>{t('unfreezePlayer')}</span></button>
               <button className="q-action-btn" onClick={() => executeAction('cuff', { cuffed: true })} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><Lock size={18} /><span>{lang === 'ar' ? 'كلبشة' : 'Cuff'}</span></button>
               <button className="q-action-btn success" onClick={() => executeAction('cuff', { cuffed: false })} disabled={!isOnline} style={!isOnline ? {opacity:0.4, cursor:'not-allowed'} : {}}><Lock size={18} /><span>{lang === 'ar' ? 'فك كلبشة' : 'Uncuff'}</span></button>
               <button className="q-action-btn danger" onClick={() => openAction(lang === 'ar' ? 'حذف الشخصية' : 'Delete Character', 'Delete data permanently', 'delete_character', 'confirm')}><Trash2 size={18} /><span>{lang === 'ar' ? 'حذف' : 'Del'}</span></button>
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC MODAL SYSTEM */}
      {actionModal.show && (
        <div className="modal-overlay" onClick={() => setActionModal({ ...actionModal, show: false })}>
          <div className="action-modal-box glass-panel advanced-modal animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group"><h3>{actionModal.title}</h3><p>{actionModal.description}</p></div>
              <button className="close-btn" onClick={() => setActionModal({ ...actionModal, show: false })}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {actionModal.type === 'item' && (
                <div className="advanced-flow">
                  <div className="input-group"><label>{lang === 'ar' ? 'اختر العنصر' : 'Select Item'}</label>
                    <div className="searchable-select-wrapper" ref={dropdownRef}>
                      <div className="select-trigger" onClick={() => setShowDropdown(!showDropdown)}>
                        {promptValues.label ? <span>{promptValues.label}</span> : (lang === 'ar' ? 'ابدأ البحث...' : 'Start search...')}
                        <ChevronDown size={16} />
                      </div>
                      {showDropdown && (
                        <div className="select-dropdown glass-panel">
                          <div className="search-box"><Search size={14} /><input type="text" placeholder="بحث..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} autoFocus /></div>
                          <div className="options-list">
                                        {filteredResults.map((it, i) => (
                                <div key={i} className="option-row" onClick={() => { setPromptValues({ ...promptValues, item: it.name, label: it.label }); setShowDropdown(false); }}>
                                  <div className="item-preview">
                                    <img 
                                      src={`${API_URL}/uploads/items/${it.image || (it.name + '.png')}`} 
                                      onError={(e: any) => {
                                        if (!e.target.src.includes('/np_')) {
                                          e.target.src = `${API_URL}/uploads/items/np_${it.image || (it.name + '.png')}`;
                                        } else {
                                          e.target.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
                                        }
                                      }}
                                      style={{ width: '24px', height: '24px', marginRight: '8px', objectFit: 'contain' }}
                                    />
                                    <span className="lbl">{it.label}</span>
                                  </div>
                                </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="row mt-4"><div className="input-group flex-1"><label>{t('quantity')}</label><input type="number" className="input-dark" value={promptValues.amount || 1} onChange={e => setPromptValues({ ...promptValues, amount: e.target.value })} /></div></div>
                </div>
              )}
              {(actionModal.type === 'job' || actionModal.type === 'gang') && (() => {
                const list = actionModal.type === 'job' ? jobsList : gangsList;
                const selected = list.find(j => j.name === promptValues[actionModal.type!]);
                const grades = selected ? Object.entries(selected.grades || {}).map(([k, v]: any) => ({ value: k, label: `${k} — ${v.name || v.label || k}` })) : [];
                return (
                  <div className="advanced-flow">
                    <div className="row">
                      <div className="input-group flex-1">
                        <label>{actionModal.type === 'job' ? t('job') : t('gangs')}</label>
                        <select className="input-dark" value={promptValues[actionModal.type!] || ''} onChange={e => setPromptValues({ ...promptValues, [actionModal.type!]: e.target.value, grade: '' })}>
                          <option value="">{lang === 'ar' ? 'اختر...' : 'Choose...'}</option>
                          {list.map((j, i) => <option key={i} value={j.name}>{j.label}</option>)}
                        </select>
                      </div>
                      <div className="input-group flex-1">
                        <label>{t('grade')}</label>
                        <select className="input-dark" value={promptValues.grade || ''} onChange={e => setPromptValues({ ...promptValues, grade: e.target.value })} disabled={!selected}>
                          <option value="">{lang === 'ar' ? 'اختر الرتبة...' : 'Choose grade...'}</option>
                          {grades.map((g, i) => <option key={i} value={g.value}>{g.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {actionModal.type === 'identity' && (
                <div className="identity-edit-form">
                  <div className="row">
                    <div className="input-group flex-1">
                      <label>{lang === 'ar' ? 'الاسم الأول' : 'First Name'}</label>
                      <input type="text" className="input-dark" value={promptValues.firstname || ''} onChange={e => setPromptValues({ ...promptValues, firstname: e.target.value })} />
                    </div>
                    <div className="input-group flex-1">
                      <label>{lang === 'ar' ? 'اسم العائلة' : 'Last Name'}</label>
                      <input type="text" className="input-dark" value={promptValues.lastname || ''} onChange={e => setPromptValues({ ...promptValues, lastname: e.target.value })} />
                    </div>
                  </div>
                  <div className="row mt-3">
                    <div className="input-group flex-1">
                      <label>{lang === 'ar' ? 'تاريخ الميلاد' : 'Birthdate'}</label>
                      <input type="text" className="input-dark" placeholder="YYYY-MM-DD" value={promptValues.birthdate || ''} onChange={e => setPromptValues({ ...promptValues, birthdate: e.target.value })} />
                    </div>
                    <div className="input-group flex-1">
                      <label>{lang === 'ar' ? 'الجنس' : 'Gender'}</label>
                      <select className="input-dark" value={promptValues.gender ?? 0} onChange={e => setPromptValues({ ...promptValues, gender: parseInt(e.target.value) })}>
                        <option value={0}>{lang === 'ar' ? 'ذكر' : 'Male'}</option>
                        <option value={1}>{lang === 'ar' ? 'أنثى' : 'Female'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="row mt-3">
                    <div className="input-group flex-1">
                      <label>{lang === 'ar' ? 'الجنسية' : 'Nationality'}</label>
                      <select className="input-dark" value={promptValues.nationality || ''} onChange={e => setPromptValues({ ...promptValues, nationality: e.target.value })}>
                        <option value="">{lang === 'ar' ? 'اختر...' : 'Choose...'}</option>
                        {NATIONALITIES.map((n, i) => <option key={i} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="input-group flex-1">
                      <label>{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                      <input type="text" className="input-dark" value={promptValues.phone || ''} onChange={e => setPromptValues({ ...promptValues, phone: e.target.value })} />
                    </div>
                  </div>
                  <p className="modal-note mt-3">{lang === 'ar' ? 'ملاحظة: سيتم طرد اللاعب لتطبيق التغييرات.' : 'Note: Player will be kicked to apply changes.'}</p>
                </div>
              )}
              {actionModal.type === 'prompt' && (
                <div className="generic-flow">
                  {actionModal.action === 'kick' && (
                    <div className="input-group">
                      <label>{lang === 'ar' ? 'سبب الطرد' : 'Kick Reason'}</label>
                      <input type="text" className="input-dark" placeholder={lang === 'ar' ? 'اكتب السبب هنا...' : 'Write reason...'} onChange={e => setPromptValues({ ...promptValues, reason: e.target.value })} />
                    </div>
                  )}
                  {actionModal.action === 'message' && (
                    <div className="input-group">
                      <label>{lang === 'ar' ? 'نص الرسالة' : 'Message Text'}</label>
                      <textarea className="input-dark" rows={3} placeholder={lang === 'ar' ? 'اكتب الرسالة هنا...' : 'Write message here...'} style={{ resize: 'vertical', width: '100%' }} onChange={e => setPromptValues({ ...promptValues, message: e.target.value })} />
                    </div>
                  )}
                  {actionModal.action === 'teleport' && (
                    <div className="teleport-flow">
                      <div className="input-group">
                        <label>{lang === 'ar' ? 'نوع الانتقال' : 'Teleport Type'}</label>
                        <select className="input-dark" value={promptValues.type || 'coords'} onChange={e => setPromptValues({ ...promptValues, type: e.target.value, coords: '' })}>
                          <option value="coords">{lang === 'ar' ? 'إلى إحداثيات محددة' : 'To specific coords'}</option>
                          <option value="preset">{lang === 'ar' ? 'إلى موقع محفوظ' : 'To preset location'}</option>
                        </select>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-gray-400 mb-1 block">
                          {promptValues.type === 'preset' 
                            ? (lang === 'ar' ? 'اختر الموقع المحفوظ' : 'Choose Saved Location')
                            : (lang === 'ar' ? 'أدخل الإحداثيات' : 'Enter Coordinates')}
                        </label>
                        {promptValues.type === 'preset' ? (
                          <select className="input-dark" value={promptValues.coords || ''} onChange={e => setPromptValues({ ...promptValues, coords: e.target.value })}>
                            <option value="">{lang === 'ar' ? 'اختر موقعاً...' : 'Choose location...'}</option>
                            {(panelSettings.teleport_locations || []).map((loc: any, i: number) => (
                              <option key={i} value={loc.coords}>{loc.name} — {loc.coords}</option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input 
                              type="text" 
                              className="input-dark" 
                              placeholder="210.9853, -219.4686, 54.0572  أو  vector3(x,y,z)  أو  vector4(x,y,z,w)" 
                              value={promptValues.coords || ''} 
                              onChange={e => setPromptValues({ ...promptValues, coords: e.target.value })} 
                            />
                            <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
                              {lang === 'ar' 
                                ? 'مقبول: أرقام مفصولة بفاصلة، vector3() أو vector4()'
                                : 'Accepted: comma-separated numbers, vector3() or vector4()'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                  )}
                  {actionModal.action === 'manage_money' && <div className="row"><div className="input-group flex-1"><label>{t('type')}</label><select className="input-dark" value={promptValues.type || 'cash'} onChange={e => setPromptValues({ ...promptValues, type: e.target.value })}><option value="cash">كاش</option><option value="bank">بنك</option></select></div><div className="input-group flex-1"><label>{t('amount')}</label><input type="number" className="input-dark" onChange={e => setPromptValues({ ...promptValues, amount: e.target.value })} /></div><div className="input-group flex-1"><label>{t('actions')}</label><select className="input-dark" onChange={e => setPromptValues({ ...promptValues, action: e.target.value })}><option value="add">{t('addMoney')}</option><option value="remove">{t('removeMoney')}</option></select></div></div>}
                  {actionModal.action === 'addvehicle' && (
                    <div className="advanced-flow">
                      <div className="input-group"><label>{lang === 'ar' ? 'المركبة' : 'Vehicle'}</label>
                        <div className="searchable-select-wrapper" ref={dropdownRef}>
                          <div className="select-trigger" onClick={() => setShowDropdown(!showDropdown)}>
                            {promptValues.label ? <span>{promptValues.label} ({promptValues.vehicle})</span> : (lang === 'ar' ? 'ابحث عن مركبة...' : 'Search vehicle...')}
                            <ChevronDown size={16} />
                          </div>
                          {showDropdown && (
                            <div className="select-dropdown glass-panel">
                              <div className="search-box"><Search size={14} /><input type="text" placeholder={lang === 'ar' ? "بحث..." : "Search..."} value={searchFilter} onChange={e => setSearchFilter(e.target.value)} autoFocus /></div>
                              <div className="options-list">
                                {filteredVehicles.length === 0 ? (
                                   <div className="p-2 text-center text-xs opacity-50">{lang === 'ar' ? 'لا يوجد مركبات' : 'No vehicles found'}</div>
                                ) : (
                                   filteredVehicles.map((v, i) => (
                                     <div key={i} className="option-row" onClick={() => { setPromptValues({ ...promptValues, model: v.model, label: v.name }); setShowDropdown(false); }}>
                                       <div className="item-preview">
                                         <Car size={14} style={{ marginRight: '8px', opacity: 0.7 }} />
                                         <span className="lbl">{v.name} <span style={{opacity:0.5, fontSize:'10px', marginLeft:'4px'}}>({v.model})</span></span>
                                       </div>
                                     </div>
                                   ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="input-group mt-3">
                        <label>{lang === 'ar' ? 'رقم اللوحة' : 'Plate Number'}</label>
                        <input type="text" className="input-dark" maxLength={8} placeholder={lang === 'ar' ? 'اختياري' : 'Optional'} onChange={e => setPromptValues({ ...promptValues, plate: e.target.value })} />
                      </div>
                    </div>
                  )}
                  {actionModal.action === 'ban' && <div className="row"><div className="input-group flex-2"><label>{t('reason')}</label><input type="text" className="input-dark" onChange={e => setPromptValues({ ...promptValues, reason: e.target.value })} /></div><div className="input-group flex-1"><label>{lang === 'ar' ? 'المدة (بالساعات)' : 'Duration (Hours)'}</label><input type="number" className="input-dark" onChange={e => setPromptValues({ ...promptValues, duration: e.target.value })} /></div></div>}
                </div>

              )}
            </div>
            <div className="modal-footer">
               <button className="btn-outline" onClick={() => setActionModal({ ...actionModal, show: false })}>{t('cancel')}</button>
               {actionModal.type !== 'confirm' && <button className="btn-red-solid" onClick={() => executeAction(actionModal.action!, promptValues)}>{t('confirm')}</button>}
               {actionModal.type === 'confirm' && <button className="btn-red-solid" onClick={() => { executeAction(actionModal.action!, promptValues); setActionModal({ ...actionModal, show: false }); }}>{t('confirm')}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterDetail;
