import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export function getH() {
  return {
    Authorization: `Bearer ${sessionStorage.getItem('panel_token')}`,
    'x-server-id': localStorage.getItem('active_server_id') || ''
  }
}

export function parseJ(v) {
  try { return typeof v === 'string' ? JSON.parse(v) : (v || {}) } catch { return {} }
}
export function parseArr(v) {
  try {
    const p = typeof v === 'string' ? JSON.parse(v) : v
    return Array.isArray(p) ? p : Object.values(p || {}).filter(Boolean)
  } catch { return [] }
}

export async function issueCommand(type, target, payload) {
  await axios.post(`${API}/api/issue-command`, { type, target, payload }, { headers: getH() })
}

// ── Shared Modal Wrapper ─────────────────────────────────────
export function Modal({ title, subtitle, onClose, children, width = 'max-w-xl' }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#0a0a0f]/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()} dir="rtl">
      <div className={`bg-[#111317] border border-dark-600 rounded-2xl w-full ${width} relative`}>
        <button onClick={onClose} className="absolute top-4 left-4 p-1 text-gray-500 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="p-8 pt-10">
          <div className="text-center mb-8">
            <h3 className="font-bold text-white text-lg">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 font-mono mt-1">{subtitle}</p>}
          </div>
          <div>{children}</div>
        </div>
      </div>
    </div>
  )
}

// ── Reusable Select + Input ──────────────────────────────────
export function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-xs font-bold text-white text-right">{label}</label>}
      {children}
    </div>
  )
}

export function Inp({ ...props }) {
  return <input {...props} className={`w-full bg-[#0d0f14] border border-dark-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-red placeholder-gray-600 transition-colors ${props.className||''}`} />
}

export function Sel({ children, ...props }) {
  return (
    <div className="relative">
      <select {...props} className={`w-full bg-[#0d0f14] border border-dark-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-red appearance-none cursor-pointer transition-colors ${props.className||''}`}>
        {children}
      </select>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
    </div>
  )
}

export function SearchableSelect({ options, value, onChange, placeholder = 'اختر...' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  
  const filtered = options.filter(o => 
    (o.label || '').toLowerCase().includes(search.toLowerCase()) || 
    (o.value || '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedOpt = options.find(o => o.value === value)

  return (
    <div className="relative">
      <div 
        onClick={() => setOpen(!open)}
        className={`w-full bg-[#0d0f14] border ${open ? 'border-brand-red' : 'border-dark-600'} rounded-xl px-4 py-3 text-sm cursor-pointer flex items-center justify-between transition-colors`}
      >
        <span className={selectedOpt ? 'text-white font-bold' : 'text-gray-500 font-bold'}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#111317] border border-dark-600 rounded-xl z-50 overflow-hidden flex flex-col max-h-60 animate-fade-in">
            <div className="p-2 border-b border-dark-600">
              <input 
                autoFocus
                type="text" 
                placeholder="بحث..." 
                className="w-full bg-[#0d0f14] border border-dark-600 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-red"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
              {filtered.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-500">لا توجد نتائج</div>
              ) : filtered.map(o => (
                <div 
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch('') }}
                  className={`px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors flex items-center justify-between ${o.value === value ? 'bg-brand-red/10 text-brand-red font-bold' : 'text-gray-300 hover:bg-dark-700 hover:text-white'}`}
                >
                  <span>{o.label}</span>
                  {o.subLabel && <span className="text-[10px] text-gray-500 font-mono">{o.subLabel}</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function Btns({ onClose, onSubmit, loading, danger, submitText = 'تأكيد' }) {
  return (
    <div className="flex items-center justify-end gap-4 pt-8 mt-2">
      <button onClick={onClose} className="px-8 py-3 w-32 rounded-xl border border-dark-600 text-gray-400 hover:text-white hover:bg-dark-800 text-base font-bold transition-colors text-center">إلغاء</button>
      <button onClick={onSubmit} disabled={loading} className={`px-8 py-3 w-32 rounded-xl text-white text-base font-bold transition-all text-center flex items-center justify-center ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-red hover:bg-red-700 border border-transparent'} disabled:opacity-50`}>
        {loading ? '...' : submitText}
      </button>
    </div>
  )
}

// ── Action Icon Button ───────────────────────────────────────
export function ABtn({ icon, label, onClick, danger, active }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-xs font-medium min-w-[64px]
        ${danger ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/25 text-red-400'
        : active ? 'bg-brand-red/20 border-brand-red/40 text-brand-red'
        : 'bg-dark-700 border-dark-500 hover:border-dark-400 hover:bg-dark-600 text-gray-300'}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-center leading-tight whitespace-nowrap">{label}</span>
    </button>
  )
}
