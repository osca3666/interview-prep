"use client";

import { useEffect, useState } from "react";

export function TimeZoneHiddenField() {
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
      } catch {
        setTimeZone("");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return <input type="hidden" name="time_zone" value={timeZone} />;
}
