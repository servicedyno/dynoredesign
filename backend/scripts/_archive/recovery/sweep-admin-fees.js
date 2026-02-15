/**
 * Trigger admin fee sweep for pending addresses
 * Run from /app/backend: node scripts/sweep-admin-fees.js
 */
require("dotenv").config({ path: "/app/backend/.env" });

async function main() {
  const { sweepPoolAddress } = require("../dist/services/merchantPool/merchantPoolSweep");
  
  // Addresses with pending admin fee sweeps
  const pendingSweeps = [
    { id: 159, type: "USDT-POLYGON", fee: "3.3279 USDT" },
    // USDT-TRC20 at TRisAcnVJpaQd46No53CcDxEZTPKCvCXbW also has pending sweep
  ];

  for (const sweep of pendingSweeps) {
    console.log(`\n=== Sweeping ${sweep.type} (address ${sweep.id}, fee: ${sweep.fee}) ===`);
    try {
      const result = await sweepPoolAddress(sweep.id);
      console.log(`Result:`, JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`Sweep failed for ${sweep.id}:`, err?.message || err);
    }
  }
}

main().catch(err => {
  console.error("Script failed:", err?.message || err);
  process.exit(1);
});
