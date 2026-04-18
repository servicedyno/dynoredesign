/**
 * Per-model migration — syncs models individually so FK-dependent
 * models can retry after their dependencies are created.
 */
import sequelize from "../utils/dbInstance";
import * as models from "../models";

const migrate = async () => {
  // Swallow unhandled rejections from sequelize's internal promise pool
  process.on("unhandledRejection", (reason: any) => {
    console.log(`   [unhandledRejection swallowed] ${reason?.message?.split("\n")[0] || reason}`);
  });

  try {
    await sequelize.authenticate();
    console.log("✅ DB connection established");

    // Collect all Sequelize model instances from the exports
    const modelList: Array<{ name: string; model: any }> = [];
    for (const [name, val] of Object.entries(models)) {
      if (val && typeof (val as any).sync === "function" && (val as any).tableName) {
        modelList.push({ name, model: val });
      }
    }
    console.log(`Found ${modelList.length} model instances`);

    // Multi-pass: keep trying models that failed
    let remaining = [...modelList];
    const succeeded = new Set<string>();
    const failedLast: Record<string, string> = {};

    for (let pass = 1; pass <= 6 && remaining.length > 0; pass++) {
      console.log(`\n--- Pass ${pass} (remaining: ${remaining.length}) ---`);
      const nextRemaining: typeof remaining = [];

      for (const { name, model } of remaining) {
        try {
          await model.sync({ alter: true });
          console.log(`  ✅ ${model.tableName}`);
          succeeded.add(name);
        } catch (err: any) {
          const msg = err?.message?.split("\n")[0] || String(err);
          failedLast[name] = msg;
          nextRemaining.push({ name, model });
        }
      }
      remaining = nextRemaining;
    }

    if (remaining.length > 0) {
      console.log(`\n❌ ${remaining.length} models still failing:`);
      for (const { name, model } of remaining) {
        console.log(`   - ${model.tableName}: ${failedLast[name]}`);
      }
    }

    const [result] = await sequelize.query(
      "SELECT COUNT(*) AS c FROM pg_tables WHERE schemaname='public'"
    );
    console.log(`\n✅ Tables in public schema: ${(result as any)[0].c}`);
    console.log(`   Succeeded: ${succeeded.size} / ${modelList.length}`);
    process.exit(remaining.length === 0 ? 0 : 1);
  } catch (error: any) {
    console.error("❌ Fatal:", error.message);
    process.exit(1);
  }
};

migrate();
