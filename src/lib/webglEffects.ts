/**
 * GPU colour-treatment pass.
 *
 * The 2D canvas path applies the colour treatments through `ctx.filter` CSS filter strings.
 * This module reproduces the same treatments as a WebGL2 fragment shader so the work runs on
 * the GPU and stays available inside a worker, where `ctx.filter` support is uneven.
 *
 * The maths follows the Filter Effects spec so both paths agree: `saturate` and `sepia` are
 * linear colour matrices (composed here into one mat3), and `contrast` is a slope/intercept
 * transfer applied afterwards. Values are clamped between stages, as CSS filter chains do.
 */

import type { ImageEffect } from "./imageProcessor";

type Matrix3 = [number, number, number, number, number, number, number, number, number];

interface EffectProgram {
  matrix: Matrix3;
  contrast: number;
}

const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const SEPIA: Matrix3 = [
  0.393, 0.769, 0.189,
  0.349, 0.686, 0.168,
  0.272, 0.534, 0.131,
];

function saturateMatrix(amount: number): Matrix3 {
  return [
    0.213 + 0.787 * amount, 0.715 - 0.715 * amount, 0.072 - 0.072 * amount,
    0.213 - 0.213 * amount, 0.715 + 0.285 * amount, 0.072 - 0.072 * amount,
    0.213 - 0.213 * amount, 0.715 - 0.715 * amount, 0.072 + 0.928 * amount,
  ];
}

function mixMatrix(from: Matrix3, to: Matrix3, amount: number): Matrix3 {
  return from.map((value, index) => value + (to[index] - value) * amount) as Matrix3;
}

function multiplyMatrix(left: Matrix3, right: Matrix3): Matrix3 {
  const result = new Array(9).fill(0);

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] =
        left[row * 3] * right[column] +
        left[row * 3 + 1] * right[3 + column] +
        left[row * 3 + 2] * right[6 + column];
    }
  }

  return result as Matrix3;
}

/** Row-major to the column-major order `uniformMatrix3fv` expects. */
function toColumnMajor(matrix: Matrix3): Matrix3 {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ];
}

function getEffectProgram(effect: ImageEffect): EffectProgram | null {
  switch (effect) {
    case "mono":
      return { matrix: saturateMatrix(0), contrast: 1.15 };
    case "warm":
      return { matrix: multiplyMatrix(saturateMatrix(1.25), mixMatrix(IDENTITY, SEPIA, 0.45)), contrast: 1.05 };
    case "pop":
      return { matrix: saturateMatrix(1.6), contrast: 1.15 };
    default:
      return null;
  }
}

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vTexCoord;
void main() {
  vTexCoord = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vTexCoord;
uniform sampler2D uImage;
uniform mat3 uColorMatrix;
uniform float uContrast;
out vec4 outColor;
void main() {
  vec4 texel = texture(uImage, vTexCoord);
  vec3 color = clamp(uColorMatrix * texel.rgb, 0.0, 1.0);
  color = clamp(color * uContrast + (0.5 - 0.5 * uContrast), 0.0, 1.0);
  outColor = vec4(color, texel.a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create the GPU effect shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Could not compile the GPU effect shader: ${log ?? "unknown error"}`);
  }

  return shader;
}

interface EffectPipeline {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  matrixLocation: WebGLUniformLocation | null;
  contrastLocation: WebGLUniformLocation | null;
}

let pipeline: EffectPipeline | null = null;
let pipelineFailed = false;

function getPipeline(): EffectPipeline | null {
  if (pipeline) return pipeline;
  if (pipelineFailed || typeof OffscreenCanvas === "undefined") return null;

  try {
    const canvas = new OffscreenCanvas(1, 1);
    // premultipliedAlpha:false keeps the shader output straight-alpha, matching the texture upload
    // so the result composites correctly when drawn into the 2D canvas.
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!gl) {
      pipelineFailed = true;
      return null;
    }

    const program = gl.createProgram();
    if (!program) throw new Error("Could not create the GPU effect program.");

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Could not link the GPU effect program: ${gl.getProgramInfoLog(program) ?? "unknown error"}`);
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    if (!texture) throw new Error("Could not create the GPU effect texture.");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    pipeline = {
      canvas,
      gl,
      program,
      texture,
      matrixLocation: gl.getUniformLocation(program, "uColorMatrix"),
      contrastLocation: gl.getUniformLocation(program, "uContrast"),
    };
    return pipeline;
  } catch {
    pipelineFailed = true;
    return null;
  }
}

export function isEffectPipelineAvailable(): boolean {
  return getPipeline() !== null;
}

/**
 * Applies a colour treatment on the GPU and returns the result as a bitmap, or null when the
 * treatment is a no-op or WebGL2 is not usable — callers fall back to `ctx.filter` in that case.
 */
export async function applyEffectOnGPU(source: ImageBitmap, effect: ImageEffect): Promise<ImageBitmap | null> {
  const effectProgram = getEffectProgram(effect);
  if (!effectProgram) return null;

  const active = getPipeline();
  if (!active) return null;

  const { canvas, gl, program, texture, matrixLocation, contrastLocation } = active;

  try {
    canvas.width = source.width;
    canvas.height = source.height;
    gl.viewport(0, 0, source.width, source.height);
    gl.useProgram(program);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.uniformMatrix3fv(matrixLocation, false, toColumnMajor(effectProgram.matrix));
    gl.uniform1f(contrastLocation, effectProgram.contrast);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    return await createImageBitmap(canvas);
  } catch {
    return null;
  }
}
