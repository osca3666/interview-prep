"use client";

import { useEffect, useRef, useState } from "react";

export function useResponsiveChartSize({
  defaultWidth = 760,
  desktopHeight,
  mobileHeight,
}: {
  defaultWidth?: number;
  desktopHeight: number;
  mobileHeight: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    width: defaultWidth,
    height: desktopHeight,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resize = () => {
      const width = Math.max(320, Math.round(element.getBoundingClientRect().width));
      setSize({
        width,
        height: width < 640 ? mobileHeight : desktopHeight,
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [desktopHeight, mobileHeight]);

  return { containerRef, size };
}
