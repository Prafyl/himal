import type { Metadata } from "next";
import MissionControl from "@/components/MissionControl";
import { LAKES } from "@/data/lakes";

export const metadata: Metadata = {
  title: "Mission Control · HIMAL",
};

type Props = { searchParams: Promise<{ lake?: string }> };

export default async function ControlPage({ searchParams }: Props) {
  const { lake } = await searchParams;
  return <MissionControl initialLake={LAKES.some((l) => l.id === lake) ? lake : undefined} />;
}
