import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);

export default function EChart({ option, className, ariaLabel }) {
  const elementRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current) return undefined;

    const chart = echarts.init(elementRef.current, null, { renderer: "svg" });
    chartRef.current = chart;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => chart.resize());
    });
    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(
      {
        ...option,
        tooltip: option.tooltip
          ? { ...option.tooltip, confine: true }
          : option.tooltip,
      },
      { notMerge: true },
    );
  }, [option]);

  return (
    <div
      ref={elementRef}
      className={className}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
