// src/mtheme.ts
import * as echarts from "echarts/core";

const palette = {
  black: "#090909",
  dark: "#262626",
  red: "#8E1616",
  redBright: "#D84040",
  gray: "#808080",
  white: "#FFFFFF",
};

// Use a unique theme name so it won't collide with your dashboard theme
export const modelThemeName = "mtl-dark-red-model";

const theme: echarts.EChartsCoreOption = {
  color: [palette.redBright, "#b0b0b0", "#6e6e6e", "#d0d0d0", "#3a3a3a"],
  backgroundColor: "transparent",
  textStyle: {
    color: palette.white,
    fontFamily:
      'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  title: {
    textStyle: { color: palette.white, fontWeight: 700 },
    subtextStyle: { color: palette.gray },
  },
  legend: {
    textStyle: { color: "#d8d8d8" },
    pageIconColor: palette.gray,
    inactiveColor: "#6e6e6e",
  },
  tooltip: {
    backgroundColor: "#111",
    borderColor: "#333",
    textStyle: { color: "#eee" },
  },
  axisPointer: { lineStyle: { color: palette.redBright } },
  grid: { top: 24, bottom: 24, left: 24, right: 24 },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#555" } },
    axisLabel: { color: "#d8d8d8" },
    axisTick: { show: false },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: "#bdbdbd" },
    splitLine: { lineStyle: { color: "#2f2f2f" } },
  },
  visualMap: { textStyle: { color: "#d8d8d8" } },
  heatmap: { itemStyle: { borderWidth: 0 } },
  bar: { itemStyle: { borderRadius: 2 } },
};

// Named export the model-only registrar the components expect
export function registerModelTheme() {
  // Safe if called multiple times; re-registering same name is fine
  echarts.registerTheme(modelThemeName, theme);
}

// Optional: let callers import the name as default if they want
export default modelThemeName;
