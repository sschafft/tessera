// screen-observer.jsx — Screen 4: Observer view
// Read-only spectator. Sees BOTH builds + a high-level pair status.

function ScreenObserver() {
  return (
    <div className="t-reset" style={{ width: 1440, height: 900, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar role="Observer" code="HEX-934" partner={{ name: 'Sam ↔ Jules', role: 'pair 1 of 3', color: 'purple' }} timer="14:22" />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 340px', minHeight: 0, gap: 1, background: 'var(--line)' }}>
        {/* Builder canvas (read-only) */}
        <section style={{ background: 'var(--paper)', position: 'relative', overflow: 'hidden' }}>
          <PaneHeader title="Sam · Builder" subtitle="placing piece" color="orange" />
          <CanvasGridBg />
          <div style={{ position: 'absolute', inset: '60px 0 0 0' }}>
            <Tile kind="hex"    color="yellow" x={260} y={260} size={150} />
            <Tile kind="tri-up" color="red"    x={260} y={170} size={130} />
            <Tile kind="sq"     color="green"  x={180} y={300} size={84} rotate={6} />
          </div>
          <ObserverPill text="Watching · cannot interact" />
        </section>

        {/* Guider canvas (the goal) */}
        <section style={{ background: 'var(--paper)', position: 'relative', overflow: 'hidden' }}>
          <PaneHeader title="Jules · Guider" subtitle="sees the goal" color="blue" />
          <CanvasGridBg />
          <div style={{ position: 'absolute', left: 200, top: 200 }}>
            <Tile kind="hex"    color="yellow" x={80}  y={80}  size={170} />
            <Tile kind="tri-up" color="red"    x={80}  y={-25} size={150} />
            <Tile kind="sq"     color="green"  x={-15} y={120} size={92} rotate={6} />
            <Tile kind="sq"     color="blue"   x={170} y={120} size={92} rotate={-6} />
          </div>
          <div style={{ position: 'absolute', top: 70, left: 18 }}>
            <span className="t-stamp" style={{ color: 'var(--t-red)', background: '#fffaf0' }}>● THE GOAL</span>
          </div>
        </section>

        {/* Right rail — pair status */}
        <aside style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Pair status</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--paper-2)', borderRadius: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>62%</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>build accuracy</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>9</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>pieces placed</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>2</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>misplaced</div>
              </div>
            </div>
          </div>

          {/* Round info */}
          <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Round</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Title</span>
                  <span style={{ fontWeight: 600 }}>Q3 cross-functional kickoff</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Round</span>
                  <span style={{ fontWeight: 600 }}>2 of 3</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Complexity</span>
                  <span style={{ fontWeight: 600 }}>5 / 10</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Time left</span>
                  <span className="t-mono" style={{ fontWeight: 700 }}>04:18</span>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--line)' }} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>You</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--paper-2)', borderRadius: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--t-purple)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Observer</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>read-only · cannot interact</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom switcher */}
      <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', borderTop: '1px solid var(--line)', background: '#fff', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase', marginRight: 8 }}>Other pairs</span>
        {[
          { name: 'Sam ↔ Jules', active: true,  pct: 62 },
          { name: 'Wren ↔ Theo',  active: false, pct: 31 },
          { name: 'Mei ↔ Bo',     active: false, pct: 80 },
        ].map((p, i) => (
          <button key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px',
            borderRadius: 99, border: '1.5px solid', cursor: 'pointer',
            borderColor: p.active ? 'var(--ink)' : 'var(--line)',
            background: p.active ? 'var(--ink)' : 'transparent',
            color: p.active ? 'var(--paper)' : 'var(--ink)',
            fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
          }}>
            {p.name}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: .8 }}>{p.pct}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PaneHeader({ title, subtitle, color }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid var(--line)', zIndex: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--t-${color})` }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {subtitle}</span>
      </div>
      <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>live</span>
    </div>
  );
}

function ObserverPill({ text }) {
  return (
    <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
      <div style={{ padding: '6px 12px', background: 'rgba(31,26,20,.85)', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--t-purple)' }} />
        {text}
      </div>
    </div>
  );
}

window.ScreenObserver = ScreenObserver;
