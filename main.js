import dotenv from "dotenv";
import { loadPlugins, plugins } from "./plugins/index.js";
import { restoreAllSessions } from "./session.js";

dotenv.config();

const start = async () => {
  await loadPlugins();
  console.log(`Plugin dimuat: ${Object.keys(plugins).length}`);


  await restoreAllSessions();
};

start();
