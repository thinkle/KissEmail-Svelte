import { execSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
} from "fs";

try {
  const packageJSON = JSON.parse(readFileSync("package.json", "utf-8"));
  const args = process.argv.slice(2);
  const typeFlagIndex = args.indexOf("--type");
  const projectType =
    typeFlagIndex > -1 && args[typeFlagIndex + 1] ? args[typeFlagIndex + 1] : "sheets";
  const projectName = packageJSON.name || "kiss-mail-merge-svelte";

  if (!existsSync("dist")) {
    mkdirSync("dist", { recursive: true });
  }
  if (existsSync("appsscript.json")) {
    copyFileSync("appsscript.json", "dist/appsscript.json");
  }

  execSync(
    `npx clasp create --title "${projectName}" --type ${projectType} --rootDir dist/`,
    { encoding: "utf-8", stdio: "inherit" }
  );

  if (existsSync("dist/.clasp.json")) {
    renameSync("dist/.clasp.json", ".clasp.json");
  }
} catch (err) {
  console.log("Oops ", err);
}
