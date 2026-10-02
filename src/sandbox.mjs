// Runs untrusted (generated) code inside a locked-down container.
// Every run works on a throwaway copy mounted at /work; the real workspace is never mounted.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserError } from "./workspace.mjs";

const OUTPUT_CAP = 256 * 1024;

export function makeTempDir(prefix = "gingaloop-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function engineBin(sandbox) {
  if (sandbox.engine === "none") return null;
  if (!["docker", "podman"].includes(sandbox.engine)) {
    throw new UserError(`Unknown sandbox engine "${sandbox.engine}" (use docker, podman or none).`);
  }
  return sandbox.engine;
}

export function engineAvailable(sandbox) {
  const bin = engineBin(sandbox);
  if (!bin) return { ok: true, detail: "none (UNSANDBOXED)" };
  const r = spawnSync(bin, ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" });
  if (r.status === 0) return { ok: true, detail: `${bin} ${r.stdout.trim()}` };
  return { ok: false, detail: (r.stderr || r.error?.message || "not available").trim().split("\n")[0] };
}

/** Image reference for a profile: { pull: "python:3.12-slim" } or { tag, dockerfile }. */
export function imageRef(profile) {
  const img = profile.image;
  if (!img) throw new UserError(`Profile ${profile.id} has no image.`);
  return img.pull || img.tag;
}

export function imagePresent(sandbox, profile) {
  const bin = engineBin(sandbox);
  if (!bin) return true;
  return spawnSync(bin, ["image", "inspect", imageRef(profile)], { stdio: "ignore" }).status === 0;
}

/** Pull or build the profile image if missing. Network is used here, never during test runs. */
export function ensureImage(sandbox, profile, { quiet = false } = {}) {
  const bin = engineBin(sandbox);
  if (!bin || imagePresent(sandbox, profile)) return;
  const img = profile.image;
  const stdio = quiet ? ["pipe", "ignore", "pipe"] : ["pipe", "inherit", "inherit"];
  let r;
  if (img.pull) {
    if (!quiet) console.error(`Pulling ${img.pull} ...`);
    r = spawnSync(bin, ["pull", img.pull], { stdio, encoding: "utf8" });
  } else if (img.dockerfile) {
    if (!quiet) console.error(`Building ${img.tag} ...`);
    r = spawnSync(bin, ["build", "-t", img.tag, "-"], {
      input: img.dockerfile,
      stdio,
      encoding: "utf8",
    });
  } else {
    throw new UserError(`Profile ${profile.id}: image needs "pull" or "tag"+"dockerfile".`);
  }
  if (r.status !== 0) {
    throw new UserError(`Could not get image ${imageRef(profile)}: ${(r.stderr || "").trim()}`);
  }
}

/**
 * Run `command` with `sh -c` inside the profile image.
 * @param {object} o
 * @param {string} o.workDir   host dir (already a throwaway copy) mounted at /work
 * @param {string} o.cwd       working dir inside /work (e.g. "tests")
 * @returns {Promise<{code:number|null, output:string, timedOut:boolean}>}
 */
export function runInSandbox({ sandbox, profile, workDir, cwd = ".", command, env = {}, timeoutSeconds }) {
  const bin = engineBin(sandbox);
  const limit = timeoutSeconds ?? sandbox.timeoutSeconds;
  const name = `ginga-${randomBytes(5).toString("hex")}`;
  let file;
  let args;
  let spawnOpts;
  if (bin) {
    ensureImage(sandbox, profile);
    const uid = process.getuid?.() ?? 1000;
    const gid = process.getgid?.() ?? 1000;
    args = [
      "run", "--rm", "--name", name,
      "--network", "none",
      "--user", `${uid}:${gid}`,
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", String(sandbox.pidsLimit),
      "--memory", sandbox.memory,
      "--cpus", String(sandbox.cpus),
      "--read-only",
      "--tmpfs", "/tmp:exec,size=256m",
      "-v", `${workDir}:/work`,
      "-w", `/work/${cwd}`.replace(/\/\.$/, ""),
      "-e", "HOME=/tmp",
      ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
      ...(profile.sandbox?.extraFlags ?? []),
      imageRef(profile),
      "sh", "-c", command,
    ];
    file = bin;
    spawnOpts = {};
  } else {
    if (!sandbox.allowUnsandboxed) {
      throw new UserError(
        'Sandbox engine "none" runs generated code directly on this machine. ' +
          'Set "sandbox.allowUnsandboxed": true in gingaloop.json if you really want that.',
      );
    }
    console.error("WARNING: running generated code WITHOUT a sandbox.");
    file = "sh";
    args = ["-c", command];
    spawnOpts = { cwd: join(workDir, cwd), env: { ...process.env, ...env } };
  }

  return new Promise((resolvePromise) => {
    const child = spawn(file, args, { ...spawnOpts, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;
    const collect = (chunk) => {
      output += chunk.toString();
      if (output.length > OUTPUT_CAP) output = output.slice(-OUTPUT_CAP);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const kill = () => {
      if (bin) spawnSync(bin, ["kill", name], { stdio: "ignore" });
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, limit * 1000);
    const onSignal = () => {
      kill();
      process.exit(130);
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    child.on("error", (err) => {
      output += `\n[gingaloop] failed to start ${file}: ${err.message}\n`;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      if (timedOut) output += `\n[gingaloop] killed after ${limit}s timeout\n`;
      resolvePromise({ code: timedOut ? null : code, output, timedOut });
    });
  });
}
