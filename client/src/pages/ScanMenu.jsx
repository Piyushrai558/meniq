import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getToken } from '../api';
import { ToastContext } from '../App';

const STEPS = { UPLOAD: 'upload', SCANNING: 'scanning', PREVIEW: 'preview', CREATING: 'creating' };

const SCAN_TIPS = [
  'Reading your menu…',
  'Identifying sections and items…',
  'Extracting prices…',
  'Detecting veg / non-veg…',
  'Almost there…',
];

export default function ScanMenu() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep]             = useState(STEPS.UPLOAD);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile]   = useState(null);
  const [scanResult, setScanResult] = useState(null); // { restaurant_name, sections }
  const [menuName, setMenuName]     = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [tipIdx, setTipIdx]         = useState(0);
  const [error, setError]           = useState('');

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return; }
    setError('');
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const scanImage = async () => {
    if (!imageFile) return;
    setStep(STEPS.SCANNING);
    setError('');

    // Rotate through tips while scanning
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % SCAN_TIPS.length;
      setTipIdx(idx);
    }, 1400);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const res = await fetch('/api/ai/scan-menu', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      setScanResult(data.menu);
      setRestaurantName(data.menu.restaurant_name || '');
      setMenuName(data.menu.restaurant_name ? `${data.menu.restaurant_name} Menu` : 'My Menu');
      setStep(STEPS.PREVIEW);
    } catch (err) {
      setError(err.message);
      setStep(STEPS.UPLOAD);
    } finally {
      clearInterval(interval);
    }
  };

  const updateItem = (secIdx, itemIdx, field, value) => {
    setScanResult(prev => {
      const next = { ...prev, sections: prev.sections.map((s, si) =>
        si !== secIdx ? s : {
          ...s,
          items: s.items.map((item, ii) =>
            ii !== itemIdx ? item : { ...item, [field]: value }
          ),
        }
      )};
      return next;
    });
  };

  const removeItem = (secIdx, itemIdx) => {
    setScanResult(prev => ({
      ...prev,
      sections: prev.sections.map((s, si) =>
        si !== secIdx ? s : { ...s, items: s.items.filter((_, ii) => ii !== itemIdx) }
      ).filter(s => s.items.length > 0),
    }));
  };

  const createMenu = async () => {
    if (!menuName.trim()) { ToastContext.show('Please enter a menu name'); return; }
    setStep(STEPS.CREATING);
    try {
      const res = await fetch('/api/ai/create-from-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ menu_name: menuName, restaurant_name: restaurantName, sections: scanResult.sections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create menu');
      ToastContext.show('Menu created from scan!');
      navigate(`/editor/${data.menu.id}`);
    } catch (err) {
      ToastContext.show(err.message);
      setStep(STEPS.PREVIEW);
    }
  };

  const totalItems = scanResult?.sections?.reduce((n, s) => n + s.items.length, 0) ?? 0;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>Scan Menu with AI</h2>
            <p>Take a photo of your physical menu — AI will build the digital version instantly.</p>
          </div>
          {step === STEPS.PREVIEW && (
            <button className="btn-ghost" onClick={() => { setStep(STEPS.UPLOAD); setScanResult(null); setImagePreview(null); setImageFile(null); }}>
              ← Scan again
            </button>
          )}
        </div>

        {/* ── STEP 1: Upload ── */}
        {(step === STEPS.UPLOAD) && (
          <div className="scan-wrap">
            {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div
              className={`scan-drop-zone ${imagePreview ? 'has-image' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="menu preview" className="scan-preview-img" />
              ) : (
                <div className="scan-drop-inner">
                  <div className="scan-drop-icon">📷</div>
                  <div className="scan-drop-title">Upload your menu photo</div>
                  <div className="scan-drop-sub">Drag & drop, or click to select · JPG, PNG, WebP up to 5 MB</div>
                  <div className="scan-drop-tip">Works best with clear, well-lit photos taken head-on</div>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />

            {imagePreview && (
              <div className="scan-actions">
                <button className="btn-ghost" onClick={() => { setImagePreview(null); setImageFile(null); }}>
                  Remove
                </button>
                <button className="btn-primary scan-btn" onClick={scanImage}>
                  ✨ Scan with AI
                </button>
              </div>
            )}

            <div className="scan-how">
              <h4>How it works</h4>
              <div className="scan-steps">
                <div className="scan-step"><span className="scan-step-num">1</span><span>Take a clear photo of your physical menu</span></div>
                <div className="scan-step"><span className="scan-step-num">2</span><span>AI reads every item, price, and section</span></div>
                <div className="scan-step"><span className="scan-step-num">3</span><span>Review and edit the extracted data</span></div>
                <div className="scan-step"><span className="scan-step-num">4</span><span>Your digital menu + QR code are ready</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Scanning ── */}
        {step === STEPS.SCANNING && (
          <div className="scan-loading-wrap">
            <div className="scan-loading-card">
              <div className="scan-loading-img">
                <img src={imagePreview} alt="scanning" />
                <div className="scan-overlay">
                  <div className="scan-line" />
                </div>
              </div>
              <div className="scan-loading-spinner"><div className="spinner" /></div>
              <div className="scan-loading-tip">{SCAN_TIPS[tipIdx]}</div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Preview & Edit ── */}
        {step === STEPS.PREVIEW && scanResult && (
          <div className="scan-preview-wrap">
            <div className="scan-preview-header">
              <div className="scan-preview-stats">
                <span className="scan-badge">✅ {scanResult.sections.length} sections detected</span>
                <span className="scan-badge">🍽 {totalItems} items extracted</span>
              </div>
              <p style={{ color: 'var(--ink-faint)', fontSize: 13, marginTop: 6 }}>
                Review and edit before creating your digital menu.
              </p>
            </div>

            <div className="scan-meta">
              <div className="form-group">
                <label className="form-label">Menu name</label>
                <input className="form-input" value={menuName} onChange={e => setMenuName(e.target.value)} placeholder="e.g. Main Menu" />
              </div>
              <div className="form-group">
                <label className="form-label">Restaurant name</label>
                <input className="form-input" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} placeholder="e.g. Spice Garden" />
              </div>
            </div>

            <div className="scan-sections">
              {scanResult.sections.map((sec, si) => (
                <div key={si} className="scan-section">
                  <div className="scan-section-name">{sec.name}</div>
                  <div className="scan-items">
                    {sec.items.map((item, ii) => (
                      <div key={ii} className="scan-item-row">
                        <div className="scan-item-emoji">{item.emoji}</div>
                        <div className="scan-item-fields">
                          <input className="scan-item-name" value={item.name}
                            onChange={e => updateItem(si, ii, 'name', e.target.value)} />
                          {item.description && (
                            <input className="scan-item-desc" value={item.description}
                              onChange={e => updateItem(si, ii, 'description', e.target.value)} />
                          )}
                        </div>
                        <div className="scan-item-right">
                          <select className="scan-item-type"
                            value={item.type} onChange={e => updateItem(si, ii, 'type', e.target.value)}>
                            <option value="veg">🟢 Veg</option>
                            <option value="nonveg">🔴 Non-veg</option>
                            <option value="egg">🟡 Egg</option>
                          </select>
                          <div className="scan-price-wrap">
                            <span className="scan-price-sym">₹</span>
                            <input type="number" className="scan-item-price" value={item.price}
                              onChange={e => updateItem(si, ii, 'price', Number(e.target.value))} />
                          </div>
                          <button className="scan-item-del" onClick={() => removeItem(si, ii)} title="Remove item">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="scan-create-bar">
              <div className="scan-create-info">
                {scanResult.sections.length} sections · {totalItems} items ready
              </div>
              <button className="btn-primary scan-create-btn" onClick={createMenu}>
                Create Digital Menu →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Creating ── */}
        {step === STEPS.CREATING && (
          <div className="scan-loading-wrap">
            <div className="scan-loading-card" style={{ textAlign: 'center' }}>
              <div className="scan-loading-spinner"><div className="spinner" /></div>
              <div className="scan-loading-tip">Creating your digital menu…</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
