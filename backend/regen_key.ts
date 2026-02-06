import dotenv from "dotenv";
dotenv.config();

import { encrypt } from "./helper/encryption";
import sequelize from "./utils/dbInstance";
import { QueryTypes } from "sequelize";

async function main() {
  const API_SECRET = process.env.API_SECRET;
  
  // Build keyData with USD
  const keyData = {
    base_currency: "USD",
    company_id: 3,
    adm_id: 4,
    regenerated_at: new Date().toISOString(),
  };

  const keyString = "dpk_live_DYNOPAY_USER_API-" + JSON.stringify(keyData);
  const newApiKey = encrypt(keyString, API_SECRET);

  console.log("New keyData:", JSON.stringify(keyData));
  console.log("New encrypted API key:", newApiKey);

  // Update in DB
  await sequelize.query(
    `UPDATE tbl_api SET "apiKey" = $1 WHERE api_id = 26 AND company_id = 3`,
    { bind: [newApiKey], type: QueryTypes.UPDATE }
  );

  console.log("\n✅ API key regenerated with base_currency=USD for api_id=26");
  console.log("\nNew DYNOPAY_API_KEY:");
  console.log(newApiKey);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
