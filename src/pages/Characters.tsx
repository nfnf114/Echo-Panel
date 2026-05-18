import React, { useState, useEffect, useCallback } from 'react';
import { Search, ExternalLink, RefreshCw, AlertCircle, WifiOff, Database, Users } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth, invalidateServerCache } from '../utils/api';
import './Characters.css';

import { API_URL } from '../config';

interface CharacterData {
  citizenid: string;
  name: string;
  charinfo: {
    firstname?: string;
    lastname?: string;
    profilepic?: string;
    [key: string]: any;
  };
  job: {
    name?: string;
    label?: string;
    grade?: { name?: string; level?: number };
    [key: string]: any;
  };
  gang: {
    name?: string;
    label?: string;
    grade?: { name?: string; level?: number };
    isboss?: boolean;
    [key: string]: any;
  };
  money: {
    cash?: number;
    bank?: number;
    crypto?: number;
    [key: string]: any;
  };
  metadata?: {
    phone?: string;
    [key: string]: any;
  };
  is_online?: boolean;
}

const Characters: React.FC = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [sortFilter, setSortFilter] = useState('الافتراضي');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchData = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    
    try {
      const [playersRes, serverRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/server/${serverId}/game-players`),
        fetchWithAuth(`${API_URL}/api/server/${serverId}`)
      ]);

      // Handle players response
      if (!playersRes.ok && playersRes.status !== 200) {
        const errData = await playersRes.json().catch(() => ({}));
        throw new Error(errData.error || `فشل في جلب بيانات الشخصيات (HTTP ${playersRes.status})`);
      }
      const data = await playersRes.json();

      // Check for warnings from backend (e.g. no db_connection)
      if (data.warning) {
        setWarning(data.warning);
        setCharacters([]);
        return;
      }

      // Handle server response for online status
      let onlineCids = new Set<string>();
      try {
        const serverData = await serverRes.json();
        const onlinePlayers = typeof serverData.server?.players_data === 'string' 
          ? JSON.parse(serverData.server.players_data) 
          : serverData.server?.players_data || [];
        onlineCids = new Set(onlinePlayers.map((p: any) => p.citizenid).filter(Boolean));
      } catch (e) {
        // Non-critical: online status will just show all as offline
        console.warn('[Characters] Could not parse online players:', e);
      }

      const updatedPlayers = (data.players || []).map((p: any) => ({
        ...p,
        charinfo: p.charinfo || {},
        job: p.job || {},
        gang: p.gang || {},
        money: p.money || {},
        metadata: p.metadata || {},
        is_online: onlineCids.has(p.citizenid)
      }));

      setCharacters(updatedPlayers);
      const now = new Date();
      setLastUpdated(`${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`);
    } catch (e: any) {
      console.error('[Characters] Fetch error:', e);
      setError(e.message || 'حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = () => {
    if (serverId) {
      invalidateServerCache(serverId);
    }
    fetchData();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('الكل');
    setSortFilter('الافتراضي');
    setCurrentPage(1);
  };

  // Filter and sort
  const filteredCharacters = characters
    .filter(c => {
      const charName = `${c.charinfo?.firstname || ''} ${c.charinfo?.lastname || ''}`;
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = 
        charName.toLowerCase().includes(searchLower) ||
        (c.citizenid && c.citizenid.toLowerCase().includes(searchLower)) ||
        (c.name && c.name.toLowerCase().includes(searchLower));
        
      const isOnline = c.is_online || false;
      const matchesStatus = statusFilter === 'الكل' ? true 
                          : statusFilter === 'متصل' ? isOnline 
                          : !isOnline;
                          
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortFilter === 'الفلوس') {
        const totalA = (a.money?.cash || 0) + (a.money?.bank || 0);
        const totalB = (b.money?.cash || 0) + (b.money?.bank || 0);
        return totalB - totalA;
      }
      return 0;
    });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCharacters.length / pageSize));
  const paginatedCharacters = filteredCharacters.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="characters-page-table animate-fade-in">
      <div className="characters-main-container">
        
        {/* Header Title */}
        <div className="characters-header-title">
          <div className="header-title-right">
            <h2 className="title-text">الشخصيات</h2>
            {!loading && !error && (
              <span className="title-count">{characters.length} شخصية</span>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="characters-error-box">
            <div className="error-content">
              <AlertCircle size={20} className="error-icon" />
              <div className="error-text">
                <h4>خطأ في جلب البيانات</h4>
                <p>{error}</p>
              </div>
            </div>
            <button className="btn-retry" onClick={handleRetry}>
              <RefreshCw size={14} /> إعادة المحاولة
            </button>
          </div>
        )}

        {/* Warning State (no db connection, etc.) */}
        {warning && !error && (
          <div className="characters-warning-box">
            <div className="warning-content">
              <Database size={20} className="warning-icon" />
              <div className="warning-text">
                <h4>قاعدة البيانات غير متصلة</h4>
                <p>{warning}</p>
              </div>
            </div>
            <button className="btn-retry" onClick={handleRetry}>
              <RefreshCw size={14} /> إعادة المحاولة
            </button>
          </div>
        )}

        {/* Filters Area */}
        <div className="characters-filters-row">
          <div className="filter-group-right">
            <div className="filter-col">
              <label className="filter-label">الحالة</label>
              <select className="Echo-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                <option value="الكل">الكل</option>
                <option value="متصل">متصل</option>
                <option value="غير متصل">غير متصل</option>
              </select>
            </div>
            
            <div className="filter-col">
              <label className="filter-label">الفرز حسب</label>
              <select className="Echo-select" value={sortFilter} onChange={e => { setSortFilter(e.target.value); setCurrentPage(1); }}>
                <option value="الافتراضي">الافتراضي</option>
                <option value="الفلوس">الفلوس (الأعلى)</option>
              </select>
            </div>

            <div className="filter-col align-bottom">
              <button className="btn-clear" onClick={handleClearFilters}>مسح</button>
            </div>
            <div className="filter-col align-bottom">
              <button className="btn-search-refresh" onClick={handleRetry} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> تحديث
              </button>
            </div>
          </div>
          
          <div className="search-group-left align-bottom">
            <div className="filter-col w-full">
              <label className="filter-label text-right">بحث</label>
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="...name, citizenid, license, discord" 
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="characters-table-wrapper">
          {loading ? (
            <div className="loading-full">
              <RefreshCw className="spin" size={24} /> 
              <span>جاري جلب البيانات...</span>
            </div>
          ) : error ? (
            <div className="empty-state">
              <WifiOff size={48} className="empty-icon" />
              <h3>لا يمكن الاتصال بالخادم</h3>
              <p>تأكد من اتصال الإنترنت وحاول مرة أخرى</p>
              <button className="btn-retry-large" onClick={handleRetry}>
                <RefreshCw size={16} /> إعادة المحاولة
              </button>
            </div>
          ) : characters.length === 0 && warning ? (
            <div className="empty-state">
              <Database size={48} className="empty-icon" />
              <h3>لا توجد بيانات</h3>
              <p>{warning}</p>
              <button className="btn-retry-large" onClick={handleRetry}>
                <RefreshCw size={16} /> إعادة المحاولة
              </button>
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="empty-state">
              <Users size={48} className="empty-icon" />
              <h3>لا يوجد شخصيات</h3>
              <p>
                {characters.length === 0 
                  ? 'لم يتم العثور على أي شخصيات في قاعدة البيانات. تأكد من مزامنة بيانات السيرفر.'
                  : 'لا توجد نتائج مطابقة لمعايير البحث. جرب تغيير الفلاتر.'
                }
              </p>
              {characters.length > 0 && (
                <button className="btn-retry-large" onClick={handleClearFilters}>
                  مسح الفلاتر
                </button>
              )}
            </div>
          ) : (
            <table className="Echo-table-dark" dir="rtl">
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>الشخصية</th>
                  <th>CITIZENID</th>
                  <th>الحالة</th>
                  <th>نقد</th>
                  <th>البنك</th>
                  <th>الوظيفة</th>
                  <th>العصابة</th>
                  <th>إدارة</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCharacters.map((c, idx) => {
                  const charName = `${c.charinfo?.firstname || ''} ${c.charinfo?.lastname || ''}`;
                  const jobLabel = c.job?.label || 'مواطن';
                  const jobGrade = c.job?.grade?.name || 'عاطل';
                  const gangLabel = c.gang?.label || 'لا يوجد';
                  const gangGrade = c.gang?.grade?.name || '';
                  const isOnline = c.is_online || false;
                  
                  // Character image resolution chain:
                  // 1. profilepic from charinfo (stored in DB by FiveM script)
                  // 2. Face portrait uploaded by Echo_sync
                  // 3. Screenshot fallback
                  // 4. Discord avatar or generic placeholder
                  const profilePic = c.charinfo?.profilepic;
                  const faceFallback = `${API_URL}/uploads/avatars/${c.citizenid}_face.png`;
                  const screenshotFallback = `${API_URL}/uploads/screenshots/${c.citizenid}.webp`;
                  const placeholderFallback = `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(charName)}`;

                  // Primary: profilepic from DB, Fallback: face portrait
                  const imgSrc = (profilePic && profilePic !== 'none' && profilePic.trim() !== '') 
                    ? profilePic 
                    : faceFallback;

                  return (
                    <tr key={c.citizenid || idx} className={isOnline ? 'row-online' : ''}>
                      <td>
                        <div className="char-portrait-wrapper">
                          <img 
                            src={imgSrc} 
                            alt={charName}
                            className="char-portrait-img"
                            loading="lazy"
                            onError={(e: any) => {
                              e.target.onerror = null;
                              if (e.target.src !== screenshotFallback) {
                                e.target.src = screenshotFallback;
                                e.target.onerror = (e2: any) => {
                                   e2.target.onerror = null;
                                   e2.target.src = placeholderFallback;
                                };
                              } else {
                                e.target.src = placeholderFallback;
                              }
                            }}
                          />
                          <span className={`char-portrait-status ${isOnline ? 'online' : 'offline'}`}></span>
                        </div>
                      </td>
                      <td>
                        <div className="flex-col-data">
                          <span className="text-white font-bold">{charName || 'غير معروف'}</span>
                          <span className="text-muted text-xs">{c.name || ''}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex-col-data">
                          <span className="text-muted text-xs">ID</span>
                          <span className="text-white font-bold font-mono">{c.citizenid}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${isOnline ? 'pill-green' : 'pill-red'}`}>
                          {isOnline ? 'متصل' : 'غير متصل'}
                        </span>
                      </td>
                      <td className="text-green">${(c.money?.cash || 0).toLocaleString('en-US')}</td>
                      <td className="text-blue">${(c.money?.bank || 0).toLocaleString('en-US')}</td>
                      <td>
                        <div className="flex-col-data">
                          <span className="text-white font-bold">{jobLabel}</span>
                          <span className="text-muted text-xs">{jobGrade}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex-col-data">
                          <span className="text-white">{gangLabel}</span>
                          {gangGrade && <span className="text-muted text-xs">{gangGrade}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons-group">
                          <button className="btn-action-icon gray-bg" title="عرض التفاصيل" onClick={() => navigate(`/server/${serverId}/characters/${c.citizenid}`)}>
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!error && characters.length > 0 && (
          <div className="pagination-footer">
            <div className="pagination-controls">
              <button className="btn-page" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>التالي</button>
              <span className="page-text">{currentPage} / {totalPages}</span>
              <button className="btn-page" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>السابق</button>
            </div>
            <div className="total-displayed">
              عرض {paginatedCharacters.length} من {filteredCharacters.length}
              {lastUpdated && <span className="last-updated"> • آخر تحديث: {lastUpdated}</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Characters;
