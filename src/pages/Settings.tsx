import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, RefreshCw, MapPin, Edit2, X, Check } from 'lucide-react';
import { useParams } from 'react-router-dom';
import './Settings.css';

import { fetchWithAuth } from '../utils/api';

import { API_URL } from '../config';

const WEBHOOK_CHANNELS = [
  { key: 'webhook_admin_actions', label: 'كل الإجراءات', desc: 'يستقبل إشعارات لجميع إجراءات الإداريين.' },
  { key: 'webhook_all',         label: 'الكل',               desc: 'Receives a compact summary of all logged actions.' },
  { key: 'webhook_dm',          label: 'DM',                  desc: 'Logs direct messages sent to one player.' },
  { key: 'webhook_dm_all',      label: 'DM All',              desc: 'Logs direct messages sent to all players.' },
  { key: 'webhook_kick',        label: 'طرد',                 desc: 'Logs player kicks and kick reasons.' },
  { key: 'webhook_teleport',    label: 'نقل فوري',            desc: 'Logs player teleport, bring, and coordinate moves.' },
  { key: 'webhook_money',       label: 'إدارة الأموال',       desc: 'Logs cash, bank, and balance changes.' },
  { key: 'webhook_ban',         label: 'حظر',                 desc: 'Logs ban creation, edits, removals, and duration changes.' },
  { key: 'webhook_job',         label: 'تعيين الوظيفة',       desc: 'Logs job and job grade updates.' },
  { key: 'webhook_gang',        label: 'تعيين العصابة',       desc: 'Logs gang and gang grade updates.' },
  { key: 'webhook_revive',      label: 'Revive / Heal',       desc: 'Logs revive and health restoration actions.' },
  { key: 'webhook_permissions', label: 'الصلاحيات',           desc: 'Logs permission and access changes.' },
  { key: 'webhook_feed',        label: 'إطعام',               desc: 'Logs hunger and thirst restoration actions.' },
  { key: 'webhook_repair',      label: 'إصلاح مركبة',         desc: 'Logs vehicle repair actions.' },
  { key: 'webhook_inventory',   label: 'الحقيبة',             desc: 'Logs inventory item changes and actions.' },
  { key: 'webhook_identity',    label: 'Identity + Metadata', desc: 'Logs profile and metadata changes.' },
  { key: 'webhook_screenshot',  label: 'Capture All Screens', desc: 'Logs summary results of mass screenshot capture jobs.' },
  { key: 'webhook_vehicle',     label: 'مركبة',               desc: 'Logs vehicle ownership and vehicle data changes.' },
  { key: 'webhook_stash',       label: 'المخازن',             desc: 'Logs stash actions and stash item changes.' },
  { key: 'webhook_queue',       label: 'الأولوية والانتظار',   desc: 'Logs queue and priority changes.' },
  { key: 'webhook_dupes',       label: 'فحص التبديل',         desc: 'Logs duplicate scans and dupe cleanup actions.' },
  { key: 'webhook_leaderboard', label: 'لوحات الصدارة',       desc: 'Logs leaderboard resets, weekly freeze jobs, and webhook failures.' },
  { key: 'webhook_admins',      label: 'الإدارة والرتب',      desc: 'Logs admin role and role-link changes.' },
  { key: 'webhook_settings',    label: 'Settings',            desc: 'Logs configuration and webhook settings changes.' },
  { key: 'webhook_logs',        label: 'السجلات',             desc: 'Logs audit trail entries.' },
];

const Settings: React.FC = () => {
  const { serverId } = useParams();
  const [settings, setSettings] = useState<any>({
    server_display_name: '',
    server_logo_url: '',
    teleport_locations: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLogs, setSavingLogs] = useState(false);
  const [saved, setSaved] = useState(false);

  // Transport location form
  const [newLocName, setNewLocName] = useState('');
  const [newLocCoords, setNewLocCoords] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/panel-settings`);
      const data = await res.json();
      if (data.settings) setSettings({
        ...data.settings,
        teleport_locations: data.settings.teleport_locations || []
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, [serverId]);

  const saveToServer = async (payload: any) => {
    const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/panel-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  };

  const handleSaveServerInfo = async () => {
    setSaving(true);
    try {
      const data = await saveToServer({
        server_display_name: settings.server_display_name,
        server_logo_url: settings.server_logo_url
      });
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch (e) { alert('فشل الحفظ'); }
    setSaving(false);
  };

  const handleSaveWebhooks = async () => {
    setSavingLogs(true);
    try {
      const webhookData: any = {};
      WEBHOOK_CHANNELS.forEach(ch => {
        if (settings[ch.key] !== undefined) webhookData[ch.key] = settings[ch.key];
        webhookData[ch.key + '_enabled'] = settings[ch.key + '_enabled'] !== false;
      });
      const data = await saveToServer(webhookData);
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch (e) { alert('فشل الحفظ'); }
    setSavingLogs(false);
  };

  const handleSaveLocations = async (updated: any[]) => {
    try {
      const data = await saveToServer({ teleport_locations: updated });
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch (e) { alert('فشل حفظ المواقع'); }
  };

  const handleAddLocation = async () => {
    if (!newLocName.trim() || !newLocCoords.trim()) return;
    let coords = newLocCoords.trim();
    if (!coords.includes('vector')) {
       const parts = coords.split(',').map(s => parseFloat(s.trim()));
       if (parts.length >= 3 && !parts.some(isNaN)) {
          coords = `vector4(${parts[0]}, ${parts[1]}, ${parts[2]}, ${parts[3] || '0.0'})`;
       }
    }
    const newLoc = { name: newLocName, coords: coords };
    const updated = [...(settings.teleport_locations || []), newLoc];
    setSettings((p: any) => ({ ...p, teleport_locations: updated }));
    setNewLocName('');
    setNewLocCoords('');
    // Auto-save to DB immediately
    await handleSaveLocations(updated);
  };

  const handleDeleteLocation = async (idx: number) => {
    const updated = (settings.teleport_locations || []).filter((_: any, i: number) => i !== idx);
    setSettings((p: any) => ({ ...p, teleport_locations: updated }));
    await handleSaveLocations(updated);
  };


  const updateField = (key: string, val: string) => {
    setSettings((p: any) => ({ ...p, [key]: val }));
  };

  if (loading) return <div className="settings-loading"><RefreshCw className="spin" size={24} /> جاري التحميل...</div>;

  return (
    <div className="settings-page animate-fade-in" dir="rtl">

      <div className="settings-top-row">
         
         {/* Server Info Card */}
         <div className="settings-card glass-panel">
            <div className="card-header">
               <h3>معلومات السيرفر</h3>
               <button className="btn-save-mini" onClick={handleSaveServerInfo}>
                 {saved ? <Check size={14}/> : <Save size={14}/>} {saved ? 'تم الحفظ' : 'حفظ'}
               </button>
            </div>
            <div className="card-body">
               <div className="form-group mt-3">
                  <label>اسم السيرفر</label>
                  <input className="input-dark" value={settings.server_display_name || ''} onChange={e => updateField('server_display_name', e.target.value)} placeholder="Echo" />
               </div>
               <div className="form-group mt-3">
                  <label>رابط اللوغو</label>
                  <input className="input-dark text-left" dir="ltr" value={settings.server_logo_url || ''} onChange={e => updateField('server_logo_url', e.target.value)} placeholder="https://..." />
               </div>
            </div>
         </div>

         {/* Teleport Locations Card */}
         <div className="settings-card glass-panel">
            <div className="card-header">
               <h3><MapPin size={18} /> مواقع الانتقال</h3>
               <button className="btn-save-mini" onClick={() => handleSaveLocations(settings.teleport_locations || [])}>
                 {saved ? <Check size={14}/> : <Save size={14}/>} {saved ? 'حفظ المواقع' : 'حفظ المواقع'}
               </button>
            </div>
            <div className="card-body">
               <p className="description">المواقع المحفوظة المستخدمة في نقل اللاعب. وتتطلب سيبا وأكيديا.</p>
               
               <div className="location-input-bar mt-3">
                  <input className="input-dark flex-1" placeholder="الاسم" value={newLocName} onChange={e => setNewLocName(e.target.value)} />
                  <input className="input-dark flex-2 text-left" dir="ltr" placeholder="الإحداثيات (vector4)" value={newLocCoords} onChange={e => setNewLocCoords(e.target.value)} />
                  <button className="btn-add-loc" onClick={handleAddLocation}><Plus size={20} /></button>
               </div>

               <div className="locations-table-wrapper mt-3">
                  <table className="locations-table">
                     <thead>
                        <tr>
                           <th>الاسم</th>
                           <th>الإحداثيات</th>
                           <th style={{ width: '80px' }}>الإجراءات</th>
                        </tr>
                     </thead>
                     <tbody>
                        {(settings.teleport_locations || []).map((loc: any, idx: number) => (
                           <tr key={idx}>
                              <td>{loc.name}</td>
                              <td className="font-mono text-xs">{loc.coords}</td>
                              <td>
                                 <div className="actions-cell">
                                    <button className="btn-icon-del" onClick={() => handleDeleteLocation(idx)}><Trash2 size={14} /></button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                        {(!settings.teleport_locations || settings.teleport_locations.length === 0) && (
                           <tr><td colSpan={3} className="text-center py-4 text-muted">لا توجد مواقع محفوظة</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

      </div>

      {/* Webhooks Section */}
      <div className="settings-card glass-panel mt-4">
         <div className="card-header">
            <h3>لوق الديسكورد</h3>
            <button className="btn-save-mini" onClick={handleSaveWebhooks}>
              {saved ? <Check size={14}/> : <Save size={14}/>} {saved ? 'تم الحفظ' : 'حفظ السجلات'}
            </button>
         </div>
         <div className="card-body">
            <div className="webhooks-grid">
               {WEBHOOK_CHANNELS.map(ch => (
                  <div key={ch.key} className="webhook-box">
                     <div className="webhook-info">
                        <div className="top">
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <span className="label">{ch.label}</span>
                             <div className={`status-dot ${settings[ch.key] && settings[ch.key + '_enabled'] !== false ? 'active' : ''}`}></div>
                           </div>
                           
                           {/* Toggle Button */}
                           <label className="switch-toggle">
                              <input 
                                type="checkbox" 
                                checked={settings[ch.key + '_enabled'] !== false} 
                                onChange={e => {
                                   setSettings((p: any) => ({ ...p, [ch.key + '_enabled']: e.target.checked }));
                                }} 
                              />
                              <span className="slider round"></span>
                           </label>
                        </div>
                        <span className="desc">{ch.desc}</span>
                     </div>
                     <input 
                        className="input-dark-sm text-left" 
                        dir="ltr" 
                        placeholder="https://discord.com/api/webhooks/..." 
                        value={settings[ch.key] || ''} 
                        onChange={e => updateField(ch.key, e.target.value)} 
                     />
                  </div>
               ))}
            </div>
         </div>
      </div>

    </div>
  );
};

export default Settings;
