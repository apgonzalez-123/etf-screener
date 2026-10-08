interface Props {
  data: number[] | null | undefined;
  width?: number;
  height?: number;
}

export function Spark({ data, width = 80, height = 22 }: Props) {
  if (!data || data.length < 2) return <span className="muted">—</span>;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = hi - lo || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`);
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`30-day trend ${up ? "up" : "down"}`}>
      <polyline points={pts.join(" ")} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
