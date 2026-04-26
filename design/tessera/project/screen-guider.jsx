// screen-guider.jsx — Screen 3: Guider view

function ScreenGuider({ briefOpen: briefOpenProp = true }) {
  const [briefOpen, setBriefOpen] = React.useState(briefOpenProp);
  React.useEffect(() => setBriefOpen(briefOpenProp), [briefOpenProp]);

  return (
    <div className="t-reset" style={{ width: 1440, height: 900, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar role="Guider" code="HEX-934" partner={{ name: 'Sam', role: 'Builder', color: 'orange' }} timer="14:22" />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr', minHeight: 0 }}>
        <main style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
          <CanvasGridBg />

          {/* THE GOAL — simplified: hex + tri + 2 squares */}
          <div style={{ position: 'absolute', left: 480, top: 220 }}>
            <Tile kind="hex"    color="yellow" x={100} y={100} size={200} />
            <Tile kind="tri-up" color="red"    x={100} y={-30} size={180} />
            <Tile kind="sq"     color="green"  x={-20} y={150} size={110} rotate={6} />
            <Tile kind="sq"     color="blue"   x={210} y={150} size={110} rotate={-6} />
          </div>

          <div style={{ position: 'absolute', top: 100, left: 500 }}>
            <span className="t-stamp" style={{ color: 'var(--t-red)', background: '#fffaf0' }}>
              ● THE GOAL · only you see this
            </span>
          </div>

          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} viewBox="0 0 1440 800">
            <path d="M 600 320 C 660 290, 730 290, 770 320" stroke="var(--t-red)" strokeWidth="3" fill="none" strokeDasharray="4 4" strokeLinecap="round" opacity=".7" />
            <text x="780" y="316" fill="var(--t-red)" fontFamily="var(--font-display)" fontSize="14" fontWeight="700">→ describe this first</text>
          </svg>

          {/* Top overlay — left stamp, right links + brief */}
          <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <span className="t-stamp" style={{ color: 'var(--t-blue)', background: '#fffaf0' }}>● THE GOAL · read-only</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <LinksBar />
              <BriefEnvelope open={briefOpen} onToggle={() => setBriefOpen(o => !o)} role="Guider" guider />
            </div>
          </div>

          {/* Builder preview - bottom right */}
          <div style={{ position: 'absolute', bottom: 18, right: 18, width: 300 }}>
            <div className="t-card" style={{ padding: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Sam is building</span>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>preview · 2 / 4</span>
              </div>
              <div style={{ position: 'relative', height: 160, background: 'var(--paper)', borderRadius: 10, overflow: 'hidden' }}>
                <CanvasGridBg />
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Tile kind="hex"    color="yellow" x={120} y={60} size={86} />
                  <Tile kind="tri-up" color="red"    x={120} y={5}  size={72} />
                  <Tile kind="sq"     color="green"  x={70}  y={88} size={48} rotate={6} />
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>
                ⚠ Green square is on the wrong side
              </div>
            </div>
          </div>

          {/* Partner pill */}
          <div style={{ position: 'absolute', bottom: 22, left: 22 }}>
            <div className="t-card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar name="S" color="orange" size={28} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Paired with</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Sam · building</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Override BriefEnvelope content for Guider
const _OrigBrief = window.BriefEnvelope;
window.BriefEnvelope = function BriefEnvelopeWrap({ open, onToggle, role, guider }) {
  if (!open) return _OrigBrief({ open, onToggle, role });
  if (role !== 'Guider') return _OrigBrief({ open, onToggle, role });
  return (
    <div style={{ width: 320 }}>
      <div className="t-card" style={{ padding: 18, borderRadius: 16, background: '#fffaf0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--t-blue)', fontWeight: 700, letterSpacing: '.12em' }}>● GUIDER · CONFIDENTIAL</span>
          <button onClick={onToggle} style={{ ...iconBtn, fontSize: 18 }}>×</button>
        </div>
        <div className="t-display" style={{ fontSize: 17, lineHeight: 1.3, marginBottom: 10 }}>
          You can only describe pieces using nautical terms.
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          <li>↑ "fore" · ↓ "aft"</li>
          <li>← "port" · → "starboard"</li>
          <li>Triangle = "sail" · Square = "deck" · Hex = "buoy"</li>
        </ul>
        <div style={{ marginTop: 14, padding: 10, background: 'var(--tint-yellow)', borderRadius: 10, fontSize: 12, color: '#7a5b00' }}>
          The builder has a <b>different brief</b>. Don't share yours.
        </div>
      </div>
    </div>
  );
};

window.ScreenGuider = ScreenGuider;
