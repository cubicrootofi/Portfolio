/* Hero field: isolines of a slowly drifting scalar field, read like a stress contour plot.
   The pointer applies a load: a smooth bump in the field that grows with pointer speed. */
(() => {
  const canvas = document.getElementById('field');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power',
  });
  if (!gl) { canvas.classList.add('is-fallback'); return; }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = !matchMedia('(hover: hover) and (pointer: fine)').matches;
  const readout = document.querySelector('[data-readout]');

  const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // 3D simplex noise: Ashima Arts / Stefan Gustavson, MIT licence.
  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uLoad;
uniform float uDpr;
out vec4 outColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  vec2 m = (uMouse - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.045 + 20.0;

  // domain-warped field
  vec2 q = p * 1.05;
  q += 0.30 * vec2(snoise(vec3(q * 0.65 + 3.1, t)), snoise(vec3(q * 0.65 - 1.7, t + 7.0)));
  float f = 0.55 * snoise(vec3(q * 0.8, t * 0.8)) + 0.14 * snoise(vec3(q * 2.1, t * 1.3));

  // the load
  vec2 dm = p - m;
  float r2 = dot(dm, dm);
  f += 0.9 * uLoad * exp(-r2 * 9.0);

  // isolines, every fifth one heavier (index contours)
  float v = f * 13.0;
  float fw = max(fwidth(v), 1e-4);
  float dist = abs(fract(v - 0.5) - 0.5) / fw;
  float k = floor(v + 0.5);
  float major = 1.0 - step(0.5, mod(k + 1000.0, 5.0));
  float halfw = 0.5 * uDpr * mix(0.7, 1.2, major);
  float line = 1.0 - smoothstep(halfw * 0.5, halfw + 0.75 * uDpr, dist);
  line *= 1.0 - smoothstep(0.35, 0.9, fw);

  float heat = clamp(uLoad * 1.4, 0.0, 1.0) * exp(-r2 * 11.0);
  float alpha = mix(0.08, 0.2, major);
  alpha = mix(alpha, 0.85, heat);

  vec2 uv = frag / uRes;
  float vig = smoothstep(1.3, 0.2, length(p * vec2(0.72, 1.0)));
  vig *= smoothstep(0.0, 0.3, uv.y);

  vec3 bg = vec3(0.039, 0.039, 0.043);
  vec3 ink = vec3(0.925, 0.914, 0.89);
  vec3 ember = vec3(1.0, 0.357, 0.18);
  vec3 lc = mix(ink, ember, smoothstep(0.08, 0.6, heat));
  vec3 col = bg + lc * line * alpha * vig + ember * heat * 0.03 * vig;
  outColor = vec4(col, 1.0);
}`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.classList.add('is-fallback'); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(prog));
    canvas.classList.add('is-fallback');
    return;
  }
  gl.useProgram(prog);

  // one oversized triangle covers the viewport
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const loc = name => gl.getUniformLocation(prog, name);
  const uRes = loc('uRes'), uTime = loc('uTime'), uMouse = loc('uMouse'), uLoad = loc('uLoad'), uDpr = loc('uDpr');

  let w = 1, h = 1, dpr = 1;
  let running = false, visible = true, raf = 0, lastT = 0, lastReadout = 0;
  const t0 = performance.now();

  // pointer state in CSS px, origin at the canvas' top-left
  const target = { x: 0, y: 0 }, pos = { x: 0, y: 0 }, last = { x: 0, y: 0 };
  let load = 0, speed = 0, inside = false, hasPointer = false, lastMove = 0;

  const draw = t => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, pos.x * dpr, (h - pos.y) * dpr);
    gl.uniform1f(uLoad, load);
    gl.uniform1f(uDpr, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const first = w === 1;
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w * h * dpr * dpr > 2.6e6) dpr = Math.sqrt(2.6e6 / (w * h)); // cap the fill cost on big screens
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (first) { target.x = pos.x = w * 0.66; target.y = pos.y = h * 0.42; }
    if (!running) draw(lastT);
  };

  const writeReadout = () => {
    if (!readout) return;
    const x = (pos.x / w).toFixed(3);
    const y = (1 - pos.y / h).toFixed(3);
    const P = (load * 48).toFixed(1).padStart(4, '0');
    readout.textContent = `x ${x} · y ${y} · P ${P} kN`;
  };

  const frame = now => {
    raf = 0;
    const t = (now - t0) / 1000;
    lastT = t;
    const auto = coarse || !hasPointer;
    if (auto) {
      // no mouse yet (or touch): the load wanders on its own
      target.x = w * (0.58 + 0.24 * Math.sin(t * 0.23));
      target.y = h * (0.42 + 0.16 * Math.cos(t * 0.31));
    }
    speed *= 0.9;
    const want = auto ? 0.32 : inside ? 0.2 + Math.min(speed * 0.45, 0.8) : 0;
    load += (want - load) * 0.045;
    pos.x += (target.x - pos.x) * 0.07;
    pos.y += (target.y - pos.y) * 0.07;
    draw(t);
    if (now - lastReadout > 90) { lastReadout = now; writeReadout(); }
    if (running) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
    if (!inside) return;
    const now = performance.now();
    const dt = Math.max(8, now - lastMove);
    if (hasPointer) speed = Math.max(speed, Math.hypot(x - last.x, y - last.y) / dt);
    hasPointer = true;
    last.x = x; last.y = y; lastMove = now;
    target.x = x; target.y = y;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { inside = false; });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible && !document.hidden ? start() : stop();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  window.addEventListener('resize', resize);

  resize();
  if (reduce) { load = 0.35; draw(12); writeReadout(); } else start();
})();
