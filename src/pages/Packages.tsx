import React from 'react';
import type { Package } from '../types';
import { Check, Star, Zap, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Packages.css';

const Packages: React.FC = () => {
  const navigate = useNavigate();
  
  // Mock packages for display
  const packages: Package[] = [
    {
      id: 'basic',
      name: 'باقة المبتدئين / BASIC',
      features: ['لوحة تحكم كاملة', 'إدارة اللاعبين', 'سجلات السيرفر (Logs)', 'تحديثات مجانية'],
      durationOptions: ['30d', '90d']
    },
    {
      id: 'premium',
      name: 'باقة البريميوم / PREMIUM',
      features: ['كل مميزات الباقة العادية', 'لقطات الشاشة المباشرة', 'إدارة العصابات والمخازن', 'بحث متقدم'],
      durationOptions: ['30d', '90d', '1y']
    },
    {
      id: 'ultimate',
      name: 'الباقة المتكاملة / ULTIMATE',
      features: ['كل مميزات البريميوم', 'دعم فني 24/7', 'تخصيص كامل للوحة', 'أولوية في التحديثات'],
      durationOptions: ['1y', 'Lifetime']
    }
  ];

  return (
    <div className="packages-container animate-fade-in">
      <header className="page-header-simple">
        <button className="back-btn glass-panel" onClick={() => navigate('/servers')}>
          <ArrowRight size={20} />
        </button>
        <div className="title-section">
          <h1>اختر الباقة المناسبة</h1>
          <p className="text-muted">اختر الباقة التي تناسب احتياجات سيرفرك واحتياجات مجتمعك.</p>
        </div>
      </header>

      <div className="packages-grid">
        {packages.map((pkg, index) => (
          <div key={pkg.id} className={`package-card glass-panel ${index === 1 ? 'popular' : ''}`}>
            {index === 1 && <div className="popular-badge">الأكثر طلباً</div>}
            
            <div className="package-header">
              <div className="package-icon">
                {index === 0 && <Star size={32} className="text-muted" />}
                {index === 1 && <Zap size={32} className="text-red" />}
                {index === 2 && <Crown size={32} style={{ color: '#fbbf24' }} />}
              </div>
              <h2>{pkg.name}</h2>
            </div>

            <div className="package-features">
              {pkg.features.map((feature, i) => (
                <div key={i} className="feature-item">
                  <Check size={18} className="text-red" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="package-footer">
              <p className="duration-label">المدد المتاحة:</p>
              <div className="duration-tags">
                {pkg.durationOptions.map(dur => (
                  <span key={dur} className="duration-tag">{dur}</span>
                ))}
              </div>
              <button className={`btn-primary full-width ${index !== 1 ? 'btn-outline' : ''}`}>
                طلب الباقة الآن
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="purchase-instruction glass-panel">
        <div className="instruction-header">
          <Star size={20} className="text-red" />
          <h3>كيفية تفعيل الباقة؟</h3>
        </div>
        <div className="instruction-steps">
          <div className="step">
            <div className="step-number">1</div>
            <p>قم بشراء الباقة من متجرنا في الديسكورد.</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <p>سيقوم البوت بإعطائك مفتاح رخصة (License Key).</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <p>قم بوضع المفتاح في السكربت داخل السيرفر وسيعمل تلقائياً.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Packages;
