import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ChevronDown, Edit, Trash2, Plus, RefreshCw,
  ShieldCheck, Lock, Search, UserPlus, Shield,
  Wifi, WifiOff, Gamepad2, Globe, ExternalLink, Settings
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import './Admins.css';
import { fetchWithAuth } from '../utils/api';
import { useNotification } from '../context/NotificationContext';

import { API_URL } from '../config';

const ALL_PERMISSIONS = [
  { group: 'اللاعبون', perms: ['عرض اللاعبين', 'طرد', 'إنعاش', 'إطعام', 'إعطاء أموال', 'سحب أموال', 'تعيين الأموال', 'إزالة عناصر', 'إعطاء عناصر', 'حذف الشخصية', 'نقل فوري', 'تعيين الوظيفة', 'تعيين العصابة', 'تعيين البيانات الوصفية', 'تعيين الهوية', 'تعيين الصلاحيات', 'رسالة مباشرة', 'اللقطات المباشرة', 'مسح الحقيبة'] },
  { group: 'متصل', perms: ['عرض اللاعبين المتصلين', 'إشعار جميع اللاعبين'] },
  { group: 'إدارة المركبات', perms: ['عرض المركبات', 'إعطاء مركبات', 'حذف المركبات', 'نقل المركبات', 'تغيير اللوحة', 'تعديل حالة المركبة'] },
  { group: 'المخازن', perms: ['عرض المخازن', 'إضافة عناصر', 'إزالة عناصر', 'تفريغ المخازن'] },
  { group: 'الأولوية والانتظار', perms: ['عرض الانتظار', 'تعيين الأولوية', 'إزالة الأولوية', 'رفع/خفض', 'إزالة من الانتظار'] },
  { group: 'البحث المتقدم', perms: ['استخدام أداة التحقيق'] },
  { group: 'Dupes', perms: ['عرض التكرارات', 'حذف جميع التكرارات'] },
  { group: 'الحظر', perms: ['عرض الحظر', 'إضافة حالات حظر', 'إزالة حالات حظر', 'تحديث حالات الحظر'] },
  { group: 'العصابات', perms: ['عرض العصابات', 'إدارة العصابات'] },
  { group: 'التدقيق', perms: ['عرض سجلات التدقيق'] },
  { group: 'Settings', perms: ['عرض الإعدادات', 'إدارة الإعدادات', 'إدارة مواقع النقل', 'إدارة إعدادات السجلات'] },
  { group: 'لوحات الصدارة', perms: ['إعادة تعيين وقت اللعب', 'إدارة اللوحات', 'إدارة الظهور'] },
  { group: 'الإدارة والرتب', perms: ['إدارة الإداريين', 'إدارة الرتب'] },
];

// Role color by name
const ROLE_COLORS: Record<string, string> = {
  owner: '#f1c40f',
  admin: '#e74c3c',
  moderator: '#3498db',
  manager: '#9b59b6',
  support: '#2ecc71',
};
const getRoleColor = (name: string) => {
  const key = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(ROLE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#7289da';
};

// ── Error Boundary ──────────────────────────────────────────────────────────
interface EBState { hasError: boolean; error: Error | null }
class AdminsErrorBoundary extends React.Component<React.PropsWithChildren<{}>, EBState> {
  state: EBState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: 12 }}>حدث خطأ غير متوقع</h2>
          <p style={{ fontSize: 13, marginBottom: 20 }}>
            {this.state.error?.message || 'تعذر عرض هذه الصفحة'}
          </p>
          <button
            style={{ background: '#8b0000', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main Component ──────────────────────────────────────────────────────────
const Admins: React.FC = () => {
  const { serverId } = useParams();
  const { showNotification } = useNotification();

  const [roles, setRoles] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [discordUsers, setDiscordUsers] = useState<Record<string, { username: string; avatar: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [rankSearch, setRankSearch] = useState('');

  const [showCreateRankModal, setShowCreateRankModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['اللاعبون']);

  const [newRankName, setNewRankName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [adminDiscordId, setAdminDiscordId] = useState('');
  const [adminRoleId, setAdminRoleId] = useState('');
  const [adminPreview, setAdminPreview] = useState<{ username: string; avatar: string | null } | null>(null);

  // Submit-guard refs to prevent double-click
  const addingAdminRef = useRef(false);
  const savingRoleRef = useRef(false);
  const [submittingAdmin, setSubmittingAdmin] = useState(false);
  const [submittingRole, setSubmittingRole] = useState(false);

  // ── Debounced Discord ID preview lookup ─────────────────────────────────
  useEffect(() => {
    if (adminDiscordId.length >= 17) {
      const t = setTimeout(async () => {
        try {
          const res = await fetchWithAuth(`${API_URL}/api/discord-user/${adminDiscordId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.username) {
              setAdminPreview(data);
            } else {
              setAdminPreview(null);
            }
          } else {
            setAdminPreview(null);
          }
        } catch (e) {
          setAdminPreview(null);
        }
      }, 600);
      return () => clearTimeout(t);
    } else {
      setAdminPreview(null);
    }
  }, [adminDiscordId]);

  // ── Batched Discord info fetcher ────────────────────────────────────────
  const fetchDiscordInfoBatch = useCallback(async (adminList: any[]) => {
    const idsToFetch = adminList
      .map(a => a.discord_id)
      .filter((id): id is string => !!id);

    if (idsToFetch.length === 0) return;

    const results: Record<string, { username: string; avatar: string | null }> = {};
    const fetches = idsToFetch.map(async (id) => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/discord-user/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.username) {
            results[id] = { username: data.username, avatar: data.avatar || null };
          }
        }
      } catch (e) {
        // Silently skip failed lookups
      }
    });

    await Promise.allSettled(fetches);

    // Batch single state update
    if (Object.keys(results).length > 0) {
      setDiscordUsers(prev => ({ ...prev, ...results }));
    }
  }, []);

  // ── Main data fetch ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, adminsRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/server/${serverId}/panel-roles`).catch(() => null),
        fetchWithAuth(`${API_URL}/api/server/${serverId}/panel-admins`).catch(() => null),
      ]);

      if (!rolesRes || !adminsRes) {
        setError('فشل الاتصال بالخادم');
        setRoles([]);
        setAdmins([]);
        return;
      }

      if (!rolesRes.ok || !adminsRes.ok) {
        setError('فشل تحميل البيانات');
        setRoles([]);
        setAdmins([]);
        return;
      }

      let rolesList: any[] = [];
      let adminsList: any[] = [];

      try {
        const rolesData = await rolesRes.json();
        rolesList = Array.isArray(rolesData?.roles) ? rolesData.roles : [];
        // Ensure permissions are parsed properly and locked flag is set
        rolesList = rolesList.map((r: any) => ({
          ...r,
          permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : (r.permissions || []),
          locked: r.name?.toLowerCase() === 'owner'
        }));
      } catch (e) {
        rolesList = [];
      }

      try {
        const adminsData = await adminsRes.json();
        adminsList = Array.isArray(adminsData?.admins) ? adminsData.admins : [];
      } catch (e) {
        adminsList = [];
      }

      setRoles(rolesList);
      setAdmins(adminsList);

      // Batch fetch Discord info instead of one-by-one state updates
      await fetchDiscordInfoBatch(adminsList);
    } catch (e) {
      console.error('fetchData error:', e);
      setError('حدث خطأ أثناء تحميل البيانات');
      setRoles([]);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [serverId, fetchDiscordInfoBatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Permission toggles ─────────────────────────────────────────────────
  const togglePerm = (perm: string) =>
    setSelectedPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);

  const toggleGroupPerms = (groupPerms: string[]) => {
    const allSelected = groupPerms.every(p => selectedPerms.includes(p));
    setSelectedPerms(prev =>
      allSelected ? prev.filter(p => !groupPerms.includes(p)) : [...new Set([...prev, ...groupPerms])]
    );
  };

  const toggleGroupExpand = (group: string) =>
    setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);

  // ── Save role ──────────────────────────────────────────────────────────
  const handleSaveRole = async () => {
    if (savingRoleRef.current) return;
    if (!newRankName.trim()) return showNotification('يرجى إدخال اسم الرتبة', 'error');
    if (newRankName.trim().toLowerCase() === 'owner') return showNotification('لا يمكن إنشاء رتبة باسم Owner - هذه الرتبة محجوزة تلقائياً لصاحب السيرفر', 'error');
    if (selectedPerms.length === 0 && !editingRole) return showNotification('يرجى اختيار صلاحية واحدة على الأقل', 'error');
    savingRoleRef.current = true;
    setSubmittingRole(true);
    try {
      const method = editingRole ? 'PUT' : 'POST';
      const url = editingRole
        ? `${API_URL}/api/server/${serverId}/panel-roles/${editingRole.id}`
        : `${API_URL}/api/server/${serverId}/panel-roles`;
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRankName.trim(), permissions: selectedPerms }),
      });
      if (res.ok) {
        showNotification('تم حفظ الرتبة بنجاح', 'success');
        setShowCreateRankModal(false);
        resetRoleModal();
        fetchData();
      } else {
        let msg = 'فشل الحفظ';
        try { const d = await res.json(); msg = d?.message || d?.error || msg; } catch (e) {}
        showNotification(msg, 'error');
      }
    } catch (e) {
      showNotification('فشل الاتصال بالخادم', 'error');
    } finally {
      savingRoleRef.current = false;
      setSubmittingRole(false);
    }
  };

  const resetRoleModal = () => {
    setEditingRole(null);
    setNewRankName('');
    setSelectedPerms([]);
  };

  // ── Delete role ────────────────────────────────────────────────────────
  const handleDeleteRole = async (roleId: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الرتبة؟ سيتم إزالة جميع الإداريين المرتبطين بها.')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/panel-roles/${roleId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('تم حذف الرتبة بنجاح', 'success');
        fetchData();
      } else {
        let msg = 'فشل الحذف';
        try { const d = await res.json(); msg = d?.message || d?.error || msg; } catch (e) {}
        showNotification(msg, 'error');
      }
    } catch (e) {
      showNotification('فشل الاتصال بالخادم', 'error');
    }
  };

  // ── Add / Edit admin ───────────────────────────────────────────────────
  const handleAddAdmin = async () => {
    if (addingAdminRef.current) return;
    if (!adminDiscordId.trim()) return showNotification('يرجى إدخال معرف ديسكورد', 'error');
    if (adminDiscordId.trim().length < 17) return showNotification('معرف ديسكورد غير صالح (يجب أن يكون 17-20 رقم)', 'error');
    if (!adminRoleId) return showNotification('يرجى اختيار الرتبة', 'error');

    const roleIdNum = parseInt(adminRoleId);
    if (isNaN(roleIdNum)) return showNotification('رتبة غير صالحة', 'error');

    addingAdminRef.current = true;
    setSubmittingAdmin(true);
    try {
      const method = editingAdmin ? 'PUT' : 'POST';
      const url = editingAdmin
        ? `${API_URL}/api/server/${serverId}/panel-admins/${adminDiscordId}`
        : `${API_URL}/api/server/${serverId}/panel-admins`;

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_id: adminDiscordId.trim(),
          role_id: roleIdNum
        })
      });

      if (res.ok) {
        showNotification(editingAdmin ? 'تم تحديث رتبة الإداري بنجاح' : 'تمت إضافة الإداري بنجاح', 'success');
        closeAdminModal();
        fetchData();
      } else {
        let msg = 'فشل العملية';
        try { const d = await res.json(); msg = d?.message || d?.error || msg; } catch (e) {}
        showNotification(msg, 'error');
      }
    } catch (e) {
      showNotification('فشل الاتصال بالخادم', 'error');
    } finally {
      addingAdminRef.current = false;
      setSubmittingAdmin(false);
    }
  };

  // ── Remove admin ───────────────────────────────────────────────────────
  const handleRemoveAdmin = async (discordId: string) => {
    if (!discordId) return;
    if (!confirm('هل أنت متأكد من إزالة هذا الإداري؟')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/panel-admins/${discordId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('تمت إزالة الإداري بنجاح', 'success');
        fetchData();
      } else {
        let msg = 'فشل الإزالة';
        try { const d = await res.json(); msg = d?.message || d?.error || msg; } catch (e) {}
        showNotification(msg, 'error');
      }
    } catch (e) {
      showNotification('فشل الاتصال بالخادم', 'error');
    }
  };

  // ── Modal helpers ──────────────────────────────────────────────────────
  const closeAdminModal = () => {
    setShowAddAdminModal(false);
    setEditingAdmin(null);
    setAdminDiscordId('');
    setAdminRoleId('');
    setAdminPreview(null);
  };

  const openCreateModal = (role?: any) => {
    setEditingRole(role || null);
    setNewRankName(role?.name || '');
    // Ensure permissions are always an array
    const perms = role?.permissions 
      ? (typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : role.permissions)
      : [];
    setSelectedPerms(Array.isArray(perms) ? perms : []);
    setShowCreateRankModal(true);
  };

  // ── Derived / filtered data ────────────────────────────────────────────
  const filteredRanks = (roles || []).filter(r => (r?.name || '').toLowerCase().includes((rankSearch || '').toLowerCase()));
  const filteredAdmins = (admins || []).filter(a => {
    const id = a?.discord_id || '';
    const roleName = a?.role_name || '';
    const username = discordUsers[id]?.username || '';
    const q = (adminSearch || '').toLowerCase();
    return id.toLowerCase().includes(q) || roleName.toLowerCase().includes(q) || username.toLowerCase().includes(q);
  });

  const getAvatar = (discordId: string, username: string) => {
    const info = discordUsers[discordId];
    if (info?.avatar) return info.avatar;
    return `https://ui-avatars.com/api/?background=2c2f3e&color=fff&name=${encodeURIComponent((username || discordId || '??').slice(0, 2))}&size=128&bold=true`;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="admins-page animate-fade-in" dir="rtl">

      {/* HEADER */}
      <div className="admins-top-bar glass-panel">
        <div className="header-right">
          <h1 className="page-title">الإدارة والرتب</h1>
          <p className="page-subtitle">تحكم بمن يمكنه الوصول إلى هذا البانل داخل السيرفر وما الإجراءات المسموح لهم بها</p>
        </div>
        <button className="btn-refresh" onClick={fetchData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> تحديث البيانات
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin: '15px 0', padding: '15px 20px', background: 'rgba(139,0,0,0.15)', border: '1px solid rgba(139,0,0,0.3)', borderRadius: 12, color: '#e74c3c', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <WifiOff size={16} />
          {error}
          <button style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(139,0,0,0.3)', color: '#e74c3c', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 11 }} onClick={fetchData}>إعادة المحاولة</button>
        </div>
      )}

      <div className="admins-grid mt-4">

        {/* RANKS SECTION */}
        <div className="admins-card glass-panel">
          <div className="card-header">
            <div className="title-group">
              <h3>الرتب</h3>
              <p>ترتّب الرتب من الأعلى إلى الأدنى. رتبة المالك مُقفلة دائماً وتملك كامل الصلاحيات.</p>
            </div>
            <button className="btn-red-solid" onClick={() => openCreateModal()}>
              <Plus size={16} /> رتبة جديدة
            </button>
          </div>

          <div className="card-filters mt-3">
            <div className="search-box">
              <Search size={14} />
              <input type="text" placeholder="البحث في الرتب" value={rankSearch} onChange={e => setRankSearch(e.target.value)} />
            </div>
            <span style={{ fontSize: '12px', color: '#555' }}>عرض {filteredRanks.length} من {roles.length} رتب</span>
          </div>

          <div className="ranks-list mt-3">
            {filteredRanks.map(rank => (
              <div key={rank.id} className="rank-item-premium">
                <div className="rank-info">
                  <div className="rank-icon-wrapper" style={{ background: `${getRoleColor(rank.name)}22`, border: `1px solid ${getRoleColor(rank.name)}55` }}>
                    <ShieldCheck size={20} color={getRoleColor(rank.name)} />
                  </div>
                  <div className="txt">
                    <span className="name">
                      {rank.name}
                      {rank.locked && <Lock size={12} className="lock-icon" />}
                    </span>
                    <span className="meta">
                      {(rank.name?.toLowerCase() === 'owner'
                        ? (admins.filter(a => a?.role_id === rank.id || a?.is_owner).length)
                        : (admins.filter(a => a?.role_id === rank.id).length)
                      )} عضو -{' '}
                      {(rank.permissions || []).length} صلاحيات
                    </span>

                    {/* Members avatars row */}
                    <div className="rank-members-row">
                      {(rank.name?.toLowerCase() === 'owner'
                        ? admins.filter(a => a?.role_id === rank.id || a?.is_owner)
                        : admins.filter(a => a?.role_id === rank.id)
                      ).slice(0, 5).map((a: any, i: number) => {
                        const did = a?.discord_id || '';
                        return (
                          <img
                            key={did || i}
                            className="rank-member-avatar"
                            src={getAvatar(did, discordUsers[did]?.username || did)}
                            alt=""
                            title={discordUsers[did]?.username || did}
                            style={{ zIndex: 10 - i }}
                          />
                        );
                      })}
                      {admins.filter(a => a?.role_id === rank.id).length > 5 && (
                        <div className="rank-member-more">+{admins.filter(a => a?.role_id === rank.id).length - 5}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rank-actions">
                  <button className="action-btn" onClick={() => openCreateModal(rank)}>
                    <Edit size={16} color="white" />
                  </button>
                  {!rank.locked && rank.name?.toLowerCase() !== 'owner' && (
                    <button className="action-btn danger" onClick={() => handleDeleteRole(rank.id)}>
                      <Trash2 size={16} color="#8b0000" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ADMINS SECTION */}
        <div className="admins-card glass-panel">
          <div className="card-header">
            <div className="title-group">
              <h3>الإداريون</h3>
              <p>أضف الإداريين عبر Discord ID. يمكنك إسناد رتب أقل من رتبتك.</p>
            </div>
            <button className="btn-red-solid" onClick={() => { setEditingAdmin(null); setAdminDiscordId(''); setAdminRoleId(''); setAdminPreview(null); setShowAddAdminModal(true); }}>
              <UserPlus size={16} /> إضافة إداري
            </button>
          </div>

          <div className="card-filters mt-3">
            <div className="search-box">
              <Search size={14} />
              <input type="text" placeholder="ابحث بالاسم أو Discord ID أو الرتبة" value={adminSearch} onChange={e => setAdminSearch(e.target.value)} />
            </div>
            <span style={{ fontSize: '12px', color: '#555' }}>عرض {filteredAdmins.length} من {admins.length} إداريين</span>
          </div>

          <div className="admins-list mt-3">
            {loading && (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>
                <RefreshCw className="spin" size={30} style={{ margin: '0 auto' }} />
              </div>
            )}
            {!loading && filteredAdmins.map((a) => {
              const did = a?.discord_id || '';
              const userInfo = discordUsers[did] || { username: did || 'Unknown', avatar: null };
              const roleColor = getRoleColor(a?.role_name || '');

              return (
                <div key={did || `admin-${a?.id}`} className={`admin-lux-card ${a?.is_owner ? 'owner-lux' : ''}`}>
                  <div className="lux-card-glow" />

                  {/* Left: Actions (Desktop) */}
                  <div className="lux-card-actions">
                    {!a?.is_owner && !a?.is_auto_owner && (
                      <>
                        <button
                          className="lux-action-btn"
                          onClick={() => {
                            setEditingAdmin(a);
                            setAdminDiscordId(did);
                            setAdminRoleId(a?.role_id?.toString() || '');
                            setShowAddAdminModal(true);
                          }}
                          title="تعديل الرتبة"
                        >
                          <Settings size={16} />
                        </button>
                        <button className="lux-action-btn danger" onClick={() => handleRemoveAdmin(did)} title="إزالة الإداري">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Center: Info Content */}
                  <div className="lux-card-content">
                    <div className="lux-name-row">
                      {a?.is_owner && <span className="lux-owner-tag"><Shield size={10} /> المالك</span>}
                      <h4 className="lux-username">{userInfo.username}</h4>
                      <span className="lux-role-pill" style={{ '--role-color': roleColor } as any}>
                        {a?.role_name || 'بدون رتبة'}
                      </span>
                    </div>

                    <div className="lux-id-row" onClick={() => {
                      if (did) {
                        navigator.clipboard.writeText(did);
                        showNotification('تم نسخ المعرف', 'success');
                      }
                    }}>
                      <span className="id-label">معرف ديسكورد</span>
                      <span className="id-value">{did}</span>
                      <ExternalLink size={10} className="copy-icon" />
                    </div>

                    <div className="lux-status-container">
                      <div className={`lux-status-chip ${a?.is_online_web ? 'active' : 'inactive'}`}>
                        <Globe size={12} />
                        <span>{a?.is_online_web ? 'متصل بالموقع' : 'خارج الموقع'}</span>
                      </div>
                      <div className={`lux-status-chip game ${a?.is_online_game ? 'active' : 'inactive'}`}>
                        <Gamepad2 size={12} />
                        <span>{a?.is_online_game ? 'داخل اللعبة' : 'خارج اللعبة'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Avatar Section */}
                  <div className="lux-avatar-section">
                    <div className="lux-avatar-container">
                      <img
                        src={getAvatar(did, userInfo.username)}
                        alt=""
                        className="lux-avatar-img"
                      />
                      <div className={`lux-online-indicator ${a?.is_online_web ? 'online' : 'offline'}`}>
                        <div className="pulse-ring" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && filteredAdmins.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.3 }}>
                <Shield size={40} style={{ margin: '0 auto 10px' }} />
                <p>لا يوجد إداريون</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: CREATE/EDIT RANK */}
      {showCreateRankModal && (
        <div className="modal-overlay" onClick={() => { setShowCreateRankModal(false); resetRoleModal(); }}>
          <div className="action-modal-box glass-panel advanced-modal animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <h3>{editingRole ? 'تعديل رتبة' : 'إنشاء رتبة جديدة'}</h3>
                <p>حدد اسم الرتبة والصلاحيات المتاحة لها</p>
              </div>
              <button className="close-btn" onClick={() => { setShowCreateRankModal(false); resetRoleModal(); }}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>اسم الرتبة</label>
                <input type="text" className="input-dark" placeholder="مثال: Manager" value={newRankName} onChange={e => setNewRankName(e.target.value)} />
              </div>
              <div className="permissions-container mt-4">
                <label>الصلاحيات المتاحة</label>
                <div className="perms-scroll-area mt-2">
                  {ALL_PERMISSIONS.map((group, gi) => (
                    <div key={gi} className="perm-group-premium">
                      <div className="group-header">
                        <div className="right" onClick={() => toggleGroupExpand(group.group)}>
                          <Shield size={16} />
                          <span>{group.group}</span>
                          <ChevronDown size={14} className={expandedGroups.includes(group.group) ? 'rotate-180' : ''} />
                        </div>
                        <button className="btn-select-all" onClick={() => toggleGroupPerms(group.perms)}>
                          {group.perms.every(p => selectedPerms.includes(p)) ? 'إلغاء الكل' : 'اختيار الكل'}
                        </button>
                      </div>
                      {expandedGroups.includes(group.group) && (
                        <div className="group-perms-grid">
                          {group.perms.map((p, pi) => (
                            <div key={pi} className={`perm-chip ${selectedPerms.includes(p) ? 'active' : ''}`} onClick={() => togglePerm(p)}>
                              {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => { setShowCreateRankModal(false); resetRoleModal(); }}>إلغاء</button>
              <button className="btn-red-solid" onClick={handleSaveRole} disabled={submittingRole}>
                {submittingRole ? 'جارٍ الحفظ...' : 'حفظ الرتبة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD/EDIT ADMIN */}
      {showAddAdminModal && (
        <div className="modal-overlay" onClick={closeAdminModal}>
          <div className="action-modal-box glass-panel advanced-modal animate-modal-in" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <h3>{editingAdmin ? 'تعديل رتبة الإداري' : 'إضافة إداري جديد'}</h3>
                <p>{editingAdmin ? 'اختر الرتبة الجديدة لهذا الإداري' : 'اربط معرف ديسكورد برتبة معينة'}</p>
              </div>
              <button className="close-btn" onClick={closeAdminModal}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>معرّف ديسكورد (Discord ID)</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="81729381..."
                  value={adminDiscordId}
                  onChange={e => setAdminDiscordId(e.target.value)}
                  disabled={!!editingAdmin}
                />
              </div>

              {adminPreview && !editingAdmin && (
                <div className="admin-preview-box mt-3 glass-panel">
                  <img
                    src={adminPreview.avatar || `https://ui-avatars.com/api/?background=2c2f3e&color=fff&name=${encodeURIComponent((adminPreview.username || '??').slice(0, 2))}&size=128&bold=true`}
                    alt="preview"
                  />
                  <div className="txt">
                    <span className="name">{adminPreview.username}</span>
                    <span className="status">تم العثور على الشخص</span>
                  </div>
                </div>
              )}

              <div className="input-group mt-4">
                <label>الرتبة الممنوحة</label>
                <select className="input-dark" value={adminRoleId} onChange={e => setAdminRoleId(e.target.value)}>
                  <option value="">اختر الرتبة...</option>
                  {(roles || []).filter(r => r?.name?.toLowerCase() !== 'owner').map(r => (
                    <option key={r?.id} value={r?.id}>{r?.name} ({(r?.permissions || []).length} صلاحيات)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={closeAdminModal}>إلغاء</button>
              <button className="btn-red-solid" onClick={handleAddAdmin} disabled={submittingAdmin}>
                {submittingAdmin ? 'جارٍ الإضافة...' : editingAdmin ? 'تحديث' : 'إضافة الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ── Export wrapped with Error Boundary ───────────────────────────────────
const AdminsWithBoundary: React.FC = () => (
  <AdminsErrorBoundary>
    <Admins />
  </AdminsErrorBoundary>
);

export default AdminsWithBoundary;
