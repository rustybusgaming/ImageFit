const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ENGINE_REQUIREMENTS,
  assertVideoPayload,
  getOutputFilename,
  getVaapiDevice,
  isCodecCompatible,
  isEngineSupportedHere,
  planVideoBitrate,
  retargetVideoBitrate,
} = require("../desktop/video-config.cjs");

const validPayload = {
  inputPath: path.resolve("fixtures/source-video.mp4"),
  presetId: "discord-10mb",
  maxBytes: 10 * 1024 * 1024,
  duration: 30,
  height: 720,
  frameRate: 30,
  audio: "keep",
  format: "mp4",
  codec: "h264",
  encoder: "software",
};

test("codec/container validity matches supported exports", () => {
  assert.equal(isCodecCompatible("h264", "mp4"), true);
  assert.equal(isCodecCompatible("vp9", "webm"), true);
  assert.equal(isCodecCompatible("prores", "mov"), true);
  assert.equal(isCodecCompatible("theora", "ogv"), true);
  assert.equal(isCodecCompatible("vp9", "mp4"), false);
  assert.equal(isCodecCompatible("prores", "webm"), false);
});

test("desktop IPC payload validation rejects malformed or incompatible requests", () => {
  assert.doesNotThrow(() => assertVideoPayload(validPayload));
  assert.throws(() => assertVideoPayload({ ...validPayload, inputPath: "relative.mp4" }), /source video path/);
  assert.throws(() => assertVideoPayload({ ...validPayload, format: "mp4", codec: "vp9" }), /not compatible/);
  assert.throws(() => assertVideoPayload({ ...validPayload, format: "gif", audio: "keep" }), /must be muted/);
  assert.throws(() => assertVideoPayload({ ...validPayload, encoder: "unknown" }), /encoding engine/);
});

test("desktop output filenames are stable and safe", () => {
  assert.equal(
    getOutputFilename("/media/My clip (final).mp4", validPayload),
    "My-clip-final-discord-10mb-h264.mp4"
  );
  assert.equal(
    getOutputFilename("C:\\media\\clip.mkv", { ...validPayload, inputPath: "C:\\media\\clip.mkv", format: "webm", codec: "vp9", encoder: "nvenc" }),
    "C-media-clip-discord-10mb-vp9-nvenc.webm"
  );
});

test("hardware engines are accepted and named in the output filename", () => {
  for (const encoder of ["software", "nvenc", "qsv", "amf", "videotoolbox", "vaapi", "mf"]) {
    assert.doesNotThrow(() => assertVideoPayload({ ...validPayload, encoder }));
  }

  assert.equal(
    getOutputFilename("/media/clip.mp4", { ...validPayload, encoder: "vaapi" }),
    "clip-discord-10mb-h264-vaapi.mp4"
  );
  assert.equal(
    getOutputFilename("/media/clip.mp4", { ...validPayload, encoder: "software" }),
    "clip-discord-10mb-h264.mp4"
  );
});

test("desktop output filenames never contain path separators", () => {
  for (const presetId of ["../../escape", "..\\..\\escape", "a/b/c"]) {
    const filename = getOutputFilename("/media/clip.mp4", { ...validPayload, presetId });
    assert.ok(!filename.includes("/") && !filename.includes("\\"), `expected a flat filename, got ${filename}`);
    assert.ok(!filename.includes(".."), `expected no parent-directory hop, got ${filename}`);
  }

  assert.equal(getOutputFilename("/media/../../etc/passwd.mp4", validPayload), "passwd-discord-10mb-h264.mp4");
});

test("platform-bound engines are only offered on the platform that can run them", () => {
  assert.equal(isEngineSupportedHere("mf", "win32"), true);
  assert.equal(isEngineSupportedHere("mf", "linux"), false);
  assert.equal(isEngineSupportedHere("mf", "darwin"), false);

  assert.equal(isEngineSupportedHere("videotoolbox", "darwin"), true);
  assert.equal(isEngineSupportedHere("videotoolbox", "win32"), false);

  // VAAPI additionally needs a render node, so it is never available off Linux.
  assert.equal(isEngineSupportedHere("vaapi", "win32"), false);
  assert.equal(isEngineSupportedHere("vaapi", "darwin"), false);
  assert.equal(getVaapiDevice("win32"), null);
  assert.equal(getVaapiDevice("darwin"), null);

  // Engines with no platform requirement stay available everywhere.
  for (const platform of ["win32", "linux", "darwin"]) {
    assert.equal(isEngineSupportedHere("nvenc", platform), true);
    assert.equal(isEngineSupportedHere("software", platform), true);
  }
});

test("every platform-bound engine explains why it is unavailable", () => {
  for (const [engine, requirement] of Object.entries(ENGINE_REQUIREMENTS)) {
    assert.equal(typeof requirement.message, "string", `${engine} needs a message`);
    assert.ok(requirement.message.length > 0, `${engine} needs a non-empty message`);
  }
});

const MB = 1024 * 1024;

test("size targets that the bitrate floor makes impossible are reported up front", () => {
  // Short clips have plenty of headroom.
  assert.equal(planVideoBitrate(20 * MB, 30, "keep").isReachable, true);
  assert.equal(planVideoBitrate(10 * MB, 30, "keep").isReachable, true);

  // A 10-minute clip cannot fit 5 MB: the 100 kbps floor alone exceeds the budget.
  assert.equal(planVideoBitrate(5 * MB, 600, "keep").isReachable, false);

  // Muting frees the audio budget, but not enough to rescue a very long clip.
  assert.equal(planVideoBitrate(5 * MB, 600, "mute").isReachable, false);
  assert.equal(planVideoBitrate(20 * MB, 600, "mute").isReachable, true);
});

test("a reachable plan stays within its byte budget", () => {
  for (const [maxBytes, duration] of [[5 * MB, 30], [10 * MB, 60], [20 * MB, 120]]) {
    const plan = planVideoBitrate(maxBytes, duration, "keep");
    const predictedBytes = ((plan.videoBitrate + plan.audioBitrate) * duration) / 8;
    assert.ok(predictedBytes <= maxBytes, `${maxBytes} over ${duration}s predicted ${predictedBytes}`);
  }
});

test("retargeting steps down from a measured overshoot and stops at the floor", () => {
  // A 40% overshoot should cut the bitrate by at least a proportional amount.
  const next = retargetVideoBitrate(2_000_000, 14 * MB, 10 * MB);
  assert.ok(next !== null && next < 2_000_000, "expected a lower bitrate");
  assert.ok(next <= Math.floor((2_000_000 * 10) / 14), "expected at least a proportional cut");

  // Retargeting converges rather than oscillating.
  let bitrate = 2_000_000;
  for (let i = 0; i < 3 && bitrate !== null; i += 1) {
    const lower = retargetVideoBitrate(bitrate, 12 * MB, 10 * MB);
    if (lower === null) break;
    assert.ok(lower < bitrate, "each step must decrease");
    bitrate = lower;
  }

  // At the floor there is nothing left to give.
  assert.equal(retargetVideoBitrate(100_000, 99 * MB, 10 * MB), null);
  // An output already under the cap would not be retargeted upward.
  assert.equal(retargetVideoBitrate(100_000, 1 * MB, 10 * MB), null);
});
