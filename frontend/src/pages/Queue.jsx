import { useState } from 'react'
import { Clock, Plus, Trash2, Activity, Wifi } from 'lucide-react'

export default function Queue() {
  const [priorities] = useState([
    { identifiers: 'license:xxx, discord:123, steam:xxx', power: 10, note: '/VIP / Staff' }
  ])

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">الأولوية والانتظار</h1></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Queue Status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Activity size={15} className="text-brand-red" /> حالة الانتظار</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'السيرفر', value: 'online', ok: true },
              { label: 'المزود', value: 'connectqueue', ok: true },
              { label: 'حجم الانتظار', value: '0/9' },
              { label: 'آخر تحديث', value: 'الآن' },
            ].map(({ label, value, ok }) => (
              <div key={label} className="bg-dark-800 rounded-lg p-2.5">
                <p className="text-gray-500 text-xs mb-0.5">{label}</p>
                <p className={`font-medium text-sm ${ok === true ? 'text-accent-green' : 'text-white'}`}>{value}</p>
              </div>
            ))}
          </div>
          <button className="btn-secondary text-xs mt-3 w-full">كتب في القائمة</button>
        </div>

        {/* Priority Queues */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Clock size={15} className="text-brand-red" /> أدوات الانتظار</h3>
          <p className="text-xs text-gray-500 mb-3">افتح لنا داخل البانل المباشر — الميزات أيضاً إيجاد أن يدعم SetPos عملية connectqueue بطريقة خطير</p>
          <div className="space-y-2">
            {[{ label: 'الموضوع', value: '1' }].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-dark-800 rounded-lg text-xs text-gray-500">
            license:xxxx, discord:xxxx, steam:xxx
          </div>
        </div>
      </div>

      {/* Live Queue */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">الانتظار المباشر</h3>
        <p className="text-xs text-gray-500 mb-3">يعرض قائمة الانتظار الحالية من مزود license/steam، جميع الإجراءات تتم عبر طابور قائمة الانتظار. قائمة الانتظار عبر عرض عناية لا يمكن الوصول إليه عبر المعرفات.</p>
        <div className="text-center py-8 text-gray-600 text-xs">لا أحد في الانتظار حالياً</div>
      </div>

      {/* Priority Settings */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">صفوف الأولوية</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-500 text-xs text-gray-500">
                <th className="text-right py-2 px-3 font-medium">المعرفات</th>
                <th className="text-right py-2 px-3 font-medium">قوة الأولوية</th>
                <th className="text-right py-2 px-3 font-medium">ملاحظة</th>
                <th className="text-right py-2 px-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {priorities.map((p, i) => (
                <tr key={i} className="table-row">
                  <td className="py-2 px-3 font-mono text-xs text-gray-400">{p.identifiers}</td>
                  <td className="py-2 px-3 text-white font-medium">{p.power}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{p.note}</td>
                  <td className="py-2 px-3"><button className="text-gray-500 hover:text-brand-red transition-colors"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-primary text-xs mt-3"><Plus size={13} /> إضافة إلى القائمة</button>
      </div>
    </div>
  )
}
