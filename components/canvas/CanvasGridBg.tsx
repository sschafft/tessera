/**
 * CanvasGridBg — the triangular tessellation background drawn under
 * canvases (builder, guider, observer, master). Renders as an absolutely
 * positioned SVG that fills its parent.
 */
export function CanvasGridBg() {
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.5,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="tri-grid"
          width="60"
          height="52"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0 L30 52 L60 0 M0 52 L30 0 L60 52"
            fill="none"
            stroke="rgba(60,40,10,.10)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tri-grid)" />
    </svg>
  );
}
