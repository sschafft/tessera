// screen-builder.jsx — Screen 2: Builder view
// Big tray of polygons + central canvas. Builder drags pieces, talks to guider.
// Sealed envelope = builder brief, can be opened/sealed.

function ScreenBuilder({ briefOpen: briefOpenProp = true, accelerantStyle, density = 'standard' }) {
  const [briefOpen, setBriefOpen] = React.useState(briefOpenProp);
  React.useEffect(() => setBriefOpen(briefOpenProp), [briefOpenProp]);

  // Simpler buildable composition: hex, triangle on top, two squares — that's it.
  const builtTiles = [
    { kind: 'hex',    color: 'yellow', x: 360, y: 280, size: 140 },
    { kind: 'tri-up', color: 'red',    x: 360, y: 175, size: 110 },
    { kind: 'sq',     color: 'green',  x: 270, y: 320, size: 80, rotate: 6 },
  ];

  return (
    <div className="t-reset" style={{ width: 1440, height: 900, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar role="Builder" code="HEX-934" partner={{ name: 'Jules', role: 'Guider', color: 'blue' }} timer="14:22" />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
        {/* Left tray — pieces */}
        <aside style={{
          background: 'var(--paper-2)', borderRight: '1px solid var(--line)',
          padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Tray · pieces</span>
              <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>32 left</span>
            </div>
            <ShapeGrid />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Color palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {['red','orange','yellow','green','blue','purple','pink','teal'].map(c => (
                <div key={c} style={{ aspectRatio: '1', borderRadius: 10, background: `var(--t-${c})`, border: '2px solid #fff', boxShadow: '0 2px 0 rgba(0,0,0,.10)', cursor: 'grab' }} />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Tools</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '↺', l: 'Rotate', k: 'R' },
                { icon: '⤢', l: 'Resize', k: 'S' },
                { icon: '⌫', l: 'Remove', k: '⌫' },
                { icon: '⎌', l: 'Undo',   k: '⌘Z' },
              ].map(t => (
                <button key={t.l} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
                  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ width: 22, textAlign: 'center', fontSize: 16 }}>{t.icon}</span>
                  <span style={{ flex: 1 }}>{t.l}</span>
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t.k}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center canvas */}
        <main style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
          <CanvasGridBg />

          {/* Built tiles */}
          <div style={{ position: 'absolute', inset: 0 }}>
            {builtTiles.map((t, i) => <Tile key={i} {...t} />)}

            {/* ghost suggestion — last piece to place */}
            <Tile kind="sq" color="blue" x={500} y={320} size={80} rotate={-6} ghost />

            {/* Selected piece w/ handles */}
            <div style={{ position: 'absolute', left: 270, top: 320, width: 80, height: 80, transform: 'rotate(6deg)', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: -10, border: '2px dashed var(--t-red)', borderRadius: 6 }} />
              <div style={{ position: 'absolute', top: -18, left: -18, width: 12, height: 12, borderRadius: 99, background: '#fff', border: '2px solid var(--t-red)' }} />
              <div style={{ position: 'absolute', top: -18, right: -18, width: 12, height: 12, borderRadius: 99, background: '#fff', border: '2px solid var(--t-red)' }} />
              <div style={{ position: 'absolute', bottom: -18, left: -18, width: 12, height: 12, borderRadius: 99, background: '#fff', border: '2px solid var(--t-red)' }} />
              <div style={{ position: 'absolute', bottom: -18, right: -18, width: 12, height: 12, borderRadius: 99, background: '#fff', border: '2px solid var(--t-red)' }} />
            </div>
          </div>

          {/* Top bar overlay — controls */}
          <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div className="t-card" style={{ padding: '8px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <button style={iconBtn}>⎌</button>
              <button style={iconBtn}>⎋</button>
              <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
              <button style={iconBtn}>−</button>
              <span className="t-mono" style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 38, textAlign: 'center' }}>100%</span>
              <button style={iconBtn}>+</button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <LinksBar />
              <BriefEnvelope open={briefOpen} onToggle={() => setBriefOpen(o => !o)} role="Builder" />
            </div>
          </div>

          {/* Bottom dock — accelerants visible to builder */}
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)' }}>
            <div className="t-card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', borderRadius: 'var(--r-pill)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--tint-blue)', color: 'var(--t-blue)', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--t-blue)' }} />
                Prototype unlocked
              </span>
              <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                👁 Glimpse goal · 5s
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                ✓ Test build
              </button>
            </div>
          </div>

          {/* Partner presence — bottom left. They're on a video call (off-platform) */}
          <div style={{ position: 'absolute', bottom: 22, left: 22 }}>
            <div className="t-card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar name="J" color="blue" size={28} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Paired with</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Jules · guiding</span>
              </div>
              <span style={{ width: 1, height: 22, background: 'var(--line)' }} />
              <span className="t-mono" style={{ fontSize: 10, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--t-green)' }} />
                off-platform call
              </span>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .t-input{ width:100%; height:42px; padding:0 14px; border:1.5px solid var(--line);
          border-radius:12px; background:#fff; font:14px/1 var(--font-ui); color:var(--ink);
          outline:none; }
      `}</style>
    </div>
  );
}

const iconBtn = {
  width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent',
  cursor: 'pointer', fontSize: 14, color: 'var(--ink-2)', display: 'grid', placeItems: 'center',
};

function LinksBar() {
  return (
    <div className="t-card" style={{ padding: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
      <a href="#" style={linkBtn}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--t-blue)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>▶</span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Video call</span>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>meet.example/x9</span>
        </span>
      </a>
      <span style={{ width: 1, height: 26, background: 'var(--line)' }} />
      <a href="#" style={linkBtn}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--t-purple)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>▦</span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Whiteboard</span>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>miro.com/q3-kickoff</span>
        </span>
      </a>
    </div>
  );
}

const linkBtn = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 8px',
  borderRadius: 8, textDecoration: 'none', color: 'var(--ink)',
  cursor: 'pointer',
};

function ShapeGrid() {
  const cells = [
    ['tri-up','red'], ['tri-dn','blue'], ['sq','yellow'],
    ['hex','green'], ['rhomb','orange'], ['trap','purple'],
    ['tri-up','teal'], ['sq','pink'], ['hex','red'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      {cells.map(([k,c],i) => (
        <div key={i} style={{
          aspectRatio: '1', background: '#fff', border: '1px solid var(--line)',
          borderRadius: 12, position: 'relative', cursor: 'grab',
        }}>
          <Tile kind={k} color={c} x={10} y={10} size={48} />
        </div>
      ))}
    </div>
  );
}

function CanvasGridBg() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .5 }}>
      <defs>
        <pattern id="tri-grid" width="60" height="52" patternUnits="userSpaceOnUse">
          <path d="M0 0 L30 52 L60 0 M0 52 L30 0 L60 52" fill="none" stroke="rgba(60,40,10,.10)" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tri-grid)"/>
    </svg>
  );
}

function BriefEnvelope({ open, onToggle, role }) {
  if (!open) {
    return (
      <button onClick={onToggle} className="t-envelope" style={{ width: 280, paddingTop: 36, cursor: 'pointer', textAlign: 'left', border: '1.5px solid var(--ink)' }}>
        <div className="t-envelope__seal">{role[0]}</div>
        <div style={{ marginTop: 6 }}>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.12em' }}>SEALED</div>
          <div className="t-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{role}'s brief</div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>Tap to open · keep secret</div>
        </div>
      </button>
    );
  }
  return (
    <div style={{ width: 320, position: 'relative' }}>
      <div className="t-card" style={{ padding: 18, borderRadius: 16, position: 'relative', background: '#fffaf0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--t-red)', fontWeight: 700, letterSpacing: '.12em' }}>● BUILDER · CONFIDENTIAL</span>
          <button onClick={onToggle} style={{ ...iconBtn, fontSize: 18 }}>×</button>
        </div>
        <div className="t-display" style={{ fontSize: 17, lineHeight: 1.3, marginBottom: 10 }}>
          Translate every direction your guider gives you.
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          <li>↔ When they say <b>"left"</b>, you place <b>right</b>.</li>
          <li>⇅ When they say a <b>color</b>, use the complement.</li>
          <li>⌀ <b>Numbers</b> are halved (round up).</li>
        </ul>
        <div style={{ marginTop: 14, padding: 10, background: 'var(--tint-yellow)', borderRadius: 10, fontSize: 12, color: '#7a5b00' }}>
          The guider has a <b>different brief</b>. Don't share yours.
        </div>
      </div>
    </div>
  );
}

function TopBar({ role, code, partner, timer }) {
  return (
    <header style={{
      height: 60, padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', borderBottom: '1px solid var(--line)',
      background: '#fff', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Wordmark size={20} />
        <span style={{ width: 1, height: 20, background: 'var(--line)' }} />
        <span className="t-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>game · {code}</span>
        <RoleChip role={role} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="t-mono" style={{ fontSize: 14, fontWeight: 700, padding: '6px 12px', background: 'var(--paper-2)', borderRadius: 99 }}>⏱ {timer}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 4px', background: 'var(--paper-2)', borderRadius: 99 }}>
          <Avatar name={partner.name} color={partner.color} size={26} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{partner.name}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· {partner.role}</span>
        </div>
        <button className="t-btn t-btn--ghost t-btn--sm">Leave game</button>
      </div>
    </header>
  );
}

Object.assign(window, { ScreenBuilder, TopBar, CanvasGridBg, BriefEnvelope, iconBtn, LinksBar });
