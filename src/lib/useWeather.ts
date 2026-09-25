"use client";

import { useEffect, useState } from "react";
import { LAKES } from "@/data/lakes";
import { fetchWeather, type LakeWeather } from "./weather";

const REFRESH_MS = 10 * 60 * 1000;

export function useWeather() {
  const [data, setData] = useState<Record<string, LakeWeather>>({});
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchWeather(LAKES)
        .then((d) => {
          if (!alive) return;
          setData(d);
          setError(false);
          setTick((t) => t + 1);
        })
        .catch(() => alive && setError(true));
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return { data, error, tick };
}
