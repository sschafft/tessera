// shapes.jsx — Tessera shape primitives.
// Pure SVG primitives for the polygon-tessellation canvas.
// Mixed polygons: triangle ▲▽, square ◼, hexagon ⬡, parallelogram ▰, trapezoid.
// Colors come from CSS vars on root.

const PALETTE = {
  red:    'var(--t-red)',
  orange: 'var(--t-orange)',
  yellow: 'var(--t-yellow)',
  green:  'var(--t-green)',
  blue:   'var(--t-blue)',
  purple: 'var(--t-purple)',
  pink:   'var(--t-pink)',
  teal:   'var(--t-teal)',
};

// Tile factory — returns an absolutely-positioned SVG.
// `kind` ∈ tri-up | tri-dn | sq | hex | rhomb | trap
function Tile({ kind, color = 'blue', x, y, size = 56, rotate = 0, ghost = false, prototype = false, correct = null, style }) {
  const fill = ghost ? 'rgba(0,0,0,.06)' : (prototype ? `color-mix(in oklab, ${PALETTE[color]} 35%, #d8d2c4)` : PALETTE[color]);
  const stroke = ghost ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.20)';
  const dash = ghost ? '4 3' : (prototype ? '3 4' : null);

  const W = size;
  const H = size;
  let path = '';
  // unit shapes drawn in viewBox 0 0 100 100
  switch (kind) {
    case 'tri-up':   path = 'M50 6 L94 88 L6 88 Z'; break;
    case 'tri-dn':   path = 'M6 12 L94 12 L50 94 Z'; break;
    case 'sq':       path = 'M8 8 H92 V92 H8 Z'; break;
    case 'rhomb':    path = 'M30 8 H92 L70 92 H8 Z'; break;
    case 'trap':     path = 'M22 14 H78 L94 86 H6 Z'; break;
    case 'hex':      path = 'M50 4 L92 28 L92 72 L50 96 L8 72 L8 28 Z'; break;
    case 'pent':     path = 'M50 6 L94 38 L78 90 L22 90 L6 38 Z'; break;
    default:         path = 'M8 8 H92 V92 H8 Z';
  }

  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: W, height: H,
      transform: `rotate(${rotate}deg)`, transformOrigin: 'center',
      filter: ghost ? 'none' : 'drop-shadow(0 2px 0 rgba(0,0,0,.10))',
      ...style
    }}>
      <svg viewBox="0 0 100 100" width={W} height={H} style={{ overflow: 'visible' }}>
        <path d={path} fill={fill} stroke={stroke} strokeWidth={ghost ? 1.5 : 2.5}
          strokeLinejoin="round" strokeDasharray={dash || undefined} />
        {correct === true && (
          <circle cx="80" cy="20" r="9" fill="#46b86a" stroke="#fff" strokeWidth="2.5" />
        )}
        {correct === false && (
          <circle cx="80" cy="20" r="9" fill="#ee3a3a" stroke="#fff" strokeWidth="2.5" />
        )}
      </svg>
    </div>
  );
}

// Pattern presets — collections of tiles ready to drop into a canvas.
// Each is a function (x,y,scale) => array of <Tile/> props.
const PATTERNS = {
  // Simple flag of three colors
  flag: (cx = 0, cy = 0, s = 1) => [
    { kind: 'sq', color: 'red',    x: cx +   0*s, y: cy +  0*s, size: 60*s },
    { kind: 'sq', color: 'yellow', x: cx +  60*s, y: cy +  0*s, size: 60*s },
    { kind: 'sq', color: 'blue',   x: cx + 120*s, y: cy +  0*s, size: 60*s },
  ],

  // Mixed-poly star pattern (target for the main mockups)
  star: (cx = 0, cy = 0, s = 1) => [
    // hex center
    { kind: 'hex',    color: 'yellow', x: cx + 80*s,  y: cy + 80*s,  size: 80*s },
    // four triangles forming points
    { kind: 'tri-up', color: 'red',    x: cx + 80*s,  y: cy + 8*s,   size: 80*s },
    { kind: 'tri-dn', color: 'red',    x: cx + 80*s,  y: cy + 156*s, size: 80*s },
    { kind: 'tri-up', color: 'blue',   x: cx + 8*s,   y: cy + 80*s,  size: 80*s, rotate: -90 },
    { kind: 'tri-dn', color: 'blue',   x: cx + 156*s, y: cy + 80*s,  size: 80*s, rotate: -90 },
    // corner squares
    { kind: 'sq',     color: 'green',  x: cx + 16*s,  y: cy + 16*s,  size: 50*s },
    { kind: 'sq',     color: 'green',  x: cx + 168*s, y: cy + 16*s,  size: 50*s },
    { kind: 'sq',     color: 'purple', x: cx + 16*s,  y: cy + 168*s, size: 50*s },
    { kind: 'sq',     color: 'purple', x: cx + 168*s, y: cy + 168*s, size: 50*s },
  ],

  // Honeycomb fragment
  honeycomb: (cx = 0, cy = 0, s = 1) => {
    const tiles = [];
    const r = 40 * s;        // hex 'radius'
    const w = r * 2;
    const h = w * 0.866;
    const colors = ['red', 'yellow', 'blue', 'green', 'orange', 'purple', 'teal'];
    let i = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = cx + col * w * 0.75;
        const y = cy + row * h + (col % 2 ? h / 2 : 0);
        tiles.push({ kind: 'hex', color: colors[i % colors.length], x, y, size: w });
        i++;
      }
    }
    return tiles;
  },
};

// Render an array of tile-prop objects.
function PatternRender({ tiles, prototype = false, ghost = false, correctIndices = null }) {
  return (
    <>
      {tiles.map((t, i) => (
        <Tile key={i} {...t}
          ghost={ghost}
          prototype={prototype}
          correct={correctIndices ? correctIndices[i] : null}
        />
      ))}
    </>
  );
}

Object.assign(window, { Tile, PALETTE, PATTERNS, PatternRender });
