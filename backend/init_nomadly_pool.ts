/**
 * One-off script to initialize merchant pool for nomadly@moxx.co (user_id=4)
 * Creates xpub HD wallets + temp pool addresses for each crypto currency
 */
import dotenv from "dotenv";
dotenv.config();

import { initializeMerchantPool } from "./services/merchantPoolService";

const USER_ID = 4; // nomadly@moxx.co
const CURRENCIES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'USDT-TRC20', 'USDT-ERC20'];

async function main() {
  console.log(`\n🚀 Initializing merchant pool for user_id=${USER_ID} (nomadly@moxx.co)`);
  console.log(`   Currencies: ${CURRENCIES.join(', ')}\n`);

  const results: { currency: string; status: string; error?: string }[] = [];

  for (const currency of CURRENCIES) {
    try {
      console.log(`⏳ Initializing ${currency}...`);
      await initializeMerchantPool(USER_ID, currency);
      console.log(`✅ ${currency} pool initialized\n`);
      results.push({ currency, status: 'SUCCESS' });
    } catch (error: any) {
      console.error(`❌ ${currency} failed: ${error.message}\n`);
      results.push({ currency, status: 'FAILED', error: error.message });
    }
  }

  console.log('\n========== SUMMARY ==========');
  for (const r of results) {
    const icon = r.status === 'SUCCESS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.currency}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
  }

  const success = results.filter(r => r.status === 'SUCCESS').length;
  console.log(`\n  ${success}/${CURRENCIES.length} currencies initialized`);
  
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
