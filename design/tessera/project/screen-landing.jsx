// screen-landing.jsx — Screen 1: Landing / create game
function ScreenLanding() {
  const [tab, setTab] = React.useState('host');
  const [complexity, setComplexity] = React.useState(5);
  const [team, setTeam] = React.useState('Players pick');

  return (
    <div className="t-reset" style={{ width: 1440, height: 900, position: 'relative', overflow: 'hidden' }}>
      <div className="t-dots" style={{ position: 'absolute', inset: 0, opacity: .35 }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Tile kind="hex"    color="yellow" x={92}   y={120} size={120} rotate={-12} />
        <Tile kind="tri-up" color="red"    x={1230} y={90}  size={96}  rotate={14} />
        <Tile kind="sq"     color="blue"   x={1180} y={620} size={84}  rotate={20} />
        <Tile kind="tri-dn" color="green"  x={120}  y={680} size={96}  rotate={-10} />
        <Tile kind="rhomb"  color="purple" x={1300} y={360} size={70}  rotate={6} />
        <Tile kind="hex"    color="teal"   x={40}   y={420} size={60}  rotate={28} />
      </div>

      <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 56px', zIndex: 2 }}>
        <Wordmark size={26} />
        <nav style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['How it works', 'Facilitator guide', 'Examples'].map(l => (
            <a key={l} style={{ padding: '8px 14px', fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 500 }}>{l}</a>
          ))}
          <button className="t-btn t-btn--sm" style={{ marginLeft: 8 }}>Sign in</button>
        </nav>
      </header>

      <section style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 56, padding: '24px 80px 0', alignItems: 'start', zIndex: 1 }}>
        <div>
          <span className="t-chip" style={{ background: 'var(--tint-yellow)', color: '#7a5b00' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--t-orange)' }} />
            A workshop game for teams of 3+
          </span>
          <h1 className="t-display" style={{ fontSize: 88, lineHeight: .94, margin: '18px 0 22px', letterSpacing: '-0.035em' }}>
            Build the<br/>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              same picture
              <svg viewBox="0 0 420 22" style={{ position: 'absolute', left: 0, right: 0, bottom: -10, width: '100%' }}>
                <path d="M2 14 C 80 4, 200 22, 418 8" fill="none" stroke="var(--t-red)" strokeWidth="6" strokeLinecap="round"/>
              </svg>
            </span><br/>
            without seeing it.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 540, margin: 0 }}>
            Tessera is a facilitation game for hybrid workshops. Pair a <b>builder</b> with a <b>guider</b>,
            give each a secret brief, and watch communication, prototyping, and shared context become visible.
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 30 }}>
            <button className="t-btn t-btn--primary" style={{ height: 54, padding: '0 26px', fontSize: 15 }}>Host a game →</button>
            <button className="t-btn t-btn--ghost" style={{ height: 54, padding: '0 26px', fontSize: 15 }}>I have a code</button>
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 30, color: 'var(--ink-3)', fontSize: 13 }}>
            <Bullet color="red" label="Builder + Guider pairs" />
            <Bullet color="blue" label="Optional observers" />
            <Bullet color="green" label="No accounts needed" />
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="t-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
              {[{id:'host',l:'Host a game'},{id:'join',l:'Join a game'}].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: '18px 0', border: 'none', cursor: 'pointer',
                    background: tab === t.id ? '#fff' : 'transparent',
                    fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
                    color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
                    borderBottom: tab === t.id ? '3px solid var(--t-red)' : '3px solid transparent',
                  }}>{t.l}</button>
              ))}
            </div>

            {tab === 'host' ? (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Workshop name">
                  <input className="t-input" defaultValue="Q3 cross-functional kickoff" />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Video call link" required>
                    <input className="t-input" defaultValue="meet.example/x9-fzj-prw" />
                  </Field>
                  <Field label="Whiteboard" hint="optional">
                    <input className="t-input" placeholder="miro.com/…" />
                  </Field>
                </div>
                <Field label="Team assignment">
                  <Segmented options={['Game master picks','Players pick']} value={team} onChange={setTeam} />
                </Field>
                <Field label={`Complexity · ${complexity}/8`} hint={complexityHint(complexity)}>
                  <ComplexitySlider value={complexity} onChange={setComplexity} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Toggle label="Builder brief" sub="Translation rules" on={true} />
                  <Toggle label="Guider brief" sub="Eccentric prompts" on={true} />
                </div>
                <button className="t-btn t-btn--primary" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                  Create game · get code →
                </button>
              </div>
            ) : (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Game code" hint="6 chars from your facilitator">
                  <CodeInput value="HEX-934" />
                </Field>
                <Field label="Display name" hint="must be unique in this game">
                  <input className="t-input" defaultValue="Sam · Design" />
                </Field>
                <div style={{ background: 'var(--tint-yellow)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 6, background: 'var(--t-yellow)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>i</div>
                  <div style={{ fontSize: 13, color: '#7a5b00', lineHeight: 1.45 }}>
                    Your facilitator chose <b>Players pick teams</b> — you'll choose your role on the next screen.
                  </div>
                </div>
                <button className="t-btn t-btn--primary" style={{ alignSelf: 'flex-start' }}>Join game →</button>
              </div>
            )}
          </div>
          <div style={{
            position: 'absolute', top: -22, right: -18,
            background: 'var(--t-yellow)', color: 'var(--ink)',
            padding: '10px 16px', borderRadius: 999,
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            transform: 'rotate(8deg)',
            boxShadow: '0 4px 0 rgba(0,0,0,.10), 0 6px 20px rgba(60,40,10,.12)',
            border: '1.5px solid var(--ink)',
          }}>no logins!</div>
        </div>
      </section>

      <section style={{ position: 'relative', marginTop: 56, padding: '36px 80px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {[
          { n: '01', label: 'Host', text: 'Create a game and share the code.', dot: 'red' },
          { n: '02', label: 'Pair up', text: 'Pick builder, guider, or observer.', dot: 'blue' },
          { n: '03', label: 'Build', text: 'Talk through it on your call.', dot: 'green' },
          { n: '04', label: 'Reflect', text: 'Trigger learnings, share briefs, debrief.', dot: 'purple' },
        ].map(s => (
          <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '18px 0', borderTop: `3px solid var(--t-${s.dot})` }}>
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.1em' }}>{s.n}</span>
            <span className="t-display" style={{ fontSize: 22, fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>{s.text}</span>
          </div>
        ))}
      </section>

      <style>{`
        .t-input{ width:100%; height:42px; padding:0 14px; border:1.5px solid var(--line);
          border-radius:12px; background:#fff; font:14px/1 var(--font-ui); color:var(--ink);
          outline:none; transition: border-color .12s; }
        .t-input:focus{ border-color: var(--ink); }
      `}</style>
    </div>
  );
}
window.ScreenLanding = ScreenLanding;
