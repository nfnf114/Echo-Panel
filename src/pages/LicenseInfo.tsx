import React, { useState, useEffect } from 'react';
import { Key, Calendar, ShieldCheck, Server, RefreshCw, ExternalLink, Copy, Clock, Lock } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../App';
import './LicenseInfo.css';

import { API_URL } from '../config';

const LicenseInfo: React.FC = () => {
  const { serverId } = useParams();
  const { lang } = useLanguage();
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}`);
        const data = await res.json();
        setServer(data.server);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [serverId]);

  useEffect(() => {
    if (!server?.expires_at) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(server.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
        clearInterval(interval);
      } else {
        const totalSeconds = Math.floor(diff / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        setTimeLeft({ hours, minutes, seconds, totalSeconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [server]);

  const copyKey = () => {
    if (server?.license_key) {
      navigator.clipboard.writeText(server.license_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isAr = lang === 'ar';

  return (
    <div className={`license-page animate-fade-in ${isAr ? 'rtl' : 'ltr'}`}>
      <div className="license-page-header">
        <h1 className="license-page-title">
           {server?.server_name || 'Echo'} 
           <span className="server-letter">P</span>
        </h1>
        <p className="text-muted text-sm">
           {isAr ? 'تفاصيل الاشتراك (للمالك فقط)' : 'Subscription details (Owner only)'}
        </p>
      </div>

      {loading ? (
        <div className="license-loading"><RefreshCw className="spin" size={24} /></div>
      ) : (
        <div className="license-cards-row">

          {/* Remarks Card */}
          <div className="license-card glass-panel">
            <div className="license-card-header">
              <Key size={16} />
              <h3>{isAr ? 'ملاحظات هامة' : 'Important Remarks'}</h3>
            </div>
            <div className="remarks-body text-muted text-sm">
              <p>{isAr ? 'فقط المالك يمكنه رؤية تفاصيل الرخصة والاشتراك.' : 'Only the Owner can view license & subscription details.'}</p>
              <p className="mt-2">{isAr ? 'تبقى لوحات تحكم الإداريين متاحة دون الكشف عن بيانات الرخصة الحساسة.' : 'Staff dashboards stay available without exposing sensitive subscription fields.'}</p>
            </div>
          </div>

          {/* Server Card */}
          <div className="license-card glass-panel">
            <div className="license-card-header">
              <Server size={16} />
              <h3>{isAr ? 'بيانات السيرفر' : 'Server Data'}</h3>
            </div>
            <div className="server-info-list">
              <div className="server-info-row">
                <span className="info-label">{isAr ? 'معرف السيرفر (UID)' : 'Server UID'}</span>
                <span className="info-val font-mono text-sm">{serverId}</span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{isAr ? 'عنوان الـ IP' : 'Server IP'}</span>
                <span className="info-val font-mono">{server?.ip_address || '—'}</span>
              </div>
              <div className="server-info-row">
                <span className="info-label">{isAr ? 'مقفل' : 'Locked'}</span>
                <button className="lock-icon-btn"><Lock size={16} /></button>
              </div>
            </div>
          </div>

          {/* License Card */}
          <div className="license-card glass-panel">
            <div className="license-card-header">
              <ShieldCheck size={16} />
              <h3>{isAr ? 'حالة الرخصة' : 'License Status'}</h3>
            </div>
            
            <div className="countdown-timer mt-3">
               <div className="timer-box">
                  <span className="time-val">{timeLeft.hours}</span>
                  <span className="time-label">{isAr ? 'ساعة' : 'Hrs'}</span>
               </div>
               <div className="timer-sep">:</div>
               <div className="timer-box">
                  <span className="time-val">{timeLeft.minutes}</span>
                  <span className="time-label">{isAr ? 'دقيقة' : 'Min'}</span>
               </div>
               <div className="timer-sep">:</div>
               <div className="timer-box">
                  <span className="time-val">{timeLeft.seconds}</span>
                  <span className="time-label">{isAr ? 'ثانية' : 'Sec'}</span>
               </div>
            </div>

            <div className="license-info-list mt-4">
              <div className="license-info-row">
                <span className="info-label">{isAr ? 'الحالة' : 'Status'}</span>
                <span className="info-val text-green">{isAr ? 'الرخصة معتمدة' : 'License Approved'}</span>
              </div>
              <div className="license-info-row">
                <span className="info-label">{isAr ? 'تنتهي في' : 'Expires on'}</span>
                <span className="info-val">
                  {server?.expires_at ? new Date(server.expires_at).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'}
                </span>
              </div>
              <div className="license-info-row">
                <span className="info-label">{isAr ? 'دعم ديسكورد' : 'Discord Support'}</span>
                <a href="https://discord.gg/haPZZ3BpPZ" target="_blank" rel="noreferrer" className="info-link">discord.gg/haPZZ3BpPZ <ExternalLink size={11} /></a>
              </div>
              <div className="license-info-row">
                <span className="info-label">{isAr ? 'الخطة' : 'Plan'}</span>
                <span className="info-val"><span className="module-active-badge">{server?.product_name || (isAr ? 'نشط' : 'Active')}</span></span>
              </div>
              <div className="license-info-row">
                <span className="info-label">{isAr ? 'مفتاح الرخصة' : 'License Key'}</span>
                <div className="key-copy-row">
                  <button className="copy-btn" onClick={copyKey} title={isAr ? 'نسخ' : 'Copy'}>
                    <Copy size={13} /> {copied ? (isAr ? 'تم!' : 'Copied!') : ''}
                  </button>
                  <span className="info-val font-mono text-xs">{server?.license_key || '—'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default LicenseInfo;
