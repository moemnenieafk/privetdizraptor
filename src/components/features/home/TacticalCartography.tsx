import { fetchCartographyData } from "@/actions/tarkov-cartography";
import { TacticalCartographyClient } from "./TacticalCartographyClient";

export async function TacticalCartography() {
  const data = await fetchCartographyData();
  return <TacticalCartographyClient tasks={data.tasks} maps={data.maps} />;
}
