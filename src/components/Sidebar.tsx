import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, Package, LogOut, Settings, Users } from 'lucide-react';
import clsx from 'clsx';
import './Sidebar.css';
import { User } from '../types';
import { checkActiveSubscription } from '../utils/subscription';

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    if (user?.discordId) {
      checkActiveSubscription(user.discordId).then(setHasActiveSubscription);
    }
  }, [user?.discordId]);

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        {/* Placeholder for Logo */}
        <div className="logo-container">
          {/* Instructing user to place logo.png in public folder */}
          <img src="/logo.png" alt="Echo-Panel Logo" className="logo-img" onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23e6192b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
          }}/>
          <h2 className="logo-text">Echo<span className="text-red-gradient">Panel</span></h2>
        </div>
      </div>

      {user && (
        <div className="user-profile">
          <img src={user.avatarUrl} alt="Discord Avatar" className="user-avatar" />
          <div className="user-info">
            <p className="user-name">{user.username}</p>
            <p className="user-role">User</p>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/servers" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
          <Server size={20} />
          <span>My Servers</span>
        </NavLink>
        {hasActiveSubscription && (
          <NavLink to="/client-area" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
            <Users size={20} />
            <span>Client Area</span>
          </NavLink>
        )}
        <NavLink to="/packages" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
          <Package size={20} />
          <span>Packages</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item logout-btn" onClick={onLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
