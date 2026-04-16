import { useState, useEffect } from 'react';
import Modal from './Modal';
import { ToastContext } from '../App';

const PRESETS = [
  { name: 'Classic', dark: '1A1410', light: 'FFFDF9' },
  { name: 'Orange',  dark: 'C8622A', light: 'FFF5F0' },
  { name: 'Forest',  dark: '2D6A4F', light: 'F0FBF5' },
  { name: 'Night',   dark: 'FFFDF9', light: '1A1410' },
  { name: 'Pure',    dark: '000000', light: 'FFFFFF' },
];

const SIZES = [
  { label: 'S', value: 200 },
  { label: 'M', value: 300 },
  { label: 'L', value: 500 },
];

export default function QRModal({ open, onClose, slug, menuName }) {
  const [size, setSize] = useState(300);
  const [preset, setPreset] = useState(0);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !slug) return;
    loadQR();
  }, [open, slug, size, preset]);

  const loadQR = async () => {
    setLoading(true);
    try {
      const { dark, light } = PRESETS[preset];
      const params = new URLSearchParams({ size, dark, light });
      const res = await fetch(`/api/qr/${slug}?${params}`);
      const data = await res.json();
      setQrData(data);
    } catch {
      ToastContext.show('Could not load QR code');
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!qrData?.qr) return;
    const a = document.createElement('a');
    a.href = qrData.qr;
    a.download = `${(menuName || 'menu').toLowerCase().replace(/\s+/g, '-')}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    ToastContext.show('QR code downloaded!');
  };

  const copyUrl = () => {
    if (!qrData?.url) return;
    navigator.clipboard.writeText(qrData.url).then(() => {
      ToastContext.show('Menu URL copied!');
    });
  };

  const print = () => {
    if (!qrData?.qr) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>${menuName || 'Menu'} — QR Code</title>
    <style>
      body { margin: 0; display: flex; flex-direction: column; align-items: center;
             justify-content: center; min-height: 100vh; font-family: sans-serif; background: #fff; }
      h2 { font-size: 22px; margin-bottom: 24px; color: #1A1410; }
      img { width: 300px; height: 300px; }
      p { color: #888; font-size: 12px; margin-top: 16px; word-break: break-all;
          text-align: center; max-width: 320px; }
    </style>
  </head>
  <body>
    <h2>${menuName || 'Menu'}</h2>
    <img src="${qrData.qr}" alt="QR Code" />
    <p>${qrData.url}</p>
  </body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="qr-gen">
        <h3>QR Code Generator</h3>
        <p>Customise and download the QR code for your menu.</p>

        <div className="qr-gen-preview">
          {loading ? (
            <div className="qr-gen-loading"><div className="spinner" /></div>
          ) : qrData?.qr ? (
            <img src={qrData.qr} alt="QR Code" className="qr-gen-img" />
          ) : null}
        </div>

        {qrData?.url && (
          <div className="qr-gen-url">
            <span className="qr-gen-url-text">{qrData.url}</span>
            <button className="qr-gen-copy-btn" onClick={copyUrl}>Copy</button>
          </div>
        )}

        <div className="qr-gen-options">
          <div className="qr-gen-group">
            <div className="qr-gen-group-label">Colour</div>
            <div className="qr-gen-presets">
              {PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  title={p.name}
                  className={`qr-preset-btn ${preset === i ? 'active' : ''}`}
                  style={{ background: `#${p.dark}`, color: `#${p.light}` }}
                  onClick={() => setPreset(i)}
                >
                  {p.name[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="qr-gen-group">
            <div className="qr-gen-group-label">Size</div>
            <div className="qr-size-btns">
              {SIZES.map(s => (
                <button
                  key={s.value}
                  className={`qr-size-btn ${size === s.value ? 'active' : ''}`}
                  onClick={() => setSize(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={print}>Print</button>
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={download}>↓ Download PNG</button>
        </div>
      </div>
    </Modal>
  );
}
