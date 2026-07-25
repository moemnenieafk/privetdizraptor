// CRT пост-обработка ОТРИСОВАННОГО битмапа (хендофф §6): не CSS-трансформ на элементе,
// а искажение только картинки — DOM-бокс остаётся честным 4:3, клики маппятся простым масштабом.
// WebGL-пасс (barrel-выпуклость трубки + сканлайны + люминофор-маска + вигнетка), 2D-фолбэк без barrel.

export type CrtPreset = 'site' | 'fullscreen';

export interface CrtRenderer {
  /** Отрисовать кадр: source = offscreen-канвас игры 640×480. */
  render(source: HTMLCanvasElement): void;
  /** Подогнать буфер под CSS-размер бокса экрана. */
  resize(cssW: number, cssH: number): void;
  setPreset(preset: CrtPreset): void;
  dispose(): void;
}

interface CrtParams {
  curvature: number; // сила выпуклости трубки
  scanline: number; // глубина сканлайнов 0..1
  vignette: number; // затемнение по краям
  chroma: number; // хроматическая аберрация по краю
  mask: number; // сила люминофор-маски (RGB-триады)
}

const PRESETS: Record<CrtPreset, CrtParams> = {
  site: { curvature: 0.12, scanline: 0.12, vignette: 0.22, chroma: 0.0016, mask: 0.1 },
  fullscreen: { curvature: 0.22, scanline: 0.18, vignette: 0.34, chroma: 0.0028, mask: 0.16 },
};

const VERT = `#version 100
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 100
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uOut;       // размер выходного буфера (device px)
uniform float uCurve;
uniform float uScan;
uniform float uVignette;
uniform float uChroma;
uniform float uMask;

// Выпуклость трубки: тянем углы наружу (barrel).
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) * uCurve;
  uv += uv * off * off;
  return uv * 0.5 + 0.5;
}

void main() {
  vec2 uv = curve(vUv);

  // За кромкой стекла — чёрный борт.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Лёгкая хроматическая аберрация к краям.
  float d = distance(uv, vec2(0.5));
  vec2 dir = (uv - 0.5) * uChroma * d;
  float r = texture2D(uTex, uv + dir).r;
  float g = texture2D(uTex, uv).g;
  float b = texture2D(uTex, uv - dir).b;
  vec3 col = vec3(r, g, b);

  // Сканлайны (по строкам выходного буфера).
  float scan = 0.5 + 0.5 * sin(uv.y * uOut.y * 3.14159);
  col *= 1.0 - uScan * (1.0 - scan);

  // Люминофор-маска: RGB-триады по колонкам.
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(1.0);
  if (m < 1.0) mask = vec3(1.0, 1.0 - uMask, 1.0 - uMask);
  else if (m < 2.0) mask = vec3(1.0 - uMask, 1.0, 1.0 - uMask);
  else mask = vec3(1.0 - uMask, 1.0 - uMask, 1.0);
  col *= mask;

  // Вигнетка.
  float vig = pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), uVignette);
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function createWebglRenderer(display: HTMLCanvasElement, initial: CrtPreset): CrtRenderer | null {
  const gl = (display.getContext('webgl', { antialias: false, alpha: false, depth: false }) ||
    display.getContext('experimental-webgl', { antialias: false })) as WebGLRenderingContext | null;
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // Фуллскрин-квад (2 треугольника).
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const uTex = gl.getUniformLocation(prog, 'uTex');
  const uOut = gl.getUniformLocation(prog, 'uOut');
  const uCurve = gl.getUniformLocation(prog, 'uCurve');
  const uScan = gl.getUniformLocation(prog, 'uScan');
  const uVignette = gl.getUniformLocation(prog, 'uVignette');
  const uChroma = gl.getUniformLocation(prog, 'uChroma');
  const uMask = gl.getUniformLocation(prog, 'uMask');
  gl.uniform1i(uTex, 0);

  let params = PRESETS[initial];

  const applyParams = () => {
    gl.uniform1f(uCurve, params.curvature);
    gl.uniform1f(uScan, params.scanline);
    gl.uniform1f(uVignette, params.vignette);
    gl.uniform1f(uChroma, params.chroma);
    gl.uniform1f(uMask, params.mask);
  };
  applyParams();

  return {
    render(source) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(uOut, display.width, display.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    resize(cssW, cssH) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      display.width = Math.max(1, Math.round(cssW * dpr));
      display.height = Math.max(1, Math.round(cssH * dpr));
      gl.viewport(0, 0, display.width, display.height);
    },
    setPreset(preset) {
      params = PRESETS[preset];
      applyParams();
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    },
  };
}

// 2D-фолбэк: блит + сканлайны + вигнетка (без barrel-выпуклости).
function create2dRenderer(display: HTMLCanvasElement, initial: CrtPreset): CrtRenderer {
  const ctx = display.getContext('2d')!;
  let params = PRESETS[initial];

  return {
    render(source) {
      const w = display.width;
      const h = display.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(source, 0, 0, w, h);

      // Сканлайны.
      ctx.globalAlpha = params.scanline;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      ctx.globalAlpha = 1;

      // Вигнетка.
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.28 + params.vignette})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    resize(cssW, cssH) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      display.width = Math.max(1, Math.round(cssW * dpr));
      display.height = Math.max(1, Math.round(cssH * dpr));
    },
    setPreset(preset) {
      params = PRESETS[preset];
    },
    dispose() {},
  };
}

export function createCrtRenderer(display: HTMLCanvasElement, preset: CrtPreset): CrtRenderer {
  return createWebglRenderer(display, preset) ?? create2dRenderer(display, preset);
}
