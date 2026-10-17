const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createMediaRegistry,
  getVideoContentType,
  isVideoPath,
  parseByteRange,
} = require("../desktop/media-stream.cjs");

test("byte ranges resolve against the file size", () => {
  assert.equal(parseByteRange(null, 1000), null);
  assert.deepEqual(parseByteRange("bytes=0-", 1000), { start: 0, end: 999 });
  assert.deepEqual(parseByteRange("bytes=100-199", 1000), { start: 100, end: 199 });
  assert.deepEqual(parseByteRange("bytes=900-5000", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseByteRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseByteRange("bytes=-5000", 1000), { start: 0, end: 999 });
});

test("ranges outside the file are unsatisfiable and unsupported forms fall back to the whole file", () => {
  assert.equal(parseByteRange("bytes=1000-", 1000), "unsatisfiable");
  assert.equal(parseByteRange("bytes=500-100", 1000), "unsatisfiable");
  assert.equal(parseByteRange("bytes=-0", 1000), "unsatisfiable");
  assert.equal(parseByteRange("bytes=0-", 0), "unsatisfiable");
  assert.equal(parseByteRange("bytes=0-10,20-30", 1000), null);
  assert.equal(parseByteRange("items=0-10", 1000), null);
  assert.equal(parseByteRange("bytes=-", 1000), null);
});

test("the media registry only resolves tokens it issued", () => {
  let next = 0;
  const registry = createMediaRegistry(() => `token-${next++}`);
  const url = registry.register("/videos/clip.mp4");

  assert.equal(url, "imagefit-media://media/token-0");
  assert.equal(registry.register("/videos/clip.mp4"), url);
  assert.equal(registry.resolve(url), "/videos/clip.mp4");
  assert.equal(registry.resolve("imagefit-media://media/token-1"), null);
  assert.equal(registry.resolve("imagefit-media://media//etc/passwd"), null);
  assert.equal(registry.resolve("imagefit-media://other/token-0"), null);
  assert.equal(registry.resolve("file:///videos/clip.mp4"), null);
  assert.equal(registry.resolve("not a url"), null);
});

test("videos are recognised and typed by extension", () => {
  assert.equal(isVideoPath("/a/clip.MKV"), true);
  assert.equal(isVideoPath("/a/photo.png"), false);
  assert.equal(getVideoContentType("/a/clip.mov"), "video/quicktime");
  assert.equal(getVideoContentType("/a/clip.unknown"), "application/octet-stream");
});
