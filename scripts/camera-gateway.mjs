import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDirectory = resolve(root, ".camera-runtime");
const pidFile = resolve(runtimeDirectory, "mediamtx.pid");
const logFile = resolve(runtimeDirectory, "mediamtx.log");
const configFile = resolve(root, "camera-gateway", "mediamtx.yml");
const command = process.argv[2] ?? "status";

function isAvailable(binary) {
  const result = spawnSync(binary, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
  });
  return !result.error;
}

function readPid() {
  if (!existsSync(pidFile)) return null;
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function cleanStalePid() {
  const pid = readPid();
  if (pid && !isRunning(pid)) rmSync(pidFile, { force: true });
  return pid && isRunning(pid) ? pid : null;
}

function requireDependencies() {
  const missing = ["mediamtx", "ffmpeg"].filter(
    (binary) => !isAvailable(binary),
  );
  if (!missing.length) return;
  console.error(`Faltan dependencias: ${missing.join(", ")}.`);
  console.error("Instálalas una vez con: brew install mediamtx ffmpeg");
  process.exit(1);
}

function start() {
  const currentPid = cleanStalePid();
  if (currentPid) {
    console.log(`Gateway de cámara ya está activo (PID ${currentPid}).`);
    return;
  }
  requireDependencies();
  mkdirSync(runtimeDirectory, { recursive: true });
  const output = openSync(logFile, "a");
  const child = spawn("mediamtx", [configFile], {
    cwd: root,
    detached: true,
    env: process.env,
    stdio: ["ignore", output, output],
  });
  child.once("error", (error) => {
    console.error(`No fue posible iniciar MediaMTX: ${error.message}`);
    process.exitCode = 1;
  });
  child.unref();
  closeSync(output);
  writeFileSync(pidFile, String(child.pid));
  console.log(`Gateway de cámara iniciado (PID ${child.pid}).`);
  console.log("HLS: http://localhost:8888/stream2/index.m3u8");
  console.log("La cámara remota se conecta bajo demanda al abrir el popup.");
}

function stop() {
  const pid = cleanStalePid();
  if (!pid) {
    console.log("El gateway de cámara no está activo.");
    return;
  }
  try {
    process.kill(pid, "SIGINT");
    rmSync(pidFile, { force: true });
    console.log(`Gateway de cámara detenido (PID ${pid}).`);
  } catch (error) {
    console.error(`No fue posible detener el gateway: ${error.message}`);
    process.exitCode = 1;
  }
}

function status() {
  const pid = cleanStalePid();
  if (pid) {
    console.log(`Gateway activo (PID ${pid}).`);
    console.log("HLS: http://localhost:8888/stream2/index.m3u8");
  } else {
    console.log("Gateway detenido.");
  }
}

function logs() {
  if (!existsSync(logFile)) {
    console.log("Todavía no existen logs del gateway.");
    return;
  }
  const lines = readFileSync(logFile, "utf8").trimEnd().split("\n");
  console.log(lines.slice(-120).join("\n"));
}

switch (command) {
  case "up":
    start();
    break;
  case "down":
    stop();
    break;
  case "status":
    status();
    break;
  case "logs":
    logs();
    break;
  default:
    console.error("Uso: node scripts/camera-gateway.mjs up|down|status|logs");
    process.exitCode = 1;
}
