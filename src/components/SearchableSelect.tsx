import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = 'اختر...', label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="searchable-select-wrapper" ref={wrapperRef} style={{ position: 'relative', width: '100%', marginBottom: '15px' }}>
      {label && <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>{label}</label>}
      
      <div 
        className="select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
      >
        <span style={{ color: selectedOption ? '#fff' : '#555' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
      </div>

      {isOpen && (
        <div className="select-dropdown glass-panel" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '5px',
          zIndex: 2000,
          maxHeight: '300px',
          overflowY: 'auto',
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <div className="search-box" style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, background: '#1a1a1a' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
              <input 
                type="text" 
                placeholder="ابحث هنا..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px 8px 8px 30px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>
          
          <div className="options-list">
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '15px', textAlign: 'center', color: '#555', fontSize: '13px' }}>لا توجد نتائج</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.value}
                  className="select-option"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  style={{
                    padding: '10px 15px',
                    cursor: 'pointer',
                    background: value === opt.value ? 'rgba(139, 0, 0, 0.1)' : 'transparent',
                    borderLeft: value === opt.value ? '3px solid #8b0000' : '3px solid transparent',
                    transition: '0.2s'
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: value === opt.value ? 'bold' : 'normal', fontSize: '14px' }}>{opt.label}</div>
                  {opt.description && <div style={{ color: '#555', fontSize: '11px' }}>{opt.description}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
