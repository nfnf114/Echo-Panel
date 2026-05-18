import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, ShieldAlert, Trash2, RefreshCw, X, AlertCircle,
  ChevronDown, ChevronUp, Shield, User, Eye, Package, Info,
  MapPin, Briefcase, Crosshair, Zap, Archive, AlertTriangle,
  WifiOff, Fingerprint, Box, Users, Layers
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';
import { useNotification } from '../context/NotificationContext';
import './Dupes.css';

import { API_URL } from '../config';

interface Owner {
  name: string;
  citizenid: string;
  type: string;
  location: string;
  job: string;
  avatar: string | null;
}

interface DupeItem {
  serial: string;
  count: number;
  item: string;
  label: string;
  isDuplicate?: boolean;
  owners: Owner[];
}

const Dupes: React.FC = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [allData, setAllData] = useState<DupeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyDupes, setShowOnlyDupes] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [deletingOwner, setDeletingOwner] = useState<string | null>(null);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScanned(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/duplicates`);
      const data = await res.json();
      if (res.ok) {
        setAllData(data.all || data.duplicates || []);
      } else {
        setError(data.error || 'فشل الاتصال بالسيرفر');
        showNotification(data.error || 'فشل الاتصال بالسيرفر', 'error');
      }
    } catch (e) {
      setError('فشل الاتصال بالسيرفر');
      showNotification('فشل الاتصال بالسيرفر', 'error');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  // Client-side filtering
  const duplicates = showOnlyDupes
    ? allData.filter(d => d.count > 1)
    : allData;

  const handleDeleteItem = async (owner: Owner, serial: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف العنصر ذو السيريال ${serial} من ${owner.name}؟\nهذا الإجراء لا يمكن التراجع عنه!`)) return;
    setDeletingOwner(`${serial}-${owner.citizenid}`);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/duplicates/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, ownerId: owner.citizenid, type: owner.type }),
      });
      if (res.ok) {
        showNotification('تم حذف العنصر بنجاح', 'success');
        // Refresh data
        fetchDuplicates();
      } else {
        const data = await res.json();
        showNotification(data.error || 'فشل الحذف', 'error');
      }
    } catch (e) {
      showNotification('فشل الاتصال أثناء الحذف', 'error');
    } finally {
      setDeletingOwner(null);
    }
  };

  const filteredDuplicates = duplicates.filter(d => {
    const matchesSearch =
      d.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.owners.some(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const totalDupes = allData.filter(d => d.count > 1).length;
  const totalOwners = new Set(allData.flatMap(d => d.owners.map(o => o.citizenid))).size;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Player': return <User size={12} />;
      case 'Stash': return <Archive size={12} />;
      case 'Trunk': return <Package size={12} />;
      case 'Glovebox': return <Package size={12} />;
      case 'OxInventory': return <Layers size={12} />;
      default: return <Package size={12} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'Player': return 'لاعب';
      case 'Stash': return 'مخزن';
      case 'Trunk': return 'شنطة سيارة';
      case 'Glovebox': return 'درج سيارة';
      case 'OxInventory': return 'Ox مخزن';
      default: return type;
    }
  };

  const getTypeClass = (type: string) => {
    switch (type) {
      case 'Player': return 'player';
      case 'Stash': return 'stash';
      case 'Trunk': return 'trunk';
      case 'Glovebox': return 'glovebox';
      case 'OxInventory': return 'ox';
      default: return 'stash';
    }
  };

  return (
    <div className="dupes-page animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="dupes-top-header">
        <div className="header-titles">
          <div className="title-with-icon">
            <Fingerprint size={32} className="title-icon" />
            <div>
              <h2>فحص التدبيل</h2>
              <p className="subtitle-lux">مسح شامل لجميع العناصر المسلسلة في السيرفر</p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <div className="search-bar-lux">
            <Search size={16} />
            <input
              placeholder="بحث باسم الغرض، السيريال، أو اسم اللاعب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            className={`btn-lux-filter ${showOnlyDupes ? 'active' : ''}`}
            onClick={() => setShowOnlyDupes(!showOnlyDupes)}
          >
            <ShieldAlert size={16} />
            <span>التدبيلات فقط</span>
          </button>

          <button className="btn-lux-primary" onClick={fetchDuplicates} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>إعادة الفحص</span>
          </button>
        </div>
      </div>

      {/* Security Note */}
      <div className="dupes-note-box">
        <div className="note-icon-wrap"><AlertTriangle size={18} /></div>
        <div className="note-content">
          <h4>تنبيه أمني</h4>
          <p>تقوم هذه الصفحة بمسح جميع حقائب اللاعبين والمخازن في السيرفر والبحث عن العناصر التي تحمل نفس الرقم التسلسلي (Serial). تكرار الرقم التسلسلي يشير غالباً إلى عملية "تدبيل" غير قانونية.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="dupes-stats-grid">
        <div className="dupes-stat-card">
          <div className="icon-wrap red"><Fingerprint size={24} /></div>
          <div className="info">
            <span className="label">عناصر مدبّلة</span>
            <span className="value">{totalDupes}</span>
          </div>
          {totalDupes > 0 && <div className="danger-glow" />}
        </div>
        <div className="dupes-stat-card">
          <div className="icon-wrap blue"><Package size={24} /></div>
          <div className="info">
            <span className="label">إجمالي العناصر الممسوحة</span>
            <span className="value">{duplicates.length}</span>
          </div>
        </div>
        <div className="dupes-stat-card">
          <div className="icon-wrap green"><Users size={24} /></div>
          <div className="info">
            <span className="label">أشخاص متورطون</span>
            <span className="value">{totalOwners}</span>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="dupes-error-box">
          <div className="error-content">
            <WifiOff size={24} />
            <div>
              <h3>فشل الاتصال بالسيرفر</h3>
              <p>{error}</p>
            </div>
          </div>
          <button className="btn-lux-primary" onClick={fetchDuplicates}>
            <RefreshCw size={16} /> إعادة المحاولة
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="dupes-loading-box">
          <div className="loading-spinner-wrap">
            <RefreshCw size={40} className="animate-spin" />
          </div>
          <h3>جاري فحص جميع الحقائب والمخازن...</h3>
          <p>يتم مسح حقائب اللاعبين، المخازن، شنط السيارات، ومخازن Ox</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && scanned && (
        <div className="dupes-results-area">
          {filteredDuplicates.length === 0 ? (
            <div className="dupes-empty-state">
              <div className="empty-icon-wrap">
                <Shield size={48} />
              </div>
              <h3>
                {duplicates.length === 0
                  ? 'لم يتم العثور على عناصر مسلسلة'
                  : 'لا توجد نتائج مطابقة للبحث'}
              </h3>
              <p>
                {duplicates.length === 0
                  ? 'لا توجد عناصر تحمل أرقام تسلسلية في السيرفر حالياً. تأكد من اتصال قاعدة البيانات وحاول مرة أخرى.'
                  : 'جرّب تغيير معايير البحث أو إزالة فلتر "التدبيلات فقط"'}
              </p>
              {duplicates.length === 0 && (
                <button className="btn-lux-primary" onClick={fetchDuplicates}>
                  <RefreshCw size={16} /> إعادة الفحص
                </button>
              )}
            </div>
          ) : (
            <div className="dupes-list">
              {filteredDuplicates.map((d, idx) => {
                const isExpanded = expandedItem === d.serial;
                const isDupe = d.count > 1;
                return (
                  <div
                    key={idx}
                    className={`dupe-item-card ${isDupe ? 'is-duplicate' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                  >
                    {/* Main Row */}
                    <div className="dupe-item-main" onClick={() => setExpandedItem(isExpanded ? null : d.serial)}>
                      <div className="dupe-item-icon">
                        <img
                          src={`${API_URL}/uploads/items/${d.item}.png`}
                          alt=""
                          onError={(e: any) => {
                            e.target.onerror = null;
                            e.target.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png';
                          }}
                        />
                        {isDupe && <div className="dupe-badge-pulse" />}
                      </div>

                      <div className="dupe-item-info">
                        <div className="dupe-item-name-row">
                          <span className="dupe-item-label">{d.label}</span>
                          <span className="dupe-item-internal">{d.item}</span>
                        </div>
                        <div className="dupe-serial-row">
                          <span className="dupe-serial-pill">
                            <Fingerprint size={12} />
                            {d.serial}
                          </span>
                          <span className={`dupe-count-badge ${isDupe ? 'danger' : 'safe'}`}>
                            {d.count} نسخة
                          </span>
                        </div>
                      </div>

                      <div className="dupe-item-owners-preview">
                        {d.owners.slice(0, 3).map((o, i) => (
                          <span key={i} className={`owner-mini-tag ${getTypeClass(o.type)}`}>
                            {getTypeIcon(o.type)}
                            {o.type === 'Player' ? o.name : getTypeLabel(o.type)}
                          </span>
                        ))}
                        {d.owners.length > 3 && (
                          <span className="owner-more-tag">+{d.owners.length - 3}</span>
                        )}
                      </div>

                      <div className="dupe-expand-btn">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="dupe-item-details animate-slide-in">
                        <div className="details-section-title">
                          <Users size={14} />
                          <span>تفاصيل الملاك والمواقع ({d.owners.length})</span>
                        </div>
                        <div className="dupe-owners-list">
                          {d.owners.map((o, oi) => (
                            <div key={oi} className="dupe-owner-card">
                              <div className="owner-avatar">
                                {(() => {
                                  const faceFallback = `${API_URL}/uploads/avatars/${o.citizenid}_face.png`;
                                  const finalImg = (o.avatar && o.avatar !== 'none' && o.avatar !== '') ? o.avatar : faceFallback;
                                  return (
                                    <img
                                      src={finalImg}
                                      alt=""
                                      onError={(e: any) => {
                                        e.target.onerror = null;
                                        const screenshotUrl = `${API_URL}/uploads/screenshots/${o.citizenid}.webp`;
                                        e.target.src = screenshotUrl;
                                        e.target.onerror = (e2: any) => {
                                          e2.target.onerror = null;
                                          e2.target.style.display = 'none';
                                        };
                                      }}
                                    />
                                  );
                                })()}
                                <span className="avatar-initials">{o.name.slice(0, 2).toUpperCase()}</span>
                              </div>

                              <div className="owner-details">
                                <div className="owner-name-row">
                                  <span
                                    className="owner-name"
                                    onClick={() => {
                                      if (o.type === 'Player') {
                                        navigate(`/server/${serverId}/characters/${o.citizenid}`);
                                      }
                                    }}
                                  >
                                    {o.name}
                                  </span>
                                  <span className={`owner-type-tag ${getTypeClass(o.type)}`}>
                                    {getTypeIcon(o.type)}
                                    {getTypeLabel(o.type)}
                                  </span>
                                </div>
                                <div className="owner-meta-row">
                                  <span className="owner-location">
                                    <MapPin size={10} />
                                    {o.location}
                                  </span>
                                  {o.job && o.job !== 'Civilian' && (
                                    <span className="owner-job">
                                      <Briefcase size={10} />
                                      {o.job}
                                    </span>
                                  )}
                                  <span className="owner-cid">
                                    {o.citizenid}
                                  </span>
                                </div>
                              </div>

                              <button
                                className="owner-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(o, d.serial);
                                }}
                                disabled={deletingOwner === `${d.serial}-${o.citizenid}`}
                                title="حذف العنصر من هذا المالك"
                              >
                                {deletingOwner === `${d.serial}-${o.citizenid}` ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dupes;
