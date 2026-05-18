import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Package, Database, Trash2, Plus, ChevronRight, X, Eye, MapPin, Lock, Users, MapPinned } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { fetchWithAuth, invalidateServerCache } from '../utils/api';
import { useNotification } from '../context/NotificationContext';
import './Inventory.css';

import { API_URL } from '../config';

interface StashItem {
  name: string;
  label: string;
  amount: number;
  slot: number;
  image?: string;
  info?: any;
  type?: string;
}

interface Stash {
  id: string;
  label: string;
  itemsCount: number;
  items: StashItem[];
  location: string;
}

interface CreateStashForm {
  name: string;
  locationCoords: string;
  password: string;
  slots: string;
  objectModel: string;
  allowedCharacters: Array<{ citizenid: string; name: string }>;
}

const Inventory: React.FC = () => {
  const { serverId } = useParams();
  const { showNotification } = useNotification();
  const [stashes, setStashes] = useState<Stash[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStash, setSelectedStash] = useState<Stash | null>(null);
  const [sharedConfig, setSharedConfig] = useState<any>(null);
  const [addItemModal, setAddItemModal] = useState(false);
  const [addItemValues, setAddItemValues] = useState<{ item: string; amount: string; label: string }>({ item: '', amount: '1', label: '' });
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null); // slot being deleted
  const [createStashModal, setCreateStashModal] = useState(false);
  const [createStashLoading, setCreateStashLoading] = useState(false);
  const [createStashForm, setCreateStashForm] = useState<CreateStashForm>({
    name: '',
    locationCoords: '',
    password: '',
    slots: '20',
    objectModel: 'prop_drop_3setbox',
    allowedCharacters: []
  });
  const [characterSearch, setCharacterSearch] = useState('');
  const [characterSearchResults, setCharacterSearchResults] = useState<Array<{ citizenid: string; name: string }>>([]);
  const [searchingCharacters, setSearchingCharacters] = useState(false);

  // Vault object models for selection
  const VAULT_OBJECTS = [
    { value: 'prop_drop_3setbox', label: 'صندوق خشبي' },
    { value: 'prop_choc_box_02', label: 'صندوق صغير' },
    { value: 'prop_box_ammo_04a', label: 'صندوق ذخيرة' },
    { value: 'prop_rub_crate01', label: 'صندوق مطاطي' },
    { value: 'prop_ld_crates1', label: 'صناديق مكدسة' },
    { value: 'prop_vault_01', label: 'خزنة حديدية' },
    { value: 'p_v_43_safe_s', label: 'خزنة صغيرة' },
    { value: 'prop_security_case_01', label: 'حقيبة أمنية' },
    { value: 'prop_cash_case_01', label: 'حقيبة نقود' },
    { value: 'prop_drop_crate_02_set', label: 'صندوق كبير' },
    { value: 'hei_heist_acc_drill_crate_02', label: 'صندوق حفارة' },
    { value: 'ex_office_swag_silverbar', label: 'سبائك فضية' },
  ];

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStashes();
    fetchConfig();
  }, [serverId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/shared-config`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.items) setSharedConfig(data);
    } catch (e) {
      // Silently fail - config is optional
    }
  };

  const fetchStashes = async () => {
    setLoading(true);
    try {
      if (serverId) invalidateServerCache(serverId);
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/stashes`);
      if (!res.ok) {
        // Silently fail - don't show error notification
        setStashes([]);
        return;
      }
      const data = await res.json();
      if (data.stashes) setStashes(data.stashes);
    } catch (e) {
      // Silently fail - don't show error notification
      setStashes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (stashId: string, slot: number) => {
    const slotKey = `${stashId}-${slot}`;
    setDeleteLoading(slotKey);

    // Optimistic update: immediately remove item from local state
    const prevItems = selectedStash ? [...(selectedStash.items || [])] : [];
    if (selectedStash && selectedStash.id === stashId) {
      const updatedItems = (selectedStash.items || []).filter((i: StashItem) => i.slot !== slot);
      setSelectedStash({ ...selectedStash, items: updatedItems, itemsCount: Math.max(0, (selectedStash.itemsCount || 0) - 1) });
    }

    try {
      if (serverId) invalidateServerCache(serverId);
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/stashes/${encodeURIComponent(stashId)}/item`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: Number(slot) })
      });

      if (res.ok) {
        showNotification('Item deleted successfully', 'success');
        // Refresh stash list in background for consistency
        fetchStashes();
      } else {
        // Revert optimistic update on failure
        let errorMsg = 'Failed to delete item';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch {}
        showNotification(errorMsg, 'error');
        if (selectedStash) {
          setSelectedStash({ ...selectedStash, items: prevItems });
        }
      }
    } catch (e) {
      // Revert optimistic update on error
      showNotification('Connection error while deleting item', 'error');
      if (selectedStash) {
        setSelectedStash({ ...selectedStash, items: prevItems });
      }
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleWipeStash = async (stashId: string) => {
    if (!confirm(`Are you sure you want to wipe all items from stash: ${stashId}?`)) return;

    // Optimistic update
    const prevItems = selectedStash?.items || [];
    if (selectedStash && selectedStash.id === stashId) {
      setSelectedStash({ ...selectedStash, items: [], itemsCount: 0 });
    }
    try {
      if (serverId) invalidateServerCache(serverId);
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/stashes/${encodeURIComponent(stashId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification('Stash wiped successfully', 'success');
        setSelectedStash(null);
        fetchStashes();
      } else {
        showNotification('Failed to wipe stash', 'error');
        fetchStashes(); // Refresh to get accurate state
      }
    } catch (e) {
      showNotification('Connection error while wiping stash', 'error');
      fetchStashes(); // Refresh to get accurate state
    }
  };

  const handleAddItem = async () => {
    if (!addItemValues.item || !selectedStash) {
      showNotification('Please select an item', 'error');
      return;
    }

    const itemName = addItemValues.item;
    const itemAmount = parseInt(addItemValues.amount) || 1;
    const itemLabel = addItemValues.label || itemName;

    if (itemAmount < 1) {
      showNotification('Amount must be at least 1', 'error');
      return;
    }

    setAddItemLoading(true);

    // Optimistic update: immediately add item to local state
    const prevStash = { ...selectedStash, items: [...(selectedStash.items || [])] };
    const optimisticStash = { ...selectedStash, items: [...(selectedStash.items || [])] };
    const existingItem = optimisticStash.items.find((i: StashItem) => i.name === itemName);
    if (existingItem) {
      existingItem.amount = (existingItem.amount || 1) + itemAmount;
    } else {
      const maxSlot = optimisticStash.items.reduce((max: number, i: StashItem) => Math.max(max, i.slot || 0), 0);
      optimisticStash.items.push({
        name: itemName,
        label: itemLabel,
        amount: itemAmount,
        slot: maxSlot + 1,
        image: itemName + '.png'
      });
      optimisticStash.itemsCount = (optimisticStash.itemsCount || 0) + 1;
    }
    setSelectedStash(optimisticStash);

    try {
      if (serverId) invalidateServerCache(serverId);

      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/stashes/${encodeURIComponent(selectedStash.id)}/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemName, amount: itemAmount, label: itemLabel })
      });

      if (res.ok) {
        showNotification('Item added successfully', 'success');
        setAddItemModal(false);
        setAddItemValues({ item: '', amount: '1', label: '' });
        setItemSearch('');
        setShowItemDropdown(false);
        // Refresh stash data from server to ensure consistency
        fetchStashes();
      } else {
        // Revert optimistic update on failure
        let errorMsg = 'Failed to add item';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch {}
        showNotification(errorMsg, 'error');
        setSelectedStash(prevStash);
      }
    } catch (e) {
      // Revert optimistic update on error
      showNotification('Connection error while adding item', 'error');
      setSelectedStash(prevStash);
    } finally {
      setAddItemLoading(false);
    }
  };

  const searchCharacters = async (query: string) => {
    if (!query || query.length < 2) { setCharacterSearchResults([]); return; }
    setSearchingCharacters(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/game-players`);
      if (res.ok) {
        const data = await res.json();
        const players = data.players || [];
        const filtered = players.filter((p: any) => {
          const fullName = `${p.charinfo?.firstname || ''} ${p.charinfo?.lastname || ''}`.toLowerCase();
          const cid = (p.citizenid || '').toLowerCase();
          return fullName.includes(query.toLowerCase()) || cid.includes(query.toLowerCase());
        }).slice(0, 20).map((p: any) => ({
          citizenid: p.citizenid,
          name: `${p.charinfo?.firstname || ''} ${p.charinfo?.lastname || ''}`
        }));
        setCharacterSearchResults(filtered);
      }
    } catch (e) {
      // Silently fail
    }
    setSearchingCharacters(false);
  };

  const addCharacter = (char: { citizenid: string; name: string }) => {
    if (!createStashForm.allowedCharacters.find(c => c.citizenid === char.citizenid)) {
      setCreateStashForm(prev => ({
        ...prev,
        allowedCharacters: [...prev.allowedCharacters, char]
      }));
    }
    setCharacterSearch('');
    setCharacterSearchResults([]);
  };

  const removeCharacter = (citizenid: string) => {
    setCreateStashForm(prev => ({
      ...prev,
      allowedCharacters: prev.allowedCharacters.filter(c => c.citizenid !== citizenid)
    }));
  };

  const handleCreateStash = async () => {
    const { name, locationCoords, password, slots, objectModel, allowedCharacters } = createStashForm;

    if (!name.trim()) {
      showNotification('اسم الخزنة مطلوب', 'error');
      return;
    }

    // Parse vector3 coordinates from input like: vector3(157.3, -788.26, 31.24) or 157.3, -788.26, 31.24
    let x: number, y: number, z: number;
    const vectorMatch = locationCoords.match(/vector3\s*\(\s*([\d.\-]+)\s*,\s*([\d.\-]+)\s*,\s*([\d.\-]+)\s*\)/);
    if (vectorMatch) {
      x = parseFloat(vectorMatch[1]);
      y = parseFloat(vectorMatch[2]);
      z = parseFloat(vectorMatch[3]);
    } else {
      const parts = locationCoords.split(',').map(s => parseFloat(s.trim()));
      if (parts.length >= 3 && !parts.some(isNaN)) {
        x = parts[0]; y = parts[1]; z = parts[2];
      } else {
        showNotification('أدخل الإحداثيات بشكل صحيح مثل: vector3(157.3, -788.26, 31.24)', 'error');
        return;
      }
    }

    const slotsNum = parseInt(slots);
    if (isNaN(slotsNum) || slotsNum < 1) {
      showNotification('عدد الخانات يجب أن يكون رقم صحيح', 'error');
      return;
    }

    setCreateStashLoading(true);

    try {
      if (serverId) invalidateServerCache(serverId);

      const body: any = {
        name: name.trim(),
        location: { x, y, z },
        locationStr: `vector3(${x}, ${y}, ${z})`,
        slots: slotsNum,
        objectModel: objectModel || 'prop_drop_3setbox',
        allowedCitizenIds: allowedCharacters.map(c => c.citizenid)
      };

      if (password.trim()) {
        body.password = password.trim();
      }

      // Send as action request to create stash in-game via shefra_sync
      const res = await fetchWithAuth(`${API_URL}/api/server/${serverId}/action-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'create_stash',
          target_id: name.trim(),
          data: body
        })
      });

      // Also create via the stash API endpoint
      const stashRes = await fetchWithAuth(`${API_URL}/api/server/${serverId}/create-stash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (stashRes.ok || res.ok) {
        showNotification(`تم إنشاء الخزنة "${name}" بنجاح`, 'success');
        setCreateStashModal(false);
        setCreateStashForm({
          name: '',
          locationCoords: '',
          password: '',
          slots: '20',
          objectModel: 'prop_drop_3setbox',
          allowedCharacters: []
        });
        fetchStashes();
      }
    } catch (e) {
      // Silently fail
    } finally {
      setCreateStashLoading(false);
    }
  };

  const itemsList = sharedConfig?.items
    ? Object.entries(sharedConfig.items).map(([name, data]: [string, any]) => ({
        name,
        label: data?.label || name,
        image: data?.image || (name + '.png')
      }))
    : [];

  const filteredItems = itemsList.filter(it =>
    it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    it.label.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const filteredStashes = stashes.filter(stash =>
    stash.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getItemImage = (imgName: string, itemName: string) => {
    if (!imgName) return `${API_URL}/uploads/items/${itemName}.png`;
    if (imgName.includes('.')) return `${API_URL}/uploads/items/${imgName}`;
    return `${API_URL}/uploads/items/${imgName}.png`;
  };

  return (
    <div className="inventory-page-fakhm animate-fade-in" dir="rtl">

      {/* Header */}
      <div className="inventory-header glass-panel">
        <div className="header-content">
          <div className="title-area">
            <div className="icon-box-blue"><Database size={24} /></div>
            <div className="text-box">
              <h1>إدارة المخازن</h1>
              <p>عرض وتعديل محتويات مخازن اللاعبين والعصابات</p>
            </div>
          </div>
          <div className="actions-area">
            <button
              className="btn-create-stash-lux"
              onClick={() => setCreateStashModal(true)}
              style={{
                background: 'rgba(41, 121, 255, 0.1)',
                border: '1px solid rgba(41, 121, 255, 0.3)',
                color: '#2979ff',
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              <Plus size={18} />
              إنشاء مخزن
            </button>
            <button className="btn-refresh-lux" onClick={fetchStashes} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
              {loading ? 'جاري التحميل...' : 'تحديث'}
            </button>
          </div>
        </div>
        <div className="search-bar-lux mt-4">
          <div className="search-box">
            <Search size={18} />
            <input type="text" placeholder="ابحث عن مخزن بالاسم..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="inventory-content mt-4" style={{ display: 'grid', gridTemplateColumns: selectedStash ? '1fr 1.4fr' : '1fr', gap: '1.5rem' }}>

        {/* Stash List */}
        <div className="table-lux-wrapper glass-panel">
          <table className="lux-table">
            <thead>
              <tr>
                <th>اسم المخزن</th>
                <th>الموقع</th>
                <th>عدد الأغراض</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#666' }}><RefreshCw className="spin" size={24} /></td></tr>
              ) : filteredStashes.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#666' }}>لا توجد مخازن</td></tr>
              ) : filteredStashes.map((stash, idx) => (
                <tr key={idx} className={selectedStash?.id === stash.id ? 'selected-row' : ''}>
                  <td className="stash-name-cell">
                    <div className="stash-icon-small"><Package size={16} /></div>
                    <span style={{ fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stash.id}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#aaa' }}>
                      <span style={{ opacity: 0.7 }}><MapPin size={12} /></span>
                      {stash.location || 'غير محدد'}
                    </div>
                  </td>
                  <td><span className="count-pill">{stash.itemsCount} غرض</span></td>
                  <td>
                    <div className="action-row">
                      <button className="btn-open-lux" title="عرض الأغراض" onClick={() => setSelectedStash(stash)}>
                        <Eye size={14} />
                      </button>
                      <button className="btn-delete-lux" title="مسح المخزن" onClick={() => handleWipeStash(stash.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stash Detail Panel */}
        {selectedStash && (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>{selectedStash.id}</h3>
                <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{selectedStash.itemsCount} غرض في المخزن</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setAddItemModal(true)}
                  disabled={addItemLoading}
                  style={{ background: 'rgba(139,0,0,0.1)', border: '1px solid rgba(139,0,0,0.3)', color: '#8b0000', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, opacity: addItemLoading ? 0.6 : 1 }}
                >
                  <Plus size={16} /> إضافة غرض
                </button>
                <button onClick={() => setSelectedStash(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              {(!selectedStash.items || selectedStash.items.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <Package size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                  <p>المخزن فارغ</p>
                </div>
              ) : selectedStash.items.filter(Boolean).map((item: StashItem, i: number) => {
                const isDeleting = deleteLoading === `${selectedStash.id}-${item.slot}`;
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    opacity: isDeleting ? 0.5 : 1,
                    transition: 'opacity 0.2s'
                  }}>
                    <img
                      src={getItemImage(item.image || '', item.name)}
                      onError={(e: any) => e.target.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', background: 'rgba(0,0,0,0.3)', padding: '4px' }}
                      alt={item.name}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{item.label || item.name}</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>{item.name} • الكمية: {item.amount || 1} • Slot: {item.slot}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(selectedStash.id, item.slot)}
                      disabled={isDeleting}
                      style={{ background: 'rgba(139,0,0,0.1)', border: '1px solid rgba(139,0,0,0.2)', color: '#8b0000', width: '32px', height: '32px', borderRadius: '8px', cursor: isDeleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isDeleting ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {addItemModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { if (!addItemLoading) setAddItemModal(false); }}>
          <div style={{ background: 'rgba(15,15,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', minWidth: '400px', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>إضافة غرض للمخزن</h3>
              <button onClick={() => { if (!addItemLoading) { setAddItemModal(false); setShowItemDropdown(false); } }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: '1rem' }} ref={dropdownRef}>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>اختر الغرض</label>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', cursor: 'pointer' }} onClick={() => setShowItemDropdown(!showItemDropdown)}>
                  {addItemValues.item ? (
                    <span style={{ padding: '10px 0', flex: 1 }}>{addItemValues.label || addItemValues.item}</span>
                  ) : (
                    <span style={{ padding: '10px 0', flex: 1, color: '#666' }}>اختر غرضاً...</span>
                  )}
                  <ChevronRight size={16} style={{ color: '#666', transform: showItemDropdown ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                </div>
                {showItemDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'rgba(15,15,25,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', zIndex: 10, maxHeight: '250px', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <input type="text" autoFocus placeholder="بحث..." value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '13px' }} />
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
                      {filteredItems.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#666', fontSize: '13px' }}>لا توجد نتائج</div>
                      ) : filteredItems.map((it, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => { setAddItemValues({ ...addItemValues, item: it.name, label: it.label }); setShowItemDropdown(false); setItemSearch(''); }}>
                          <img src={getItemImage(it.image, it.name)} onError={(e: any) => e.target.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }} alt={it.name} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{it.label}</div>
                            <div style={{ fontSize: '11px', color: '#666' }}>{it.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>الكمية</label>
              <input type="number" min={1} value={addItemValues.amount} onChange={e => setAddItemValues({ ...addItemValues, amount: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setAddItemModal(false); setShowItemDropdown(false); }} disabled={addItemLoading}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', opacity: addItemLoading ? 0.5 : 1 }}>إلغاء</button>
              <button onClick={handleAddItem} disabled={addItemLoading || !addItemValues.item}
                style={{ background: addItemLoading || !addItemValues.item ? '#5a0000' : '#8b0000', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', cursor: addItemLoading || !addItemValues.item ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {addItemLoading ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
                {addItemLoading ? 'جاري الإضافة...' : 'إضافة الغرض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Stash Modal */}
      {createStashModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { if (!createStashLoading) setCreateStashModal(false); }}>
          <div style={{ background: 'rgba(15,15,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', minWidth: '480px', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(41, 121, 255, 0.1)', border: '1px solid rgba(41, 121, 255, 0.2)', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2979ff' }}>
                  <Package size={18} />
                </div>
                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>إنشاء خزنة جديدة</h3>
              </div>
              <button onClick={() => { if (!createStashLoading) setCreateStashModal(false); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Stash Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                اسم الخزنة <span style={{ color: '#8b0000' }}>*</span>
              </label>
              <input type="text" placeholder="مثال: خزنة العصابة" value={createStashForm.name} onChange={e => setCreateStashForm({ ...createStashForm, name: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            {/* Object Model Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                <Package size={14} />
                اوبجكت الخزنة <span style={{ color: '#8b0000' }}>*</span>
              </label>
              <select
                value={createStashForm.objectModel}
                onChange={e => setCreateStashForm({ ...createStashForm, objectModel: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', outline: 'none', fontSize: '14px', boxSizing: 'border-box', cursor: 'pointer' }}
              >
                {VAULT_OBJECTS.map(obj => (
                  <option key={obj.value} value={obj.value} style={{ background: '#1a1a1a', color: '#fff' }}>{obj.label} ({obj.value})</option>
                ))}
              </select>
            </div>

            {/* Location Vector3 - Full format input */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                <MapPinned size={14} />
                الموقع (Vector3) <span style={{ color: '#8b0000' }}>*</span>
              </label>
              <input type="text" dir="ltr" placeholder="vector3(157.3, -788.26, 31.24)" value={createStashForm.locationCoords} onChange={e => setCreateStashForm({ ...createStashForm, locationCoords: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', outline: 'none', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#555' }}>أدخل الإحداثيات الكاملة مثل: vector3(157.3, -788.26, 31.24) أو مفصولة بفواصل</p>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                <Lock size={14} />
                كلمة المرور <span style={{ color: '#555', fontSize: '11px' }}>(اختياري)</span>
              </label>
              <input type="text" placeholder="اتركه فارغاً لخزنة مفتوحة" value={createStashForm.password} onChange={e => setCreateStashForm({ ...createStashForm, password: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            {/* Capacity/Slots */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                السعة (Slots) <span style={{ color: '#8b0000' }}>*</span>
              </label>
              <input type="number" min={1} placeholder="20" value={createStashForm.slots} onChange={e => setCreateStashForm({ ...createStashForm, slots: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            {/* Allowed Characters - Search & Select */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                <Users size={14} />
                الأشخاص المسموح لهم بفتح الخزنة <span style={{ color: '#555', fontSize: '11px' }}>(اختياري)</span>
              </label>
              {/* Search input */}
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <input type="text" placeholder="ابحث عن شخصية بالاسم أو المعرف..." value={characterSearch} onChange={e => { setCharacterSearch(e.target.value); searchCharacters(e.target.value); }}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
                {searchingCharacters && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '11px' }}>جاري البحث...</span>}
                {/* Search results dropdown */}
                {characterSearchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                    {characterSearchResults.map((char, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => addCharacter(char)}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{char.name}</div>
                          <div style={{ fontSize: '11px', color: '#666' }}>{char.citizenid}</div>
                        </div>
                        <Plus size={14} style={{ color: '#2979ff' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Selected characters tags */}
              {createStashForm.allowedCharacters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {createStashForm.allowedCharacters.map((char, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(41, 121, 255, 0.1)', border: '1px solid rgba(41, 121, 255, 0.3)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: '#2979ff' }}>
                      <span>{char.name}</span>
                      <button onClick={() => removeCharacter(char.citizenid)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCreateStashModal(false)} disabled={createStashLoading}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', opacity: createStashLoading ? 0.5 : 1 }}>إلغاء</button>
              <button onClick={handleCreateStash} disabled={createStashLoading || !createStashForm.name.trim()}
                style={{ background: createStashLoading || !createStashForm.name.trim() ? 'rgba(41, 121, 255, 0.3)' : '#2979ff', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', cursor: createStashLoading || !createStashForm.name.trim() ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {createStashLoading ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
                {createStashLoading ? 'جاري الإنشاء...' : 'إنشاء الخزنة'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
