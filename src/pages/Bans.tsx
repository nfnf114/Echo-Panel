import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Trash2, Edit, Ban, Info, X, User, ChevronDown } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useParams } from 'react-router-dom';
import './Bans.css';

import { API_URL } from '../config';

const Bans: React.FC = () => {
  const { serverId } = useParams();
  const [bans, setBans] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Form State
  const [banForm, setBanForm] = useState({
    steam: '',
    name: '',
    duration: '0',
    reason: ''
  });

  const fetchBans = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-bans`);
      const data = await res.json();
      setBans(data.bans || []);
    } catch (e) {
      // Silently show empty data on error - no error banners
      setBans([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-players`);
      const data = await res.json();
      setAllPlayers(data.players || []);
    } catch (e) {
      // Silently show empty data on error
      setAllPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  };

  useEffect(() => {
    if (showCreateModal && allPlayers.length === 0) {
      fetchPlayers();
    }
  }, [showCreateModal, serverId]);

  useEffect(() => {
    fetchBans();
  }, [serverId]);

  const filteredBans = bans.filter(b => 
    (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.license || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.bannedby || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.ban_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateBan = async () => {
    if (!banForm.steam && !banForm.name) {
      alert('يجب إدخال رخصة ستيم أو الاسم على الأقل');
      return;
    }
    
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'ban',
          target_id: banForm.steam || banForm.name,
          data: { 
            reason: banForm.reason, 
            duration: parseInt(banForm.duration),
            name: banForm.name
          }
        })
      });
      
      if (res.ok) {
        alert('تم إنشاء الحظر بنجاح!');
        setShowCreateModal(false);
        fetchBans();
        setBanForm({ steam: '', name: '', duration: '0', reason: '' });
      } else {
        alert('حدث خطأ أثناء الإنشاء');
      }
    } catch (e) {
      alert('حدث خطأ أثناء الإنشاء');
    }
  };

  const handleUnban = async (license: string) => {
    if (!confirm('هل أنت متأكد من فك الحظر عن هذا اللاعب؟')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'unban',
          target_id: license,
          data: { license }
        })
      });
      
      if (res.ok) {
        alert('تم إرسال طلب فك الحظر بنجاح!');
        fetchBans();
      } else {
        alert('حدث خطأ');
      }
    } catch (e) {
      alert('حدث خطأ');
    }
  };

  const formatDuration = (b: any) => {
    if (b.isPermanent) return 'مؤبد';
    if (b.expire) {
      // Try to calculate original duration from expire time if available
      return 'مؤقت';
    }
    return 'غير محدد';
  };

  return (
    <div className="bans-page-table animate-fade-in">
      <div className="bans-main-container">
        
        {/* Header Title */}
        <div className="bans-header-title">
          <div className="header-actions-left">
            <button className="btn-solid-red" onClick={() => setShowCreateModal(true)}>
              <Ban size={16} /> إنشاء حظر
            </button>
            <button className="btn-outline-dark">تصدير JSON</button>
            <button className="btn-outline-dark">تصدير CSV</button>
          </div>
          <div className="title-with-icon">
            <h2 className="title-text">الحظر</h2>
            <Ban size={22} className="text-white" />
          </div>
        </div>

        {/* Note Box */}
        <div className="note-box-blue mt-3">
          <div className="note-icon"><Info size={18} /></div>
          <div className="note-text text-right w-full">
            <h4 className="m-0 text-white font-bold">ملاحظات</h4>
            <p className="m-0 text-muted mt-1 text-sm">تقرأ هذه الصفحة سجلات الحظر من جدول QBCore الأساسي المضبوط على هذا السيرفر.</p>
          </div>
        </div>

        {/* Filters Area */}
        <div className="bans-filters-row mt-4">
          <div className="filter-group-right">
            <button className="btn-search-refresh" onClick={fetchBans}>
              <RefreshCw size={14} /> بحث
            </button>
            <button className="btn-clear" onClick={() => setSearchTerm('')}>مسح</button>
            <div className="toggle-container">
              <span className="text-muted text-sm ml-2">إخفاء المنتهي</span>
              <div className="toggle-switch red-switch"></div>
            </div>
            <span className="text-white text-sm font-bold mr-4">النشط فقط</span>
          </div>
          
          <div className="search-group-left">
            <div className="filter-col w-full">
              <label className="filter-label text-right">بحث</label>
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="...name/license/ban code/reason" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="bans-table-wrapper">
          <div className="table-meta text-right mb-2">
            <span className="text-muted text-xs">آخر تحديث: {new Date().toLocaleString()}</span>
          </div>
          
          {loading ? (
            <div className="loading-full"><RefreshCw className="spin" /> جاري جلب البيانات...</div>
          ) : (
            <table className="Echo-table-dark" dir="rtl">
              <thead>
                <tr>
                  <th>الحالة</th>
                  <th>الاسم</th>
                  <th>كود الباند</th>
                  <th>الرخصة</th>
                  <th>السبب</th>
                  <th>المدة</th>
                  <th>المتبقي</th>
                  <th>بواسطة</th>
                  <th>الأفعال</th>
                </tr>
              </thead>
              <tbody>
                {filteredBans.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-5 text-muted">لا توجد حالات حظر</td></tr>
                ) : (
                  filteredBans.map((b, idx) => {
                    const isPermanent = b.isPermanent || b.expire === 2147483647;
                    const isActive = b.isActive !== undefined ? b.isActive : (isPermanent || (b.expire > Math.floor(Date.now() / 1000)));
                    const banCode = b.ban_code || (b.license && b.license.length >= 8 ? b.license.substring(0, 8).toUpperCase() : 'UNKNOWN');
                    return (
                      <tr key={idx}>
                        <td>
                          <div className="flex-col-data">
                            {isPermanent ? (
                              <span className="status-pill pill-red">مؤبد</span>
                            ) : isActive ? (
                              <span className="status-pill pill-green">نشط</span>
                            ) : (
                              <span className="status-pill" style={{ background: 'rgba(100,100,100,0.2)', color: '#666' }}>منتهي</span>
                            )}
                          </div>
                        </td>
                        <td><span className="text-white font-bold">{b.name}</span></td>
                        <td><span className="font-mono text-muted" style={{ color: '#8b0000', fontWeight: 'bold' }}>#{banCode}</span></td>
                        <td className="font-mono text-muted">{b.license?.substring(0, 15)}...</td>
                        <td><span className="text-muted">{b.reason}</span></td>
                        <td><span className="text-muted">{formatDuration(b)}</span></td>
                        <td><span className="text-muted">{b.remaining || (isPermanent ? '∞' : (!isActive ? 'منتهي' : '—'))}</span></td>
                        <td><span className="text-muted">{b.bannedby}</span></td>
                        <td>
                          <div className="action-buttons-group">
                            <button className="btn-action-icon red-bg" title="فك الحظر" onClick={() => handleUnban(b.license)}>
                              <Trash2 size={14} />
                            </button>
                            <button className="btn-action-icon gray-bg" title="تعديل الحظر">
                              <Edit size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="pagination-footer">
          <div className="pagination-controls">
            <button className="btn-page">التالي</button>
            <button className="btn-page">السابق</button>
          </div>
          <div className="total-displayed">
            عرض {filteredBans.length} سجلات
          </div>
        </div>

      </div>

      {/* Create Ban Modal */}
      {showCreateModal && (
        <div className="modal-overlay-dark">
          <div className="create-ban-modal animate-fade-in" style={{
             background: '#121212',
             border: '1px solid rgba(255,255,255,0.05)',
             borderRadius: '20px',
             padding: '30px',
             width: '500px',
             boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div className="modal-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button className="close-btn" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.5 }}><X size={20} /></button>
              <div className="text-right">
                <h2 className="m-0" style={{ color: '#ff4d4d', fontSize: '1.5rem' }}>إنشاء حظر</h2>
                <p className="text-muted text-xs m-0 mt-1">اختر اللاعب وحدد المدة والسبب</p>
              </div>
            </div>
            
            <div className="modal-body">
              <div className="form-group text-right mb-4">
                <label className="block mb-2 text-sm text-gray-400">اختر اللاعب</label>
                <div className="searchable-select-wrapper" style={{ position: 'relative' }}>
                  <div className="select-trigger" onClick={() => setShowDropdown(!showDropdown)} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    color: '#fff'
                  }}>
                    {banForm.name ? (
                      <span className="font-bold">{banForm.name} <small style={{opacity: 0.5}}>({banForm.steam})</small></span>
                    ) : (
                      <span style={{opacity: 0.5}}>{loadingPlayers ? 'جاري التحميل...' : 'ابحث عن لاعب...'}</span>
                    )}
                    <ChevronDown size={18} style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>

                  {showDropdown && (
                    <div className="select-dropdown glass-panel mt-2 animate-fade-in" style={{ 
                      position: 'absolute', 
                      zIndex: 100, 
                      width: '100%', 
                      maxHeight: '250px', 
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '12px',
                      background: '#1a1a1a',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}>
                      <div className="search-box p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                          <input 
                            type="text" 
                            placeholder="بحث بالاسم أو CID..." 
                            className="input-dark"
                            style={{ paddingRight: '35px', width: '100%', background: '#000', border: 'none', borderRadius: '8px', padding: '10px 35px 10px 10px', color: '#fff' }}
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            autoFocus 
                          />
                        </div>
                      </div>
                      <div className="options-list" style={{ overflowY: 'auto', flex: 1 }}>
                        {allPlayers
                          .filter(p => {
                            const name = `${p.charinfo?.firstname || ''} ${p.charinfo?.lastname || ''}`.toLowerCase();
                            const cid = (p.citizenid || '').toLowerCase();
                            const filter = searchFilter.toLowerCase();
                            return name.includes(filter) || cid.includes(filter);
                          })
                          .slice(0, 50)
                          .map((p: any) => {
                            const charName = `${p.charinfo?.firstname || ''} ${p.charinfo?.lastname || ''}`;
                            return (
                              <div key={p.citizenid} className="option-row p-3 cursor-pointer flex items-center gap-3 hover:bg-white/5 transition-all" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} onClick={() => {
                                setBanForm({...banForm, name: charName, steam: p.license || p.citizenid});
                                setShowDropdown(false);
                                setSearchFilter('');
                              }}>
                                <div className="flex items-center gap-3 w-full" dir="rtl" style={{ display: 'flex' }}>
                                  <div className="p-2 rounded-lg bg-red-500/10 text-red-500" style={{ marginLeft: '12px' }}>
                                    <User size={18} />
                                  </div>
                                  <div className="flex flex-col flex-1 text-right">
                                    <div className="text-white text-sm font-bold">{charName}</div>
                                    <div className="text-xs opacity-50 font-mono">{p.citizenid}</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group text-right mb-4">
                <label className="block mb-2 text-sm text-gray-400">المدة (بالساعات. 0 = دائم)</label>
                <input 
                  type="number" 
                  className="input-dark" 
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  value={banForm.duration}
                  onChange={e => setBanForm({...banForm, duration: e.target.value})}
                />
              </div>
              
              <div className="form-group text-right mb-4">
                <label className="block mb-2 text-sm text-gray-400">السبب</label>
                <textarea 
                  className="input-dark" 
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', minHeight: '100px', resize: 'vertical' }}
                  placeholder="اكتب سبب الحظر هنا..."
                  value={banForm.reason}
                  onChange={e => setBanForm({...banForm, reason: e.target.value})}
                ></textarea>
              </div>
            </div>
            
            <div className="modal-footer" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleCreateBan} style={{ flex: 1, padding: '12px', background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>تأكيد الحظر</button>
              <button onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Bans;
