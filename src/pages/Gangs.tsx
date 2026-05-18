import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, X, Download, Check } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import './Gangs.css';

import { API_URL } from '../config';

const Gangs: React.FC = () => {
  const { serverId } = useParams();
  const [gangs, setGangs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  // Modal State
  const [selectedGang, setSelectedGang] = useState<string | null>(null);
  const [gangMembers, setGangMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [leadersOnly, setLeadersOnly] = useState(false);

  const fetchGangs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-players`);
      const data = await res.json();
      
      // Group players by gang to calculate stats
      const gangMap: Record<string, any> = {};
      if (data.players) {
        data.players.forEach((p: any) => {
          if (!p.gang || p.gang.name === 'none') return;
          const gName = p.gang.name;
          if (!gangMap[gName]) {
            gangMap[gName] = {
              name: gName,
              label: p.gang.label,
              members: 0,
              leaders: 0,
              samples: [],
              allMembers: []
            };
          }
          gangMap[gName].members++;
          if (p.gang.isboss) gangMap[gName].leaders++;
          
          const char = p.charinfo || {};
          const memberData = {
            name: `${char.firstname || ''} ${char.lastname || ''}`.trim() || p.name,
            cid: p.citizenid,
            grade: p.gang.grade?.name || 'Unknown',
            isboss: p.gang.isboss
          };
          
          gangMap[gName].allMembers.push(memberData);
          if (gangMap[gName].samples.length < 2) {
            gangMap[gName].samples.push(`${p.citizenid} - ${memberData.grade}`);
          }
        });
      }
      setGangs(Object.values(gangMap));
      
      const now = new Date();
      setLastUpdate(`${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGangs();
  }, [serverId]);

  const openMembersModal = (gang: any) => {
    setSelectedGang(gang.name);
    setGangMembers(gang.allMembers);
    setLeadersOnly(false);
  };

  const filteredMembers = leadersOnly ? gangMembers.filter(m => m.isboss) : gangMembers;

  return (
    <div className="gangs-page-new animate-fade-in">
      {/* Main Container matching the screenshot */}
      <div className="gangs-main-container">
        {/* Header Title Area */}
        <div className="gangs-header-title">
          <div className="header-tabs">
            <span className="tab active">البيانات</span>
          </div>
          <div className="header-main-text">
            <h2>العصابات <Users size={20} /></h2>
            <p>افتح الأعضاء لمراجعة قائمة أعضاء العصابة ويمكنك عرض القادة فقط عند الحاجة</p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="gangs-top-actions">
          <div className="actions-right">
            <span className="last-update-text">آخر تحديث: {lastUpdate}</span>
            <button className="btn-export">تصدير CSV</button>
            <button className="btn-export">تصدير JSON</button>
          </div>
          <div className="actions-left">
            <button className="btn-refresh-red" onClick={fetchGangs}>
              تحديث
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="gangs-table-wrapper">
          {loading ? (
            <div className="loading-full"><RefreshCw className="spin" /> جاري جلب البيانات...</div>
          ) : (
            <table className="Echo-table" dir="rtl">
              <thead>
                <tr>
                  <th>العصابة</th>
                  <th>الأعضاء</th>
                  <th>القادة</th>
                  <th>عينات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {gangs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4">لا توجد عصابات حالياً</td></tr>
                ) : (
                  gangs.map((g, idx) => (
                    <tr key={idx}>
                      <td>{g.name}</td>
                      <td>{g.members}</td>
                      <td>{g.leaders}</td>
                      <td>
                        <span className="sample-badge">{g.samples[0] || 'لا يوجد'}</span>
                      </td>
                      <td>
                        <button className="btn-table-action" onClick={() => openMembersModal(g)}>
                          الأعضاء
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Members Modal */}
      {selectedGang && (
        <div className="members-modal-overlay">
          <div className="members-modal-content">
            
            <div className="modal-header-top">
              <button className="btn-close-modal" onClick={() => setSelectedGang(null)}>
                <X size={20} />
              </button>
              <h2 className="modal-title-text">
                الأعضاء | <span className="highlight-red">{selectedGang}</span>
              </h2>
            </div>

            <div className="modal-sub-actions">
              <div className="actions-export">
                <button className="btn-export">تصدير JSON</button>
                <button className="btn-export">تصدير CSV</button>
              </div>
              <div className="actions-filter">
                <label className="checkbox-container">
                  القادة فقط
                  <input type="checkbox" checked={leadersOnly} onChange={(e) => setLeadersOnly(e.target.checked)} />
                  <span className="checkmark"></span>
                </label>
              </div>
            </div>

            <div className="members-table-container">
              <table className="Echo-table" dir="rtl">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>CID او ID</th>
                    <th>الرتبة</th>
                    <th>قائد</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-4">لا يوجد أعضاء</td></tr>
                  ) : (
                    filteredMembers.map((m, idx) => (
                      <tr key={idx}>
                        <td>{m.name}</td>
                        <td>{m.cid}</td>
                        <td>{m.grade}</td>
                        <td>{m.isboss ? <Check size={14} className="text-green" /> : ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="btn-load-more">تحميل المزيد</button>
              <span className="total-text">الإجمالي {filteredMembers.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gangs;
