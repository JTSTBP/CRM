require("dotenv").config();
const mongoose = require("mongoose");
const CallActivity = require("../models/CallActivity");
const models = require("../models/BDMonitoring");
const { syncLegacyCall } = require("../services/bdMonitoringService");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  const fromArgument = process.argv.find((value) =>
    value.startsWith("--from="),
  );
  const from = fromArgument ? new Date(fromArgument.slice(7)) : null;
  if (from && !Number.isFinite(+from))
    throw new Error("Use --from=YYYY-MM-DD.");
  await mongoose.connect(process.env.MONGO_URI);
  const query = {
    bdRecorded: { $ne: true },
    ...(from ? { timestamp: { $gte: from } } : {}),
  };
  const count = await CallActivity.countDocuments(query);
  console.log(
    `${count} existing call records are eligible for monitoring import.`,
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run complete. Add --apply to create indexes and import actual recorded calls.",
    );
    return;
  }
  await Promise.all(Object.values(models).map((model) => model.init()));
  let imported = 0;
  for await (const call of CallActivity.find(query)
    .sort({ timestamp: 1 })
    .lean()
    .cursor()) {
    await syncLegacyCall(call);
    imported += 1;
    if (imported % 100 === 0) console.log(`Imported ${imported} calls.`);
  }
  console.log(`Imported ${imported} calls. Source records were preserved.`);
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
