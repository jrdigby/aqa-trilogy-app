import { startAuthShell } from "./appAuthShell.js";

startAuthShell(() => import("./app.js"));
