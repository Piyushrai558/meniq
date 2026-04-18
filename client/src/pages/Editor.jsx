import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getToken } from '../api';
import Sidebar from '../components/Sidebar';
import UpgradeModal from '../components/UpgradeModal';
import { ToastContext } from '../App';

export default function Editor() {
  const { menuId } = useParams();
  const navigate   = useNavigate();

  const [menu, setMenu]                   = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [selectedTags, setSelectedTags]   = useState([]);
  const [newItem, setNewItem]             = useState({ name: '', price: '', description: '' });
  const [newItemImg, setNewItemImg]       = useState('');   // uploaded URL
  const [uploading, setUploading]         = useState(false);
  const [qrData, setQrData]              = useState(null);
  const [restName, setRestName]           = useState('');
  const [tagline, setTagline]             = useState('');
  const [accentColor, setAccentColor]     = useState('#C8622A');
  const [upgradeOpen, setUpgradeOpen]     = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { loadMenu(); }, [menuId]);

  const loadMenu = async () => {
    try {
      const data = await api('GET', `/menus/${menuId}`);
      setMenu(data.menu);
      setRestName(data.menu.restaurant_name || '');
      setTagline(data.menu.tagline || '');
      setAccentColor(data.menu.accent_color || '#C8622A');
      if (data.menu.sections.length > 0 && !activeSectionId) {
        setActiveSectionId(data.menu.sections[0].id);
      }
      try {
        const qr = await api('GET', `/qr/${data.menu.slug}`);
        setQrData(qr);
      } catch (_) {}
    } catch (err) {
      ToastContext.show(err.message);
      navigate('/dashboard');
    }
  };

  const activeSection = menu?.sections?.find(s => s.id === activeSectionId);
  const items = activeSection?.items || [];

  const toggleItem = async (itemId, newState) => {
    try {
      await api('PUT', `/sections/items/${itemId}`, { is_active: !!newState });
      setMenu(prev => ({
        ...prev,
        sections: prev.sections.map(s => ({
          ...s,
          items: s.items.map(i => i.id === itemId ? { ...i, is_active: newState } : i),
        })),
      }));
      ToastContext.show(newState ? 'Item enabled' : 'Item disabled');
    } catch (err) { ToastContext.show(err.message); }
  };

  const deleteItem = async (itemId) => {
    if (!confirm('Remove this item?')) return;
    try {
      await api('DELETE', `/sections/items/${itemId}`);
      setMenu(prev => ({
        ...prev,
        sections: prev.sections.map(s => ({
          ...s,
          items: s.items.filter(i => i.id !== itemId),
        })),
      }));
      ToastContext.show('Item removed');
    } catch (err) { ToastContext.show(err.message); }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setNewItemImg(data.url);
      ToastContext.show('Image uploaded!');
    } catch (err) {
      ToastContext.show(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) { ToastContext.show('Please enter an item name'); return; }
    const type = selectedTags.includes('nonveg') ? 'nonveg' : 'veg';
    try {
      const data = await api('POST', '/sections/items', {
        section_id:   activeSectionId,
        name:         newItem.name,
        price:        parseInt(newItem.price) || 0,
        description:  newItem.description,
        type,
        is_spicy:     selectedTags.includes('spicy')      ? 1 : 0,
        is_bestseller:selectedTags.includes('bestseller') ? 1 : 0,
        emoji:        type === 'nonveg' ? '🍗' : '🥦',
        image_url:    newItemImg,
      });
      setMenu(prev => ({
        ...prev,
        sections: prev.sections.map(s =>
          s.id === activeSectionId ? { ...s, items: [...s.items, data.item] } : s
        ),
      }));
      setNewItem({ name: '', price: '', description: '' });
      setSelectedTags([]);
      setNewItemImg('');
      setShowAddForm(false);
      ToastContext.show('Item added! ✓');
    } catch (err) {
      if (err.message.includes('Upgrade') || err.message.includes('plan')) {
        setUpgradeOpen(true);
      }
      ToastContext.show(err.message);
    }
  };

  const addSection = async () => {
    const name = prompt('Section name (e.g. Desserts):');
    if (!name) return;
    try {
      const data = await api('POST', '/sections', { menu_id: parseInt(menuId), name });
      const newSection = { ...data.section, items: [] };
      setMenu(prev => ({ ...prev, sections: [...prev.sections, newSection] }));
      setActiveSectionId(newSection.id);
      ToastContext.show(`"${name}" section added`);
    } catch (err) { ToastContext.show(err.message); }
  };

  const saveSettings = async () => {
    try {
      await api('PUT', `/menus/${menuId}`, { restaurant_name: restName, tagline, accent_color: accentColor });
      ToastContext.show('Settings saved! ✓');
    } catch (err) { ToastContext.show(err.message); }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      let next = [...prev, tag];
      if (tag === 'veg')    next = next.filter(t => t !== 'nonveg');
      if (tag === 'nonveg') next = next.filter(t => t !== 'veg');
      return next;
    });
  };

  const downloadQR = () => {
    if (!qrData?.qr) return;
    const a = document.createElement('a');
    a.href = qrData.qr;
    a.download = `${(menu?.restaurant_name || menu?.name || 'menu').toLowerCase().replace(/\s+/g, '-')}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    ToastContext.show('QR code downloaded!');
  };

  if (!menu) return <div className="app-layout"><Sidebar /><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* SECTION SIDEBAR */}
        <div className="editor-sidebar">
          <div className="sidebar-section-title">Sections</div>
          <ul className="section-list">
            {menu.sections.map(s => (
              <li key={s.id}
                  className={s.id === activeSectionId ? 'active' : ''}
                  onClick={() => { setActiveSectionId(s.id); setShowAddForm(false); }}>
                {s.name} <span className="section-count">{s.items.length}</span>
              </li>
            ))}
          </ul>
          <button className="btn-add-section" onClick={addSection}>+ Add section</button>
          <hr className="divider" />
          <div className="sidebar-section-title">Menu settings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 4 }}>Restaurant name</label>
              <input className="form-input-sm" value={restName} onChange={e => setRestName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 4 }}>Tagline</label>
              <input className="form-input-sm" value={tagline} onChange={e => setTagline(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 4 }}>Accent color</label>
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                style={{ width: '100%', height: 36, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '2px 4px' }} />
            </div>
            <button className="btn-sm btn-sm-accent" style={{ marginTop: 8 }} onClick={saveSettings}>
              Save settings
            </button>
          </div>
        </div>

        {/* ITEMS EDITOR */}
        <div className="editor-main">
          <div className="editor-top">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
            <span className="editor-title">{activeSection?.name || 'Menu'}</span>
            <div className="editor-actions">
              <button className="btn-sm btn-sm-outline"
                onClick={() => window.open(`/menu/${menu.slug}`, '_blank')}>
                Preview live
              </button>
            </div>
          </div>

          <div className="items-list">
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-faint)', fontSize: 14 }}>
                No items yet — add your first!
              </div>
            ) : items.map(item => (
              <div className="item-card" key={item.id}>
                <div className="item-thumb">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                    : item.emoji || (item.type === 'nonveg' ? '🍗' : '🥦')
                  }
                </div>
                <div className="item-info">
                  <div className="item-name">
                    {item.name}
                    <span className={`item-tag ${item.type === 'veg' ? 'tag-veg' : 'tag-nonveg'}`}>
                      {item.type === 'veg' ? 'Veg' : 'Non-veg'}
                    </span>
                    {item.is_spicy    ? <span className="item-tag tag-spicy">🌶</span> : null}
                    {!item.is_active  ? <span className="item-tag" style={{ background: '#F1EFE8', color: '#8A7B6E' }}>Off</span> : null}
                  </div>
                  <div className="item-desc">{item.description}</div>
                  <div className="item-meta"><span className="item-price">₹{item.price}</span></div>
                </div>
                <div className="item-controls">
                  <div className="toggle-wrap">
                    <span className="toggle-label">{item.is_active ? 'Available' : 'Off'}</span>
                    <div className={`toggle ${item.is_active ? 'on' : ''}`}
                      onClick={() => toggleItem(item.id, item.is_active ? 0 : 1)}>
                      <div className="toggle-knob" />
                    </div>
                  </div>
                  <button className="btn-edit-item" onClick={() => deleteItem(item.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            {showAddForm ? (
              <div className="add-item-form">
                <h4>Add new item</h4>
                <div className="form-row">
                  <div className="form-group-sm">
                    <label>Item name</label>
                    <input className="form-input-sm" placeholder="e.g. Paneer Tikka"
                      value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="form-group-sm">
                    <label>Price (₹)</label>
                    <input className="form-input-sm" placeholder="250" type="number"
                      value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group-sm">
                  <label>Description</label>
                  <input className="form-input-sm" placeholder="Short description..."
                    value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} />
                </div>

                {/* Image upload */}
                <div className="form-group-sm">
                  <label>Photo (optional)</label>
                  <div className="img-upload-row">
                    {newItemImg && (
                      <img src={newItemImg} alt="preview"
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                    )}
                    <button type="button" className="btn-sm btn-sm-outline img-upload-btn"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}>
                      {uploading ? 'Uploading…' : newItemImg ? '↺ Change' : '↑ Upload photo'}
                    </button>
                    {newItemImg && (
                      <button type="button" className="btn-edit-item" onClick={() => setNewItemImg('')}>Remove</button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => handleImageUpload(e.target.files[0])} />
                </div>

                <div className="form-group-sm">
                  <label>Tags</label>
                  <div className="tag-select">
                    {['veg', 'nonveg', 'spicy', 'bestseller'].map(tag => (
                      <button key={tag}
                        className={`tag-option ${selectedTags.includes(tag) ? `selected-${tag}` : ''}`}
                        onClick={() => toggleTag(tag)}>
                        {tag === 'veg' ? '🟢 Veg' : tag === 'nonveg' ? '🔴 Non-veg' : tag === 'spicy' ? '🌶 Spicy' : '⭐ Bestseller'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-actions-sm">
                  <button className="btn-sm btn-sm-outline" onClick={() => { setShowAddForm(false); setNewItemImg(''); }}>Cancel</button>
                  <button className="btn-sm btn-sm-accent" onClick={handleAddItem}>Add item</button>
                </div>
              </div>
            ) : (
              <button className="btn-add-section" style={{ width: '100%', marginTop: 12 }}
                onClick={() => setShowAddForm(true)}>
                + Add item to {activeSection?.name || 'section'}
              </button>
            )}
          </div>
        </div>

        {/* LIVE PREVIEW */}
        <div className="editor-preview">
          <div className="preview-label">Live preview</div>
          <div className="preview-phone">
            <div className="preview-bar" />
            <div className="preview-header" style={{ background: accentColor }}>
              <div className="preview-rest-name">{restName || menu.restaurant_name}</div>
              <div className="preview-rest-tag">{tagline || menu.tagline}</div>
            </div>
            <div className="preview-body">
              {menu.sections.map(sec => {
                const active = sec.items.filter(i => i.is_active);
                if (!active.length) return null;
                return (
                  <div className="preview-sec" key={sec.id}>
                    <div className="preview-sec-title">{sec.name}</div>
                    {active.map(item => (
                      <div className="preview-item" key={item.id}>
                        <span className="preview-item-name">{item.name}</span>
                        <span className="preview-item-price" style={{ color: accentColor }}>₹{item.price}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {qrData && (
            <div className="qr-wrap">
              <div className="qr-label">Your QR code</div>
              <div>
                <img src={qrData.qr} alt="QR Code"
                  style={{ borderRadius: 'var(--radius-sm)', maxWidth: 160 }} />
              </div>
              <div className="qr-url">{qrData.url}</div>
              <button className="btn-sm btn-sm-accent" style={{ marginTop: 12, width: '100%' }}
                onClick={downloadQR}>
                ↓ Download QR
              </button>
            </div>
          )}
        </div>
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
