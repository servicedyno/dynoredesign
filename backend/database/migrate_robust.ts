/**
 * Robust migration script — runs sequelize.sync() in multiple passes
 * to resolve circular/forward FK dependencies (e.g., tbl_customer_transaction
 * references tbl_company which may not exist yet on pass 1).
 */
import sequelize from "../utils/dbInstance";
import * as models from "../models";

const MAX_PASSES = 5;

const migrate = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connection established");
    console.log(`Registered models: ${Object.keys(models).length}`);

    let lastError: Error | null = null;
    let success = false;

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      console.log(`\n--- Pass ${pass}/${MAX_PASSES} ---`);
      try {
        await sequelize.sync({ alter: true });
        console.log(`✅ Pass ${pass}: all models synced`);
        success = true;
        break;
      } catch (err: any) {
        lastError = err;
        console.log(`⚠️  Pass ${pass} failed: ${err.message?.split("\n")[0]}`);
        console.log("   Retrying (FK deps may resolve in next pass)...");
      }
    }

    if (!success) {
      console.error("\n❌ Migration failed after all passes");
      if (lastError) console.error(lastError.message);
      process.exit(1);
    }

    // Show table count
    const [result] = await sequelize.query(
      "SELECT COUNT(*) AS c FROM pg_tables WHERE schemaname='public'"
    );
    console.log(`\n✅ Migration completed. Tables in public schema: ${(result as any)[0].c}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration fatal error:", error);
    process.exit(1);
  }
};

migrate();
