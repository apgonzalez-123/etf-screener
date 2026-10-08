import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Bar } from "../lib/types";

interface Props {
  bars: Bar[];
  range: number; // sessions
  earnings?: number | null;
  onScrub: (bar: Bar | null) => void;
}

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function PriceChart({ bars, range, earnings, onScrub }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: css("--ink-2"), fontFamily: "Hanken Grotesk, system-ui" },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--line") } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { vertLine: { color: css("--gold"), labelBackgroundColor: css("--bg-2") }, horzLine: { color: css("--gold"), labelBackgroundColor: css("--bg-2") } },
      handleScale: false,
    });
    chart.current = c;
    const slice = bars.slice(-range);
    const up = css("--up");
    const down = css("--down");
    const price = c.addAreaSeries({
      lineColor: css("--gold"),
      topColor: "rgba(201,164,92,0.22)",
      bottomColor: "rgba(201,164,92,0)",
      lineWidth: 2,
      priceLineVisible: false,
    });
    price.setData(slice.map((b) => ({ time: b[0] as UTCTimestamp, value: b[4] })));
    const vol = c.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(
      slice.map((b, i) => ({
        time: b[0] as UTCTimestamp,
        value: b[5],
        color: (i > 0 && b[4] < slice[i - 1][4] ? down : up) + "66",
      })),
    );
    if (earnings) {
      const last = slice[slice.length - 1]?.[0];
      if (last && earnings > last) {
        price.setMarkers([{ time: last as UTCTimestamp, position: "aboveBar", color: css("--gold"), shape: "arrowDown", text: `Earnings ${new Date(earnings * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` }]);
      }
    }
    c.timeScale().fitContent();
    const byTime = new Map(slice.map((b) => [b[0], b]));
    c.subscribeCrosshairMove((p) => {
      if (!p.time) onScrub(null);
      else {
        const b = byTime.get(p.time as number);
        onScrub(b ?? null);
        if (b && "vibrate" in navigator && window.matchMedia("(pointer: coarse)").matches) navigator.vibrate?.(3);
      }
    });
    return () => {
      c.remove();
      chart.current = null;
    };
  }, [bars, range, earnings, onScrub]);

  return <div ref={box} className="chart-box" aria-label="Price chart. Hover to scrub." role="img" />;
}
