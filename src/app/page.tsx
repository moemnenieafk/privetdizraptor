import { fetchSupplyItems } from "@/actions/tarkov-supply";
import { SupplyGrid } from "@/components/features/home/SupplyGrid";
import { TacticalCartography } from "@/components/features/home/TacticalCartography";
import { HomeClient } from "@/components/features/home/HomeClient";

export default async function HomePage() {
  const supplyItems = await fetchSupplyItems();

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <HomeClient
        supplySection={<SupplyGrid items={supplyItems} />}
        tacticalSection={<TacticalCartography />}
      />
    </div>
  );
}
