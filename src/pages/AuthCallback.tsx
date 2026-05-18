import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from '../types';
import './AuthCallback.css';

interface AuthCallbackProps {
  onLogin: (user: User) => void;
}

// Proper base64url decoder that handles JWT encoding
function decodeJWTPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    // Convert base64url to standard base64
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padding = (4 - base64.length % 4) % 4;
    if (padding) base64 += '='.repeat(padding);
    // Decode with Unicode support
    const decoded = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(decoded);
  } catch (e) {
    console.error('[AuthCallback] JWT decode error:', e);
    return null;
  }
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onLogin }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusText, setStatusText] = useState('جاري التحقق من الهوية...');
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution
    if (processedRef.current) return;
    processedRef.current = true;

    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      console.error('[AuthCallback] Error param:', error);
      navigate('/login?error=' + encodeURIComponent(error), { replace: true });
      return;
    }

    if (!token) {
      console.error('[AuthCallback] No token in URL');
      navigate('/login', { replace: true });
      return;
    }

    // Decode JWT payload
    const payload = decodeJWTPayload(token);

    if (!payload) {
      console.error('[AuthCallback] Failed to decode token');
      navigate('/login?error=invalid_token', { replace: true });
      return;
    }

    // Handle different payload formats from different auth routes
    const discordId = payload.discordId || payload.id || payload.discord_id || '';
    const username = payload.username || '';
    const avatarUrl = payload.avatarUrl 
      || (payload.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${payload.avatar}.png` : '')
      || `https://cdn.discordapp.com/embed/avatars/0.png`;

    if (!discordId) {
      console.error('[AuthCallback] No discordId in token payload:', payload);
      navigate('/login?error=invalid_token', { replace: true });
      return;
    }

    setStatusText('تم التحقق بنجاح! جاري تحضير اللوحة...');

    const user: User = {
      id: discordId,
      discordId: discordId,
      username: username,
      avatarUrl: avatarUrl,
      token: token,
    };

    // Save user and navigate immediately
    onLogin(user);
    
    // Navigate to the appropriate page after a brief visual delay
    setTimeout(() => {
      const redirectTo = localStorage.getItem('redirectAfterLogin') || 
                         sessionStorage.getItem('redirectAfterLogin');
      if (redirectTo) {
        localStorage.removeItem('redirectAfterLogin');
        sessionStorage.removeItem('redirectAfterLogin');
      }
      const targetPath = redirectTo || '/hub';
      
      // Use window.location.href for reliable navigation (prevents React Router race conditions)
      window.location.href = targetPath;
    }, 800);

  }, []); // Empty dependency - only run once

  return (
    <div className="auth-callback-page">
      <div className="auth-content glass-panel">
        <div className="loader-wrapper">
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
          <div className="logo-center">
             <img src="/logo.png" alt="Logo" className="pulse-logo" />
          </div>
        </div>
        <h2 className="status-title">{statusText}</h2>
        <p className="status-subtitle">يرجى الانتظار قليلاً بينما نقوم بربط حسابك</p>
      </div>
    </div>
  );
};

export default AuthCallback;
