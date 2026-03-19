"use client";

import { useSyncExternalStore } from "react";
import { formatLocalDate } from "@/lib/date";

const emptySubscribe = () => () => {};

export function useLocalDate() {
  return useSyncExternalStore(
    emptySubscribe,
    () => formatLocalDate(),
    () => "",
  );
}
