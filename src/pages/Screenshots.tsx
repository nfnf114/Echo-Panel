import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, X, AlertTriangle, CheckCircle, Radio, RadioOff } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { fetchWithAuth } from '../utils/api';
import './Screenshots.css';

import { API_URL } from '../config';

// Stagger delay between captures (ms) - reduced for live streaming
const STAGGER_DELAY = 200;
// Minimum interval between captures for the same player (ms) - reduced for live streaming
const MIN_CAPTURE_INTERVAL = 200;
// Auto-refresh interval for individual screenshots (ms) - reduced for near-real-time
const LIVE_REFRESH_INTERVAL = 300;

const Screenshots: React.FC = () => {
  const { serverId } = useParams();
  const { showNotification } = useNotification();
  const [players, setPlayers] = useState<any[]>([]);
  const [screenshots, setScreenshots] = useState<Record<string, string>>({});
  const [screenshotTimes, setScreenshotTimes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [isCapturing, setIsCapturing] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState(false);

  // Refs for live mode
  const liveModeRef = useRef(false);
  const captureQueueRef = useRef<string[]>([]);
  const lastCaptureTimeRef = useRef<Record<string, number>>({});
  const isProcessingQueueRef = useRef(false);
  const visibleCardsRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Keep liveModeRef in sync
  useEffect(() => {
    liveModeRef.current = liveMode;
  }, [liveMode]);

  // Fetch online players
  const fetchPlayers = useCallback(async () => {
    try {
      const sRes = await fetchWithAuth(`${API_URL}/api/server/${serverId}`);
      const sData = await sRes.json();
      const onlinePlayers = typeof sData.server?.players_data === 'string'
        ? JSON.parse(sData.server.players_data)
        : sData.server?.players_data || [];
      setPlayers(onlinePlayers);
    } catch (e) {
      console.error(e);
    }
  }, [serverId]);

  // Fetch screenshots
  const fetchScreenshots = useCallback(async () => {
    try {
      const scRes = await fetchWithAuth(`${API_URL}/api/server/${serverId}/screenshots`);
      const scData = await scRes.json();
      const scList = scData.screenshots || [];
      const scMap: Record<string, string> = {};
      const timeMap: Record<string, number> = {};
      scList.forEach((s: any) => {
        if (s.targetId && s.type === 'screen') {
          scMap[s.targetId] = s.url;
          timeMap[s.targetId] = s.timestamp || Date.now();
        }
      });
      setScreenshots(scMap);
      setScreenshotTimes(timeMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      await fetchPlayers();
      await fetchScreenshots();
    };
    loadData();
  }, [fetchPlayers, fetchScreenshots]);

  // Request a single screenshot (used for both manual and live captures)
  const requestScreenshot = useCallback(async (citizenid: string, quality: 'low' | 'high' = 'low') => {
    const now = Date.now();
    const lastCapture = lastCaptureTimeRef.current[citizenid] || 0;
    if (now - lastCapture < MIN_CAPTURE_INTERVAL) return false;

    lastCaptureTimeRef.current[citizenid] = now;
    setIsCapturing(citizenid);

    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/player/${citizenid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: quality === 'low' ? 'live_screenshot' : 'screenshot',
          value: { quality }
        })
      });

      if (res.ok) {
        // Poll for the screenshot result after a delay
        setTimeout(() => fetchScreenshots(), 3000);
        setTimeout(() => fetchScreenshots(), 6000);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Screenshot request failed:', e);
      return false;
    } finally {
      setTimeout(() => setIsCapturing(null), 1000);
    }
  }, [serverId, fetchScreenshots]);

  // Manual high-quality capture for a single player
  const requestSingleScreenshot = useCallback(async (citizenid: string) => {
    const success = await requestScreenshot(citizenid, 'high');
    if (success) {
      showNotification('Requesting high-quality screenshot...', 'success');
    } else {
      showNotification('Failed to request screenshot (rate limited)', 'error');
    }
  }, [requestScreenshot, showNotification]);

  // Capture all players (manual bulk action)
  const requestAllScreenshots = useCallback(async () => {
    setIsCapturing('ALL');
    try {
      await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'screenshot_all',
          target_id: 'GLOBAL',
        })
      });
      showNotification('Screenshot request sent to all players', 'success');
      setTimeout(() => setShowCaptureModal(false), 500);
      // Wait for uploads to finish then refresh
      setTimeout(() => fetchScreenshots(), 2000);
      setTimeout(() => fetchScreenshots(), 5000);
      setTimeout(() => fetchScreenshots(), 8000);
      setTimeout(() => fetchScreenshots(), 11000);
    } catch (e) {
      console.error(e);
      showNotification('Failed to send screenshot request', 'error');
    } finally {
      setTimeout(() => setIsCapturing(null), 2000);
    }
  }, [serverId, fetchScreenshots, showNotification]);

  // Process the capture queue (staggered, one player at a time)
  const processCaptureQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (captureQueueRef.current.length > 0 && liveModeRef.current) {
      const cid = captureQueueRef.current.shift();
      if (!cid) continue;

      // Only capture if card is visible
      if (!visibleCardsRef.current.has(cid)) continue;

      await requestScreenshot(cid, 'low');
      await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
    }

    isProcessingQueueRef.current = false;
  }, [requestScreenshot]);

  // Live mode: schedule periodic captures
  useEffect(() => {
    if (!liveMode) return;

    const runLiveCycle = () => {
      if (!liveModeRef.current) return;

      // Build capture queue from visible online players
      const now = Date.now();
      const queue: string[] = [];

      players.forEach(p => {
        const cid = p.citizenid;
        if (!cid) return;

        // Only add visible players that haven't been captured recently
        const lastCapture = lastCaptureTimeRef.current[cid] || 0;
        if (now - lastCapture >= LIVE_REFRESH_INTERVAL) {
          queue.push(cid);
        }
      });

      // Prioritize visible cards
      queue.sort((a, b) => {
        const aVis = visibleCardsRef.current.has(a) ? 0 : 1;
        const bVis = visibleCardsRef.current.has(b) ? 0 : 1;
        return aVis - bVis;
      });

      captureQueueRef.current = queue;
      processCaptureQueue();
    };

    // Start first cycle after a short delay
    const initialTimeout = setTimeout(runLiveCycle, 2000);
    // Run cycles periodically
    const intervalId = setInterval(runLiveCycle, LIVE_REFRESH_INTERVAL + STAGGER_DELAY * 10);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [liveMode, players, processCaptureQueue]);

  // Pause live mode when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && liveModeRef.current) {
        // Don't stop live mode, just clear the queue to stop captures
        captureQueueRef.current = [];
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Intersection Observer for visibility-based capture
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const cid = entry.target.getAttribute('data-citizenid');
          if (!cid) return;

          if (entry.isIntersecting) {
            visibleCardsRef.current.add(cid);
          } else {
            visibleCardsRef.current.delete(cid);
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe all card elements
    Object.values(cardRefsRef.current).forEach(el => {
      if (el && observerRef.current) {
        observerRef.current.observe(el);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [players]);

  // Periodic player list refresh (slower than screenshot refresh)
  useEffect(() => {
    const interval = setInterval(fetchPlayers, 30000);
    return () => clearInterval(interval);
  }, [fetchPlayers]);

  // Ref callback for cards
  const setCardRef = useCallback((cid: string, el: HTMLDivElement | null) => {
    cardRefsRef.current[cid] = el;
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  }, []);

  const toggleLiveMode = () => {
    setLiveMode(prev => {
      if (prev) {
        // Turning off
        captureQueueRef.current = [];
        showNotification('Live mode disabled', 'success');
      } else {
        // Turning on
        showNotification('Live mode enabled - auto-capturing visible players', 'success');
      }
      return !prev;
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="screenshots-page animate-fade-in">
      <div className="screenshots-main-container">

        {/* Header Section */}
        <div className="screenshots-header-section">
          <div className="screenshots-buttons-left">
            <button
              className={`btn-live-toggle ${liveMode ? 'active' : ''}`}
              onClick={toggleLiveMode}
            >
              {liveMode ? <Radio size={16} className="pulse-icon" /> : <RadioOff size={16} />}
              {liveMode ? 'LIVE ON' : 'LIVE OFF'}
            </button>
            <button className="btn-red-capture" onClick={() => setShowCaptureModal(true)}>
              Capture All
            </button>
            <button className="btn-dark-refresh" onClick={() => { fetchPlayers(); fetchScreenshots(); }}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="screenshots-title-right">
            <div className="flex-col-end">
              <h1 className="title-text">Live Screenshots</h1>
              <span className="sub-text-gray">
                Online: {players.length} | {liveMode ? 'LIVE - Auto-capturing every ~10s' : 'Manual mode'}
              </span>
            </div>
          </div>
        </div>

        {/* Grid Section */}
        <div className="screenshots-grid-container">
          {players.length === 0 ? (
            <div className="no-players-msg text-center">No online players currently.</div>
          ) : (
            <div className="screenshots-grid">
              {players.map((p, idx) => {
                const cid = p.citizenid || 'Unknown';
                const charName = p.charinfo ? `${p.charinfo.firstname} ${p.charinfo.lastname}` : p.name;
                const latestImg = screenshots[cid];
                const captureTime = screenshotTimes[cid];
                const isBeingCaptured = isCapturing === cid;

                return (
                  <div
                    className="screenshot-card-dark"
                    key={idx}
                    data-citizenid={cid}
                    ref={(el) => setCardRef(cid, el)}
                  >
                    <div className="card-top-bar">
                      <div className="card-actions-left">
                        <button
                          className="btn-card-capture"
                          onClick={() => requestSingleScreenshot(cid)}
                          title="High-quality capture"
                          disabled={!!isCapturing}
                        >
                          <Camera size={16} />
                        </button>
                        {liveMode && <div className="live-badge">LIVE</div>}
                        <div className="status-badge-outline">Online</div>
                      </div>
                      <div className="player-meta-info">
                        <span className="player-name">{charName}</span>
                        <span className="player-cid">{cid}</span>
                      </div>
                    </div>

                    <div className="screenshot-image-area">
                      {latestImg ? (
                        <img
                          src={`${latestImg}?t=${captureTime || Date.now()}`}
                          alt="Live view"
                          onClick={() => window.open(latestImg, '_blank')}
                        />
                      ) : (
                        <div className="no-image-placeholder">
                          <Camera size={24} className="text-muted" />
                          <span className="placeholder-text">No screenshot yet</span>
                        </div>
                      )}
                    </div>

                    {captureTime && (
                      <div className="card-bottom-bar">
                        <span className="capture-time">{formatTimeAgo(captureTime)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Capture Modal */}
      {showCaptureModal && (
        <div className="modal-overlay-dark">
          <div className="capture-modal-box">
            <div className="modal-header-flex">
              <button className="close-btn" onClick={() => setShowCaptureModal(false)}><X size={18} /></button>
              <div className="title-with-icon">
                <AlertTriangle size={20} className="text-yellow" />
                <h2 className="modal-title-red-line">Capture All Screenshots</h2>
              </div>
            </div>

            <div className="modal-body text-right mt-3 mb-4">
              <p className="text-muted text-sm">This will request screenshots from all online players ({players.length}). High-quality captures may take a few seconds per player.</p>
            </div>

            <div className="modal-footer-flex-reverse">
              <button className="btn-confirm-yellow" onClick={requestAllScreenshots} disabled={isCapturing === 'ALL'}>
                {isCapturing === 'ALL' ? 'Requesting...' : 'Confirm'}
              </button>
              <button className="btn-cancel-dark" onClick={() => setShowCaptureModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Screenshots;
