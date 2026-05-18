import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RefreshCw, Trophy, Save, ChevronDown, Settings, MessageSquare } from 'lucide-react';
import { useParams } from 'react-router-dom';
import './Leaderboard.css';

import { API_URL } from '../config';
const DEFAULT_TEMPLATE = `{rank.1} <{1.id}> **{1.user}** - \`\`\`played {1.playtime}**\`\`\`\n{rank.2} <{2.id}> **{2.user}** - \`\`\`played {2.playtime}**\`\`\`\n{rank.3} <{3.id}> **{3.user}** - \`\`\`played {3.playtime}**\`\`\`\n{rank.4} <{4.id}> **{4.user}** - \`\`\`played {4.playtime}**\`\`\`\n{rank.5} <{5.id}> **{5.user}** - \`\`\`played {5.playtime}**\`\`\`\n{rank.6} <{6.id}> **{6.user}** - \`\`\`played {6.playtime}**\`\`\`\n{rank.7} <{7.id}> **{7.user}** - \`\`\`played {7.playtime}**\`\`\`\n{rank.8} <{8.id}> **{8.user}** - \`\`\`played {8.playtime}**\`\`\`\n{rank.9} <{9.id}> **{9.user}** - \`\`\`played {9.playtime}**\`\`\`\n{rank.10} <{10.id}> **{10.user}** - \`\`\`played {10.playtime}**\`\`\``;

const TIMEZONES = ['Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'UTC', 'Europe/London', 'America/New_York'];
const DAYS = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const LANGS = ['الإنجليزية', 'العربية'];

const Leaderboard: React.FC = () => {
  const { serverId } = useParams();
  const [boards, setBoards] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  // Add Board form
  const [newTitle, setNewTitle] = useState('وقت اللعب الأسبوعي');
  const [newType, setNewType] = useState('weekly');
  const [newEnabled, setNewEnabled] = useState(true);
  const [newPublic, setNewPublic] = useState(false);

  // Weekly config
  const [weeklyConfig, setWeeklyConfig] = useState<any>({
    auto_reset: false, reset_day: 'الاثنين', reset_time: '10:00',
    timezone: 'Asia/Riyadh', discord_enabled: false, discord_webhook: '',
    discord_lang: 'الإنجليزية', message_title: 'وقت اللعب الأسبوعي',
    message_template: DEFAULT_TEMPLATE
  });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [bRes, pRes, wRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/server/${serverId}/leaderboard-boards`),
        fetchWithAuth(`${API_URL}/api/server/${serverId}/leaderboard-data`),
        fetchWithAuth(`${API_URL}/api/server/${serverId}/leaderboard-weekly`)
      ]);
      const bData = await bRes.json();
      const pData = await pRes.json();
      const wData = await wRes.json();
      setBoards(bData.boards || []);
      const sorted = (pData.players || []).sort((a: any, b: any) => b.playtime - a.playtime);
      setPlayers(sorted);
      if (wData.config) setWeeklyConfig(wData.config);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [serverId]);

  const handleAddBoard = async () => {
    if (!newTitle.trim()) { alert('أدخل عنوان اللوحة'); return; }
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/leaderboard-boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, board_type: newType, enabled: newEnabled, public: newPublic })
      });
      const data = await res.json();
      if (data.success) { setShowAddBoard(false); fetchAll(); }
    } catch (e) { alert('فشل الإضافة'); }
  };

  const handleDeleteBoard = async (id: number) => {
    if (!confirm('هل تريد حذف هذه اللوحة؟')) return;
    try {
      await fetchWithAuth(`${API_URL}/api/server/${serverId}/leaderboard-boards/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (e) {}
  };

  const handleSaveWeekly = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/leaderboard-weekly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weeklyConfig)
      });
      const data = await res.json();
      if (data.success) { setShowWeeklyModal(false); }
    } catch (e) { alert('فشل الحفظ'); }
    setSaving(false);
  };

  const formatPlaytime = (minutes: number) => {
    if (!minutes || minutes === 0) return '0 دقيقة';
    const d = Math.floor(minutes / (60 * 24));
    const h = Math.floor((minutes % (60 * 24)) / 60);
    const m = minutes % 60;
    
    let res = [];
    if (d > 0) res.push(`${d} يوم`);
    if (h > 0) res.push(`${h} ساعة`);
    if (m > 0 || res.length === 0) res.push(`${m} دقيقة`);
    return res.join(' و ');
  };

  return (
    <div className="leaderboard-page animate-fade-in">

      {/* Top Action Bar */}
      <div className="lb-top-bar">
        <button className="btn-red-solid" onClick={() => setShowAddBoard(true)}>
          <Plus size={14} /> إضافة لوحة
        </button>
      </div>

      {/* Boards Grid */}
      {boards.length > 0 && (
        <div className="lb-boards-grid mt-3">
          {boards.map((board) => (
            <div key={board.id} className="lb-board-card">
              <div className="lb-board-header">
                <div className="lb-board-actions">
                  <button className="icon-btn-sm" onClick={() => setShowWeeklyModal(true)}><Settings size={12} /></button>
                  <button className="icon-btn-sm red-icon" onClick={() => handleDeleteBoard(board.id)}><Trash2 size={12} /></button>
                </div>
                <div className="lb-board-info">
                  <h3 className="lb-board-title">{board.title}</h3>
                  <span className={`lb-board-type ${board.board_type}`}>{board.board_type === 'weekly' ? 'أسبوعي' : board.board_type === 'monthly' ? 'شهري' : 'كل الأوقات'}</span>
                </div>
              </div>
              <div className="lb-board-status-row">
                <span className={`status-tag ${board.enabled ? 'green' : 'gray'}`}>{board.enabled ? 'مفعّل' : 'معطّل'}</span>
                <span className={`status-tag ${board.public ? 'blue' : 'gray'}`}>{board.public ? 'عام' : 'خاص'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="lb-main-card mt-4">
        <div className="lb-card-header">
          <button className="icon-btn-sm" onClick={fetchAll}><RefreshCw size={14} /></button>
          <div className="lb-card-title">
            <Trophy size={18} className="text-gold" />
            <h2>لوحة الصدارة</h2>
            <span className="text-muted text-sm">NEW</span>
          </div>
        </div>

        {loading ? (
          <div className="lb-loading"><RefreshCw size={20} className="spin" /> جاري التحميل...</div>
        ) : (
          <table className="Echo-table-dark lb-table" dir="rtl">
            <thead>
              <tr>
                <th>الترتيب</th>
                <th>المعرف</th>
                <th>اللاعب</th>
                <th>الوظيفة</th>
                <th>وقت اللعب</th>
                <th>البنك</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-5 text-muted">لا توجد بيانات لوحة صدارة. تأكد من ربط قاعدة بيانات اللعبة.</td></tr>
              ) : (
                players.slice(0, 50).map((p, idx) => (
                  <tr key={p.citizenid} className={idx < 3 ? `top-${idx + 1}` : ''}>
                    <td>
                      <span className={`rank-num rank-${idx + 1}`}>
                        {idx === 0 ? '#1' : idx === 1 ? '#2' : idx === 2 ? '#3' : `#${idx + 1}`}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-muted">{p.citizenid}</td>
                    <td className="font-bold">{p.charinfo?.firstname} {p.charinfo?.lastname}</td>
                    <td className="text-muted text-sm">{p.job?.label || '—'}</td>
                    <td className="text-blue">{formatPlaytime(p.playtime)}</td>
                    <td className="text-green">${(p.money?.bank || 0).toLocaleString()}</td>
                    <td>
                      <button className="action-mini-btn">عرض</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== ADD BOARD MODAL ===== */}
      {showAddBoard && (
        <div className="modal-overlay">
          <div className="lb-modal-sm">
            <div className="modal-top-bar">
              <button className="close-x-btn" onClick={() => setShowAddBoard(false)}><X size={16} /></button>
              <div className="modal-title-section">
                <h2 className="modal-title-red">إضافة لوحة</h2>
                <p className="modal-subtitle">أضف لوحة جديدة لعرضها في قسم الصدارة.</p>
              </div>
            </div>

            <div className="form-group text-right mt-3">
              <label className="field-label">العنوان</label>
              <input className="input-dark text-right" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="وقت اللعب الأسبوعي" />
            </div>

            <div className="form-group text-right mt-3">
              <label className="field-label">نوع اللوحة</label>
              <select className="input-dark" value={newType} onChange={e => setNewType(e.target.value)}>
                <option value="weekly">أسبوعي</option>
                <option value="monthly">شهري</option>
                <option value="alltime">كل الأوقات</option>
              </select>
            </div>

            <div className="toggle-row-modal mt-3">
              <div className="toggle-item">
                <div className={`toggle-pill ${newEnabled ? 'active' : ''}`} onClick={() => setNewEnabled(!newEnabled)}></div>
                <span className="toggle-text">مفعّل<br/><span className="text-muted text-xs">ضم هذه اللوحة إلى التصنيفات.</span></span>
              </div>
              <div className="toggle-item">
                <div className={`toggle-pill ${newPublic ? 'active' : ''}`} onClick={() => setNewPublic(!newPublic)}></div>
                <span className="toggle-text">عام<br/><span className="text-muted text-xs">اعرض هذه اللوحة في الصفحة العامة.</span></span>
              </div>
            </div>

            <div className="modal-footer-bar mt-4">
              <button className="btn-cancel" onClick={() => setShowAddBoard(false)}>إلغاء</button>
              <button className="btn-red-solid" onClick={handleAddBoard}><Save size={14} /> إضافة لوحة</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== WEEKLY AUTOMATION MODAL ===== */}
      {showWeeklyModal && (
        <div className="modal-overlay">
          <div className="lb-modal-lg">
            <div className="modal-top-bar">
              <button className="close-x-btn" onClick={() => setShowWeeklyModal(false)}><X size={16} /></button>
              <div className="modal-title-section">
                <h2 className="modal-title-red">الأتمتة الأسبوعية</h2>
                <p className="modal-subtitle">جدول إعادة التعيين الأسبوعية وأرسل القائزين إلى ديسكورد قبل إعادة التعيين.</p>
              </div>
            </div>

            {/* Auto Reset Section */}
            <div className="weekly-section mt-4">
              <div className="weekly-section-header">
                <span className="weekly-section-icon"><RefreshCw size={16} /></span>
                <div>
                  <h3 className="text-white">إعادة التعيين الأسبوعي</h3>
                  <p className="text-muted text-xs">امسح وقت اللعب الأسبوعي حسب الجدول.</p>
                </div>
                <div className={`toggle-pill ${weeklyConfig.auto_reset ? 'active' : ''}`} onClick={() => setWeeklyConfig((p: any) => ({ ...p, auto_reset: !p.auto_reset }))}></div>
                <h4 className="ml-auto text-right mr-0">تفعيل إعادة التعيين التلقائية</h4>
              </div>

              {weeklyConfig.auto_reset && (
                <div className="weekly-fields-grid mt-3">
                  <div className="form-group text-right">
                    <label className="field-label-sm">يوم إعادة التعيين</label>
                    <select className="input-dark-sm" value={weeklyConfig.reset_day} onChange={e => setWeeklyConfig((p: any) => ({ ...p, reset_day: e.target.value }))}>
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group text-right">
                    <label className="field-label-sm">وقت إعادة التعيين</label>
                    <input type="time" className="input-dark-sm" value={weeklyConfig.reset_time} onChange={e => setWeeklyConfig((p: any) => ({ ...p, reset_time: e.target.value }))} />
                  </div>
                  <div className="form-group text-right">
                    <label className="field-label-sm">المنطقة الزمنية للسيرفر</label>
                    <select className="input-dark-sm" value={weeklyConfig.timezone} onChange={e => setWeeklyConfig((p: any) => ({ ...p, timezone: e.target.value }))}>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {weeklyConfig.auto_reset && (
                <div className="weekly-next-reset text-muted text-xs text-right mt-2">
                  إعادة التعيين التالية: {weeklyConfig.reset_day} · {weeklyConfig.reset_time} م · {weeklyConfig.timezone}
                </div>
              )}
            </div>

            {/* Discord Section */}
            <div className="weekly-section mt-3">
              <div className="weekly-section-header">
                <span className="weekly-section-icon"><MessageSquare size={16} /></span>
                <div>
                  <h3 className="text-white">رسالة ديسكورد</h3>
                  <p className="text-muted text-xs">أرسل القائزين الأسبوعيين إلى ديسكورد قبل إعادة التعيين.</p>
                </div>
                <div className={`toggle-pill ${weeklyConfig.discord_enabled ? 'active' : ''}`} onClick={() => setWeeklyConfig((p: any) => ({ ...p, discord_enabled: !p.discord_enabled }))}></div>
                <h4 className="ml-auto text-right mr-0">تفعيل رسالة ديسكورد</h4>
              </div>

              {weeklyConfig.discord_enabled && (
                <div className="mt-3">
                  <div className="form-group text-right">
                    <label className="field-label-sm">رابط الويبهوك</label>
                    <input className="input-dark-sm text-left" placeholder="...https://discord.com/api/webhooks" value={weeklyConfig.discord_webhook} onChange={e => setWeeklyConfig((p: any) => ({ ...p, discord_webhook: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="weekly-fields-grid mt-2">
                    <div className="form-group text-right">
                      <label className="field-label-sm">اللغة</label>
                      <select className="input-dark-sm" value={weeklyConfig.discord_lang} onChange={e => setWeeklyConfig((p: any) => ({ ...p, discord_lang: e.target.value }))}>
                        {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="form-group text-right">
                      <label className="field-label-sm">عنوان الرسالة</label>
                      <input className="input-dark-sm text-right" value={weeklyConfig.message_title} onChange={e => setWeeklyConfig((p: any) => ({ ...p, message_title: e.target.value }))} placeholder="وقت اللعب الأسبوعي" />
                    </div>
                  </div>

                  {/* Message Template */}
                  <div className="form-group text-right mt-3">
                    <div className="template-header">
                      <button className="btn-xs-outline" onClick={() => setWeeklyConfig((p: any) => ({ ...p, message_template: DEFAULT_TEMPLATE }))}>إعادة القالب الافتراضي</button>
                      <label className="field-label-sm">قالب الرسالة</label>
                    </div>
                    <div className="template-tags mt-1">
                      {['{rank.الترتيب}', '{1.id}', '{1.user}', '{1.playtime}'].map(tag => (
                        <button key={tag} className="tag-pill" onClick={() => setWeeklyConfig((p: any) => ({ ...p, message_template: p.message_template + tag }))}>{tag}</button>
                      ))}
                    </div>
                    <textarea
                      className="input-dark-textarea mt-1"
                      rows={8}
                      value={weeklyConfig.message_template}
                      onChange={e => setWeeklyConfig((p: any) => ({ ...p, message_template: e.target.value }))}
                      dir="ltr"
                    />
                  </div>

                  {/* Preview */}
                  <div className="weekly-preview mt-3">
                    <div className="preview-label">معاينة القالب بعناوين مثبتة:</div>
                    <div className="preview-box">
                      {[1,2,3].map(i => (
                        <div key={i} className="preview-row">
                          <span className="preview-tag">#{i}</span>
                          <span className="preview-user">@لاعب{i}</span>
                          <span className="preview-dash"> - </span>
                          <span className="preview-time">played {i * 10}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer-bar mt-4">
              <button className="btn-cancel" onClick={() => setShowWeeklyModal(false)}>إلغاء</button>
              <button className="btn-red-solid" disabled={saving} onClick={handleSaveWeekly}>
                <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
