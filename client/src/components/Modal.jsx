export default function Modal({ open, onClose, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
