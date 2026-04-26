// screen-master.jsx — Screen 5: Game master dashboard
// The polished one. Multi-pair overview + per-pair drill-in + ACCELERANT controls.

function ScreenMaster({ accelerantStyle = 'chunky' }) {
  const [selected, setSelected] = React.useState(0);
  const pairs = [
    { name: 'Sam ↔ Jules',  builders: { B: 'Sam', G: 'Jules' }, colors: { B: 'orange', G: 'blue'   }, pct: 62, placed: 9, mis: 2, status: 'building',  flag: 'on track' },
    { name: 'Wren ↔ Theo',  builders: { B: 'Wren', G: 'Theo' }, colors: { B: 'pink',   G: 'teal'   }, pct: 31, placed: 4, mis: 1, status: 'stuck',     flag: 'needs nudge' },
    { name: 'Mei ↔ Bo',     builders: { B: 'Mei', G: 'Bo'    }, colors: { B: 'green',  G: 'purple' }, pct: 80, placed: 12, mis: 0, status: 'finishing', flag: 'fast' },
  ];
  const cur = pairs[selected];

  return (
    <div className="t-reset" style={{ width: 1440, height: 900, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper-2)' }}>
      <header style={{ height: 64, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Wordmark size={22} />
          <span style={{ width: 1, height: 22, background: 'var(--line)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Q3 cross-functional kickoff</span>
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>HEX-934 · round 2 of 3 · complexity 5</span>
          </div>
          <RoleChip role="Game master" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="t-mono" style={{ fontSize: 14, fontWeight: 700, padding: '8px 14px', background: 'var(--paper-2)', borderRadius: 99 }}>⏱ 14:22</span>
          <button className="t-btn t-btn--ghost t-btn--sm">Pause round</button>
          <button className="t-btn t-btn--primary t-btn--sm">End round</button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 360px', minHeight: 0 }}>
        {/* Pairs sidebar */}
        <aside style={{ background: '#fff', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
          {/* LOBBY — unallocated people waiting to be assigned */}
          <Lobby />

          <div style={{ padding: '14px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Pairs · 3</span>
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>+1 observer</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
            {pairs.map((p, i) => (
              <button key={i} onClick={() => setSelected(i)}
                style={{
                  width: '100%', textAlign: 'left', padding: 12, marginBottom: 6,
                  borderRadius: 12, border: '1.5px solid', cursor: 'pointer',
                  borderColor: selected === i ? 'var(--ink)' : 'transparent',
                  background: selected === i ? 'var(--paper)' : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: -6, alignItems: 'center' }}>
                    <Avatar name={p.builders.B} color={p.colors.B} size={26} ring="#fff" />
                    <div style={{ marginLeft: -8 }}>
                      <Avatar name={p.builders.G} color={p.colors.G} size={26} ring="#fff" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 8 }}>{p.name}</span>
                  </div>
                  <span className="t-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{p.pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--paper-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${p.pct}%`, height: '100%', background: p.pct > 70 ? 'var(--t-green)' : p.pct > 40 ? 'var(--t-orange)' : 'var(--t-red)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)' }}>
                  <span>{p.placed} placed · {p.mis} off</span>
                  <span style={{
                    color: p.status === 'stuck' ? 'var(--t-red)' : p.status === 'finishing' ? 'var(--t-green)' : 'var(--ink-2)',
                    fontWeight: 600,
                  }}>● {p.status}</span>
                </div>
              </button>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 6 }}>
            <button className="t-btn t-btn--ghost t-btn--sm" style={{ flex: 1 }}>+ add pair</button>
            <button className="t-btn t-btn--sm" style={{ flex: 1 }}>shuffle</button>
          </div>
        </aside>

        {/* Center: pair detail */}
        <main style={{ padding: 24, overflowY: 'auto', background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>FOCUSED PAIR · 1 OF 3</div>
              <h2 className="t-display" style={{ fontSize: 32, margin: '4px 0 0' }}>{cur.name}</h2>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="t-btn t-btn--sm">Send accelerant</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Builder canvas */}
            <div className="t-card" style={{ padding: 0, overflow: 'hidden', background: '#fff' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={cur.builders.B} color={cur.colors.B} size={24} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{cur.builders.B}</span>
                  <RoleChip role="Builder" />
                </div>
                <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>WIP</span>
              </div>
              <div style={{ position: 'relative', height: 240, background: 'var(--paper)' }}>
                <CanvasGridBg />
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Tile kind="hex"    color="yellow" x={180} y={70} size={100} />
                  <Tile kind="tri-up" color="red"    x={180} y={5}  size={86} />
                  <Tile kind="sq"     color="green"  x={130} y={100} size={56} rotate={6} />
                </div>
              </div>
            </div>
            {/* Guider canvas (goal) */}
            <div className="t-card" style={{ padding: 0, overflow: 'hidden', background: '#fff' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={cur.builders.G} color={cur.colors.G} size={24} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{cur.builders.G}</span>
                  <RoleChip role="Guider" />
                </div>
                <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>GOAL</span>
              </div>
              <div style={{ position: 'relative', height: 240, background: 'var(--paper)' }}>
                <CanvasGridBg />
                <div style={{ position: 'absolute', left: 130, top: 50 }}>
                  <Tile kind="hex"    color="yellow" x={50}  y={50}  size={110} />
                  <Tile kind="tri-up" color="red"    x={50}  y={-20} size={96} />
                  <Tile kind="sq"     color="green"  x={-15} y={80}  size={62} rotate={6} />
                  <Tile kind="sq"     color="blue"   x={115} y={80}  size={62} rotate={-6} />
                </div>
              </div>
            </div>
          </div>

          {/* Briefs row */}
          <div className="t-card" style={{ padding: 18, marginBottom: 16, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Briefs in play (only you see both)</span>
              <button className="t-btn t-btn--ghost t-btn--sm">Re-roll briefs</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <BriefCard role="Builder" color="orange" title="Translate, don't transcribe."
                rules={['"left" → place right', 'colors → complement', 'numbers ÷ 2']} />
              <BriefCard role="Guider" color="blue" title="Speak only in nautical terms."
                rules={['fore/aft, port/starboard', 'sail / deck / buoy', 'no plain shape names']} />
            </div>
          </div>
        </main>

        {/* Right: ACCELERANTS — the heart of GM dashboard */}
        <aside style={{ background: '#fff', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--t-red)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800 }}>⚡</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)' }}>Accelerants</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              Trigger mechanics on a pair (or all pairs) to push them past stuck moments.
            </p>
            <Segmented options={[cur.name.split(' ')[0], 'All pairs']} value={cur.name.split(' ')[0]} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Accelerant style={accelerantStyle} icon="🔮" color="blue"   title="Prototype unlock" sub="Show builder a 5-second glimpse of the goal." cooldown="12s left" used="2 / 4" />
            <Accelerant style={accelerantStyle} icon="📖" color="purple" title="Reveal briefs" sub="Both players see each other's hidden brief." used="0 / 1" hot />
            <Accelerant style={accelerantStyle} icon="✓"  color="green"  title="Test build" sub="Auto-check % accuracy against goal." used="3 / ∞" />
            <Accelerant style={accelerantStyle} icon="↻"  color="orange" title="Agile share" sub="Surface 3 builder previews to the guider." used="1 / 3" />
            <Accelerant style={accelerantStyle} icon="⏱"  color="red"    title="Time pressure" sub="−3:00 from the round timer. Plays a sting." used="0 / 2" />
            <Accelerant style={accelerantStyle} icon="✦"  color="teal"   title="Vocab swap" sub="Force the guider's brief to a new constraint mid-round." used="0 / 1" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function BriefCard({ role, color, title, rules }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, background: `var(--tint-${color})`, border: `1.5px solid var(--t-${color})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <RoleChip role={role} />
        <span className="t-mono" style={{ fontSize: 10, fontWeight: 700, color: `var(--t-${color})` }}>● VISIBLE</span>
      </div>
      <div className="t-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink-2)' }}>
        {rules.map((r, i) => <li key={i}>· {r}</li>)}
      </ul>
    </div>
  );
}

function Accelerant({ style: variant, icon, color, title, sub, cooldown, used, hot }) {
  if (variant === 'minimal') {
    return (
      <button style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
        background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
        cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ width: 28, textAlign: 'center', fontSize: 16 }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{title}</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)' }}>{sub}</span>
        </span>
        <span className="t-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{used}</span>
      </button>
    );
  }
  if (variant === 'cards') {
    return (
      <div style={{ background: '#fff', border: '1.5px solid var(--line)', borderRadius: 14, padding: 14, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: `var(--tint-${color})`, color: `var(--t-${color})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>{icon}</span>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{used}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 10 }}>{sub}</div>
        <button className="t-btn t-btn--sm" style={{ width: '100%', background: hot ? `var(--t-${color})` : 'var(--ink)' }}>Trigger</button>
      </div>
    );
  }
  // chunky (default) — toy-like buttons
  return (
    <button style={{
      width: '100%', textAlign: 'left',
      padding: 14, borderRadius: 14, cursor: 'pointer',
      background: hot ? `var(--t-${color})` : '#fff',
      color: hot ? '#fff' : 'var(--ink)',
      border: `1.5px solid ${hot ? 'var(--ink)' : 'var(--line)'}`,
      boxShadow: hot ? '0 4px 0 var(--ink)' : '0 3px 0 rgba(0,0,0,.08)',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      position: 'relative', transition: 'transform .12s var(--ease)',
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: hot ? 'rgba(255,255,255,.25)' : `var(--tint-${color})`,
        color: hot ? '#fff' : `var(--t-${color})`,
        display: 'grid', placeItems: 'center', fontSize: 18,
        boxShadow: hot ? 'none' : `inset 0 0 0 1.5px var(--t-${color})`,
      }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          <span className="t-mono" style={{ fontSize: 10, opacity: .7 }}>{used}</span>
        </span>
        <span style={{ display: 'block', fontSize: 12, opacity: .85, lineHeight: 1.4 }}>{sub}</span>
        {cooldown && <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, padding: '2px 6px', background: hot ? 'rgba(255,255,255,.2)' : 'var(--paper-2)', borderRadius: 99 }} className="t-mono">⏱ {cooldown}</span>}
      </span>
    </button>
  );
}

window.ScreenMaster = ScreenMaster;

// ─── LOBBY ────────────────────────────────────────────────────────────
// Unallocated participants. GM can pair them, drop them into a pair as
// observer, or auto-assign everyone via "Auto-allocate".
function Lobby() {
  const [people, setPeople] = React.useState([
    { name: 'Ada',    color: 'red',    role: null, joined: '14:01', team: 'eng' },
    { name: 'Kit',    color: 'teal',   role: null, joined: '14:02', team: 'design' },
    { name: 'Noor',   color: 'purple', role: null, joined: '14:04', team: 'pm' },
    { name: 'Rhys',   color: 'green',  role: null, joined: '14:06', team: 'eng' },
    { name: 'Yuki',   color: 'orange', role: null, joined: '14:09', team: 'design' },
  ]);
  const [picked, setPicked] = React.useState(new Set());

  const togglePick = (name) => {
    const next = new Set(picked);
    next.has(name) ? next.delete(name) : next.add(name);
    setPicked(next);
  };
  const pickedCount = picked.size;

  return (
    <div style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--t-orange)', boxShadow: '0 0 0 3px var(--tint-orange)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Lobby · {people.length} waiting
          </span>
        </div>
        <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {pickedCount > 0 ? `${pickedCount} selected` : 'tap to select'}
        </span>
      </div>

      {/* Avatar list — selectable chips */}
      <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {people.map((p, i) => {
          const sel = picked.has(p.name);
          return (
            <button key={i} onClick={() => togglePick(p.name)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
              border: `1.5px solid ${sel ? 'var(--ink)' : 'transparent'}`,
              background: sel ? '#fff' : 'transparent',
              textAlign: 'left',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `1.5px solid ${sel ? 'var(--ink)' : 'var(--line-2)'}`,
                background: sel ? 'var(--ink)' : '#fff',
                display: 'grid', placeItems: 'center',
                color: '#fff', fontSize: 11, fontWeight: 800,
              }}>{sel ? '✓' : ''}</span>
              <Avatar name={p.name} color={p.color} size={26} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-3)' }}>{p.team} · joined {p.joined}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Action bar */}
      <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Primary: when 2 selected, allow direct pairing */}
        {pickedCount === 2 && (
          <button style={{
            width: '100%', padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
            background: 'var(--ink)', color: 'var(--paper)', border: 'none',
            fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
            boxShadow: '0 2px 0 rgba(0,0,0,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            ⇄ Pair selected · assign roles
          </button>
        )}
        {pickedCount >= 1 && pickedCount !== 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button className="t-btn t-btn--ghost t-btn--sm" style={{ fontSize: 11 }}>→ Existing pair</button>
            <button className="t-btn t-btn--ghost t-btn--sm" style={{ fontSize: 11 }}>👁 As observer</button>
          </div>
        )}

        {/* Always available: auto-allocate */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 6 }}>
          <button style={{
            padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
            background: '#fff', color: 'var(--ink)',
            border: '1.5px solid var(--ink)',
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
            boxShadow: '0 2px 0 var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            🎲 Auto-allocate all
          </button>
          <button className="t-btn t-btn--ghost t-btn--sm" style={{ fontSize: 11 }}>Settings</button>
        </div>

        {/* Allocation rule chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {[
            { label: 'pairs of 2', on: true },
            { label: 'mix teams', on: true },
            { label: '1 observer per 2 pairs', on: false },
          ].map((r, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 99,
              background: r.on ? 'var(--ink)' : 'transparent',
              color: r.on ? 'var(--paper)' : 'var(--ink-3)',
              border: `1px ${r.on ? 'solid' : 'dashed'} ${r.on ? 'var(--ink)' : 'var(--line-2)'}`,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}>{r.on ? '✓ ' : '+ '}{r.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
