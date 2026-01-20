import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function Chart() {
  const ref = useRef();

  useEffect(() => {
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: ref.current.clientHeight
    });

    chart.addCandlestickSeries();
    return () => chart.remove();
  }, []);

  return <div ref={ref} style={{ width: "60%" }} />;
}
