// Screenshots.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, RefreshCw, Users, Radio, Eye, AlertTriangle } from 'lucide-react'
import axios from 'axios'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const POLL_INTERVAL = 800 // 0.8 seconds - Fast polling for live view
const LIVE_CAPTURE_INTERVAL = 3000 // Request new screenshot every 3 seconds for all players

export default function Screenshots() {
  const [shots, setShots] = useState([])
  const [loading, setLoading] = useState(false)
  const [liveMode, setLiveMode] = useState(true)
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [missingScreenshotBasic, setMissingScreenshotBasic] = useState(false)
  const intervalRef = useRef(null)
  const liveCaptureRef = useRef(null)
  const lastCaptureRef = useRef(0)

  const H = () => ({
    Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`,
    'x-server-id': localStorage.getItem('active_server_id') || ''
  })

  const serverId = localStorage.getItem('active_server_id') || '0'

  // Fetch screenshots from the backend (this shows what has been captured)
  const fetchScreenshots = useCallback(async () => {
    try {
      // Try bridge cache first (fastest)
      const bridgeToken = sessionStorage.getItem('bridge_token')
      if (bridgeToken) {
        const { data } = await axios.get(`${API}/api/bridge/screenshots`, {
          headers: { 'x-bridge-token': bridgeToken }
        })
        if (Array.isArray(data) && data.length > 0) {
          // Check if any screenshot indicates missing screenshot-basic
          const hasMissing = data.some(s => s.status === 'screenshot-basic_required')
          setMissingScreenshotBasic(hasMissing)
          setShots(data)
          return
        }
      }
      
      // Fallback: fetch from file-based endpoint
      const { data } = await axios.get(`${API}/api/server/${serverId}/screenshots`, {
        headers: H()
      })
      if (data && data.screenshots) {
        // Group by targetId, keep only latest per player
        const latestByPlayer = {}
        for (const s of data.screenshots) {
          if (!latestByPlayer[s.targetId] || s.time > latestByPlayer[s.targetId].time) {
            latestByPlayer[s.targetId] = s
          }
        }
        
        const hasMissing = Object.values(latestByPlayer).some(s => s.status === 'screenshot-basic_required')
        setMissingScreenshotBasic(hasMissing)
        
        const formattedShots = Object.values(latestByPlayer)
          .filter(s => s.type === 'screen') // Only show actual screen captures
          .map(s => ({
            citizenid: s.targetId,
            name: s.targetId,
            screenshotUrl: s.url ? (s.url + '?t=' + Date.now()) : null, // Cache buster
            ts: new Date(s.time).toLocaleTimeString('ar-SA'),
            live: true,
            status: s.status
          }))
        setShots(formattedShots)
      }
    } catch (err) {
      console.error("Error fetching screenshots:", err)
    }
  }, [serverId])

  const fetchOnlinePlayers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/online`, { headers: H() })
      if (Array.isArray(data)) {
        setOnlinePlayers(data)
        // If we have online players but no screenshots, trigger capture immediately
        if (data.length > 0 && liveMode && shots.length === 0) {
          console.log("Online players found but no screenshots, triggering live capture...")
          runLiveCaptureNow()
        }
      }
    } catch (err) {
      console.error("Error fetching online players:", err)
    }
  }, [liveMode, shots.length])

  // Request a screenshot for a specific player via the proper action endpoint
  const requestScreenshot = useCallback(async (citizenid, isLive = false) => {
    try {
      const action = isLive ? 'live_screenshot' : 'screenshot'
      await axios.post(`${API}/api/server/${serverId}/player/${citizenid}/action`, {
        action,
        value: { quality: isLive ? 'low' : 'high' }
      }, { headers: H() })
      // console.log(`Requested ${action} for ${citizenid}`)
    } catch (err) {
      // Silent fail - network issues
    }
  }, [serverId])

  // Request screenshots for all online players IMMEDIATELY
  const captureAll = async () => {
    setLoading(true)
    try {
      // Get online players first
      const { data } = await axios.get(`${API}/api/online`, { headers: H() })
      const players = Array.isArray(data) ? data : []
      
      if (players.length === 0) {
        setLoading(false)
        return
      }
      
      console.log(`Capturing screenshots for ${players.length} players...`)
      
      // Request screenshot for each player (staggered to avoid overwhelming)
      for (let i = 0; i < players.length; i++) {
        setTimeout(() => {
          requestScreenshot(players[i].citizenid, liveMode) // Use live quality if in live mode
        }, i * 300) // Stagger by 300ms
      }
      
      // Start polling for results immediately
      setTimeout(async () => {
        await fetchScreenshots()
        setLoading(false)
      }, 2000)
    } catch (err) {
      console.error("Capture all error:", err)
      setLoading(false)
    }
  }

  // Immediate live capture - called when page loads or players appear
  const runLiveCaptureNow = useCallback(async () => {
    if (onlinePlayers.length === 0) {
      // Try to fetch online players first
      await fetchOnlinePlayers()
      if (onlinePlayers.length === 0) return
    }
    
    console.log(`Running live capture for ${onlinePlayers.length} players...`)
    
    // Request live screenshots for all online players
    for (const p of onlinePlayers) {
      if (p.citizenid) {
        requestScreenshot(p.citizenid, true)
      }
    }
    
    // Fetch results after a short delay
    setTimeout(() => {
      fetchScreenshots()
    }, 1000)
  }, [onlinePlayers, requestScreenshot, fetchOnlinePlayers, fetchScreenshots])

  // Auto-live capture loop: periodically request screenshots for online players
  const runLiveCapture = useCallback(async () => {
    const now = Date.now()
    if (now - lastCaptureRef.current < LIVE_CAPTURE_INTERVAL) return
    lastCaptureRef.current = now
    
    if (onlinePlayers.length > 0) {
      // Request live screenshots for all online players
      for (const p of onlinePlayers) {
        if (p.citizenid) {
          requestScreenshot(p.citizenid, true)
        }
      }
      // Fetch updated screenshots after requesting
      setTimeout(() => {
        fetchScreenshots()
      }, 800)
    }
  }, [onlinePlayers, requestScreenshot, fetchScreenshots])

  // Fast polling for screenshot display
  useEffect(() => {
    if (!liveMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial fetch and capture
    fetchOnlinePlayers()
    fetchScreenshots()
    
    // Trigger immediate capture on load
    setTimeout(() => {
      if (onlinePlayers.length > 0) {
        runLiveCaptureNow()
      }
    }, 1000)

    // Poll screenshots very fast (every POLL_INTERVAL)
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchScreenshots()
      }
    }, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [liveMode, fetchScreenshots, fetchOnlinePlayers, onlinePlayers.length, runLiveCaptureNow])

  // Refresh online players list every 5 seconds
  useEffect(() => {
    const onlineInterval = setInterval(() => {
      if (liveMode && document.visibilityState === 'visible') {
        fetchOnlinePlayers()
      }
    }, 5000)
    return () => clearInterval(onlineInterval)
  }, [liveMode, fetchOnlinePlayers])

  // Auto-live capture loop
  useEffect(() => {
    if (!liveMode) {
      if (liveCaptureRef.current) {
        clearInterval(liveCaptureRef.current)
        liveCaptureRef.current = null
      }
      return
    }

    liveCaptureRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        runLiveCapture()
      }
    }, LIVE_CAPTURE_INTERVAL)

    return () => {
      if (liveCaptureRef.current) {
        clearInterval(liveCaptureRef.current)
        liveCaptureRef.current = null
      }
    }
  }, [liveMode, runLiveCapture])

  // Also fetch when the page becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && liveMode) {
        fetchScreenshots()
        fetchOnlinePlayers()
        // Trigger capture if we have players but no shots
        if (onlinePlayers.length > 0 && shots.length === 0) {
          runLiveCaptureNow()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [liveMode, fetchScreenshots, fetchOnlinePlayers, onlinePlayers.length, shots.length, runLiveCaptureNow])

  // Merge player names from online players into shots
  const shotsWithNames = shots.map(s => {
    const onlinePlayer = onlinePlayers.find(p => p.citizenid === s.citizenid)
    return {
      ...s,
      name: onlinePlayer?.name || s.name || s.citizenid,
      isOnline: onlinePlayers.some(p => p.citizenid === s.citizenid),
      needsScreenshotBasic: !s.screenshotUrl && s.status === 'screenshot-basic_required'
    }
  }).filter(s => s.isOnline) // Only show online players

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">اللقطات المباشرة</h1>
          <p className="text-gray-400 text-sm">عرض حي لما يراه اللاعبون في اللعبة</p>
        </div>
        <div className="flex gap-2">
          {/* Live mode toggle */}
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              liveMode
                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                : 'bg-dark-700 text-gray-400 border border-dark-500'
            }`}
          >
            <Radio size={13} className={liveMode ? 'animate-pulse' : ''} />
            {liveMode ? 'بث مباشر (تلقائي)' : 'متوقف'}
          </button>
          <button onClick={captureAll} disabled={loading} className="btn-primary text-xs">
            <Camera size={13} className={loading ? 'animate-spin' : ''} /> التقاط الكل
          </button>
          <button onClick={fetchScreenshots} className="btn-secondary text-xs">
            <RefreshCw size={13} /> تحديث
          </button>
        </div>
      </div>

      {/* Live mode indicator */}
      {liveMode && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-green-400/70">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            تحديث تلقائي | المتصلون: {onlinePlayers.length} | آخر تحديث: {shots.length} لقطة
          </div>
          <button 
            onClick={runLiveCaptureNow}
            className="text-[10px] px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 transition"
          >
            طلب لقطات الآن
          </button>
        </div>
      )}

      {/* Missing screenshot-basic warning */}
      {missingScreenshotBasic && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-yellow-400 font-medium">⚠️ السيرفر لا يلتقط الصور تلقائياً</p>
            <p className="text-gray-400 text-xs mt-1">
              يتطلب البث المباشر تثبيت سكربت <code className="bg-dark-800 px-1 rounded">screenshot-basic</code> في السيرفر.
              قم بتثبيته وستظهر لقطات الشاشة تلقائياً.
            </p>
          </div>
        </div>
      )}

      {onlinePlayers.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-500 text-sm">
            لا يوجد لاعبون متصلون حالياً
          </p>
          <p className="text-gray-600 text-xs mt-2">سوف تظهر اللقطات تلقائياً عند اتصال اللاعبين</p>
        </div>
      ) : shotsWithNames.length === 0 ? (
        <div className="card text-center py-16">
          <Camera size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-500 text-sm">
            {liveMode
              ? 'جاري طلب اللقطات المباشرة من اللاعبين...'
              : 'اضغط "التقاط الكل" لعرض لقطات الشاشة'}
          </p>
          <p className="text-gray-600 text-xs mt-2">
            المتصلون: {onlinePlayers.length} لاعب
            {liveMode && (
              <button onClick={runLiveCaptureNow} className="block mx-auto mt-3 text-brand-red text-xs">
                ↻ طلب اللقطات الآن
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shotsWithNames.map((s) => (
            <div key={s.citizenid} className="card overflow-hidden group">
              <div className="aspect-video bg-dark-800 rounded-lg overflow-hidden relative mb-3">
                {s.needsScreenshotBasic ? (
                  <div className="flex flex-col items-center justify-center h-full text-yellow-400/70 px-4 text-center">
                    <Camera size={28} className="mb-2 opacity-50" />
                    <p className="text-xs">يتطلب screenshot-basic</p>
                    <p className="text-[10px] text-gray-500 mt-1">قم بتثبيته في سيرفرك للبث المباشر</p>
                  </div>
                ) : s.screenshotUrl ? (
                  <img 
                    src={s.screenshotUrl} 
                    alt={`شاشة ${s.name}`} 
                    className="w-full h-full object-cover" 
                    key={s.screenshotUrl}
                    onError={(e) => {
                      // If image fails to load, mark as missing
                      console.log(`Failed to load screenshot for ${s.name}`)
                      e.target.style.display = 'none'
                      e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-gray-600"><Camera size="32" /></div>'
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600">
                    <Camera size={32} />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className="badge-online text-xs bg-green-600/80">متصل</span>
                  {liveMode && (
                    <span className="bg-red-500/80 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Eye size={10} /> مباشر
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center">
                    <Users size={12} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-medium">{s.name}</p>
                    <p className="text-gray-500 text-xs font-mono">{s.citizenid}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => requestScreenshot(s.citizenid, false)} 
                    className="text-[10px] px-2 py-1 rounded bg-brand-red/10 text-brand-red border border-brand-red/20 hover:bg-brand-red hover:text-white transition-colors"
                    title="التقاط صورة عالية الجودة"
                  >
                    <Camera size={10} className="inline ml-1" /> لقطة
                  </button>
                  <span className="text-gray-600 text-xs">{s.ts || ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}