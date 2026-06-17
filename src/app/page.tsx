import { fetchTarkovContext } from "@/actions/tarkov-context";
import { fetchSupplyItems } from "@/actions/tarkov-supply";
import { ActiveContextBar } from "@/components/features/home/ActiveContextBar";
import { SupplyGrid } from "@/components/features/home/SupplyGrid";
import { TacticalCartography } from "@/components/features/home/TacticalCartography";
import { HomeClient } from "@/components/features/home/HomeClient";

export default async function HomePage() {
  const [contextData, supplyItems] = await Promise.all([
    fetchTarkovContext(),
    fetchSupplyItems(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <ActiveContextBar data={contextData} />
      <HomeClient
        supplySection={<SupplyGrid items={supplyItems} />}
        tacticalSection={<TacticalCartography />}
      />
    </div>
  );
}
