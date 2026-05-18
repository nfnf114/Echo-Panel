import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, Calendar, User, ArrowLeft, ArrowRight, Shield } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import './Logs.css';

import { API_URL } from '../config';

const Logs: React.FC = () => {
  const { serverId } = useParams();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  useEffect(() => {
    fetchLogs();
  }, [serverId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/logs`);
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.admin_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.action_type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`logs-page ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="logs-header-premium">
         <div className="header-top">
            <button className="btn-refresh-logs" onClick={fetchLogs}>
               <RefreshCw size={16} className={loading ? 'spin' : ''} /> {lang === 'ar' ? 'تحديث السجلات' : 'Refresh Logs'}
            </button>
            <h2>{lang === 'ar' ? 'سجلات الإدارة' : 'Admin Logs'}</h2>
         </div>

         <div className="filters-bar mt-4">
            <div className="filters-row">
               <div className="filter-col" style={{flex: 1}}>
                 <label>{lang === 'ar' ? 'البحث التفصيلي' : 'Detailed Search'}</label>
                 <div className="search-wrapper">
                    <Search size={16} />
                    <input 
                      type="text" 
                      placeholder={lang === 'ar' ? 'ابحث عن إداري، آيدي، أو أكشن...' : 'Search for admin, target ID, or action...'} 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
               </div>
               
               <div className="filter-col">
                 <label>{lang === 'ar' ? 'النوع' : 'Type'}</label>
                 <select className="premium-select">
                    <option>{lang === 'ar' ? 'الكل' : 'All'}</option>
                    <option value="revive">{lang === 'ar' ? 'إنعاش' : 'Revive'}</option>
                    <option value="additem">{lang === 'ar' ? 'إعطاء غرض' : 'Give Item'}</option>
                    <option value="setjob">{lang === 'ar' ? 'تغيير وظيفة' : 'Set Job'}</option>
                 </select>
               </div>
               
               <div className="filter-col" style={{display: 'flex', alignItems: 'flex-end', paddingBottom: '2px'}}>
                 <button className="btn-apply-filters">{lang === 'ar' ? 'تطبيق' : 'Apply'}</button>
               </div>
            </div>
         </div>
      </div>

      <div className="logs-list-container mt-4">
         <div className="section-title-row">
            <h3>{lang === 'ar' ? 'أحدث السجلات' : 'Latest Logs'}</h3>
            <span className="results-count">{filteredLogs.length} {lang === 'ar' ? 'نتيجة' : 'Results'}</span>
         </div>

         <div className="audit-cards-list mt-3">
            {filteredLogs.length === 0 ? (
               <div className="audit-card" style={{justifyContent: 'center', color: '#888'}}>
                  {loading ? (lang === 'ar' ? 'جاري التحميل...' : 'Loading...') : (lang === 'ar' ? 'لا توجد سجلات مطابقة.' : 'No matching logs found.')}
               </div>
            ) : filteredLogs.map((log, idx) => (
              <div key={idx} className="audit-card">
                 <div className="card-main">
                    <div className="admin-profile">
                       <Shield size={24} color="#8b0000" />
                    </div>
                    <div className="action-info">
                       <div className="info-top">
                          <span className="admin-name">{log.admin_id}</span>
                          <span className="action-sep">—</span>
                          <span className="action-name">{log.action_type}</span>
                          {log.target_id && <span className="target-badge">Target: {log.target_id}</span>}
                       </div>
                       <div className="info-bottom">
                          <span className="reason-label">{lang === 'ar' ? 'التفاصيل:' : 'Details:'}</span>
                          <span className="reason-text">{log.details}</span>
                       </div>
                    </div>
                 </div>
                 <div className="card-right">
                    <div className="timestamp">
                       <Clock size={14} />
                       <span>{new Date(log.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}</span>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const Clock = ({ size, className }: { size?: number, className?: string }) => (
  <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default Logs;
