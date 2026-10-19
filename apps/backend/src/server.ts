import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { MongooseIncidentRepository, MongooseUserRepository, connectMongo } from "./repositories/mongoose.js";

const config = loadConfig();
let ready = false;
const repositories = config.mongodbUri ? { users: new MongooseUserRepository(), incidents: new MongooseIncidentRepository() } : undefined;
const server = createServer(createApp(config, () => ready, repositories));

void (async () => { if (config.mongodbUri) await connectMongo(config.mongodbUri); server.listen(config.port, () => { ready = true; process.stdout.write(`Civiclens backend listening on ${config.port}\n`); }); })().catch(() => { process.stderr.write("Failed to connect to MongoDB\n"); process.exitCode = 1; });

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  process.stdout.write(`Received ${signal}; shutting down\n`);
  server.close((error) => {
    if (error) {
      process.stderr.write("Failed to close server cleanly\n");
      process.exitCode = 1;
    }
    process.exit();
  });
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
