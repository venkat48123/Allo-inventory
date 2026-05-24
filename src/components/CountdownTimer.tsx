// src/components/CountdownTimer.tsx
"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

export function CountdownTimer({ expiresAt, onExpired }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpired?.();
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          onExpired?.();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired, secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft < 60;

  if (secondsLeft <= 0) {
    return (
      <span className="font-mono font-bold text-red-600">Expired</span>
    );
  }

  return (
    <span
      className={`font-mono font-bold tabular-nums ${
        isUrgent ? "text-red-600 animate-pulse" : "text-amber-600"
      }`}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
