"use client";

import { useState, useEffect } from "react";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function useCountdown(target: Date | null): Countdown {
  const calc = (): Countdown => {
    if (!target)
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const diff = target.getTime() - Date.now();
    if (diff <= 0)
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const totalSeconds = Math.floor(diff / 1000);
    return {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
      expired: false,
    };
  };

  const [state, setState] = useState<Countdown>(calc);

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setState(calc()), 1000);
    return () => clearInterval(id);
  }, [target]);

  return state;
}
