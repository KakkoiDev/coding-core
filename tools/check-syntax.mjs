import { execFileSync } from "node:child_process";
execFileSync(process.execPath, ["--check", "js/recipes.mjs"], {
  stdio: "inherit",
});
execFileSync(process.execPath, ["--check", "js/effects.mjs"], {
  stdio: "inherit",
});
