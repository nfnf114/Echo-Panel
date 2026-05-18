import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Users,
  LayoutGrid,
  UserCheck,
  Package,
  Camera,
  LayoutDashboard,
  ShieldBan,
  Car,
  ScrollText,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Globe,
  Code2,
  Heart,
  ExternalLink,
  Zap,
  Server,
  Lock,
  RefreshCw
} from 'lucide-react';
import type { User } from '../types';
import { useLanguage } from '../App';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { checkActiveSubscription } from '../utils/subscription';
import './Hub.css';

interface HubProps {
  user: User | null;
  onLogout: () => void;
}

const Hub: React.FC<HubProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const isRTL = lang === 'ar';
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    if (user?.discordId) {
      checkActiveSubscription(user.discordId).then(setHasActiveSubscription);
    }
  }, [user?.discordId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('hub-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    const animElements = document.querySelectorAll('.hub-animate');
    animElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: <Users size={24} />,
      title: t('hubFeatPlayerMgmt'),
      desc: t('hubFeatPlayerMgmtDesc')
    },
    {
      icon: <UserCheck size={24} />,
      title: t('hubFeatCharMgmt'),
      desc: t('hubFeatCharMgmtDesc')
    },
    {
      icon: <Package size={24} />,
      title: t('hubFeatStashMgmt'),
      desc: t('hubFeatStashMgmtDesc')
    },
    {
      icon: <Camera size={24} />,
      title: t('hubFeatLiveScreenshots'),
      desc: t('hubFeatLiveScreenshotsDesc')
    },
    {
      icon: <LayoutDashboard size={24} />,
      title: t('hubFeatDashboard'),
      desc: t('hubFeatDashboardDesc')
    },
    {
      icon: <ShieldBan size={24} />,
      title: t('hubFeatBanSystem'),
      desc: t('hubFeatBanSystemDesc')
    },
    {
      icon: <Car size={24} />,
      title: t('hubFeatVehicleMgmt'),
      desc: t('hubFeatVehicleMgmtDesc')
    },
    {
      icon: <ScrollText size={24} />,
      title: t('hubFeatActivityLogs'),
      desc: t('hubFeatActivityLogsDesc')
    }
  ];

  const stats = [
    { value: '500+', label: t('hubStatServers') },
    { value: '10K+', label: t('hubStatPlayers') },
    { value: '99.9%', label: t('hubStatUptime') },
    { value: '24/7', label: t('hubStatSupport') }
  ];

  const teamMembers = [
    { name: 'Echo', role: t('hubTeamFounder'), icon: <Code2 size={20} /> },
    { name: 'Dev Team', role: t('hubTeamDev'), icon: <Zap size={20} /> }
  ];

  const scrollToFeatures = () => {
    const el = document.getElementById('hub-features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="hub-page" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="hub-header">
        <div className="hub-header-inner">
          <div className="hub-header-left">
            <div className="hub-logo-mark">
              <Server size={20} />
            </div>
            <span className="hub-logo-text">Echo</span>
            <LanguageSwitcher />
          </div>

          <div className="hub-header-right">
            <button className="hub-logout-btn" onClick={onLogout}>
              <LogOut size={16} />
              <span>{t('logout')}</span>
            </button>

            <div className="hub-user-info">
              <div className="hub-user-text">
                <span className="hub-welcome-label">{t('welcome')}</span>
                <span className="hub-user-name">{user?.username || 'Guest'}</span>
              </div>
              <img
                src={user?.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                className="hub-user-avatar"
                alt="Avatar"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hub-hero">
        <div className="hub-hero-bg-accent" />
        <div className="hub-hero-content hub-animate">
          <div className="hub-hero-badge">
            <Zap size={14} />
            <span>{t('hubHeroBadge')}</span>
          </div>
          <h1 className="hub-hero-title">
            Echo <span className="hub-hero-title-accent">PANEL</span>
          </h1>
          <p className="hub-hero-subtitle">{t('hubHeroSubtitle')}</p>
          <p className="hub-hero-description">{t('hubHeroDescription')}</p>
          <div className="hub-hero-actions">
            <button className="hub-cta-primary" onClick={() => navigate('/servers')}>
              <span>{t('hubGetStarted')}</span>
              {isRTL ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </button>
            <button className="hub-cta-secondary" onClick={scrollToFeatures}>
              <span>{t('hubLearnMore')}</span>
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="hub-section" id="hub-features">
        <div className="hub-section-inner">
          <div className="hub-section-header hub-animate">
            <div className="hub-section-divider" />
            <h2 className="hub-section-title">{t('hubFeaturesTitle')}</h2>
            <p className="hub-section-subtitle">{t('hubFeaturesSubtitle')}</p>
          </div>
          <div className="hub-features-grid">
            {features.map((feat, idx) => (
              <div
                className="hub-feature-card hub-animate"
                key={idx}
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                <div className="hub-feature-icon">{feat.icon}</div>
                <h3 className="hub-feature-title">{feat.title}</h3>
                <p className="hub-feature-desc">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="hub-section hub-stats-section">
        <div className="hub-section-inner">
          <div className="hub-section-header hub-animate">
            <div className="hub-section-divider" />
            <h2 className="hub-section-title">{t('hubStatsTitle')}</h2>
            <p className="hub-section-subtitle">{t('hubStatsSubtitle')}</p>
          </div>
          <div className="hub-stats-grid hub-animate">
            {stats.map((stat, idx) => (
              <div className="hub-stat-card" key={idx}>
                <span className="hub-stat-value">{stat.value}</span>
                <span className="hub-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Access Section */}
      <section className="hub-section">
        <div className="hub-section-inner">
          <div className="hub-section-header hub-animate">
            <div className="hub-section-divider" />
            <h2 className="hub-section-title">{t('hubQuickAccessTitle')}</h2>
            <p className="hub-section-subtitle">{t('hubQuickAccessSubtitle')}</p>
          </div>
          <div className="hub-quick-grid hub-animate">
            {hasActiveSubscription && (
              <div className="hub-quick-card" onClick={() => navigate('/client-area')}>
                <div className="hub-quick-icon">
                  <Users size={32} />
                </div>
                <div className="hub-quick-content">
                  <h3>{t('clientArea')}</h3>
                  <p>{t('clientAreaDesc')}</p>
                </div>
                <div className="hub-quick-arrow">
                  {isRTL ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                </div>
              </div>
            )}

            <div className="hub-quick-card" onClick={() => navigate('/servers')}>
              <div className="hub-quick-icon">
                <LayoutGrid size={32} />
              </div>
              <div className="hub-quick-content">
                <h3>{t('serverMgmt')}</h3>
                <p>{t('serverMgmtDesc')}</p>
              </div>
              <div className="hub-quick-arrow">
                {isRTL ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team/About Section */}
      <section className="hub-section">
        <div className="hub-section-inner">
          <div className="hub-section-header hub-animate">
            <div className="hub-section-divider" />
            <h2 className="hub-section-title">{t('hubAboutTitle')}</h2>
            <p className="hub-section-subtitle">{t('hubAboutSubtitle')}</p>
          </div>
          <div className="hub-about-content hub-animate">
            <div className="hub-about-text">
              <p>{t('hubAboutDescription')}</p>
              <div className="hub-about-highlights">
                <div className="hub-about-highlight-item">
                  <Lock size={16} />
                  <span>{t('hubAboutSecure')}</span>
                </div>
                <div className="hub-about-highlight-item">
                  <RefreshCw size={16} />
                  <span>{t('hubAboutUpdates')}</span>
                </div>
                <div className="hub-about-highlight-item">
                  <Globe size={16} />
                  <span>{t('hubAboutMultilang')}</span>
                </div>
              </div>
            </div>
            <div className="hub-team-grid">
              {teamMembers.map((member, idx) => (
                <div className="hub-team-card" key={idx}>
                  <div className="hub-team-avatar">{member.icon}</div>
                  <div className="hub-team-info">
                    <span className="hub-team-name">{member.name}</span>
                    <span className="hub-team-role">{member.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hub-footer">
        <div className="hub-footer-inner">
          <div className="hub-footer-brand">
            <Server size={18} />
            <span>Echo PANEL</span>
          </div>
          <div className="hub-footer-links">
            <a href="https://discord.gg/Echo" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} />
              <span>Discord</span>
            </a>
            <a href="https://Echo.store" target="_blank" rel="noopener noreferrer">
              <Globe size={14} />
              <span>Website</span>
            </a>
          </div>
          <div className="hub-footer-copyright">
            <span>{t('hubFooterCopyright')}</span>
            <span className="hub-footer-sep">|</span>
            <span>v2.0.0</span>
          </div>
          <div className="hub-footer-made">
            <Heart size={14} className="hub-footer-heart" />
            <span>{t('hubFooterMade')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Hub;
