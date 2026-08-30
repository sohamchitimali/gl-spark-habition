import React from 'react';

interface ConsistencyRingsProps {
  weekly: number;
  monthly: number;
  yearly: number;
  /** Size of the rings SVG in px. Default: 130 */
  size?: number;
  /** Title shown above the component */
  title?: string;
}

/**
 * ConsistencyRings — Apple Activity-Rings style component.
 *
 * Layout: rings on the LEFT, vertical legend stack on the RIGHT.
 *
 * Ring order (outermost → innermost):
 *   Outer  — Yearly  (blue)   #4F9CF9
 *   Middle — Monthly (purple) #A78BFA
 *   Inner  — Weekly  (green)  #34C789
 *
 * Each arc fills clockwise from 12 o'clock.
 * The legend shows label + bold coloured percentage, one per row.
 */
const ConsistencyRings: React.FC<ConsistencyRingsProps> = ({
  weekly,
  monthly,
  yearly,
  size = 130,
}) => {
  const rings = [
    { label: 'Year', percentage: Math.min(100, Math.max(0, yearly)), color: '#4F9CF9' },
    { label: 'Month', percentage: Math.min(100, Math.max(0, monthly)), color: '#A78BFA' },
    { label: 'Week', percentage: Math.min(100, Math.max(0, weekly)), color: '#34C789' },
  ];

  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.088;     // ring thickness
  const gap = strokeWidth * 1.3; // gap between rings

  const radii = [
    cx - strokeWidth / 2,
    cx - strokeWidth / 2 - gap,
    cx - strokeWidth / 2 - gap * 2,
  ];

  /** Build SVG arc path clockwise from 12 o'clock */
  const arcPath = (radius: number, pct: number): string => {
    if (pct <= 0) return '';
    if (pct >= 100) {
      return [
        `M ${cx} ${cy - radius}`,
        `A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`,
        `A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}`,
      ].join(' ');
    }
    const angle = (pct / 100) * 360;
    const rad = (angle - 90) * (Math.PI / 180);
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%' }}>
      {/* ── Rings SVG ── */}
      <svg
        width="100%"
        height="auto"
        style={{ maxWidth: '100%', maxHeight: '280px', flexShrink: 1, overflow: 'visible' }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {rings.map((ring, i) => {
          const r = radii[i];
          return (
            <g key={ring.label}>
              <title>{ring.label}: {Math.round(ring.percentage)}%</title>
              {/* Track */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                opacity={0.15}
              />
              {/* Filled arc */}
              {ring.percentage > 0 && (
                <path
                  d={arcPath(r, ring.percentage)}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 ${strokeWidth * 0.55}px ${ring.color}99)`,
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Legend (below) ── */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 24, width: '100%' }}>
        {rings.map((ring) => (
          <div key={ring.label} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: ring.color,
                boxShadow: `0 0 5px ${ring.color}`,
                flexShrink: 0,
              }}
            />
            {/* Label */}
            <span style={{ color: '#B4B2A9', fontSize: 10, fontWeight: 500 }}>
              {ring.label}
            </span>
            {/* Percentage */}
            <span
              style={{
                color: ring.color,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '-0.2px',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                marginLeft: 2,
              }}
            >
              {Math.round(ring.percentage)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsistencyRings;

/**
 * Utility — derive weekly / monthly / yearly ring percentages from a
 * Map<dateString, completionPercentage> heatmap (the same shape used by HeatmapView).
 *
 * Averages the completion percentages of the last 7 / 30 / 365 days.
 * Days with no entry in the map count as 0 (not yet done or not tracked).
 */
export function computeRingsFromHeatmap(
  heatmap: Map<string, number>
): { weekly: number; monthly: number; yearly: number } {
  const today = new Date();

  const avgOverDays = (days: number): number => {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      sum += heatmap.get(key) ?? 0;
    }
    return sum / days;
  };

  return {
    weekly: avgOverDays(7),
    monthly: avgOverDays(30),
    yearly: avgOverDays(365),
  };
}
