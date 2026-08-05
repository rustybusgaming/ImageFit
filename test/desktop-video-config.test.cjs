const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { assertVideoPayload, getOutputFilename, isCodecCompatible } = require("../desktop/video-config.cjs");

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
