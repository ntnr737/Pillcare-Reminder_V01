import React from "react";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import { View, StyleSheet, Text } from "react-native";
import { theme } from "@/src/lib/theme";

type Bar = { label: string; value: number };

export function SimpleBarChart({
  data,
  height = 180,
  max = 100,
  unit = "%",
  testID,
}: {
  data: Bar[];
  height?: number;
  max?: number;
  unit?: string;
  testID?: string;
}) {
  const width = Math.max(280, data.length * 44);
  const padding = { top: 16, right: 16, bottom: 28, left: 16 };
  const chartH = height - padding.top - padding.bottom;
  const chartW = width - padding.left - padding.right;
  const barW = data.length ? (chartW / data.length) * 0.55 : 0;
  const gap = data.length ? (chartW / data.length) * 0.45 : 0;

  return (
    <View testID={testID} style={styles.wrap}>
      <Svg width={width} height={height}>
        <Line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={padding.left + chartW}
          y2={padding.top + chartH}
          stroke={theme.colors.borderSubtle}
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const h = max > 0 ? (d.value / max) * chartH : 0;
          const x = padding.left + i * (barW + gap) + gap / 2;
          const y = padding.top + chartH - h;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={Math.max(2, h)} rx={4} fill={theme.colors.brand} />
              <SvgText x={x + barW / 2} y={padding.top + chartH + 16} fontSize={10} fill={theme.colors.textSecondary} textAnchor="middle">
                {d.label}
              </SvgText>
              <SvgText x={x + barW / 2} y={y - 4} fontSize={10} fill={theme.colors.textPrimary} textAnchor="middle">
                {d.value > 0 ? `${d.value}${unit}` : ""}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function SimpleLineChart({ values, labels, height = 180, testID }: { values: number[]; labels: string[]; height?: number; testID?: string }) {
  const width = Math.max(280, labels.length * 44);
  const padding = { top: 16, right: 16, bottom: 28, left: 16 };
  const chartH = height - padding.top - padding.bottom;
  const chartW = width - padding.left - padding.right;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = padding.left + (i / Math.max(1, values.length - 1)) * chartW;
    const y = padding.top + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <View testID={testID} style={styles.wrap}>
      <Svg width={width} height={height}>
        <Line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={padding.left + chartW}
          y2={padding.top + chartH}
          stroke={theme.colors.borderSubtle}
          strokeWidth={1}
        />
        <SvgPath d={path} />
        {points.map((p, i) => (
          <Rect key={i} x={p.x - 3} y={p.y - 3} width={6} height={6} rx={3} fill={theme.colors.secondary} />
        ))}
        {labels.map((l, i) => (
          <SvgText key={i} x={padding.left + (i / Math.max(1, labels.length - 1)) * chartW} y={padding.top + chartH + 16} fontSize={10} fill={theme.colors.textSecondary} textAnchor="middle">
            {l}
          </SvgText>
        ))}
        {values.length > 0 && (
          <SvgText x={padding.left} y={padding.top + 4} fontSize={10} fill={theme.colors.textSecondary}>
            max {Math.round(max)}
          </SvgText>
        )}
      </Svg>
      {values.length === 0 && <Text style={styles.empty}>No data yet</Text>}
    </View>
  );
}

function SvgPath({ d }: { d: string }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Path } = require("react-native-svg");
  return <Path d={d} stroke={theme.colors.secondary} strokeWidth={2} fill="none" />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-start" },
  empty: { color: theme.colors.textSecondary, padding: 12 },
});
