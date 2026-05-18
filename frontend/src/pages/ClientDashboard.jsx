import { Package, Shield, Settings, ChevronLeft, Download, ChevronRight, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useContext } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { ServerContext } from '../App'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export default function ClientDashboard({ user }) {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { handleChangeServer } = useContext(ServerContext)
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const handleViewLicenses = () => {
    handleChangeServer()
    navigate('/panel')
  }

  return (
    <div
      className={`min-h-screen relative flex flex-col bg-[#0a0a0f] overflow-y-auto ${dir === 'rtl' ? 'font-arabic' : ''}`}
      dir={dir}
    >
      {/* Background patterns */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-red/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-6xl mx-auto relative z-10 flex-1 flex flex-col gap-8 p-4 md:p-8">

        {/* Header */}
        <div className="flex items-center justify-between bg-[#111317] border border-dark-600 p-5 rounded-2xl relative z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 bg-[#0d0f14] hover:bg-dark-700 rounded-xl transition-all border border-dark-600 text-gray-400 hover:text-white"
            >
              {dir === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
            <div>
              <h1 className="text-2xl font-black text-white tracking-wide">
                {lang === 'ar' ? 'منطقة العميل' : 'Client Area'}
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                {lang === 'ar' ? 'مرحباً بك في لوحة تحكم التراخيص والمنتجات' : 'Welcome to your licenses and products dashboard'}
              </p>
            </div>
          </div>
          <div className="bg-[#0d0f14] px-4 py-2 rounded-xl border border-dark-600 flex items-center gap-3">
            <img
              src={`https://cdn.discordapp.com/avatars/${user?.id}/${user?.avatar}.png`}
              className="w-8 h-8 rounded-full border border-dark-500"
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${user?.username}&background=2d2d35&color=fff` }}
              alt="avatar"
            />
            <span className="text-white font-bold text-sm">{user?.username}</span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-8">

          {/* Licenses Card */}
          <div className="group bg-[#111317] border border-dark-600 rounded-3xl p-9 flex flex-col hover:border-gray-500 transition-all duration-300">
            <div className="w-16 h-16 bg-[#0d0f14] rounded-2xl flex items-center justify-center border border-dark-600 mb-6 group-hover:border-brand-red transition-colors">
              <Shield size={32} className="text-gray-400 group-hover:text-brand-red transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              {lang === 'ar' ? 'التراخيص النشطة' : 'Active Licenses'}
            </h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed flex-1 font-medium">
              {lang === 'ar' ? 'عرض وتنزيل الرخص الخاصة بسيرفراتك وإدارتها بكل سهولة.' : 'View, manage, and download licenses for your servers easily.'}
            </p>
            <button
              onClick={handleViewLicenses}
              className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white py-3.5 rounded-2xl font-bold text-lg transition-all border border-transparent"
            >
              {lang === 'ar' ? 'عرض الرخص' : 'View Licenses'}
              {dir === 'rtl' ? <ArrowRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Products Card */}
          <div className="group bg-[#111317] border border-dark-600 rounded-3xl p-9 flex flex-col hover:border-gray-500 transition-all duration-300">
            <div className="w-16 h-16 bg-[#0d0f14] rounded-2xl flex items-center justify-center border border-dark-600 mb-6 group-hover:border-purple-500 transition-colors">
              <Package size={32} className="text-gray-400 group-hover:text-purple-400 transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              {lang === 'ar' ? 'المنتجات (Store)' : 'Products (Store)'}
            </h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed flex-1 font-medium">
              {lang === 'ar' ? 'تصفح وتحميل جميع منتجات وسكربتات Echo الحصرية.' : 'Browse and download all exclusive products and scripts.'}
            </p>
            <a
              href="https://discord.gg/haPZZ3BpPZ"
              target="_blank" rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white py-3.5 rounded-2xl font-bold text-lg transition-all border border-transparent"
            >
              {lang === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
            </a>
          </div>

          {/* Settings Card */}
          <div className="group bg-[#111317] border border-dark-600 rounded-3xl p-9 flex flex-col hover:border-gray-500 transition-all duration-300">
            <div className="w-16 h-16 bg-[#0d0f14] rounded-2xl flex items-center justify-center border border-dark-600 mb-6 group-hover:border-blue-500 transition-colors">
              <Settings size={32} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              {lang === 'ar' ? 'إعدادات الحساب' : 'Account Settings'}
            </h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed flex-1 font-medium">
              {lang === 'ar' ? 'تغيير إعدادات الملف الشخصي والاتصال بحساب الديسكورد.' : 'Change profile settings and Discord connection.'}
            </p>
            <button
              onClick={() => alert(lang === 'ar' ? 'قريباً...' : 'Coming soon...')}
              className="w-full flex items-center justify-center gap-2 bg-[#0d0f14] hover:bg-dark-700 border border-dark-600 hover:border-gray-500 text-gray-300 hover:text-white py-3.5 rounded-2xl font-bold text-lg transition-all"
            >
              {lang === 'ar' ? 'الإعدادات' : 'Settings'}
            </button>
          </div>

        </div>

        {/* Downloads */}
        <div className="bg-[#111317] border border-dark-600 rounded-3xl p-9 relative z-10 mb-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Download size={26} className="text-brand-red" />
            {lang === 'ar' ? 'أحدث التحميلات' : 'Latest Downloads'}
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-[#0d0f14] rounded-2xl border border-dark-600 hover:border-gray-500 transition-all group">
            <div className="flex items-center gap-5 mb-4 sm:mb-0">
              <div className="p-4 bg-[#111317] rounded-xl border border-dark-600 group-hover:border-gray-500 transition-colors">
                <Package size={26} className="text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Echo Panel Bridge Script</h4>
                <p className="text-gray-500 text-sm mt-1 font-medium">السكربت المطلوب لتشغيل اللوحة داخل سيرفرك (يدعم QBCore / ESX)</p>
              </div>
            </div>
            <a
              href={`${API}/downloads/Echopanel.zip`}
              download
              className="flex items-center justify-center gap-2 bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red hover:text-white text-brand-red px-8 py-3.5 rounded-2xl text-base font-bold transition-colors"
            >
              <Download size={16} />
              {lang === 'ar' ? 'تحميل السكربت' : 'Download Script'}
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
