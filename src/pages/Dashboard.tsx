import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Server as ServerIcon, Users, ShieldAlert, Package, Ban, UserSquare, 
  BarChart2, Briefcase, UserPlus, Cloud, Sun, Trash2, Clock, Globe, 
  RefreshCw, Zap, Smartphone, Key, CloudRain, Snowflake, Pause, Play, 
  Power, Moon, Thermometer, Wind
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../App';
import { fetchWithAuth } from '../utils/api';
import './Dashboard.css';

import { API_URL } from '../config';

const Dashboard: React.FC = () => {
  const { serverId } = useParams();
  const { lang, t } = useLanguage();
  const [server, setServer] = useState<any>(null);
  const [fullStats, setFullStats] = useState<any>({
    characters: 0, vehicles: 0, bans: 0, inventories: 0, dupes: 0, gangs: 0, stashes: 0
  });
  const [activityData, setActivityData] = useState<any[]>([]);
  const [topJobs, setTopJobs] = useState<any[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServerData();
    const interval = setInterval(fetchServerData, 30000);
    return () => clearInterval(interval);
  }, [serverId]);

  const fetchServerData = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}`);
      const data = await res.json();
      if (data.server) {
        setServer(data.server);
        try {
          const pData = data.server.players_data;
          const parsed = typeof pData === 'string' ? JSON.parse(pData) : (pData || []);
          setOnlinePlayers(Array.isArray(parsed) ? parsed : []);
        } catch(e) { setOnlinePlayers([]); }
      }
      
      const statsRes = await fetchWithAuth(`${API_URL}/api/server/${serverId}/stats-full`);
      const statsData = await statsRes.json();
      if (statsData.stats) {
        setFullStats(statsData.stats);
      }

      const activityRes = await fetchWithAuth(`${API_URL}/api/server/${serverId}/activity`);
      const activityJson = await activityRes.json();
      if (activityJson.activity) {
        // Create a 24-hour map
        const hoursMap: any = {};
        activityJson.activity.forEach((a: any) => {
          const hr = new Date(a.recorded_at).getHours();
          hoursMap[hr] = a.players;
        });

        const full24Hours = [];
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
          const d = new Date(now);
          d.setHours(now.getHours() - i, 0, 0, 0);
          const hr = d.getHours();
          full24Hours.push({
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            players_count: hoursMap[hr] || 0
          });
        }
        setActivityData(full24Hours);
      }

      const jobsRes = await fetchWithAuth(`${API_URL}/api/server/${serverId}/top-jobs`);
      const jobsJson = await jobsRes.json();
      if (jobsJson.jobs) {
        setTopJobs(jobsJson.jobs);
      }
    } catch (e) {
      console.error('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const executeWorldAction = async (action: string, data: any = {}) => {
    try {
      await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: action, target_id: 'GLOBAL', data })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const isOnline = server?.status === 'online';
  const currentPlayers = server?.current_players || 0;
  const maxPlayers = server?.max_players || 32;

  if (loading) return (
    <div className="flex-center" style={{height: '100vh', flexDirection: 'column', gap: '15px'}}>
      <RefreshCw size={40} className="spin text-red" />
      <span className="sub-text">Loading Dashboard...</span>
    </div>
  );

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="dashboard-header-title">
        <h2 className="title-text">{t('dashboardTitle')}</h2>
      </div>

      {/* Top Status Row */}
      <div className="dashboard-status-row">
        
        {/* Server Status */}
        <div className="dash-card">
          <div className="card-header">
            <span className="card-label">{t('serverStatus').toUpperCase()}</span>
            <span className={`status-dot ${isOnline ? 'green' : 'red'}`}></span>
          </div>
          <div className="card-content-flex">
            <div className={`icon-box ${isOnline ? 'border-green' : 'border-red'}`}>
              <ServerIcon size={18} className={isOnline ? 'text-green' : 'text-red'} />
            </div>
            <div className="text-col">
              <h3 className="card-val">{isOnline ? t('online') : t('offline')}</h3>
              <div className={`sub-badge ${isOnline ? 'green-badge' : 'red-badge'}`}>
                <span className="dot"></span> {isOnline ? (lang === 'ar' ? 'الربط: متصل' : 'Sync: Connected') : (lang === 'ar' ? 'الربط: غير متصل' : 'Sync: Offline')}
              </div>
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="dash-card">
          <div className="card-header right-align">
            <span className="card-label text-red"><Users size={12}/> {t('connectedPlayers')}</span>
          </div>
          <div className="card-content-flex col-reverse">
            <div className="text-col right-align">
              <h3 className="card-val">{(currentPlayers).toLocaleString('en-US')}/{(maxPlayers).toLocaleString('en-US')}</h3>
              <span className="sub-text">{lang === 'ar' ? 'اللاعبين الحاليين في السيرفر' : 'Current players in server'}</span>
            </div>
          </div>
          <div className="progress-bar mt-2">
            <div className="progress-fill red-fill" style={{ width: `${Math.min((currentPlayers/maxPlayers)*100, 100)}%` }}></div>
          </div>
        </div>

        {/* Last Sync */}
        <div className="dash-card">
          <div className="card-header right-align">
            <span className="card-label text-red"><Clock size={12}/> {t('lastSync')}</span>
          </div>
          <div className="card-content-flex col-reverse">
            <div className="text-col right-align">
              <h3 className="card-val-sm">{server?.last_sync ? new Date(server.last_sync).toLocaleString('en-GB') : '—'}</h3>
              <span className="sub-text">{t('syncDesc')}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Totals Section */}
      <div className="totals-section mt-4">
        <div className="section-title-right">
          <span className="text-red"><BarChart2 size={16} /> {t('generalStats')}</span>
        </div>
        
        <div className="totals-grid">
          <div className="dash-card small">
            <span className="card-label"><UserSquare size={12}/> {t('characters')}</span>
            <h3 className="card-val mt-2">{(fullStats.characters || 0).toLocaleString('en-US')}</h3>
          </div>
          <div className="dash-card small">
            <span className="card-label"><Package size={12}/> {t('vehicles')}</span>
            <h3 className="card-val mt-2">{(fullStats.vehicles || 0).toLocaleString('en-US')}</h3>
          </div>
          <div className="dash-card small">
            <span className="card-label"><Smartphone size={12}/> {t('stashes')}</span>
            <h3 className="card-val mt-2">{(fullStats.stashes || 0).toLocaleString('en-US')}</h3>
          </div>
          <div className="dash-card small">
            <span className="card-label"><Ban size={12}/> {t('bans')}</span>
            <h3 className="card-val mt-2">{(fullStats.bans || 0).toLocaleString('en-US')}</h3>
          </div>
          <div className="dash-card small">
            <span className="card-label text-red"><ShieldAlert size={12}/> {t('dupes')}</span>
            <h3 className="card-val mt-2">{(fullStats.dupes || 0).toLocaleString('en-US')}</h3>
          </div>
          <div className="dash-card small">
            <span className="card-label"><Users size={12}/> {t('gangs')}</span>
            <h3 className="card-val mt-2">{(fullStats.gangs || 0).toLocaleString('en-US')}</h3>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row mt-4">
        <div className="chart-card large">
          <div className="card-header right-align border-bottom pb-2">
             <span className="card-label"><BarChart2 size={12}/> {t('activityChart')}</span>
          </div>
          <div className="chart-placeholder">
             {activityData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%" dir="ltr">
                 <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#8b0000" stopOpacity={0.8}/>
                       <stop offset="95%" stopColor="#8b0000" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <XAxis dataKey="time" stroke="#555" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                   <YAxis 
                     stroke="#555" 
                     fontSize={11} 
                     axisLine={false} 
                     tickLine={false} 
                     domain={[0, maxPlayers]}
                     allowDataOverflow={false}
                   />
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#111', borderColor: '#222', borderRadius: '8px', color: '#fff' }} 
                     itemStyle={{ color: '#8b0000' }}
                     labelStyle={{ color: '#888' }}
                   />
                   <Area type="monotone" dataKey="players_count" name={lang === 'ar' ? 'اللاعبين' : 'Players'} stroke="#8b0000" strokeWidth={3} fillOpacity={1} fill="url(#colorPlayers)" />
                 </AreaChart>
               </ResponsiveContainer>
             ) : (
               <div className="flex-center" style={{height:'100%'}}>
                 <span className="sub-text">{t('noActivity')}</span>
               </div>
             )}
          </div>
        </div>
        <div className="chart-card small">
          <div className="card-header right-align border-bottom pb-2">
             <span className="card-label"><Briefcase size={12}/> {t('topJobs')}</span>
          </div>
          <div className="top-jobs-list mt-3">
             {topJobs.length > 0 ? topJobs.map((job, idx) => (
               <div key={idx} className="job-row">
                 <div className="job-info">
                   <div className="job-icon-mini"><Briefcase size={10} /></div>
                   <div className="job-details">
                     <span className="job-name">{job.name}</span>
                   </div>
                 </div>
                 <div className="job-count-badge">{(job.count || 0).toLocaleString('en-US')}</div>
               </div>
             )) : (
               <div className="flex-center" style={{height:'200px'}}>
                 <span className="sub-text">{t('noJobs')}</span>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Live Online Players */}
      <div className="last-joined-section mt-4">
        <div className="section-title-right">
          <span className="text-red"><Users size={16} /> {t('onlinePlayersCount')} ({onlinePlayers.length.toLocaleString('en-US')})</span>
        </div>
        <div className="dash-card p-3">
          {onlinePlayers.length === 0 ? (
            <div className="flex-center" style={{padding:'20px'}}>
              <span className="sub-text">{t('noPlayers')}</span>
            </div>
          ) : (
            <div className="online-players-grid">
              {onlinePlayers.map((p, idx) => {
                const char = p.charinfo || {};
                const packageType = p.package || 'Basic';
                const fullName = ((char.firstname || '') + ' ' + (char.lastname || '')).trim() || p.name || 'Unknown';
                const profilePic = p.profilepic || char.profilepic;
                const faceFallback = `${API_URL}/uploads/avatars/${p.citizenid}_face.png`;
                const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=1a1a2e&color=8b0000&size=40`;
                const imgSrc = (profilePic && profilePic !== 'none' && profilePic.trim() !== '') 
                  ? profilePic 
                  : faceFallback;

                return (
                  <div key={idx} className="online-player-card">
                    <div className="player-meta">
                      <span className={`package-badge ${packageType.toLowerCase()}`}>{packageType} {lang === 'ar' ? 'خطة' : 'Plan'}</span>
                      <span className="player-id">ID: {(p.id || p.source || 0).toLocaleString('en-US')}</span>
                    </div>
                    <div className="player-info-main">
                      <div className="player-text">
                        <div className="player-name">{fullName}</div>
                        <div className="player-citizenid">{p.citizenid}</div>
                      </div>
                      <img 
                        src={imgSrc} 
                        className="player-avatar-sm" 
                        alt="av" 
                        onError={(e: any) => {
                          e.target.onerror = null;
                          const screenshotUrl = `${API_URL}/uploads/screenshots/${p.citizenid}.webp`;
                          e.target.src = screenshotUrl;
                          e.target.onerror = (e2: any) => {
                            e2.target.onerror = null;
                            e2.target.src = fallbackSrc;
                          };
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* World Controls */}
      <div className="world-controls-section mt-4 animate-slide-up">
        <div className="section-title-right">
          <span className="text-red"><Globe size={16} /> {t('worldControls')}</span>
        </div>
        <div className="dash-card glass-panel" style={{ padding: '25px' }}>
          <div className="world-grid">
            
            {/* Weather Controls */}
            <div className="world-group">
              <span className="label">{t('weatherControl')}</span>
              <div className="btn-row" style={{ flexDirection: 'column' }}>
                <div className="select-with-icon">
                  <Cloud size={14} className="select-icon" />
                  <select 
                    className="mini-btn select-has-icon" 
                    style={{ width: '100%', background: '#111', color: 'white', border: '1px solid #333', flex: 1 }}
                    onChange={(e) => executeWorldAction('weather', { weather: e.target.value })}
                  >
                    <option value="">{lang === 'ar' ? 'اختر حالة الطقس...' : 'Select weather...'}</option>
                    <option value="EXTRASUNNY">☀️ Extra Sunny</option>
                    <option value="CLEAR">🌤️ Clear</option>
                    <option value="NEUTRAL">🌡️ Neutral</option>
                    <option value="SMOG">💨 Smog</option>
                    <option value="FOGGY">🌫️ Foggy</option>
                    <option value="OVERCAST">☁️ Overcast</option>
                    <option value="CLOUDS">☁️ Clouds</option>
                    <option value="RAIN">🌧️ Rain</option>
                    <option value="THUNDER">⛈️ Thunder</option>
                    <option value="SNOW">❄️ Snow</option>
                    <option value="BLIZZARD">🌨️ Blizzard</option>
                    <option value="XMAS">🎄 Xmas</option>
                  </select>
                </div>
                <div className="btn-row">
                  <button className="mini-btn" onClick={() => executeWorldAction('weather', { weather: 'EXTRASUNNY' })}><Sun size={14} /> {lang === 'ar' ? 'مشمس' : 'Sunny'}</button>
                  <button className="mini-btn" onClick={() => executeWorldAction('weather', { weather: 'CLOUDS' })}><Cloud size={14} /> {lang === 'ar' ? 'غائم' : 'Cloudy'}</button>
                  <button className="mini-btn" onClick={() => executeWorldAction('weather', { weather: 'RAIN' })}><CloudRain size={14} /> {lang === 'ar' ? 'ماطر' : 'Rain'}</button>
                  <button className="mini-btn" onClick={() => executeWorldAction('weather', { weather: 'SNOW' })}><Snowflake size={14} /> {lang === 'ar' ? 'ثلج' : 'Snow'}</button>
                  <button className="mini-btn" onClick={() => executeWorldAction('weather', { weather: 'THUNDER' })}><Zap size={14} /> {lang === 'ar' ? 'رعد' : 'Thunder'}</button>
                </div>
              </div>
            </div>

            {/* Time Controls */}
            <div className="world-group">
              <span className="label">{t('timeControl')}</span>
              <div className="btn-row" style={{ alignItems: 'center' }}>
                <div className="input-with-icon">
                  <Clock size={14} className="input-icon" />
                  <input 
                    type="number" 
                    min="0" 
                    max="23" 
                    defaultValue="12"
                    id="customHourInput"
                    className="mini-btn input-has-icon" 
                    style={{ width: '70px', background: '#111', textAlign: 'center' }}
                  />
                </div>
                <button className="mini-btn active" onClick={() => {
                  const val = (document.getElementById('customHourInput') as HTMLInputElement).value;
                  executeWorldAction('time', { hour: val });
                }}><Clock size={14} /> {t('apply')}</button>
              </div>
              <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                <button className="mini-btn" style={{ flex: 1 }} onClick={() => executeWorldAction('freeze_time', { freeze: true })}><Pause size={14} /> {t('freeze')}</button>
                <button className="mini-btn" style={{ flex: 1 }} onClick={() => executeWorldAction('freeze_time', { freeze: false })}><Play size={14} /> {t('resume')}</button>
              </div>
            </div>

            {/* System Controls */}
            <div className="world-group">
              <span className="label">{t('systemTools')}</span>
              <div className="btn-row">
                <button className="mini-btn" onClick={() => executeWorldAction('blackout', { blackout: true })}><Moon size={14} /> {t('blackoutOn')}</button>
                <button className="mini-btn" onClick={() => executeWorldAction('blackout', { blackout: false })}><Sun size={14} /> {t('blackoutOff')}</button>
              </div>
              <div className="btn-row">
                <button className="mini-btn danger" style={{ width: '100%' }} onClick={() => executeWorldAction('clear_vehicles')}>
                  <Trash2 size={14} /> {t('clearVehicles')}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
