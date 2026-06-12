// hero.js
// Animated black-and-white mural hero. The real Boulevard 301 building is an
// op-art mural of concentric black/white stripes; this renders it to a WebGL
// canvas and warps it with a slow flowing displacement field so the stripes
// move like liquid ink. The painted "Boulevard 301" wordmark on the wall is
// the hero title, so we keep the warp gentle enough to stay legible.
//
// Robustness: the static <picture> sits underneath. If WebGL is unavailable or
// the user prefers reduced motion, we never reveal the canvas and the static
// grayscale photo shows instead. The loop pauses when the hero scrolls out of
// view or the tab is hidden, and DPR is capped for mobile performance.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2  uRes;
uniform vec2  uImg;
uniform float uTime;
uniform float uAmp;    // how far the bands travel
uniform float uSpeed;  // racing speed (advection cycles / sec)
uniform float uZoom;   // <1 zooms out (reveals more of the mural)

// Ashima 2D simplex noise.
vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec2 mod289(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;                 // image upright (canvas origin is bottom-left)

  // object-fit: cover
  float ca = uRes.x / uRes.y;
  float ia = uImg.x / uImg.y;
  vec2 cuv = uv;
  if (ca > ia) { cuv.y = (uv.y - 0.5) * (ia / ca) + 0.5; }
  else         { cuv.x = (uv.x - 0.5) * (ca / ia) + 0.5; }

  // zoom out a touch: sample a larger region; anything past the photo edge
  // becomes the dark hero backdrop so it reads as a clean frame.
  cuv = (cuv - 0.5) / uZoom + 0.5;
  vec2 ib = step(vec2(0.0), cuv) * step(cuv, vec2(1.0));
  float inside = ib.x * ib.y;

  // Smooth, slowly-evolving direction field. The black and white RACE along
  // these curved paths (continuous one-way flow) instead of wobbling in place.
  float ang = snoise(cuv * 1.3 + vec2(0.0, uTime * 0.015)) * 3.14159265;
  vec2 dir  = vec2(cos(ang), sin(ang));

  // Flow-map advection: push the sampling along dir, cross-fading two
  // half-cycle-offset phases so the motion loops seamlessly = endless racing.
  vec2  flow = dir * uAmp;
  float t  = uTime * uSpeed;
  float p0 = fract(t);
  float p1 = fract(t + 0.5);
  float fl = abs(1.0 - 2.0 * p0);
  vec3 c0 = texture2D(uTex, clamp(cuv + flow * p0, 0.0, 1.0)).rgb;
  vec3 c1 = texture2D(uTex, clamp(cuv + flow * p1, 0.0, 1.0)).rgb;
  vec3 col = mix(c0, c1, fl);

  // crisp black-and-white
  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  gray = mix(gray, smoothstep(0.16, 0.84, gray), 0.5);

  vec3 bg = vec3(0.075, 0.065, 0.045);
  gl_FragColor = vec4(mix(bg, vec3(gray), inside), 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function initHero() {
  const canvas = document.getElementById('hero-canvas');
  const img = document.getElementById('hero-mural-src');
  if (!canvas || !img) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return; // static photo stays; no canvas
  }

  const boot = () => {
    let gl;
    try {
      const opts = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' };
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    } catch (e) { gl = null; }
    if (!gl) return; // no WebGL -> static photo stays

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    } catch (e) { return; }

    const uRes   = gl.getUniformLocation(prog, 'uRes');
    const uImg   = gl.getUniformLocation(prog, 'uImg');
    const uTime  = gl.getUniformLocation(prog, 'uTime');
    const uAmp   = gl.getUniformLocation(prog, 'uAmp');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');
    const uZoom  = gl.getUniformLocation(prog, 'uZoom');
    gl.uniform2f(uImg, img.naturalWidth || 1448, img.naturalHeight || 1086);
    gl.uniform1f(uAmp, 0.055);    // how far the bands race
    gl.uniform1f(uSpeed, 0.18);   // racing speed
    gl.uniform1f(uZoom, 0.9);     // zoom out a little

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      const w = canvas.clientWidth || canvas.parentElement.clientWidth;
      const h = canvas.clientHeight || canvas.parentElement.clientHeight;
      const pw = Math.max(1, Math.round(w * DPR));
      const ph = Math.max(1, Math.round(h * DPR));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw; canvas.height = ph;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // reveal the canvas over the identical static photo (no visible pop)
    canvas.classList.add('is-ready');

    let raf = 0, running = false, t0 = 0;
    function frame(now) {
      if (!running) return;
      if (!t0) t0 = now;
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!running) { running = true; t0 = 0; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else play();
    });

    const hero = canvas.closest('section') || canvas.parentElement;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach(e => { e.isIntersecting ? play() : stop(); });
      }, { threshold: 0.01 }).observe(hero);
    } else {
      play();
    }
  };

  if (img.complete && img.naturalWidth) boot();
  else {
    img.addEventListener('load', boot, { once: true });
    img.addEventListener('error', () => {}, { once: true });
  }
}

// Loaded as its own module (Boulevard's main.js is a classic script), so
// self-initialize once the DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHero);
} else {
  initHero();
}
