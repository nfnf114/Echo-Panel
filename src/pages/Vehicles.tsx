import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Trash2, Tag, ArrowLeftRight, Edit, ExternalLink, X } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import { useNotification } from '../context/NotificationContext';
import './Vehicles.css';

import { API_URL } from '../config';

const Vehicles: React.FC = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('أي');
  
  // Modal State
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [transferringVehicle, setTransferringVehicle] = useState<any>(null);
  const [changingPlate, setChangingPlate] = useState<any>(null);
  
  const [editForm, setEditForm] = useState({
    garage: '',
    state: 0,
    fuel: 100,
    engine: 1000,
    body: 1000,
    reason: ''
  });

  const [transferForm, setTransferForm] = useState({
    targetCitizenId: '',
    reason: ''
  });

  const [plateForm, setPlateForm] = useState({
    newPlate: '',
    reason: ''
  });

  const fetchVehicles = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-vehicles`);
      const data = await res.json();
      if (res.ok) {
        setVehicles(data.vehicles || []);
      } else {
        setErrorMsg(data.details || data.error || 'فشل جلب المركبات');
        if (showNotification) showNotification(data.error || 'خطأ في جلب المركبات', 'error');
      }
    } catch (e) {
      setErrorMsg('خطأ في الاتصال بالخادم');
      if (showNotification) showNotification('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [serverId]);

  const filteredVehicles = vehicles.filter(v => {
    const searchLower = searchTerm.toLowerCase();
    const plate = (v.plate || '').toLowerCase();
    const model = (v.vehicle || '').toLowerCase();
    const cid = (v.citizenid || '').toLowerCase();
    const fname = (v.charinfo?.firstname || '').toLowerCase();
    const lname = (v.charinfo?.lastname || '').toLowerCase();
    
    const matchesSearch = 
      plate.includes(searchLower) ||
      model.includes(searchLower) ||
      cid.includes(searchLower) ||
      fname.includes(searchLower) ||
      lname.includes(searchLower);
      
    const matchesStatus = statusFilter === 'أي' ? true 
                        : statusFilter === 'في الكراج' ? v.state === 1 
                        : v.state !== 1;
                        
    return matchesSearch && matchesStatus;
  });

  const openEditModal = (v: any) => {
    setEditingVehicle(v);
    setEditForm({
      garage: v.garage || 'pillboxgarage',
      state: v.state || 0,
      fuel: v.fuel || 100,
      engine: v.engine || 1000,
      body: v.body || 1000,
      reason: ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingVehicle) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'edit_vehicle',
          target_id: editingVehicle.citizenid,
          data: { plate: editingVehicle.plate, updates: editForm }
        })
      });
      if (res.ok) {
        showNotification('تم إرسال طلب التعديل بنجاح!', 'success');
        setEditingVehicle(null);
        fetchVehicles();
      } else {
        showNotification('فشل التعديل', 'error');
      }
    } catch (e) {
      showNotification('حدث خطأ أثناء التعديل', 'error');
    }
  };

  const handleTransfer = async () => {
    if (!transferringVehicle) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'transfer_vehicle',
          target_id: transferringVehicle.citizenid,
          data: { plate: transferringVehicle.plate, newOwner: transferForm.targetCitizenId, reason: transferForm.reason }
        })
      });
      if (res.ok) {
        showNotification('تم إرسال طلب النقل بنجاح!', 'success');
        setTransferringVehicle(null);
        fetchVehicles();
      } else {
        showNotification('فشل النقل', 'error');
      }
    } catch (e) {
      showNotification('حدث خطأ أثناء النقل', 'error');
    }
  };

  const handleChangePlate = async () => {
    if (!changingPlate) return;
    if (!plateForm.newPlate) return showNotification('يرجى إدخال اللوحة الجديدة', 'warning');
    
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'change_plate',
          target_id: changingPlate.citizenid,
          data: { oldPlate: changingPlate.plate, newPlate: plateForm.newPlate, reason: plateForm.reason }
        })
      });
      if (res.ok) {
        showNotification('تم تغيير اللوحة بنجاح في كافة الجداول!', 'success');
        setChangingPlate(null);
        fetchVehicles();
      } else {
        const err = await res.json();
        showNotification(err.error || 'فشل تغيير اللوحة', 'error');
      }
    } catch (e) {
      showNotification('حدث خطأ أثناء تغيير اللوحة', 'error');
    }
  };

  const handleDelete = async (plate: string, citizenid: string) => {
    const reason = prompt('الرجاء إدخال سبب الحذف:');
    if (reason === null) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'delete_vehicle',
          target_id: citizenid,
          data: { plate, reason }
        })
      });
      if (res.ok) {
        showNotification('تم إرسال طلب حذف المركبة بنجاح!', 'success');
        fetchVehicles();
      } else {
        showNotification('فشل الحذف', 'error');
      }
    } catch (e) {
      showNotification('حدث خطأ أثناء الحذف', 'error');
    }
  };

  return (
    <div className="vehicles-page-table animate-fade-in">
      <div className="vehicles-main-container">
        
        {/* Header Title */}
        <div className="vehicles-header-title">
          <h2 className="title-text">المركبات</h2>
        </div>

        {/* Filters Area */}
        <div className="vehicles-filters-row">
          <div className="filter-group-right">
            <span className="filter-label">الحالة</span>
            <select className="Echo-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="أي">أي</option>
              <option value="في الكراج">في الكراج</option>
              <option value="خارج الكراج">خارج الكراج</option>
            </select>
            <button className="btn-clear">مسح</button>
            <button className="btn-search-refresh" onClick={fetchVehicles}>
              <RefreshCw size={14} /> بحث
            </button>
          </div>
          
          <div className="search-group-left">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="اللوحة، الموديل..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <span className="search-tip">Tip: search by plate, vehicle name, citizenid, license, or owner discord id.</span>
          </div>
        </div>

        <div className="displayed-count-badge">المعروض: {filteredVehicles.length}</div>

        {/* Table Area */}
        <div className="vehicles-table-wrapper">
          {loading ? (
            <div className="loading-full"><RefreshCw className="spin" /> جاري جلب البيانات...</div>
          ) : (
            <table className="Echo-table-dark" dir="rtl">
              <thead>
                <tr>
                  <th>اللوحة</th>
                  <th>الموديل</th>
                  <th>المالك</th>
                  <th>الكراج / الحالة</th>
                  <th>الوقود</th>
                  <th>المحرك</th>
                  <th>الهيكل</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4">لا يوجد مركبات</td></tr>
                ) : (
                  filteredVehicles.map((v, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-white font-bold">{v.plate}</td>
                      <td>
                        <div className="flex-col-data">
                          <span className="text-white font-bold">{v.vehicle}</span>
                          <span className="text-muted text-xs">mods apr spandem</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex-col-data">
                          <span className="text-white font-bold">{v.charinfo?.firstname} {v.charinfo?.lastname}</span>
                          <span className="text-muted text-xs">{v.citizenid}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex-col-data">
                          <span className="text-white">—</span>
                          <span className={`status-pill ${v.state === 1 ? 'pill-blue' : 'pill-green'}`}>
                            الحالة: {v.state === 1 ? 'في الكراج' : 'خارج الكراج'}
                          </span>
                        </div>
                      </td>
                      <td className="text-white">{(v.fuel || 0).toLocaleString('en-US')}</td>
                      <td className="text-white">{(v.engine || 0).toLocaleString('en-US')}</td>
                      <td className="text-white">{(v.body || 0).toLocaleString('en-US')}</td>
                      <td>
                        <div className="action-buttons-group">
                          <button className="btn-action-icon red-bg" onClick={() => handleDelete(v.plate, v.citizenid)}>
                            <Trash2 size={14} />
                          </button>
                          <button className="btn-action-icon gray-bg" title="تغيير اللوحة" onClick={() => {
                            setChangingPlate(v);
                            setPlateForm({ newPlate: '', reason: '' });
                          }}>
                            <Tag size={14} />
                          </button>
                          <button className="btn-action-icon gray-bg" title="نقل الملكية" onClick={() => {
                            setTransferringVehicle(v);
                            setTransferForm({ targetCitizenId: '', reason: '' });
                          }}>
                            <ArrowLeftRight size={14} />
                          </button>
                          <button className="btn-action-icon gray-bg" title="تعديل المركبة" onClick={() => openEditModal(v)}>
                            <Edit size={14} />
                          </button>
                          <button className="btn-action-icon gray-bg" title="عرض المالك" onClick={() => navigate(`/server/${serverId}/character/${v.citizenid}`)}>
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-content glass-panel-dark animate-modal-in">
            <div className="edit-modal-header">
              <h2 className="edit-title">تعديل المركبة <span className="red-line"></span></h2>
              <button className="btn-close-modal" onClick={() => setEditingVehicle(null)}><X size={18} /></button>
            </div>
            
            <p className="edit-warning-text">
              اللوحة {editingVehicle.plate}. التعديلات آمنة أوفلاين. إذا كان المالك متصلاً فسيتم طرده وتنتظر 5 ثواني قبل التحديث.
            </p>

            <div className="edit-form-grid">
              <div className="form-group-full">
                <label>الكراج</label>
                <input type="text" value={editForm.garage} onChange={e => setEditForm({...editForm, garage: e.target.value})} className="Echo-input" />
              </div>
              
              <div className="form-group-half">
                <label>الحالة</label>
                <select value={editForm.state} onChange={e => setEditForm({...editForm, state: parseInt(e.target.value)})} className="Echo-select-full">
                  <option value={1}>في الكراج</option>
                  <option value={0}>خارج الكراج</option>
                </select>
              </div>

              <div className="form-group-half">
                <label>الوقود</label>
                <input type="number" value={editForm.fuel} onChange={e => setEditForm({...editForm, fuel: parseInt(e.target.value)})} className="Echo-input text-center" />
              </div>

              <div className="form-group-half">
                <label>المحرك</label>
                <input type="number" value={editForm.engine} onChange={e => setEditForm({...editForm, engine: parseInt(e.target.value)})} className="Echo-input text-center" />
              </div>

              <div className="form-group-half">
                <label>الهيكل</label>
                <input type="number" value={editForm.body} onChange={e => setEditForm({...editForm, body: parseInt(e.target.value)})} className="Echo-input text-center" />
              </div>
            </div>

            <p className="form-note">ملاحظة: سيتم تقييد القيم الرقمية ضمن الحدود الامنه (الوقود 0-100، المحرك/الهيكل 0-1000).</p>

            <div className="form-group-full mt-10">
              <label>السبب (اختياري)</label>
              <textarea placeholder="لماذا؟" value={editForm.reason} onChange={e => setEditForm({...editForm, reason: e.target.value})} className="Echo-textarea"></textarea>
            </div>

            <div className="edit-modal-footer">
              <button className="btn-cancel-dark" onClick={() => setEditingVehicle(null)}>إلغاء</button>
              <button className="btn-save-red" onClick={handleSaveEdit}>حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Vehicle Modal */}
      {transferringVehicle && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-content glass-panel-dark animate-modal-in">
            <div className="edit-modal-header">
              <h2 className="edit-title">نقل المركبة <span className="red-line"></span></h2>
              <button className="btn-close-modal" onClick={() => setTransferringVehicle(null)}><X size={18} /></button>
            </div>
            
            <p className="edit-warning-text">
              نقل ملكية اللوحة {transferringVehicle.plate}. إذا كان المالك متصلاً فسيتم طرده وسيتم النقل قبل تحديث البيانات.
            </p>

            <div className="form-group-full mt-4">
              <label>CitizenID الهدف</label>
              <input 
                type="text" 
                placeholder="CID" 
                value={transferForm.targetCitizenId} 
                onChange={e => setTransferForm({...transferForm, targetCitizenId: e.target.value})} 
                className="Echo-input" 
              />
            </div>

            <div className="form-group-full mt-4">
              <label>السبب (اختياري)</label>
              <textarea 
                placeholder="لماذا؟" 
                value={transferForm.reason} 
                onChange={e => setTransferForm({...transferForm, reason: e.target.value})} 
                className="Echo-textarea"
              ></textarea>
            </div>

            <div className="edit-modal-footer mt-4">
              <button className="btn-cancel-dark" onClick={() => setTransferringVehicle(null)}>إلغاء</button>
              <button className="btn-save-red" onClick={handleTransfer}>Transfer</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plate Modal */}
      {changingPlate && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-content glass-panel-dark animate-modal-in">
            <div className="edit-modal-header">
              <h2 className="edit-title">تغيير اللوحة <span className="red-line"></span></h2>
              <button className="btn-close-modal" onClick={() => setChangingPlate(null)}><X size={18} /></button>
            </div>
            
            <p className="edit-warning-text">
              تغيير اللوحة {changingPlate.plate} ← NEWPLATE. سيتم ترحيل محتويات الحقيبة والمفاتيح قدر الإمكان.
            </p>

            <div className="form-group-full mt-4">
              <label>اللوحة الجديدة</label>
              <input 
                type="text" 
                placeholder="NEWPLATE" 
                value={plateForm.newPlate} 
                onChange={e => setPlateForm({...plateForm, newPlate: e.target.value})} 
                className="Echo-input" 
              />
            </div>

            <div className="form-group-full mt-4">
              <label>السبب (اختياري)</label>
              <textarea 
                placeholder="لماذا تريد تغيير اللوحة؟" 
                value={plateForm.reason} 
                onChange={e => setPlateForm({...plateForm, reason: e.target.value})} 
                className="Echo-textarea"
              ></textarea>
            </div>

            <div className="edit-modal-footer mt-4">
              <button className="btn-cancel-dark" onClick={() => setChangingPlate(null)}>إلغاء</button>
              <button className="btn-save-red" onClick={handleChangePlate}>تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
