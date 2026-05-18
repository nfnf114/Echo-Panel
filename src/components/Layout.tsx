import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import type { User } from '../types';
import './Layout.css';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="layout-container">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="main-content">
        <div className="top-nav">
          <div className="top-nav-title">
            <h2>Welcome back, <span className="text-red-gradient">{user.username}</span></h2>
          </div>
        </div>
        <div className="page-content animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
