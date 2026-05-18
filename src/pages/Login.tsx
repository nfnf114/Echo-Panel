import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { User } from '../types';
import { useLanguage } from '../App';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { getBackendUrl } from '../config';
import './Login.css';

interface LoginProps {
  user: User | null;
  onLogin: (user: User) => void;
}

const errorMessages: Record<string, { ar: string; en: string }> = {
  auth_failed: { ar: 'فشل تسجيل الدخول عبر Discord. يرجى المحاولة مرة أخرى.', en: 'Discord login failed. Please try again.' },
  no_code: { ar: 'لم يتم استلام رمز التحقق من Discord.', en: 'No authorization code received from Discord.' },
  no_license: { ar: 'ليس لديك رخصة صالحة للوصول إلى اللوحة.', en: 'You do not have a valid license to access the panel.' },
  license_expired: { ar: 'انتهت صلاحية رخصتك. يرجى التجديد.', en: 'Your license has expired. Please renew.' },
  invalid_token: { ar: 'رمز التحقق غير صالح. يرجى تسجيل الدخول مرة أخرى.', en: 'Invalid token. Please log in again.' },
};

const Login: React.FC<LoginProps> = ({ user, onLogin }) => {
  const { lang, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      const msg = errorMessages[error];
      setErrorMsg(msg ? msg[lang] || msg.ar : (lang === 'en' ? `Login error: ${error}` : `خطأ في تسجيل الدخول: ${error}`));
      // Clean the URL so the error doesn't persist on refresh
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, lang, setSearchParams]);

  if (user) {
    return <Navigate to="/hub" replace />;
  }

  const handleDiscordLogin = () => {
    setErrorMsg(null);
    // Use the centralized backend URL which works in both dev and production
    const backendUrl = getBackendUrl();
    window.location.href = `${backendUrl}/api/auth/discord/login`;
  };

  return (
    <div className="login-page">
      {/* Top Left Language Switcher */}
      <div className="login-header-left">
        <LanguageSwitcher />
      </div>

      <div className="login-container animate-fade-in">
        {/* Branding Section */}
        <div className="branding-section">
          <div className="logo-box">
             <img src="/logo.png" alt="Logo" className="main-logo" />
          </div>
          <h1 className="brand-title">Echo Panel</h1>
          <p className="brand-subtitle">إدارة سيرفرات FiveM</p>
        </div>

        {/* Login Card */}
        <div className="login-card glass-panel">
          <h2 className="card-title">{t('loginTitle')}</h2>
          <p className="card-subtitle">{t('loginSubtitle')}</p>

          {errorMsg && (
            <div style={{
              background: 'rgba(139, 0, 0, 0.2)',
              border: '1px solid #8b0000',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#ff6b6b',
              fontSize: '14px',
              textAlign: 'center',
              direction: lang === 'ar' ? 'rtl' : 'ltr',
            }}>
              {errorMsg}
            </div>
          )}

          <button className="discord-login-btn" onClick={handleDiscordLogin}>
            <svg className="discord-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
            </svg>
            <span>{t('loginBtn')}</span>
          </button>

          <p className="terms-footer">{t('loginTerms')}</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
