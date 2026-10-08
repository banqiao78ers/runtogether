import type { Metadata } from "next";
import { SharedRouteView } from "@/components/route-planner/SharedRouteView";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "分享路線",
    description: "板橋約跑 · 路跑路線地圖",
    openGraph: {
      title: "分享路線 · 板橋約跑",
      description: "查看跑友分享的路跑路線地圖",
      url: `/routes/share/${id}`,
    },
  };
}

export default async function SharedRoutePage({ params }: Props) {
  const { id } = await params;
  return (
    // 取消 layout 的 pb-16（分享頁隱藏 BottomNav）
    // z-40：蓋過 Keep-Alive 規劃地圖層（inactive 時仍可能佔位）
    <main className="relative z-40 -mb-16 flex h-[100dvh] flex-col bg-[#0f1f17]">
      <SharedRouteView routeId={id} />
    </main>
  );
}
