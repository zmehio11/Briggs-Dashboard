interface Props {
  label: string;
  value: number | null; // percentage, e.g. 32.4
  target: number; // target ceiling percentage
}

const CX = 90;
const CY = 95;
const R = 68;
const MAX = 80; // dial reads 0%-80%

/** angleDeg sweeps -90 (left) to +90 (right) through the bottom of the arc */
function pointOnArc(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

function arcPath(fromDeg: number, toDeg: number, radius: number) {
  const start = pointOnArc(fromDeg, radius);
  const end = pointOnArc(toDeg, radius);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * A dial styled after a kitchen thermometer rather than a generic donut
 * chart -- the needle sweeps a 180-degree arc from 0% to a fixed max, with
 * a dashed target line marking the operator's ceiling for this metric.
 */
export function PrimeCostDial({ label, value, target }: Props) {
  const clamped = value == null ? 0 : Math.min(Math.max(value, 0), MAX);
  const angle = -90 + (clamped / MAX) * 180;
  const targetAngle = -90 + (Math.min(target, MAX) / MAX) * 180;
  const isOver = value != null && value > target;

  const needleTip = pointOnArc(angle, R - 6);
  const targetInner = pointOnArc(targetAngle, R - 16);
  const targetOuter = pointOnArc(targetAngle, R + 6);

  return (
    <div className="dial-card">
      <svg viewBox="0 0 180 110" className="dial-svg">
        <path d={arcPath(-90, 90, R)} fill="none" stroke="var(--hairline)" strokeWidth="10" strokeLinecap="round" />
        <path
          d={arcPath(-90, angle, R)}
          fill="none"
          stroke={isOver ? "var(--clay)" : "var(--brass)"}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line
          x1={targetInner.x}
          y1={targetInner.y}
          x2={targetOuter.x}
          y2={targetOuter.y}
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeDasharray="2 3"
        />
        <line x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y} stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="4" fill="var(--text)" />
      </svg>
      <div className="dial-value" style={{ color: isOver ? "var(--clay)" : "var(--brass)" }}>
        {value == null ? "\u2014" : `${value.toFixed(1)}%`}
      </div>
      <div className="dial-label">{label}</div>
      <div className="dial-target">target &le; {target}%</div>
    </div>
  );
}
