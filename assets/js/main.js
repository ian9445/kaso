import { mountShell } from "./components/shell.js";
import { navigate, startRouter } from "./router.js";
import { hydrateProfile } from "./store.js";

hydrateProfile();
mountShell({ navigate });
startRouter();
