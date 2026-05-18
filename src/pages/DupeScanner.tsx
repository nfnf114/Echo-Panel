import React, { useState, useEffect } from 'react';
import {
  Search, ShieldAlert, Trash2, RefreshCw, X, AlertCircle,
  Edit, ChevronRight, ChevronDown, Shield, Activity,
  User, Eye, EyeOff, Save, Plus, Filter, Settings, Globe,
  ExternalLink, ChevronUp, Package, Info, MapPin, Briefcase,
  Crosshair, Zap, Target, Layers
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import { useNotification } from '../context/NotificationContext';
import './DupeScanner.css';

import { API_URL } from '../config';

const DupeScanner: React.FC = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [adminSearch, setAdminSearch] = useState('');
  const [allResults, setAllResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [onlyDupes, setOnlyDupes] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState<any | null>(null);
  
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<{ serial: string; text: string } | null>(null);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [showExclusions, setShowExclusions] = useState(false);
  const [newExclusion, setNewExclusion] = useState('');

  // Enhanced categories
  const [category, setCategory] = useState('all');

  useEffect(() => {
    fetchNotes();
    fetchExclusions();
    handleScan(); 
  }, [serverId]);

  const fetchNotes = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/weapon-notes`);
      if (res.ok) setNotes(await res.json());
    } catch (e) {}
  };

  const fetchExclusions = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/weapon-exclusions`);
      if (res.ok) setExclusions(await res.json());
    } catch (e) {}
  };

  const saveNote = async () => {
    if (!editingNotes) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/weapon-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: editingNotes.serial, notes: editingNotes.text }),
      });
      if (res.ok) {
        setNotes(prev => ({ ...prev, [editingNotes.serial]: editingNotes.text }));
        setEditingNotes(null);
        showNotification('تم حفظ الملاحظة', 'success');
      }
    } catch (e) {}
  };

  const handleScan = async () => {
    setLoading(true);
    setScanned(true);
    setSelectedWeapon(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/dupe-scanner/scan`);
      const data = await res.json();
      if (res.ok) {
        setAllResults(data.results || []);
      } else {
        showNotification('فشل الاتصال بالسيرفر', 'error');
      }
    } catch (e) {
      showNotification('خطأ في الاتصال', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (it: any, serial: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السلاح نهائياً؟')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/dupe-scanner/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, ownerId: it.ownerId, type: it.type }),
      });
      if (res.ok) {
        showNotification('تم حذف السلاح بنجاح', 'success');
        handleScan(); 
      }
    } catch (e) {}
  };

  const filteredResults = allResults.filter(r => {
    const matchesSearch = r.label.toLowerCase().includes(adminSearch.toLowerCase()) || 
                          r.serial.toLowerCase().includes(adminSearch.toLowerCase());
    const matchesDupeFilter = onlyDupes ? r.isDuplicate : true;
    
    // Simple category mapping
    const isPistol = r.item.toLowerCase().includes('pistol') || r.item.toLowerCase().includes('revolver');
    const isRifle = r.item.toLowerCase().includes('rifle') || r.item.toLowerCase().includes('smg') || r.item.toLowerCase().includes('shotgun');
    const isMelee = !r.item.toLowerCase().includes('weapon_') || r.item.toLowerCase().includes('knife') || r.item.toLowerCase().includes('bat');

    if (category === 'pistols' && !isPistol) return false;
    if (category === 'rifles' && !isRifle) return false;
    if (category === 'melee' && !isMelee) return false;

    return matchesSearch && matchesDupeFilter;
  });

  const dupeCount = allResults.filter(r => r.isDuplicate).length;

  return (
    <div className="dupe-scanner-page animate-fade-in" dir="rtl">
      {/* HEADER */}
      <div className="dupe-top-header">
        <div className="header-titles">
          <div className="title-with-icon">
             <Target size={32} className="title-icon" />
             <div>
                <h2>فحص وتدبيل الأسلحة</h2>
                <p className="subtitle-lux">مراقبة حية لجميع السيريالات في السيرفر</p>
             </div>
          </div>
        </div>

        <div className="header-actions">
           <div className="lux-search-wrapper">
              <div className="search-bar-lux">
                <Search size={16} />
                <input 
                  placeholder="ابحث بالسيريال أو اسم السلاح..." 
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                />
              </div>
           </div>

           <button 
             className={`btn-lux-filter ${onlyDupes ? 'active' : ''}`}
             onClick={() => setOnlyDupes(!onlyDupes)}
           >
             <ShieldAlert size={16} />
             <span>التدبيلات فقط</span>
           </button>

           <button className="btn-lux-action" onClick={() => setShowExclusions(true)}>
             <Layers size={16} />
             <span>الاستثناءات</span>
           </button>

           <button className="btn-lux-primary" onClick={handleScan} disabled={loading}>
             <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
             <span>تحديث البيانات</span>
           </button>
        </div>
      </div>

      {/* CATEGORY SELECTOR */}
      <div className="category-bar">
         <button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>الكل</button>
         <button className={category === 'pistols' ? 'active' : ''} onClick={() => setCategory('pistols')}>مسدسات</button>
         <button className={category === 'rifles' ? 'active' : ''} onClick={() => setCategory('rifles')}>بنادق</button>
         <button className={category === 'melee' ? 'active' : ''} onClick={() => setCategory('melee')}>أخرى</button>
      </div>

      {/* STATS GRID */}
      <div className="lux-stats-grid">
         <div className="lux-stat-card">
            <div className="icon-wrap blue"><Package size={24} /></div>
            <div className="info">
               <span className="label">إجمالي الأسلحة</span>
               <span className="value">{allResults.length}</span>
            </div>
         </div>
         <div className="lux-stat-card danger">
            <div className="icon-wrap red"><ShieldAlert size={24} /></div>
            <div className="info">
               <span className="label">سيريالات مدبّلة</span>
               <span className="value">{dupeCount}</span>
            </div>
            {dupeCount > 0 && <div className="danger-glow" />}
         </div>
         <div className="lux-stat-card">
            <div className="icon-wrap green"><Target size={24} /></div>
            <div className="info">
               <span className="label">أسلحة فريدة</span>
               <span className="value">{allResults.length - dupeCount}</span>
            </div>
         </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="dupe-main-layout">
        
        {/* WEAPONS LIST */}
        <div className={`table-lux-container ${selectedWeapon ? 'table-half' : 'table-full'}`}>
          <div className="lux-table-header">
             <span>قائمة السيريالات المكتشفة ({filteredResults.length})</span>
          </div>
          <div className="lux-scroll-area">
             {filteredResults.map((r, i) => (
                <div 
                  key={i} 
                  className={`lux-weapon-row ${selectedWeapon?.serial === r.serial ? 'selected' : ''} ${r.isDuplicate ? 'is-dupe' : ''}`}
                  onClick={() => setSelectedWeapon(r)}
                >
                  <div className="row-content">
                     <div className="weapon-icon-box-lux">
                        <img src={`${API_URL}/uploads/items/${r.item}.png`} alt="" onError={(e: any) => e.target.src = 'https://cdn-icons-png.flaticon.com/512/324/324141.png'} />
                     </div>
                     <div className="weapon-main-info">
                        <span className="w-name">{r.label}</span>
                        <div className="w-meta">
                           <span className="w-serial-pill">#{r.serial}</span>
                           {notes[r.serial] && <span className="w-has-note"><Edit size={10} /> ملاحظة</span>}
                        </div>
                     </div>
                     <div className="weapon-count-badge">
                        <span className={r.isDuplicate ? 'count-red' : 'count-green'}>
                           {r.count} <small>نُسخة</small>
                        </span>
                     </div>
                  </div>
                  <div className="row-hover-indicator" />
                </div>
             ))}

             {filteredResults.length === 0 && (
                <div className="lux-empty-state">
                   <div className="radar-scanner">
                      <div className="radar-beam" />
                      <Activity size={48} className="radar-icon" />
                      <div className="radar-grid" />
                   </div>
                   <h3>جاري مراقبة السيريالات...</h3>
                   <p>لم يتم العثور على أسلحة مطابقة حالياً. تأكد من وجود أسلحة في الحقائب أو المخازن ثم أعد الفحص.</p>
                </div>
             )}
          </div>
        </div>

        {/* SIDE PANEL: INVESTIGATION */}
        {selectedWeapon && (
          <div className="investigation-panel glass-panel animate-slide-in">
             <div className="panel-top">
                <div className="weapon-preview-big">
                   <img src={`${API_URL}/uploads/items/${selectedWeapon.item}.png`} alt="" onError={(e: any) => e.target.src = 'https://cdn-icons-png.flaticon.com/512/324/324141.png'} />
                   {selectedWeapon.isDuplicate && <div className="dupe-pulse-bg" />}
                </div>
                <div className="panel-header-text">
                   <h3>{selectedWeapon.label}</h3>
                   <div className="serial-pill-lux">
                      <Shield size={14} />
                      <span>{selectedWeapon.serial}</span>
                   </div>
                </div>
                <button className="panel-close-btn" onClick={() => setSelectedWeapon(null)}>
                   <X size={22} />
                </button>
             </div>

             <div className="investigation-scroll">
                <div className="section-title">الأشخاص المتورطون</div>
                <div className="owners-lux-list">
                   {selectedWeapon.details.map((it: any, idx: number) => (
                      <div key={idx} className="owner-lux-card">
                         <div className="o-avatar">
                            {(() => {
                               const faceFallback = `${API_URL}/uploads/avatars/${it.ownerId}_face.png`;
                               const finalImg = (it.avatar && it.avatar !== "none" && it.avatar !== "") ? it.avatar : faceFallback;
                               return (
                                  <img 
                                    src={finalImg} 
                                    alt="" 
                                    onError={(e: any) => {
                                       e.target.onerror = null;
                                       const screenshotUrl = `${API_URL}/uploads/screenshots/${it.ownerId}.webp`;
                                       e.target.src = screenshotUrl;
                                       e.target.onerror = (e2: any) => {
                                          e2.target.onerror = null;
                                          e2.target.style.display = "none";
                                       };
                                    }} 
                                  />
                               );
                            })()}
                            {!it.avatar && <span className="avatar-initials">{it.owner.slice(0, 2).toUpperCase()}</span>}
                         </div>
                         <div className="o-info">
                            <div 
                              className="o-name"
                              onClick={() => navigate(`/server/${serverId}/characters/${it.ownerId}`)}
                            >
                              {it.owner}
                              <ExternalLink size={12} />
                            </div>
                            <div className="o-meta">
                               <span className={`loc-tag ${it.type.toLowerCase()}`}>
                                  {it.type === 'Player' ? <User size={10}/> : 
                                   it.type === 'Stash' ? <Shield size={10}/> : 
                                   <Package size={10}/>}
                                  {it.type}
                               </span>
                               <span className="job-tag">• {it.job}</span>
                            </div>
                         </div>
                         <button className="o-delete-btn" onClick={() => handleDeleteItem(it, selectedWeapon.serial)} title="حذف نهائي">
                            <Trash2 size={16} />
                         </button>
                      </div>
                   ))}
                </div>

                <div className="section-title">الإجراءات والملاحظات</div>
                <div className="notes-section-lux">
                   <div className="note-display">
                      {notes[selectedWeapon.serial] ? (
                        <p>{notes[selectedWeapon.serial]}</p>
                      ) : (
                        <p style={{ opacity: 0.5 }}>لا توجد ملاحظات لهذا السيريال حالياً...</p>
                      )}
                   </div>
                   <button 
                     className="btn-lux-outline"
                     onClick={() => setEditingNotes({ serial: selectedWeapon.serial, text: notes[selectedWeapon.serial] || '' })}
                   >
                     <Edit size={16} />
                     تعديل الملاحظات
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* MODAL: NOTES */}
      {editingNotes && (
        <div className="modal-overlay" onClick={() => setEditingNotes(null)}>
          <div className="action-modal-box glass-panel animate-modal-in lux-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <h3>تعديل ملاحظات السلاح</h3>
                <p>السيريال المستهدف: {editingNotes.serial}</p>
              </div>
              <button className="close-btn" onClick={() => setEditingNotes(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <textarea 
                className="input-lux" 
                rows={5} 
                value={editingNotes.text} 
                onChange={e => setEditingNotes({ ...editingNotes, text: e.target.value })}
                placeholder="اكتب ملاحظاتك هنا..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn-lux-primary w-full" onClick={saveNote}>حفظ التغييرات</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSIONS */}
      {showExclusions && (
        <div className="modal-overlay" onClick={() => setShowExclusions(false)}>
           <div className="action-modal-box glass-panel animate-modal-in lux-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                 <div className="title-group">
                    <h3>قائمة الاستثناءات</h3>
                    <p>إدارة السيريالات التي يتم تجاهلها أثناء الفحص</p>
                 </div>
                 <button className="close-btn" onClick={() => setShowExclusions(false)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                 <div className="lux-add-row">
                    <input 
                      className="input-lux" 
                      placeholder="أدخل السيريال..." 
                      value={newExclusion}
                      onChange={(e) => setNewExclusion(e.target.value)}
                    />
                    <button className="btn-lux-primary" onClick={() => {
                        if (!newExclusion) return;
                        try {
                           fetchWithAuth(`${API_URL}/api/server/${serverId}/weapon-exclusions`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ serial: newExclusion }),
                           }).then(res => {
                              if (res.ok) {
                                 setExclusions(prev => [...prev, newExclusion]);
                                 setNewExclusion('');
                                 showNotification('تم الإضافة', 'success');
                              }
                           });
                        } catch(e) {}
                    }}>
                       <Plus size={20} />
                    </button>
                 </div>
                 <div className="lux-exclusions-list mt-4">
                    {exclusions.map(ex => (
                       <div key={ex} className="lux-exclusion-item">
                          <span className="ex-serial">#{ex}</span>
                          <button className="ex-del-btn" onClick={() => {
                              try {
                                 fetchWithAuth(`${API_URL}/api/server/${serverId}/weapon-exclusions/${ex}`, { method: 'DELETE' })
                                 .then(res => {
                                    if (res.ok) {
                                       setExclusions(prev => prev.filter(s => s !== ex));
                                       showNotification('تم الحذف', 'success');
                                    }
                                 });
                              } catch(e) {}
                          }}>
                             <Trash2 size={14} />
                          </button>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DupeScanner;


