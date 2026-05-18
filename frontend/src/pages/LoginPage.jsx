import { Shield, Server, Lock } from 'lucide-react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function LoginPage({ setUser }) {
  const handleDiscordLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/discord`
  }

  // Check if callback token in URL
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token) {
    try {
      const userData = JSON.parse(atob(token.split('.')[1]))
      localStorage.setItem('panel_user', JSON.stringify(userData))
      setUser(userData)
      window.history.replaceState({}, '', '/')
    } catch { }
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center relative overflow-hidden" dir="rtl">
      {/* Subtle background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      {/* Glow spots */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px] px-4 flex flex-col items-center">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-20 h-20 rounded-3xl bg-[#111317] border border-white/10 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }} />
            <div className="w-full h-full items-center justify-center hidden">
              <svg viewBox="0 0 80 80" fill="none" className="w-12 h-12">
                <path d="M20 55 L40 15 L60 55" stroke="#8b1a1a" strokeWidth="6" strokeLinejoin="round" />
                <path d="M28 55 L52 55" stroke="white" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight">Echo Panel</h1>
            <p className="text-gray-400 text-sm mt-1">إدارة سيرفرات FiveM</p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full bg-[#111317]/90 backdrop-blur border border-white/[0.07] rounded-2xl p-8 space-y-6">
          {/* Welcome */}
          <div className="text-center">
            <h2 className="text-white font-bold text-lg">مرحباً بعودتك</h2>
            <p className="text-gray-500 text-sm mt-1">المتابعة عبر ديسكورد</p>
          </div>

          {/* Features list */}
          <div className="space-y-3 py-2">
            {[
              { icon: Shield, text: 'إدارة كاملة للسيرفر في مكان واحد' },
              { icon: Server, text: 'بيانات حية ومتجددة تلقائياً' },
              { icon: Lock, text: 'دخول آمن عبر حساب Discord' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-gray-400">
                <div className="w-7 h-7 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/[0.06]">
                  <Icon size={14} className="text-brand-red" />
                </div>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Discord Button */}
          <button
            onClick={handleDiscordLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white py-3.5 rounded-xl font-bold text-[15px] transition-all duration-200 group"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.018.01.034.02.046a19.904 19.904 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            <span>المتابعة عبر ديسكورد</span>
          </button>

          <p className="text-center text-xs text-gray-600">
            بمتابعتك، فأنت توافق على{' '}
            <span className="text-gray-500 cursor-pointer hover:text-white transition-colors">شروط الخدمة وسياسة الخصوصية</span>
          </p>
        </div>
      </div>
    </div>
  )
}
