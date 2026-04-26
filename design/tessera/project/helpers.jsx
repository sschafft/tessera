// helpers.jsx — shared UI bits across screens

function Wordmark({ size = 22 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size + 10, height: size + 10 }}>
        <Tile kind="hex"    color="yellow" x={0} y={2} size={size + 6} />
        <Tile kind="tri-up" color="red"    x={4} y={-2} size={size - 4} />
      </div>
      <span className="t-display" style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em' }}>tessera</span>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '.02em', textTransform: 'uppercase' }}>
          {label} {required && <span style={{ color: 'var(--t-red)' }}>*</span>}
        </span>
        {hint && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--paper-2)', borderRadius: 'var(--r-md)', padding: 4, gap: 2 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange && onChange(o)}
          style={{
            flex: 1, padding: '10px 12px', border: 'none', cursor: 'pointer',
            background: value === o ? '#fff' : 'transparent',
            borderRadius: 'calc(var(--r-md) - 4px)',
            fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
            color: value === o ? 'var(--ink)' : 'var(--ink-3)',
            boxShadow: value === o ? '0 1px 3px rgba(0,0,0,.10)' : 'none',
          }}>{o}</button>
      ))}
    </div>
  );
}

function ComplexitySlider({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[1,2,3,4,5,6,7,8].map(i => (
        <button key={i} onClick={() => onChange(i)}
          style={{
            flex: 1, height: 36, border: 'none', cursor: 'pointer',
            borderRadius: 8,
            background: i <= value
              ? `color-mix(in oklab, var(--t-${i<=2?'green':i<=4?'yellow':i<=6?'orange':'red'}) 90%, white)`
              : 'var(--paper-2)',
            color: i <= value ? '#fff' : 'var(--ink-3)',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          }}>{i}</button>
      ))}
    </div>
  );
}

function complexityHint(v) {
  return ['', 'icebreaker', 'icebreaker', 'casual', 'casual', 'workshop', 'workshop', 'difficult', 'punishing'][v];
}

function Toggle({ label, sub, on, onChange }) {
  return (
    <button onClick={() => onChange && onChange(!on)}
      style={{
        textAlign: 'left', padding: 14, border: '1.5px solid', cursor: 'pointer',
        borderColor: on ? 'var(--ink)' : 'var(--line)',
        background: on ? '#fff' : 'var(--paper-2)',
        borderRadius: 'var(--r-md)',
        display: 'flex', flexDirection: 'column', gap: 4,
        position: 'relative',
      }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sub}</span>
      <span style={{
        position: 'absolute', top: 12, right: 12,
        width: 18, height: 18, borderRadius: 5,
        background: on ? 'var(--t-green)' : 'transparent',
        border: '1.5px solid', borderColor: on ? 'var(--t-green)' : 'var(--line-2)',
        display: 'grid', placeItems: 'center',
        color: '#fff', fontSize: 12, fontWeight: 700,
      }}>{on ? '✓' : ''}</span>
    </button>
  );
}

function CodeInput({ value }) {
  const chars = value.split('');
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {chars.map((c, i) => (
        <div key={i} style={{
          width: 44, height: 52, borderRadius: 10,
          border: c === '-' ? 'none' : '1.5px solid var(--ink)',
          background: c === '-' ? 'transparent' : '#fff',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
        }}>{c === '-' ? '–' : c}</div>
      ))}
    </div>
  );
}

function Bullet({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: 99, background: `var(--t-${color})` }} />
      {label}
    </span>
  );
}

function Avatar({ name, color = 'blue', size = 32, ring }) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `var(--t-${color})`, color: '#fff',
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size * 0.45,
      boxShadow: ring ? `0 0 0 3px ${ring}` : 'none',
      flexShrink: 0,
    }}>{initial}</div>
  );
}

function RoleChip({ role, color }) {
  const c = color || ({ Builder: 'orange', Guider: 'blue', Observer: 'purple', 'Game master': 'red' }[role]);
  return (
    <span className="t-chip" style={{ background: `var(--tint-${c})`, color: `var(--t-${c})`, filter: 'brightness(.7)' }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--t-${c})` }} />
      {role}
    </span>
  );
}

function StatusDot({ color = 'green' }) {
  return <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--t-${color})`, display: 'inline-block', boxShadow: '0 0 0 2px #fff' }} />;
}

Object.assign(window, { Wordmark, Field, Segmented, ComplexitySlider, complexityHint, Toggle, CodeInput, Bullet, Avatar, RoleChip, StatusDot });
