import React, { useState, useEffect } from 'react';
import type { User, License } from '../types';
import { ArrowRight, ChevronLeft, Key, RefreshCw, AlertCircle, Download, ShieldCheck } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import './ClientArea.css';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../App';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface ClientAreaProps {
  user: User | null;
}

import { API_URL } from '../config';


const ClientArea: React.FC<ClientAreaProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'products' | 'licenses' | 'updates'>('products');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { lang, t } = useLanguage();

  // Founder/Admin Configuration (You can change this link easily)
  const LATEST_UPDATE_LINK = "https://example.com/Echo-latest.zip"; 
  const LATEST_VERSION = "V1.0";

  useEffect(() => {
    if (user?.discordId) {
      fetchLicenses();
    }
  }, [user]);

  const fetchLicenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/user/licenses/${user?.discordId}`);
      const data = await res.json();
      setLicenses(data.licenses || []);
    } catch (e) {
      setError(lang === 'ar' ? 'تعذر الاتصال بالخادم. تأكد أن الباك إند يعمل.' : 'Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return lang === 'ar' ? 'غير محدد' : 'Not Set';
    return new Date(dateStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const activeLicenses = licenses.filter(l => l.is_active && !isExpired(l.expires_at));

  return (
    <div className={`client-area-page ${lang}`}>
      <div className="top-bar-actions">
        <button className="back-to-hub-global" onClick={() => navigate('/hub')}>
          <ChevronLeft size={18} /> {t('back')}
        </button>
        <LanguageSwitcher />
      </div>

      <header className="page-header">
        <div className="header-titles">
          <h1>{t('clientArea')}</h1>
          <p>{t('clientAreaDesc')}</p>
        </div>
      </header>

      <div className="client-content">
        {/* Account Card */}
        <div className="account-card glass-panel">
          <div className="account-header">
            <h3>{lang === 'ar' ? 'تفاصيل الحساب' : 'Account Details'}</h3>
            <p>{lang === 'ar' ? 'المعلومات المرتبطة بحساب العميل الخاص بك حالياً.' : 'Information currently linked to your customer account.'}</p>
            <div className="user-profile-large">
              <span className="username">{user?.username || '—'}</span>
              <img
                src={user?.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                alt="Avatar"
                className="avatar"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
              />
            </div>
          </div>

          <div className="account-stats">
            <div className="stat-box">
              <span className="stat-label">{lang === 'ar' ? 'المنتجات المملوكة' : 'Owned Products'}</span>
              <span className="stat-value">{(licenses.length > 0 ? 1 : 0).toLocaleString('en-US')}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">{lang === 'ar' ? 'الرخص النشطة' : 'Active Licenses'}</span>
              <span className="stat-value">{activeLicenses.length.toLocaleString('en-US')}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Discord ID</span>
              <span className="stat-value text-small" dir="ltr">{user?.discordId || '—'}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">{lang === 'ar' ? 'آخر دخول' : 'Last sign-in'}</span>
              <span className="stat-value text-small">{new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-container glass-panel">
          <button className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
             {lang === 'ar' ? 'المنتجات' : 'Products'}
          </button>
          <button className={`tab-btn ${activeTab === 'licenses' ? 'active' : ''}`} onClick={() => setActiveTab('licenses')}>
             {lang === 'ar' ? 'الرخص' : 'Licenses'} {activeLicenses.length > 0 && <span className="tab-badge">{activeLicenses.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => setActiveTab('updates')}>
             {lang === 'ar' ? 'التحديثات' : 'Updates'}
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content glass-panel">

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="products-view animate-fade-in">
              <div className="section-header">
                <h3>{lang === 'ar' ? 'منتجاتي' : 'My Products'}</h3>
                <p>{lang === 'ar' ? 'افتح أي منتج لعرض ملاحظات الإصدار والإصدارات السابقة وتحميل أحدث حزمة.' : 'Open any product to view release notes and download the latest package.'}</p>
              </div>
              {licenses.length > 0 ? (
                <div className="product-card-large glass-panel">
                   <div className="p-header">
                      <div className="p-icon"><ShieldCheck size={40} color="#8b0000" /></div>
                      <div className="p-info">
                         <h4>Echo Panel</h4>
                         <span className="p-version">{LATEST_VERSION}</span>
                      </div>
                      <button className="download-latest-btn" onClick={() => window.open(LATEST_UPDATE_LINK, '_blank')}>
                         <Download size={18} />
                         <span>{lang === 'ar' ? 'تحميل أحدث نسخة' : 'Download Latest'}</span>
                      </button>
                   </div>
                   <div className="p-body">
                      <p>{lang === 'ar' ? 'تتضمن هذه النسخة تحسينات في الأداء وإصلاحات لنظام الدخول واللغات.' : 'This version includes performance improvements and fixes for the login and language systems.'}</p>
                   </div>
                </div>
              ) : (
                <div className="empty-state">
                  <AlertCircle size={32} className="text-muted" />
                  <p>{lang === 'ar' ? 'لا توجد منتجات مرتبطة بحسابك حتى الآن.' : 'No products linked to your account yet.'}</p>
                </div>
              )}
            </div>
          )}

          {/* Licenses Tab */}
          {activeTab === 'licenses' && (
            <div className="licenses-view animate-fade-in">
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{lang === 'ar' ? 'تراخيص التشغيل' : 'Operational Licenses'}</h3>
                  <p>{lang === 'ar' ? 'التراخيص المرتبطة بحسابك حالياً والتي تسمح لك بتشغيل السكربت.' : 'Licenses currently linked to your account.'}</p>
                </div>
                <button className="btn-outline btn-small" onClick={fetchLicenses} disabled={loading}>
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  {lang === 'ar' ? 'تحديث' : 'Refresh'}
                </button>
              </div>

              {error && (
                <div className="error-banner">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {loading && (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
              )}

              {!loading && licenses.map((license) => {
                const expired = isExpired(license.expires_at);
                return (
                  <div className="license-card-premium glass-panel" key={license.id}>
                    <div className="license-top">
                      <div className="l-main-info">
                         <span className="l-icon"><Key size={16} /></span>
                         <div>
                            <h4 className="license-key" dir="ltr">{license.license_key}</h4>
                            <span className="l-product-name">Echo Panel Premium</span>
                         </div>
                      </div>
                      <span className={expired ? 'badge-expired' : license.is_active ? 'badge-active' : 'badge-inactive'}>
                        {expired ? (lang === 'ar' ? 'منتهي' : 'Expired') : license.is_active ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'معطل' : 'Disabled')}
                      </span>
                    </div>
                    <div className="license-stats">
                      <div className="l-stat">
                        <span>{lang === 'ar' ? 'الفتحات' : 'Slots'}</span>
                        <strong>1 / {license.slots}</strong>
                      </div>
                      <div className="l-stat">
                        <span>IP المرتبط</span>
                        <strong dir="ltr">{license.server_ip || (lang === 'ar' ? 'غير مرتبط' : 'Not Linked')}</strong>
                      </div>
                      <div className="l-stat">
                        <span>{lang === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</span>
                        <strong>{formatDate(license.expires_at)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Updates Tab */}
          {activeTab === 'updates' && (
            <div className="updates-view animate-fade-in">
              <div className="section-header">
                <h3>{lang === 'ar' ? 'سجل التحديثات' : 'Change Logs'}</h3>
                <p>{lang === 'ar' ? 'آخر التحديثات والإصدارات التي تم إطلاقها للسكربت.' : 'The latest updates and versions released for the script.'}</p>
              </div>
              
              {/* Feature: Founder can add update links here */}
              <div className="update-item glass-panel active">
                 <div className="u-header">
                    <span className="u-version">{LATEST_VERSION}</span>
                    <span className="u-badge-new">{lang === 'ar' ? 'جديد' : 'NEW'}</span>
                    <span className="u-date">أبريل 29, 2026</span>
                 </div>
                 <div className="u-body">
                    <ul>
                       <li>{lang === 'ar' ? 'إصلاح مشكلة تسجيل الدخول عبر ديسكورد.' : 'Fixed Discord OAuth login issue.'}</li>
                       <li>{lang === 'ar' ? 'إضافة نظام اللغات المتعددة (عربي/إنجليزي).' : 'Added multi-language system (AR/EN).'}</li>
                       <li>{lang === 'ar' ? 'تحسين واجهة المستخدم لتصبح أكثر حيوية.' : 'Improved UI to be more dynamic.'}</li>
                    </ul>
                    <button className="u-download-btn" onClick={() => window.open(LATEST_UPDATE_LINK, '_blank')}>
                       <Download size={16} /> {lang === 'ar' ? 'تحميل هذا التحديث' : 'Download This Update'}
                    </button>
                 </div>
              </div>

              <div className="update-item glass-panel">
                 <div className="u-header">
                    <span className="u-version">v1.1.0</span>
                    <span className="u-date">أبريل 15, 2026</span>
                 </div>
                 <div className="u-body">
                    <p>{lang === 'ar' ? 'إصدار أولي للوحة التحكم بنظام الربط الأساسي.' : 'Initial release of the dashboard with base linking system.'}</p>
                 </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ClientArea;
