import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useLanguage } from '../App';
import './LanguageSwitcher.css';

const LanguageSwitcher: React.FC = () => {
  const { lang, setLang } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="lang-dropdown-wrapper">
      <button className="lang-selector-btn" onClick={() => setShowMenu(!showMenu)}>
         <img src={lang === 'ar' ? "https://flagcdn.com/w20/sa.png" : "https://flagcdn.com/w20/us.png"} alt="Flag" />
         <span>{lang === 'ar' ? 'العربية' : 'English'}</span>
      </button>
      
      {showMenu && (
        <div className="lang-menu glass-panel">
          <div className={`lang-item ${lang === 'ar' ? 'active' : ''}`} onClick={() => { setLang('ar'); setShowMenu(false); }}>
            <div className="lang-info">
              <span className="lang-name">العربية</span>
              <span className="lang-sub">Arabic</span>
            </div>
            <img src="https://flagcdn.com/w20/sa.png" alt="AR" />
            {lang === 'ar' && <div className="check-mark"><Check size={14} /></div>}
          </div>
          <div className={`lang-item ${lang === 'en' ? 'active' : ''}`} onClick={() => { setLang('en'); setShowMenu(false); }}>
            <div className="lang-info">
              <span className="lang-name">English</span>
              <span className="lang-sub">English</span>
            </div>
            <img src="https://flagcdn.com/w20/us.png" alt="EN" />
            {lang === 'en' && <div className="check-mark"><Check size={14} /></div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
