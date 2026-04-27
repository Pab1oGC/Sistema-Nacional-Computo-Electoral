import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText, TSpan } from 'react-native-svg';

interface Props {
  size?: number;
  opacity?: number;
}

export function BoliviaSeal({ size = 120, opacity = 0.07 }: Props) {
  const s = size;
  const c = s / 2;
  const r = s / 2 - 2;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} opacity={opacity}>
      {/* Outer ring */}
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#F4C430" strokeWidth={s * 0.025} />
      <Circle cx={c} cy={c} r={r * 0.88} fill="none" stroke="#F4C430" strokeWidth={s * 0.01} />

      {/* Mountain */}
      <Path
        d={`M${c * 0.55} ${c * 1.2} L${c} ${c * 0.55} L${c * 1.45} ${c * 1.2} Z`}
        fill="#4A7C6F"
        stroke="#F4C430"
        strokeWidth={s * 0.008}
      />
      {/* Snow cap */}
      <Path
        d={`M${c * 0.82} ${c * 0.78} L${c} ${c * 0.55} L${c * 1.18} ${c * 0.78} Z`}
        fill="#FFFFFF"
      />

      {/* Sun */}
      <Circle cx={c} cy={c * 0.72} r={s * 0.07} fill="#F4C430" />

      {/* Condor wings (simplified) */}
      <Path
        d={`M${c * 0.3} ${c * 0.9} Q${c * 0.5} ${c * 0.7} ${c} ${c * 0.85} Q${c * 1.5} ${c * 0.7} ${c * 1.7} ${c * 0.9}`}
        fill="none"
        stroke="#C8102E"
        strokeWidth={s * 0.018}
        strokeLinecap="round"
      />

      {/* Bottom text arc placeholder */}
      <SvgText
        fill="#F4C430"
        fontSize={s * 0.075}
        fontWeight="bold"
        textAnchor="middle"
        x={c}
        y={c * 1.72}
        letterSpacing={s * 0.01}
      >
        BOLIVIA
      </SvgText>
    </Svg>
  );
}
