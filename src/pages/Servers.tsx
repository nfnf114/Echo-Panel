import React, { useState } from 'react';
import { Server, Package } from '../types';
import { Edit2, Copy, Play, SquareTerminal, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../App';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Servers.css';

interface ServersProps {
  servers: Server[];
  packages: Package[];
  onUpdateServerName: (id: string, newName: string) => void;
}

const Servers: React.FC<ServersProps> = ({ servers, packages, onUpdateServerName }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const navigate = useNavigate();
  const { lang, t } = useLanguage();

  const handleEditClick = (server: Server) => {
    setEditingId(server.id);
    setEditName(server.name);
  };

  const handleSave = (id: string) => {
    onUpdateServerName(id, editName);
    setEditingId(null);
  };

  const getPackageName = (packageId: string) => {
    return packages.find(p => p.id === packageId)?.name || 'Unknown';
  };

  return (
    <div className="servers-container animate-fade-in">
      <div className="top-bar-actions">
        <button className="back-to-hub-global" onClick={() => navigate('/hub')}>
          <ChevronLeft size={18} /> {t('back')}
        </button>
        <LanguageSwitcher />
      </div>

      <div className="page-header">
        <div>
          <h1 className="text-gradient">{t('serverMgmt')}</h1>
          <p className="text-muted">{lang === 'ar' ? 'إدارة السيرفرات النشطة المربوطة بحسابك.' : 'Manage your active FiveM servers linked to your account.'}</p>
        </div>
      </div>

      <div className="servers-grid">
        {servers.map(server => (
          <div key={server.id} className="server-card glass-panel">
            <div className="server-card-header">
              <div className="server-title-edit">
                {editingId === server.id ? (
                  <div className="edit-mode">
                    <input 
                      type="text" 
                      className="input-field small-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button className="btn-primary small-btn" onClick={() => handleSave(server.id)}>Save</button>
                  </div>
                ) : (
                  <>
                    <h3>{server.name}</h3>
                    <button className="icon-btn" onClick={() => handleEditClick(server)}>
                      <Edit2 size={16} />
                    </button>
                  </>
                )}
              </div>
              <span className="status-dot online"></span>
            </div>

            <div className="server-details">
              <div className="detail-item">
                <span className="detail-label">IP Address</span>
                <div className="ip-box">
                  <code>{server.ip}</code>
                  <button className="icon-btn" onClick={() => navigator.clipboard.writeText(server.ip)}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-item">
                  <span className="detail-label">Package</span>
                  <span className="detail-value text-red-gradient">{getPackageName(server.packageId)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Expires At</span>
                  <span className="detail-value">{new Date(server.expiresAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="server-actions">
              <button className="action-btn success">
                <Play size={18} />
                Start
              </button>
              <button className="action-btn danger">
                <SquareTerminal size={18} />
                Console
              </button>
            </div>
          </div>
        ))}

        {servers.length === 0 && (
          <div className="empty-state glass-panel">
            <h2>No Servers Found</h2>
            <p className="text-muted">You haven't linked any servers to this account yet.</p>
            <p className="text-muted">Buy a package and run the bot command to register your server.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Servers;
