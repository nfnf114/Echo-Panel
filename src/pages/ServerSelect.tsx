import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Server as ServerIcon, RefreshCw, AlertCircle, 
  Users, Key, Shield, Clock, Zap, Crown, ChevronRight, Wifi, WifiOff
} from 'lucide-react';
import type { User } from '../types';
import { useLanguage } from '../App';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { fetchWithAuth } from '../utils/api';
import { API_URL } from '../config';
import './ServerSelect.css';

interface ServerSelectProps {
  user: User | null;
}

interface ServerData {
  id: number;
  name: string;
  status: string;
  current_players: number;
  max_players: number;
  license_key: string;
  product_name: string;
  is_linked: boolean;
  expires_at: string | null;
  access_type?: 'owner' | 'admin';
  role_name?: string;
}

const ServerSelect: React.FC<ServerSelectProps> = ({ user }) => {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const [myServers, setMyServers] = useState<ServerData[]>([]);
  const [adminServers, setAdminServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'owned' | 'admin'>('owned');
  const [animatingCards, setAnimatingCards] = useState<Set<number>>(new Set());

  const isRTL = lang === 'ar';

  useEffect(() => {
    if (user?.discordId) {
      fetchServers();
    }
  }, [user]);

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch owned servers
      const ownedRes = await fetchWithAuth(`${API_URL}/api/user/servers/${user?.discordId}`);
      const ownedData = await ownedRes.json();
      const owned: ServerData[] = (ownedData.servers || []).map((s: any) => ({
        ...s,
        access_type: 'owner' as const
      }));

      // Fetch admin servers (gracefully handle failure)
      let adminList: ServerData[] = [];
      try {
        const adminRes = await fetchWithAuth(`${API_URL}/api/user/admin-servers/${user?.discordId}`);
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          adminList = (adminData.servers || []).map((s: any) => ({
            ...s,
            access_type: 'admin' as const
          }));
        }
      } catch (e) {
        // Silently ignore - endpoint may not exist yet
      }

      // Filter out servers that are already in owned list (avoid duplicates)
      const ownedIds = new Set(owned.map(s => s.id));
      const filteredAdmin = adminList.filter(s => !ownedIds.has(s.id));

      setMyServers(owned);
      setAdminServers(filteredAdmin);

      // Auto-switch tab if no owned servers but has admin servers
      if (owned.length === 0 && filteredAdmin.length > 0) {
        setActiveTab('admin');
      }
    } catch (e) {
      setError(isRTL ? 'تعذر جلب بيانات السيرفرات.' : 'Failed to fetch servers.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectServer = (server: ServerData) => {
    if (!server.is_linked) {
      alert(t('unlinkedAlert'));
      return;
    }
    const isExpired = server.expires_at && new Date(server.expires_at) < new Date();
    if (isExpired) {
      alert(t('expiredAlert'));
      return;
    }
    // Animate card
    setAnimatingCards(prev => new Set(prev).add(server.id));
    setTimeout(() => {
      localStorage.setItem('selected_server_name', server.name);
      navigate(`/server/${server.id}/dashboard`);
    }, 300);
  };

  const getStatusInfo = (server: ServerData) => {
    const isExpired = server.expires_at && new Date(server.expires_at) < new Date();
    if (isExpired) return { label: t('serverExpired'), className: 'expired', icon: <Clock size={12} /> };
    if (!server.is_linked) return { label: t('serverUnlinked'), className: 'unlinked', icon: <WifiOff size={12} /> };
    if (server.status === 'online') return { label: t('online'), className: 'online', icon: <Wifi size={12} /> };
    return { label: t('offline'), className: 'offline', icon: <WifiOff size={12} /> };
  };

  const getAccessBadge = (server: ServerData) => {
    if (server.access_type === 'admin') {
      return { label: t('adminAccess'), icon: <Shield size={12} />, className: 'admin-badge' };
    }
    return { label: t('ownerAccess'), icon: <Crown size={12} />, className: 'owner-badge' };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('neverExpires');
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const currentServers = activeTab === 'owned' ? myServers : adminServers;

  const renderServerCard = (server: ServerData, index: number) => {
    const isExpired = server.expires_at && new Date(server.expires_at) < new Date();
    const statusInfo = getStatusInfo(server);
    const accessBadge = getAccessBadge(server);
    const playerPercent = server.max_players > 0 ? Math.round((server.current_players / server.max_players) * 100) : 0;
    const isAnimating = animatingCards.has(server.id);

    return (
      <div
        className={`ss-server-card ${!server.is_linked ? 'ss-unlinked' : ''} ${isExpired ? 'ss-expired' : ''} ${isAnimating ? 'ss-card-clicked' : ''}`}
        key={server.id}
        onClick={() => handleSelectServer(server)}
        style={{ 
          animationDelay: `${index * 0.06}s`,
          cursor: isExpired ? 'not-allowed' : 'pointer'
        }}
      >
        {/* Card Glow Effect */}
        {server.is_linked && !isExpired && server.status === 'online' && (
          <div className="ss-card-glow" />
        )}

        {/* Card Header */}
        <div className="ss-card-header">
          <div className="ss-server-icon-wrap">
            <ServerIcon size={20} />
          </div>
          <div className="ss-server-title-col">
            <h3 className="ss-server-name">{server.name}</h3>
            <div className="ss-server-meta">
              <span className={`ss-access-badge ${accessBadge.className}`}>
                {accessBadge.icon}
                {accessBadge.label}
              </span>
              {server.role_name && server.access_type === 'admin' && (
                <span className="ss-role-tag">{server.role_name}</span>
              )}
            </div>
          </div>
          <div className={`ss-status-pill ${statusInfo.className}`}>
            {statusInfo.icon}
            <span>{statusInfo.label}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="ss-card-body">
          {/* Player Count */}
          <div className="ss-info-row">
            <div className="ss-info-icon">
              <Users size={14} />
            </div>
            <div className="ss-info-content">
              <span className="ss-info-label">{t('players')}</span>
              <span className="ss-info-value">
                {server.current_players}<span className="ss-info-sep">/</span>{server.max_players}
              </span>
            </div>
            <div className="ss-player-bar">
              <div 
                className={`ss-player-fill ${playerPercent > 80 ? 'high' : playerPercent > 40 ? 'mid' : 'low'}`}
                style={{ width: `${Math.min(playerPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* License Key */}
          <div className="ss-info-row">
            <div className="ss-info-icon">
              <Key size={14} />
            </div>
            <div className="ss-info-content">
              <span className="ss-info-label">{t('licenseKey')}</span>
              <span className="ss-info-value mono" dir="ltr">
                {server.license_key?.substring(0, 18)}...
              </span>
            </div>
          </div>

          {/* Expiry */}
          <div className="ss-info-row">
            <div className="ss-info-icon">
              <Clock size={14} />
            </div>
            <div className="ss-info-content">
              <span className="ss-info-label">{t('expiresAt')}</span>
              <span className={`ss-info-value ${isExpired ? 'text-expired' : ''}`}>
                {formatDate(server.expires_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="ss-card-footer">
          <span className="ss-product-badge">
            <Zap size={12} />
            {server.product_name}
          </span>
          <span className={`ss-link-badge ${server.is_linked && !isExpired ? 'linked' : isExpired ? 'expired' : 'pending'}`}>
            {isExpired ? t('serverExpired') : server.is_linked ? t('active') : t('serverPending')}
          </span>
        </div>

        {/* Enter Arrow */}
        {!isExpired && server.is_linked && (
          <div className="ss-enter-indicator">
            <ChevronRight size={16} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`ss-page animate-fade-in ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="ss-header">
        <div className="ss-header-inner">
          <div className="ss-header-left">
            <button className="back-to-hub-global" onClick={() => navigate('/hub')}>
              <ChevronLeft size={18} /> {t('back')}
            </button>
          </div>
          <div className="ss-header-right">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="ss-hero">
        <div className="ss-hero-bg-accent" />
        <div className="ss-hero-content">
          <div className="ss-hero-icon">
            <ServerIcon size={32} />
          </div>
          <h1 className="ss-hero-title">{t('serverMgmt')}</h1>
          <p className="ss-hero-desc">{t('serverMgmtDesc')}</p>
        </div>
      </div>

      {/* Content */}
      <div className="ss-content">
        {/* Toolbar */}
        <div className="ss-toolbar">
          {/* Tabs */}
          <div className="ss-tabs">
            <button
              className={`ss-tab ${activeTab === 'owned' ? 'active' : ''}`}
              onClick={() => setActiveTab('owned')}
            >
              <Crown size={14} />
              <span>{t('myServers')}</span>
              {myServers.length > 0 && <span className="ss-tab-count">{myServers.length}</span>}
            </button>
            <button
              className={`ss-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <Shield size={14} />
              <span>{t('adminServers')}</span>
              {adminServers.length > 0 && <span className="ss-tab-count">{adminServers.length}</span>}
            </button>
          </div>

          {/* Refresh */}
          <button 
            className={`ss-refresh-btn ${loading ? 'spinning' : ''}`} 
            onClick={fetchServers}
            disabled={loading}
          >
            <RefreshCw size={16} />
            <span>{t('refreshServers')}</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="ss-loading">
            <div className="ss-loading-spinner">
              <RefreshCw size={36} />
            </div>
            <p>{isRTL ? 'جاري تحميل السيرفرات...' : 'Loading servers...'}</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="ss-error">
            <AlertCircle size={48} />
            <h3>{error}</h3>
            <button className="ss-retry-btn" onClick={fetchServers}>
              <RefreshCw size={14} /> {t('refreshServers')}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && currentServers.length === 0 && (
          <div className="ss-empty">
            <div className="ss-empty-icon">
              <ServerIcon size={48} />
            </div>
            <h3>{activeTab === 'owned' ? t('noServersFound') : t('noAdminServers')}</h3>
            <p>{activeTab === 'owned' ? t('noServersDesc') : t('noAdminServers')}</p>
          </div>
        )}

        {/* Server Grid */}
        {!loading && !error && currentServers.length > 0 && (
          <div className="ss-grid">
            {currentServers.map((server, index) => renderServerCard(server, index))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerSelect;
