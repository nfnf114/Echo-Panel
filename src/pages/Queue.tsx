import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useParams } from 'react-router-dom';
import './Queue.css';

import { API_URL } from '../config';

const Queue: React.FC = () => {
  const { serverId } = useParams();
  const [serverInfo, setServerInfo] = useState<any>({ status: 'online', provider: 'connectqueue', queueSize: '0/8', autoUpdate: true });
  const [queueList, setQueueList] = useState<any[]>([]);
  const [priorityList, setPriorityList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Transfer form
  const [transferTarget, setTransferTarget] = useState('');
  const [transferMode, setTransferMode] = useState(1);

  // Priority form
  const [prioIdentifiers, setPrioIdentifiers] = useState('');
  const [prioPower, setPrioPower] = useState(10);
  const [prioNote, setPrioNote] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'get_queue', target_id: 'server', data: {} })
      });
    } catch (e) {}
    setLoading(false);
  };

  const handleAddPriority = async () => {
    if (!prioIdentifiers.trim()) { alert('أدخل المعرّفات'); return; }
    const newEntry = {
      id: Date.now(),
      identifiers: prioIdentifiers,
      power: prioPower,
      note: prioNote || '—'
    };
    setPriorityList(prev => [...prev, newEntry]);
    setPrioIdentifiers('');
    setPrioPower(10);
    setPrioNote('');
    try {
      await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'set_priority', target_id: prioIdentifiers, data: { power: prioPower, note: prioNote } })
      });
    } catch (e) {}
  };

  const handleRemovePriority = (id: number) => {
    setPriorityList(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="queue-page animate-fade-in">
      
      {/* Top Row - Two Cards */}
      <div className="queue-top-grid">
        
        {/* Queue Status Card */}
        <div className="queue-card">
          <div className="card-header-rtl">
            <h3>حالة الانتظار</h3>
          </div>
          <div className="status-info-grid">
            <div className="status-row">
              <span className="status-val">
                <span className="dot-green"></span> متصل
              </span>
              <span className="status-lbl">السيرفر</span>
            </div>
            <div className="status-row">
              <span className="status-val">آخر تحديث: {new Date().toLocaleTimeString('ar')}</span>
              <span className="status-lbl">آخر تحديث</span>
            </div>
            <div className="status-row">
              <span className="status-val provider-badge">connectqueue</span>
              <span className="status-lbl">المزوّد</span>
            </div>
            <div className="status-row">
              <span className="status-val">0/8</span>
              <span className="status-lbl">حجم الانتظار</span>
            </div>
          </div>
          <div className="auto-update-row">
            <div className={`toggle-pill ${serverInfo.autoUpdate ? 'active' : ''}`} onClick={() => setServerInfo((p: any) => ({ ...p, autoUpdate: !p.autoUpdate }))}></div>
            <span className="status-lbl">تحديث تلقائي</span>
          </div>
        </div>

        {/* Tools Card */}
        <div className="queue-card">
          <div className="card-header-rtl">
            <h3>أدوات الانتظار</h3>
          </div>
          <p className="card-desc text-muted text-sm text-right">انقل لاعباً داخل الانتظار المباشر (يجب أن يدعم connectqueue عملية SetPos) هذا إجراء خطير.</p>
          
          <div className="tools-form mt-3">
            <div className="form-row-rtl">
              <div className="form-col">
                <label className="field-label-sm">الموضع</label>
                <input type="number" className="input-dark-sm text-right" value={transferMode} onChange={e => setTransferMode(parseInt(e.target.value))} min={1} />
              </div>
              <div className="form-col flex-2">
                <label className="field-label-sm">معرّفات اللاعب</label>
                <input type="text" className="input-dark-sm text-right" placeholder="...license:xxx, discord:xxx, steam:xxx" value={transferTarget} onChange={e => setTransferTarget(e.target.value)} />
              </div>
            </div>
            <p className="hint-text text-muted text-xs text-right mt-1">أفضل بينها بفواصل. استخدم نفس المعرّفات التي يعتمدها connectqueue.</p>
            
            <div className="tools-btn-row mt-2">
              <button className="btn-ghost-sm" onClick={() => { setTransferTarget(''); setTransferMode(1); }}>
                <RefreshCw size={12} />
              </button>
              <button className="btn-red-sm" onClick={fetchQueue}>
                <RefreshCw size={12} /> نقل فوري
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Queue */}
      <div className="queue-card mt-4">
        <div className="card-header-rtl">
          <h3>الانتظار المباشر</h3>
        </div>
        <p className="card-desc text-muted text-sm text-right mt-1">
          يعرض قائمة الانتظار الحالية عند توفرها. يتم تفضيل license/steam من مورد الانتظار. جميع الإجراءات تمر عبر جسر طاقم السيرفر. قائمة الانتظار غير متاحة. استخدم النقل/الأولوية عبر المعرّفات.
        </p>
        <div className="empty-queue-box mt-3">
          <Clock size={40} className="text-muted" />
          <p className="text-muted">لا توجد بيانات انتظار مباشرة متاحة حالياً</p>
        </div>
      </div>

      {/* Priority Queues */}
      <div className="queue-card mt-4">
        <div className="card-header-rtl">
          <h3>صفوف الأولوية</h3>
        </div>

        {/* Add Priority Form */}
        <div className="priority-form mt-3">
          <div className="priority-form-grid">
            <div className="form-col flex-3">
              <label className="field-label-sm text-right">المعرّفات</label>
              <input
                type="text"
                className="input-dark-sm text-right"
                placeholder="license:xxx, discord:123, steam:xxx"
                value={prioIdentifiers}
                onChange={e => setPrioIdentifiers(e.target.value)}
              />
              <span className="hint-text text-muted text-xs">معرّفات مفصولة بفواصل</span>
            </div>
            <div className="form-col">
              <label className="field-label-sm text-right">قوة الأولوية</label>
              <input
                type="number"
                className="input-dark-sm text-right"
                value={prioPower}
                onChange={e => setPrioPower(parseInt(e.target.value))}
                min={1}
              />
            </div>
            <div className="form-col">
              <label className="field-label-sm text-right">ملاحظة</label>
              <input
                type="text"
                className="input-dark-sm text-right"
                placeholder="... VIP / Staff /"
                value={prioNote}
                onChange={e => setPrioNote(e.target.value)}
              />
            </div>
          </div>
          <div className="form-btn-row mt-2">
            <button className="btn-red-solid" onClick={handleAddPriority}>
              <Plus size={14} /> إضافة إلى القائمة
            </button>
          </div>
        </div>

        {/* Priority Table */}
        <div className="prio-table-wrapper mt-4">
          <table className="Echo-table-dark" dir="rtl">
            <thead>
              <tr>
                <th>المعرّفات</th>
                <th>قوة الأولوية</th>
                <th>ملاحظة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {priorityList.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted">لا توجد صفوف أولوية بعد.</td></tr>
              ) : (
                priorityList.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-sm">{p.identifiers}</td>
                    <td><span className="prio-badge">{p.power}</span></td>
                    <td className="text-muted">{p.note}</td>
                    <td>
                      <div className="action-row-btns">
                        <button className="icon-btn-sm red-icon" onClick={() => handleRemovePriority(p.id)}><Trash2 size={13} /></button>
                        <button className="icon-btn-sm"><ArrowUp size={13} /></button>
                        <button className="icon-btn-sm"><ArrowDown size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="prio-footer-note text-muted text-xs text-right mt-2">
          إدارة الانتظار تستخدم connectqueue (ويُفضل استخدام الجسر لاستخدام الجسر).
        </div>
      </div>

    </div>
  );
};

export default Queue;
