import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function PublicMenu() {
  const { slug } = useParams();
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`/api/menu/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setMenu(data.menu);
        if (data.menu.accent_color) {
          document.documentElement.style.setProperty('--accent', data.menu.accent_color);
        }
        document.title = `${data.menu.restaurant_name} — Menu`;
      })
      .catch(() => setError(true));
  }, [slug]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, marginBottom: 8 }}>Menu not found</h2>
        <p style={{ color: 'var(--ink-faint)' }}>This menu may have been removed or the link is incorrect.</p>
      </div>
    );
  }

  if (!menu) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const sections = menu.sections.filter(s => s.items.length > 0);

  const isVisible = (item, sectionId) => {
    if (filter === 'all') return true;
    if (filter === 'veg') return item.type === 'veg';
    if (filter === 'nonveg') return item.type === 'nonveg';
    if (filter.startsWith('section-')) return `section-${sectionId}` === filter;
    return true;
  };

  return (
    <div className="public-menu-page">
      {/* HERO */}
      <div className="pub-hero">
        <div className="pub-rest-name">{menu.restaurant_name}</div>
        <div className="pub-rest-desc">{menu.tagline}{menu.description ? ` · ${menu.description}` : ''}</div>
        <div className="pub-badges">
          <span className="pub-badge">🕐 Open now</span>
        </div>
      </div>

      {/* FILTERS */}
      <div className="pub-filter-bar">
        {[
          { key: 'all', label: 'All' },
          { key: 'veg', label: '🟢 Veg only' },
          { key: 'nonveg', label: '🔴 Non-veg' },
          ...sections.map(s => ({ key: `section-${s.id}`, label: s.name })),
        ].map(f => (
          <button key={f.key} className={`pub-filter ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* MENU BODY */}
      <div className="pub-menu-body">
        {sections.map(section => {
          const visibleItems = section.items.filter(i => isVisible(i, section.id));
          if (!visibleItems.length) return null;
          return (
            <div className="pub-section" key={section.id}>
              <div className="pub-section-title">{section.name}</div>
              <div className="pub-items">
                {visibleItems.map(item => (
                  <div className="pub-item" key={item.id}>
                    <div className="pub-item-img">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                        : item.emoji || (item.type === 'nonveg' ? '🍗' : '🥦')
                      }
                    </div>
                    <div className="pub-item-body">
                      <div className="pub-item-name">
                        <span className="accent-dot" style={{ background: item.type === 'nonveg' ? 'var(--accent)' : 'var(--green)' }} />
                        {item.name}
                      </div>
                      <div className="pub-item-desc">{item.description}</div>
                      <div className="pub-item-footer">
                        <span className="pub-item-price">₹{item.price}</span>
                        <span className={`item-tag ${item.type === 'veg' ? 'tag-veg' : 'tag-nonveg'}`}>
                          {item.type === 'veg' ? 'Veg' : 'Non-veg'}
                        </span>
                        {item.is_spicy ? <span className="item-tag tag-spicy">🌶 Spicy</span> : null}
                        {item.is_bestseller ? <span className="item-tag tag-bestseller">⭐ Bestseller</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="pub-footer">
        <p>Digital menu powered by</p>
        <a href="/">Menuify — Create your free menu →</a>
      </div>
    </div>
  );
}
