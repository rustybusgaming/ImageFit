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
