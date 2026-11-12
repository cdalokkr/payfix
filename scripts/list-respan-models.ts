import dotenv from "dotenv";
dotenv.config();
import { getRespanGatewayClient } from "../lib/services/respan-gateway.service";

async function main() {
  const client = getRespanGatewayClient();
  try {
    const list = await client.models.list();
    const free = list.data
      .map((m) => m.id)
      .filter((id) => id.includes("free"));
    console.log(`Found ${list.data.length} total models, ${free.length} marked free:`);
    console.log(free.slice(0, 20));
  } catch (err: any) {
    console.error("Error listing models:", err?.message || err);
  }
}

main();
