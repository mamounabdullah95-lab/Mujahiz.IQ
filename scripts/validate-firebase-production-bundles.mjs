import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mujahiz-firebase-bundles-"));
const resolvedTempRoot = path.resolve(tempRoot);
const resolvedSystemTemp = path.resolve(os.tmpdir());

assert.ok(
  resolvedTempRoot.startsWith(resolvedSystemTemp + path.sep),
  "Bundle validation directory must remain inside the system temporary directory.",
);

const firebaseEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_APP_CHECK_SITE_KEY",
  "VITE_FORCE_DEMO",
  "VITE_USE_FIREBASE_EMULATORS",
];

const validConfig = Object.freeze({
  VITE_FIREBASE_API_KEY: "AIzaCI_ONLY_NOT_A_SECRET_1234567890",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-mujahiziq-ci.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "demo-mujahiziq-ci",
  VITE_FIREBASE_STORAGE_BUCKET: "demo-mujahiziq-ci.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
});

const cases = [
  {
    name: "missing",
    config: Object.fromEntries(Object.keys(validConfig).map((key) => [key, ""])),
    expectedTarget: "configuration_error",
  },
  {
    name: "malformed",
    config: { ...validConfig, VITE_FIREBASE_API_KEY: "replace-me" },
    expectedTarget: "configuration_error",
  },
  {
    name: "valid",
    config: validConfig,
    expectedTarget: "firebase",
  },
];

function findChrome() {
  const configured = process.env.CHROME_BIN?.trim();
  const knownPaths = [
    configured,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const candidate of knownPaths) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
  }
  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync(command, ["--version"], { stdio: "ignore" });
    if (result.status === 0) return command;
  }
  throw new Error("Chrome or Chromium is required for built-bundle validation.");
}

function buildEnvironment(config) {
  const env = { ...process.env };
  for (const key of firebaseEnvKeys) delete env[key];
  return {
    ...env,
    ...config,
    NODE_ENV: "production",
    VITE_PUBLIC_SITE_URL: "https://ci.example.test",
    VITE_FIREBASE_APP_CHECK_SITE_KEY: "",
    VITE_FORCE_DEMO: "true",
    VITE_USE_FIREBASE_EMULATORS: "true",
    VITE_FIREBASE_AI_ENABLED: "false",
    VITE_FILE_UPLOADS_ENABLED: "false",
    VITE_SUPPLIER_EXCEL_IMPORT_ENABLED: "true",
  };
}

function buildCase(testCase) {
  const outDir = path.join(tempRoot, testCase.name);
  const result = spawnSync(
    process.execPath,
    [viteBin, "build", "--mode", "production", "--outDir", outDir, "--emptyOutDir", "--manifest"],
    {
      cwd: repositoryRoot,
      env: buildEnvironment(testCase.config),
      encoding: "utf8",
    },
  );
  assert.equal(
    result.status,
    0,
    "Vite build failed for " + testCase.name + ":\n" + result.stdout + "\n" + result.stderr,
  );
  return outDir;
}

function readBundleManifest(outDir) {
  const manifestPath = path.join(outDir, ".vite", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entry = manifest["index.html"];
  assert.ok(entry?.isEntry, "Vite manifest must contain the index.html entry.");
  const bootstrap = Object.entries(manifest).find(([key, value]) => (
    key.endsWith("src/bootstrap.tsx") || value.name === "bootstrap"
  ));
  assert.ok(bootstrap, "Vite manifest must contain the lazy bootstrap chunk.");
  return { entry, bootstrapKey: bootstrap[0], bootstrapFile: bootstrap[1].file };
}

function contentType(filePath) {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function inspectInChrome(chrome, outDir, testCase, bootstrapFile) {
  const requests = [];
  const root = path.resolve(outDir);
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
    requests.push(pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    let filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, "index.html")) {
      response.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = path.join(root, "index.html");
    }
    response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const profileDir = path.join(tempRoot, "chrome-" + testCase.name);
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-proxy-server",
    "--user-data-dir=" + profileDir,
    "--virtual-time-budget=7000",
    "--dump-dom",
    "http://127.0.0.1:" + address.port + "/",
  ];

  let stdout = "";
  let stderr = "";
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(chrome, args, { windowsHide: true });
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Chrome timed out for " + testCase.name + " bundle."));
      }, 30_000);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("error", reject);
      child.once("close", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    assert.equal(result, 0, "Chrome failed for " + testCase.name + ":\n" + stderr);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const requestedBootstrap = requests.includes("/" + bootstrapFile.replaceAll("\\", "/"));
  const exposedValues = Object.values(testCase.config).filter((value) => value && value !== "replace-me");
  for (const value of exposedValues) {
    assert.ok(!stdout.includes(value), testCase.name + " DOM must not print Firebase config values.");
  }

  if (testCase.expectedTarget === "configuration_error") {
    assert.match(stdout, /FIREBASE_CONFIGURATION_REQUIRED/);
    assert.ok(!stdout.toLowerCase().includes("<form"));
    assert.ok(!stdout.toLowerCase().includes("<input"));
    assert.doesNotMatch(stdout, /demo mode/i);
    assert.equal(requestedBootstrap, false, testCase.name + " bundle must not request bootstrap.");
  } else {
    assert.doesNotMatch(stdout, /FIREBASE_CONFIGURATION_REQUIRED/);
    assert.equal(requestedBootstrap, true, "Valid Firebase bundle must request bootstrap.");
    assert.ok(stdout.includes('<div id="root">'));
    assert.ok(!stdout.includes('<div id="root"></div>'));
  }
}

const chrome = findChrome();

try {
  for (const testCase of cases) {
    const outDir = buildCase(testCase);
    const { entry, bootstrapKey, bootstrapFile } = readBundleManifest(outDir);
    assert.ok(entry.dynamicImports?.includes(bootstrapKey), "Application bootstrap must remain a lazy import.");
    assert.ok(!entry.imports?.includes(bootstrapKey), "Application bootstrap must not be an eager import.");
    await inspectInChrome(chrome, outDir, testCase, bootstrapFile);
    console.log("Firebase bundle case passed: " + testCase.name + " -> " + testCase.expectedTarget);
  }
} finally {
  if (resolvedTempRoot.startsWith(resolvedSystemTemp + path.sep)) {
    fs.rmSync(resolvedTempRoot, { recursive: true, force: true });
  }
}

console.log("Built Firebase production bundle validation passed (3/3 cases).");
