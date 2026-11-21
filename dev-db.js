// Runs a local MongoDB for development. Data is saved in .mongo-data
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdirSync } from "node:fs";

mkdirSync(".mongo-data", { recursive: true });
const repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger", dbName: "iftarshareDB" },
    instanceOpts: [{ port: 27017, dbPath: ".mongo-data", storageEngine: "wiredTiger" }],
});
console.log("Local MongoDB running at mongodb://127.0.0.1:27017/?directConnection=true");

const stop = async () => { await repl.stop({ doCleanup: false }); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
