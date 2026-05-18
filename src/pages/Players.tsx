import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, MessageSquare, UserMinus, Ban, X, ExternalLink, RefreshCw, Clock } from 'lucide-react';
import { fetchWithAuth, invalidateServerCache } from '../utils/api';
import './Players.css';

import { API_URL } from '../config';

const Players: React.FC = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState('');
  
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState<any>(null);
  const [individualMsg, setIndividualMsg] = useState('');

  const promptIndividualMessage = (p: any) => {
    setTargetPlayer(p);
    setIndividualMsg('');
    setShowIndividualModal(true);
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}`);
      const data = await res.json();
      if (data.server && data.server.players_data) {
        const playerData = typeof data.server.players_data === 'string' 
          ? JSON.parse(data.server.players_data) 
          : data.server.players_data;
        setPlayers(playerData);
      }
    } catch (e) {
      console.error('Failed to fetch players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 5000);
    return () => clearInterval(interval);
  }, [serverId]);

  const sendGlobalNotify = async () => {
    if (!notifyMsg.trim()) return;
    try {
      if (serverId) invalidateServerCache(serverId);
      await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action_type: 'notify', 
          data: { message: notifyMsg, isPublic: true } 
        })
      });
      setShowNotifyModal(false);
      setNotifyMsg('');
      alert('تم إرسال الإشعار بنجاح');
    } catch (e) {
      alert('فشل إرسال الإشعار');
    }
  };

  const sendIndividualMessage = async () => {
    if (!individualMsg.trim() || !targetPlayer) return;
    try {
      if (serverId) invalidateServerCache(serverId);
      await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action_type: 'message', 
          target_id: targetPlayer.citizenid,
          data: { message: individualMsg } 
        })
      });
      setShowIndividualModal(false);
      setIndividualMsg('');
      alert('تم إرسال الرسالة بنجاح');
    } catch (e) {
      alert('فشل إرسال الرسالة');
    }
  };

  const filteredPlayers = players.filter(p => {
    const name = `${p.firstname || ''} ${p.lastname || ''}`.toLowerCase();
    const s = searchTerm.toLowerCase();
    return name.includes(s) || (p.citizenid && p.citizenid.toLowerCase().includes(s)) || (p.source && p.source.toString().includes(s));
  });

  return (
    <div className="players-page animate-fade-in" dir="rtl">
      <div className="players-container-main">
        
        {/* Header Section */}
        <div className="players-header-section glass-panel">
           <div className="players-buttons-left">
              <button className="btn-red-notify" onClick={() => setShowNotifyModal(true)}>
                 إرسال إشعار عام
              </button>
              <button className="btn-dark-screen" onClick={fetchPlayers}>
                 <RefreshCw size={14} className={loading ? 'spin' : ''} /> تحديث القائمة
              </button>
           </div>
           
           <div className="flex-col-end">
              <h2 className="title-text">اللاعبين المتصلين</h2>
              <div className="title-badges">
                 <div className="badge-green">
                    <span className="dot"></span>
                    <b>{players.length}</b> متصل الآن
                 </div>
              </div>
           </div>
        </div>

        {/* Search Section */}
        <div className="players-search-section glass-panel">
           <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="ابحث باسم اللاعب، CID، أو الـ ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        {/* Players List */}
        <div className="players-list-wrapper">
          {loading && players.length === 0 ? (
            <div className="loading-state glass-panel">
               <RefreshCw className="spin" size={24} /> جاري تحميل اللاعبين...
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="no-players-card glass-panel">
               لا يوجد لاعبين متصلين حالياً
            </div>
          ) : (
            filteredPlayers.map((p, idx) => {
              const char = p.charinfo || {};
              const charName = `${char.firstname || p.firstname || ''} ${char.lastname || p.lastname || ''}`.trim();
              
              // Improved initials logic for Arabic/Latin
              const names = charName.split(' ').filter(n => n.length > 0);
              const initials = names.length >= 2 
                ? (names[0].charAt(0) + names[names.length - 1].charAt(0)) 
                : (charName.charAt(0) || 'P');

              const fallbackSrc = `https://ui-avatars.com/api/?background=4a1c1c&color=fff&bold=true&name=${encodeURIComponent(initials)}&size=128`;
              const profilePic = p.profilepic || char.profilepic;
              const faceFallback = `${API_URL}/uploads/avatars/${p.citizenid}_face.png`;
              const imgSrc = (profilePic && profilePic !== 'none' && profilePic.trim() !== '') 
                ? profilePic 
                : faceFallback;

              return (
                <div key={idx} className="player-row-dark glass-panel" onClick={() => p.citizenid && navigate(`/server/${serverId}/characters/${p.citizenid}`)}>
                  
                  <div className="player-actions-left" onClick={e => e.stopPropagation()}>
                    <button className="icon-btn-danger" title="حظر" onClick={() => navigate(`/server/${serverId}/bans?target=${p.citizenid}`)}>
                      <Ban size={16} />
                    </button>
                    <button className="icon-btn-primary" title="إرسال رسالة" onClick={() => promptIndividualMessage(p)}>
                      <MessageSquare size={16} />
                    </button>
                    <button className="icon-btn-view" title="عرض التفاصيل">
                      <ExternalLink size={16} />
                    </button>
                  </div>

                  <div className="player-stats-mid">
                     <div className="stat-item">
                        <Clock size={14} className="text-muted" />
                        <span className="playtime-text"><b>{(p.playTime || p.playtime || 0) + (p.session_minutes || 0)}</b> دقيقة</span>
                     </div>
                  </div>

                  <div className="player-info-right">
                    <div className="player-details-col">
                      <span className="player-name-bold">{charName}</span>
                      <span className="player-ids-sub">ID: {p.source} | CID: {p.citizenid}</span>
                    </div>
                     <div className="player-avatar-box">
                       <img 
                         src={imgSrc} 
                         alt="avatar"
                         onError={(e: any) => { 
                           e.target.onerror = null; 
                           const screenshotUrl = `${API_URL}/uploads/screenshots/${p.citizenid}.webp`;
                           e.target.src = screenshotUrl;
                           // Final fallback to UI Avatars
                           e.target.onerror = (e2: any) => {
                              e2.target.onerror = null;
                              e2.target.src = fallbackSrc;
                           };
                         }}
                       />
                       <div className="status-dot-green"></div>
                     </div>
                  </div>
                  
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Global Notify Modal */}
      {showNotifyModal && (
        <div className="modal-overlay" onClick={() => setShowNotifyModal(false)}>
          <div className="glass-panel notify-modal-box animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header-flex">
              <h3 className="modal-title-red-line">
                 إرسال إشعار عام <span className="red-tag">GLOBAL</span>
              </h3>
              <button className="close-btn" onClick={() => setShowNotifyModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">سيتم إرسال هذا الإشعار لجميع اللاعبين المتصلين بالسيرفر حالياً.</p>
              <textarea 
                placeholder="اكتب نص الإشعار هنا..." 
                value={notifyMsg}
                onChange={(e) => setNotifyMsg(e.target.value)}
                className="premium-textarea"
              ></textarea>
            </div>
            <div className="modal-footer-flex">
              <button className="btn-confirm-red" onClick={sendGlobalNotify}>إرسال الإشعار</button>
              <button className="btn-cancel-dark" onClick={() => setShowNotifyModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Message Modal */}
      {showIndividualModal && (
        <div className="modal-overlay" onClick={() => setShowIndividualModal(false)}>
          <div className="glass-panel notify-modal-box animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header-flex">
              <h3 className="modal-title-red-line">
                 رسالة خاصة <span className="red-tag">DIRECT</span>
              </h3>
              <button className="close-btn" onClick={() => setShowIndividualModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">إرسال رسالة مباشرة إلى اللاعب {targetPlayer?.firstname}.</p>
              <textarea 
                placeholder="اكتب رسالتك الخاصة هنا..." 
                value={individualMsg}
                onChange={(e) => setIndividualMsg(e.target.value)}
                className="premium-textarea"
              ></textarea>
            </div>
            <div className="modal-footer-flex">
              <button className="btn-confirm-red" onClick={sendIndividualMessage}>إرسال الرسالة</button>
              <button className="btn-cancel-dark" onClick={() => setShowIndividualModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Players;
