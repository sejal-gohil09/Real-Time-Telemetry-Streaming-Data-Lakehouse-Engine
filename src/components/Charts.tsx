import { useMemo } from 'react';

interface AreaChartProps {
  data: number[];
  color: string;
  height?: number;
  max?: number;
  min?: number;
  gradientId: string;
}

export function AreaChart({ data, color, height = 80, max, min = 0, gradientId }: AreaChartProps) {
  const width = 100;
  const resolvedMax = max ?? Math.max(...data, 1);
  const resolvedMin = min;

  const points = useMemo(() => {
    if (data.length < 2) return '';
    const step = width / (data.length - 1);
    return data
      .map((v, i) => {
        const x = i * step;
        const normalized = (v - resolvedMin) / (resolvedMax - resolvedMin || 1);
        const y = height - normalized * height * 0.85 - height * 0.075;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, resolvedMax, resolvedMin, height]);

  const areaPath = useMemo(() => {
    if (data.length < 2) return '';
    const step = width / (data.length - 1);
    const pts = data.map((v, i) => {
      const x = i * step;
      const normalized = (v - resolvedMin) / (resolvedMax - resolvedMin || 1);
      const y = height - normalized * height * 0.85 - height * 0.075;
      return `${x},${y}`;
    });
    return `M0,${height} L${pts.join(' L')} L${width},${height} Z`;
  }, [data, resolvedMax, resolvedMin, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: `${height}px` }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {points && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  max?: number;
}

export function BarChart({ data, height = 160, max }: BarChartProps) {
  const resolvedMax = max ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2" style={{ height: `${height}px` }}>
      {data.map((d, i) => {
        const h = (d.value / resolvedMax) * (height - 24);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
              {d.value.toFixed(0)}
            </div>
            <div
              className="w-full rounded-t transition-all duration-500 ease-out group-hover:opacity-80"
              style={{
                height: `${Math.max(h, 2)}px`,
                backgroundColor: d.color || '#3b82f6',
              }}
            />
            <div className="text-[10px] text-slate-500 font-mono truncate w-full text-center">
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
}

export function Gauge({ value, max, label, unit, color }: GaugeProps) {
  const pct = Math.min(value / max, 1);
  const angle = pct * 270 - 135;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (pct * 270 / 360) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            strokeDasharray={`${(270 / 360) * circumference} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white font-mono">
            {value < 100 ? value.toFixed(1) : value.toFixed(0)}
          </span>
          <span className="text-[10px] text-slate-400">{unit}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 mt-1">{label}</span>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
}

export function Sparkline({ data, color, height = 32 }: SparklineProps) {
  const width = 80;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const points = data.length < 2
    ? ''
    : data
        .map((v, i) => {
          const x = (i / (data.length - 1)) * width;
          const y = height - ((v - min) / (max - min || 1)) * height * 0.8 - height * 0.1;
          return `${x},${y}`;
        })
        .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height: `${height}px` }}>
      {points && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
