"use client";

import { setWorkerUrl } from "maplibre-gl";

let ready = false;

/** 在建立任何 Map 之前呼叫一次（Next.js 必須自架 worker） */
export function ensureMapLibreWorker() {
  if (ready || typeof window === "undefined") return;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  ready = true;
}
