import { useId } from 'react';

export default function LtHexLogo({ size = 36 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 40 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`hex-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <polygon
        points="20,3 36.4,12.5 36.4,31.5 20,41 3.6,31.5 3.6,12.5"
        fill={`url(#hex-${uid})`}
        stroke="#06b6d4"
        strokeWidth="0.5"
      />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fill="white"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="800"
        letterSpacing="0.5"
      >
        LT
      </text>
    </svg>
  );
}
