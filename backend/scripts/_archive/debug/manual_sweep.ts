// Manually trigger the sweep via the backend API
// This script calls the internal sweep functions directly

import * as merchantPoolService from "../services/merchantPoolService";
import { connectRedis } from "../utils/redisInstance";
import sequelize from "../utils/dbInstance";

async function main() {
  console.log("Initializing...");
  
  // Connect to Redis (required by some services)
  await connectRedis();
  
  // Wait for DB sync
  await sequelize.authenticate();
  console.log("Database connected");
  
  console.log("\n=== Manually triggering performScheduledSweeps ===");
  
  try {
    await merchantPoolService.performScheduledSweeps();
    console.log("\nSweep completed!");
  } catch (error) {
    console.error("Sweep failed:", error);
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
