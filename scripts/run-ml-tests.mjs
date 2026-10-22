import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const candidates = process.platform === "win32"
  ? [path.join(root, "services", "ml", ".venv-stable", "Scripts", "python.exe"), path.join(root, "services", "ml", ".venv", "Scripts", "python.exe"), "python"]
  : [path.join(root, "services", "ml", ".venv-stable", "bin", "python"), path.join(root, "services", "ml", ".venv", "bin", "python"), "python3", "python"];
const python = candidates.find((candidate) => candidate === "python" || candidate === "python3" || existsSync(candidate));

if (!python) {
  console.error("No Python interpreter found. Create services/ml/.venv and install services/ml/requirements.txt.");
  process.exit(1);
}

const result = spawnSync(python, ["-m", "pytest", "services/ml/tests"], { cwd: root, stdio: "inherit" });
if (result.error) {
  console.error(`Unable to run ML tests with ${python}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
