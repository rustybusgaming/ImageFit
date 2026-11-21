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
  MAX_GIF_ATTEMPTS,
  MIN_GIF_FRAME_RATE,
  MIN_GIF_SCALE,
  pickFastestEngine,
  planGifRetry,
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

test("GIF output filenames leave out the unused codec and engine", () => {
  assert.equal(
    getOutputFilename("/media/clip.mp4", { ...validPayload, format: "gif", audio: "mute", presetId: "custom-7.5mb" }),
    "clip-custom-7.5mb.gif"
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

test("the opening plan leaves enough headroom to land in one pass", () => {
  // Measured: a 4% margin overshot on the first attempt and forced a second encode, which
  // roughly doubled encode time. The margin must stay generous enough to land first time.
  const plan = planVideoBitrate(10 * MB, 60, "keep");
  const predicted = ((plan.videoBitrate + plan.audioBitrate) * 60) / 8;
  assert.ok(predicted <= 10 * MB * 0.95, `expected >=5% headroom, predicted ${predicted} of ${10 * MB}`);
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

const HARDWARE_ENCODERS = {
  nvenc: { h264: "h264_nvenc", h265: "hevc_nvenc", av1: "av1_nvenc" },
  qsv: { h264: "h264_qsv", h265: "hevc_qsv", av1: "av1_qsv" },
  amf: { h264: "h264_amf", h265: "hevc_amf", av1: "av1_amf" },
  videotoolbox: { h264: "h264_videotoolbox", h265: "hevc_videotoolbox" },
  vaapi: { h264: "h264_vaapi", h265: "hevc_vaapi", av1: "av1_vaapi" },
  mf: { h264: "h264_mf", h265: "hevc_mf" },
};
const pick = (codec, available) => pickFastestEngine(codec, available, HARDWARE_ENCODERS);

test("the fastest available engine is chosen automatically", () => {
  // Vendor engines win over the OS-level ones when both are present.
  assert.equal(pick("h264", ["h264_mf", "h264_qsv", "h264_nvenc"]), "nvenc");
  assert.equal(pick("h264", ["h264_mf", "h264_qsv"]), "qsv");
  assert.equal(pick("h264", ["h264_vaapi", "h264_mf"]), "vaapi");
  assert.equal(pick("h264", ["h264_mf"]), "mf");
});

test("engine selection falls back to software rather than picking something unusable", () => {
  assert.equal(pick("h264", []), "software");
  // vp9/theora have no hardware encoder in the map at all.
  assert.equal(pick("vp9", ["h264_nvenc", "hevc_nvenc"]), "software");
  assert.equal(pick("theora", ["h264_nvenc"]), "software");
  // An engine present for a different codec must not be selected for this one.
  assert.equal(pick("av1", ["h264_videotoolbox", "hevc_videotoolbox"]), "software");
  assert.equal(pick("av1", ["av1_qsv"]), "qsv");
});

// Sizes below were measured with the bundled FFmpeg and the app's GIF palette filter on a
// 10-second 720p clip (30 fps: 19.8 MB) and a busy 6-second one (30 fps: 57.2 MB). The model
// is size ~ frameRate^0.9 * scale^1.8, so each test checks the prediction lands under the cap.
function predictGifBytes(baseBytes, base, step) {
  return baseBytes * (step.frameRate / base.frameRate) ** 0.9 * (step.scale / base.scale) ** 1.8;
}

test("an oversized GIF is retried with both frame rate and scale reduced, landing under the cap", () => {
  const start = { frameRate: 30, scale: 1 };
  const maxBytes = 10 * 1024 * 1024;
  const next = planGifRetry(start, 19_820_973, maxBytes);

  assert.ok(next, "expected a retry step");
  assert.ok(next.frameRate < 30 && next.frameRate >= 15, `frame rate should drop moderately, got ${next.frameRate}`);
  assert.ok(next.scale < 1 && next.scale >= 0.7, `scale should drop moderately, got ${next.scale}`);
  assert.ok(predictGifBytes(19_820_973, start, next) <= maxBytes);
});

test("GIF retries never go below the frame-rate and scale floors", () => {
  const next = planGifRetry({ frameRate: 30, scale: 1 }, 500 * 1024 * 1024, 1024 * 1024);
  assert.deepEqual(next, { frameRate: MIN_GIF_FRAME_RATE, scale: MIN_GIF_SCALE });

  assert.equal(planGifRetry({ frameRate: MIN_GIF_FRAME_RATE, scale: MIN_GIF_SCALE }, 50 * 1024 * 1024, 1024 * 1024), null);
});

test("a GIF already at its frame-rate floor takes the whole reduction from scale", () => {
  const next = planGifRetry({ frameRate: MIN_GIF_FRAME_RATE, scale: 1 }, 20 * 1024 * 1024, 10 * 1024 * 1024);
  assert.equal(next.frameRate, MIN_GIF_FRAME_RATE);
  assert.ok(next.scale < 0.7 && next.scale > MIN_GIF_SCALE, `got ${next.scale}`);
});

test("repeated GIF retries keep shrinking and stop within the attempt budget", () => {
  // A busy clip that cannot reach 1 MB: the planner must reach its floors and then give up.
  let step = { frameRate: 30, scale: 1 };
  let attempts = 1;
  for (;;) {
    const size = predictGifBytes(57_163_287, { frameRate: 30, scale: 1 }, step) * 1.3;
    const next = planGifRetry(step, size, 1024 * 1024);
    if (next === null) break;
    assert.ok(next.frameRate <= step.frameRate && next.scale <= step.scale);
    assert.ok(next.frameRate < step.frameRate || next.scale < step.scale, "each retry must reduce something");
    step = next;
    attempts += 1;
  }
  assert.ok(attempts <= MAX_GIF_ATTEMPTS, `took ${attempts} attempts`);
});
