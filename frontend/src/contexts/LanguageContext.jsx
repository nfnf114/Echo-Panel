import { createContext, useContext, useState, useEffect } from 'react'

const translations = {
  en: {
    // General
    'Echo Panel': 'Echo Panel',
    'Online': 'Online',
    'Offline': 'Offline',
    'Search': 'Search...',
    'Loading': 'Loading...',
    'Logout': 'Logout',
    // Sidebar
    'Dashboard': 'Dashboard',
    'Online Players': 'Online Players',
    'Screenshots': 'Live Screenshots',
    'Characters': 'Characters',
    'Vehicles': 'Vehicles',
    'Gangs': 'Gangs',
    'Stashes': 'Stashes',
    'Investigate': 'Investigate',
    'Dupe Scanner': 'Dupe Scanner',
    'Audit Logs': 'Audit Logs',
    'Ranks & Admins': 'Ranks & Admins',
    'Priority Queue': 'Priority Queue',
    'Settings': 'Settings',
    // Login
    'Welcome back': 'Welcome back',
    'Sign in to your account': 'Sign in to your account to continue',
    'Login with Discord': 'Login with Discord',
    // Dashboard Stats
    'Connected Players': 'Connected Players',
    'Registered Vehicles': 'Registered Vehicles',
    'Active Gangs': 'Active Gangs',
    'Total Stashes': 'Total Stashes',
    'Banned Players': 'Banned Players',
    'Total Characters': 'Total Characters',
    'Player Inventory': 'Player Inventory',
    'View Inventory': 'View Inventory',
    'Close': 'Close',
    'Server Status': 'Server Status',
    'Status': 'Status',
    'Bridge': 'Bridge',
    'Players': 'Players',
    'DB': 'DB',
    'Connected': 'Connected',
    'Disconnected': 'Disconnected',
    'Ready': 'Ready',
    'Banned': 'Banned',
    'Select Your Server': 'Select Your Server',
    'Choose a server to manage': 'Choose a server to manage',
    'No Servers Found': 'No Servers Found',
    'License Key': 'License Key',
    // Hero
    'hero.title': 'Echo',
    'hero.subtitle': 'FiveM Control Panel',
    'hero.description': 'The most powerful and advanced FiveM server management platform. Monitor, control, and optimize your server with real-time tools built for performance.',
    'hero.cta': 'Get Started',
    // Features
    'features.title': 'Powerful Features',
    'features.subtitle': 'Everything you need to manage your FiveM server',
    'features.realtime.title': 'Real-Time Monitoring',
    'features.realtime.desc': 'Track player activity, server performance, and resource usage in real-time with live dashboards.',
    'features.security.title': 'Advanced Security',
    'features.security.desc': 'Built-in anti-cheat detection, dupe scanning, and comprehensive audit logs to protect your server.',
    'features.management.title': 'Full Management',
    'features.management.desc': 'Manage players, vehicles, gangs, stashes, and more from a single unified control panel.',
    'features.permissions.title': 'Granular Permissions',
    'features.permissions.desc': 'Define custom ranks and admin roles with precise access controls for every feature.',
    'features.screenshots.title': 'Live Screenshots',
    'features.screenshots.desc': 'Capture and review live player screenshots for enhanced oversight and moderation.',
    'features.updates.title': 'Auto Updates',
    'features.updates.desc': 'Stay current with automatic script updates and seamless version management through your license.',
    // Team
    'team.title': 'Our Team',
    'team.subtitle': 'The people behind Echo',
    'team.member1.name': 'Ahmed Al-Rashid',
    'team.member1.role': 'Founder & Lead Developer',
    'team.member2.name': 'Sara Khoury',
    'team.member2.role': 'UI/UX Designer',
    'team.member3.name': 'Omar Hassan',
    'team.member3.role': 'Backend Engineer',
    'team.member4.name': 'Layla Nasser',
    'team.member4.role': 'Security Analyst',
    // Quick Access
    'quickaccess.title': 'Quick Access',
    'quickaccess.subtitle': 'Jump right into your workspace',
  },
  ar: {
    // General
    'Echo Panel': 'لوحة شفرة',
    'Online': 'متصل',
    'Offline': 'مغلق',
    'Search': 'بحث...',
    'Loading': 'جاري التحميل...',
    'Logout': 'تسجيل خروج',
    // Sidebar
    'Dashboard': 'الرئيسية',
    'Online Players': 'اللاعبين المتصلين',
    'Screenshots': 'اللقطات المباشرة',
    'Characters': 'الشخصيات',
    'Vehicles': 'المركبات',
    'Gangs': 'العصابات',
    'Stashes': 'المخازن',
    'Investigate': 'البحث المتقدم',
    'Dupe Scanner': 'فحص التدبيل',
    'Audit Logs': 'سجلات الأفعال',
    'Ranks & Admins': 'الرتب والإدارة',
    'Priority Queue': 'الطابور والأولوية',
    'Settings': 'الإعدادات',
    // Login
    'Welcome back': 'مرحباً بك',
    'Sign in to your account': 'قم بتسجيل الدخول للمتابعة',
    'Login with Discord': 'تسجيل الدخول عبر ديسكورد',
    // Dashboard Stats
    'Connected Players': 'اللاعبين المتصلين',
    'Registered Vehicles': 'المركبات المسجلة',
    'Active Gangs': 'العصابات النشطة',
    'Total Stashes': 'إجمالي المخازن',
    'Banned Players': 'المحظورين',
    'Total Characters': 'إجمالي الشخصيات',
    'Player Inventory': 'حقيبة اللاعب',
    'View Inventory': 'عرض الحقيبة',
    'Close': 'إغلاق',
    // Portal
    'Echo Store': 'متجر شيفرة',
    'Customer Portal': 'بوابة العملاء',
    'Client Area': 'منطقة العميل',
    'Review your products, licenses, updates, and download the newest releases linked to your account.': 'قم بمراجعة منتجاتك وتراخيصك، وحمل آخر التحديثات المرتبطة بحسابك.',
    'Open Client Area': 'فتح منطقة العميل',
    'Server Management': 'إدارة السيرفرات',
    'Open the server selection screen, then proceed to the live panel, permissions and operational tools.': 'افتح شاشة اختيار السيرفرات ثم أكمل إلى البنل المباشر ولوحات المعلومات والصلاحيات.',
    'Go to Server Management': 'الذهاب إلى إدارة السيرفرات',
    'Server Status': 'حالة السيرفر',
    'Status': 'الحالة',
    'Bridge': 'السكربت',
    'Players': 'اللاعبين',
    'DB': 'قاعدة البيانات',
    'Connected': 'متصل',
    'Disconnected': 'مفصول',
    'Ready': 'جاهز',
    'Banned': 'الحظر',
    'Select Your Server': 'اختر سيرفرك',
    'Choose a server to manage': 'اختر السيرفر الذي تود إدارته',
    'No Servers Found': 'لم يتم العثور على سيرفرات',
    'License Key': 'مفتاح الترخيص',
    // Hero
    'hero.title': 'شفرة',
    'hero.subtitle': 'لوحة تحكم فايف إم',
    'hero.description': 'أقوى وأحدث منصة لإدارة سيرفرات فايف إم. راقب وتحكم وحسّن سيرفرك بأدوات فورية مبنية للأداء العالي.',
    'hero.cta': 'ابدأ الآن',
    // Features
    'features.title': 'ميزات قوية',
    'features.subtitle': 'كل ما تحتاجه لإدارة سيرفر فايف إم الخاص بك',
    'features.realtime.title': 'مراقبة فورية',
    'features.realtime.desc': 'تتبع نشاط اللاعبين وأداء السيرفر واستخدام الموارد في الوقت الفعلي عبر لوحات بيانات حية.',
    'features.security.title': 'أمان متقدم',
    'features.security.desc': 'كشف مدمج للغش وفحص التدبيل وسجلات شاملة لحماية سيرفرك من التلاعب.',
    'features.management.title': 'إدارة شاملة',
    'features.management.desc': 'أدر اللاعبين والمركبات والعصابات والمخازن والمزيد من لوحة تحكم واحدة موحدة.',
    'features.permissions.title': 'صلاحيات دقيقة',
    'features.permissions.desc': 'حدد رتب مخصصة وأدوار إدارية مع صلاحيات وصول دقيقة لكل ميزة.',
    'features.screenshots.title': 'لقطات مباشرة',
    'features.screenshots.desc': 'التقط وراجع لقطات شاشة اللاعبين المباشرة لتعزيز الإشراف والمراقبة.',
    'features.updates.title': 'تحديثات تلقائية',
    'features.updates.desc': 'ابق على اطلاع مع التحديثات التلقائية للسكربتات وإدارة الإصدارات السلسة عبر ترخيصك.',
    // Team
    'team.title': 'فريقنا',
    'team.subtitle': 'الأشخاص وراء شفرة',
    'team.member1.name': 'أحمد الراشد',
    'team.member1.role': 'المؤسس والمطور الرئيسي',
    'team.member2.name': 'سارة خوري',
    'team.member2.role': 'مصممة واجهات',
    'team.member3.name': 'عمر حسن',
    'team.member3.role': 'مهندس خلفية',
    'team.member4.name': 'ليلى ناصر',
    'team.member4.role': 'محللة أمنية',
    // Quick Access
    'quickaccess.title': 'وصول سريع',
    'quickaccess.subtitle': 'ادخل إلى مساحة عملك مباشرة',
  }
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('panel_lang') || 'en')

  useEffect(() => {
    localStorage.setItem('panel_lang', lang)
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  const t = (key) => {
    return translations[lang]?.[key] || key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
