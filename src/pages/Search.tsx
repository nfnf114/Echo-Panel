import React, { useState } from 'react';
import { Search as SearchIcon, User, Car, Package, RefreshCw, ExternalLink, X, Info, Settings } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import './Search.css';

import { API_URL } from '../config';

type SearchType = 'citizen' | 'vehicle' | 'item';

interface SearchResult {
  type: SearchType;
  data: any;
}

const AdvancedSearch: React.FC = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('citizen');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setResults([]);

    try {
      if (searchType === 'citizen') {
        const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-players`);
        const data = await res.json();
        const q = query.toLowerCase();
        const found = (data.players || []).filter((p: any) => {
          const name = `${p.charinfo?.firstname || ''} ${p.charinfo?.lastname || ''}`.toLowerCase();
          return (
            name.includes(q) ||
            (p.citizenid && p.citizenid.toLowerCase().includes(q)) ||
            (p.charinfo?.phone && String(p.charinfo.phone).includes(q))
          );
        });
        setResults(found.map((p: any) => ({ type: 'citizen', data: p })));
      } else if (searchType === 'vehicle') {
        const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-vehicles`);
        const data = await res.json();
        const q = query.toLowerCase();
        const found = (data.vehicles || []).filter((v: any) =>
          (v.plate && v.plate.toLowerCase().includes(q)) ||
          (v.vehicle && v.vehicle.toLowerCase().includes(q)) ||
          (v.citizenid && v.citizenid.toLowerCase().includes(q))
        );
        setResults(found.map((v: any) => ({ type: 'vehicle', data: v })));
      } else if (searchType === 'item') {
        const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-inventory`);
        const data = await res.json();
        const q = query.toLowerCase();
        const found = (data.items || []).filter((item: any) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.label && item.label.toLowerCase().includes(q)) ||
          (item.owner && item.owner.toLowerCase().includes(q))
        );
        setResults(found.map((item: any) => ({ type: 'item', data: item })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="search-page animate-fade-in" dir="rtl">

      <div className="investigator-header">
        <div className="investigator-title">
           <Settings size={20} className="text-white" />
           <h2>البحث المتقدم</h2>
        </div>
      </div>

      <div className="investigator-main-card mt-3">
        <div className="experimental-note">
          <Info size={18} className="note-info-icon" />
          <div className="note-content">
            <strong>ملاحظة</strong>
            <p>هذه الميزة تجريبية. قد تستخدم المطابقة الحالية رموز العناصر أو رموز المركبات أو السيريالات.</p>
          </div>
        </div>

        <div className="query-section mt-4">
          <label className="query-label">الاستعلام</label>
          <div className="query-input-row mt-2">
            <div className="query-input-wrapper">
              <SearchIcon size={16} className="query-search-icon" />
              <input 
                type="text" 
                className="query-input" 
                placeholder="ابحث برمز العنصر أو السيريال أو اللوحة..." 
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button className="btn-search-red" onClick={handleSearch} disabled={loading}>
              {loading ? <RefreshCw size={14} className="spin" /> : 'بحث'}
            </button>
          </div>
        </div>

        <div className="search-type-tabs-mini mt-3">
          <button className={`tab-mini ${searchType === 'citizen' ? 'active' : ''}`} onClick={() => setSearchType('citizen')}>
            <User size={13} /> الشخصيات
          </button>
          <button className={`tab-mini ${searchType === 'vehicle' ? 'active' : ''}`} onClick={() => setSearchType('vehicle')}>
            <Car size={13} /> المركبات
          </button>
          <button className={`tab-mini ${searchType === 'item' ? 'active' : ''}`} onClick={() => setSearchType('item')}>
            <Package size={13} /> الحقيبة
          </button>
        </div>
      </div>

      <div className="results-section-container mt-4">
        <div className="results-header-row">
          <h3>النتائج</h3>
        </div>
        <p className="results-desc text-muted text-sm mt-1">نفّذ بحثاً لفحص اللاعبين والمركبات والمخازن</p>

        <div className="results-content-area mt-4">
          {loading ? (
            <div className="results-loading-state"><RefreshCw className="spin" size={24} /> جاري البحث في قواعد البيانات...</div>
          ) : !searched ? (
            <div className="no-search-yet">
               <SearchIcon size={48} className="text-muted opacity-20" />
               <p className="text-muted mt-2">انتظار الاستعلام...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="no-results-state">
              <p className="text-muted">لم يتم العثور على أي نتائج مطابقة لـ «{query}»</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="Echo-table-dark investigator-table">
                <thead>
                  {searchType === 'citizen' && (
                    <tr>
                      <th>اللاعب</th>
                      <th>Citizen ID</th>
                      <th>الوظيفة</th>
                      <th>العصابة</th>
                      <th>البنك</th>
                      <th>الإجراءات</th>
                    </tr>
                  )}
                  {searchType === 'vehicle' && (
                    <tr>
                      <th>اللوحة</th>
                      <th>الموديل</th>
                      <th>المالك</th>
                      <th>الحالة</th>
                      <th>الإجراءات</th>
                    </tr>
                  )}
                  {searchType === 'item' && (
                    <tr>
                      <th>العنصر</th>
                      <th>الكمية</th>
                      <th>الموقع</th>
                      <th>المالك</th>
                      <th>الإجراءات</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={idx} className={r.type === 'citizen' ? 'clickable-row' : ''} onClick={() => r.type === 'citizen' && setSelectedResult(r.data)}>
                      {r.type === 'citizen' && (
                        <>
                          <td>
                            <div className="player-cell">
                              <div className="avatar-mini">{r.data.charinfo?.firstname?.[0]}</div>
                              <div className="player-info">
                                <span className="p-name">{r.data.charinfo?.firstname} {r.data.charinfo?.lastname}</span>
                                <span className="p-sub">{r.data.charinfo?.phone}</span>
                              </div>
                            </div>
                          </td>
                          <td className="font-mono text-xs">{r.data.citizenid}</td>
                          <td>{r.data.job?.label}</td>
                          <td>{r.data.gang?.label}</td>
                          <td className="text-green">${(r.data.money?.bank || 0).toLocaleString()}</td>
                          <td>
                            <button className="btn-view-circle" onClick={(e) => { e.stopPropagation(); navigate(`/server/${serverId}/characters/${r.data.citizenid}`); }}>
                              <ExternalLink size={12} />
                            </button>
                          </td>
                        </>
                      )}
                      {r.type === 'vehicle' && (
                        <>
                          <td className="font-mono font-bold text-white">{r.data.plate}</td>
                          <td>{r.data.vehicle}</td>
                          <td>{r.data.charinfo?.firstname} {r.data.charinfo?.lastname}</td>
                          <td>
                            <span className={`status-pill-mini ${r.data.state === 1 ? 'green' : 'blue'}`}>
                              {r.data.state === 1 ? 'في الكراج' : 'خارج الكراج'}
                            </span>
                          </td>
                          <td>
                            <button className="btn-view-circle" onClick={() => navigate(`/server/${serverId}/vehicles`)}>
                              <ExternalLink size={12} />
                            </button>
                          </td>
                        </>
                      )}
                      {r.type === 'item' && (
                        <>
                          <td>
                             <div className="item-cell">
                                <span className="item-icon"><Package size={14} /></span>
                                <div className="item-info">
                                  <span className="i-name">{r.data.label || r.data.name}</span>
                                  <span className="i-sub font-mono">{r.data.name}</span>
                                </div>
                             </div>
                          </td>
                          <td><span className="amount-badge">x{r.data.amount}</span></td>
                          <td>{r.data.owner_type || 'حقيبة'}</td>
                          <td>{r.data.owner}</td>
                          <td>
                             <button className="btn-view-circle" onClick={() => navigate(`/server/${serverId}/characters/${r.data.citizenid}`)}>
                               <ExternalLink size={12} />
                             </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedResult && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="preview-modal animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="preview-modal-header">
              <button className="close-x-btn" onClick={() => setSelectedResult(null)}><X size={16} /></button>
              <h3 className="text-white">{selectedResult.charinfo?.firstname} {selectedResult.charinfo?.lastname}</h3>
            </div>
            <div className="preview-grid mt-3">
              <div className="preview-item"><span className="pl">CitizenID</span><span className="pv font-mono">{selectedResult.citizenid}</span></div>
              <div className="preview-item"><span className="pl">الهاتف</span><span className="pv">{selectedResult.charinfo?.phone || '—'}</span></div>
              <div className="preview-item"><span className="pl">الوظيفة</span><span className="pv">{selectedResult.job?.label || '—'}</span></div>
              <div className="preview-item"><span className="pl">البنك</span><span className="pv text-green">${(selectedResult.money?.bank || 0).toLocaleString()}</span></div>
            </div>
            <div className="preview-footer mt-4">
              <button className="btn-red-solid" onClick={() => { navigate(`/server/${serverId}/characters/${selectedResult.citizenid}`); setSelectedResult(null); }}>
                 عرض الملف الكامل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
