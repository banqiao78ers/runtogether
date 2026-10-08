import type { Metadata } from "next";
import { RoutePlanner } from "@/components/route-planner/RoutePlanner";

export const metadata: Metadata = {
  title: "路線規劃",
  description: "用地圖規劃路跑路線，計算距離並套用到開團",
};

export default function RoutePlanPage() {
  return (
    <main className="flex flex-1 flex-col">
      <RoutePlanner />
    </main>
  );
}
