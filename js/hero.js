// hero.js
// Animated black-and-white mural hero. The real Boulevard 301 building is an
// op-art mural of concentric black/white stripes; this renders it to a WebGL
// canvas. The PHOTO never moves or distorts (an earlier warp looked seasick) --
// instead a luminous wave travels OUTWARD from the rings' focal point like
// sonar, brightening each ring in turn, so the black and white pulse outward
// while the mural and its painted "Boulevard 301" wordmark stay pin sharp.
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
uniform float uZoom;    // <1 zooms out (reveals more of the mural)
uniform vec2  uCenter;  // focal point of the concentric rings (image uv)
uniform float uFreq;    // how many pulse rings travel at once
uniform float uSpeed;   // outward pulse speed
uniform float uAmp;     // pulse strength (how much the rings brighten)

float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;                 // image upright (canvas origin is bottom-left)

  // object-fit: cover
  float ca = uRes.x / uRes.y;
  float ia = uImg.x / uImg.y;
  vec2 cuv = uv;
  if (ca > ia) { cuv.y = (uv.y - 0.5) * (ia / ca) + 0.5; }
  else         { cuv.x = (uv.x - 0.5) * (ca / ia) + 0.5; }

  // zoom out a touch; anything past the photo edge becomes the dark hero
  // backdrop so it reads as a clean frame.
  cuv = (cuv - 0.5) / uZoom + 0.5;
  vec2 ib = step(vec2(0.0), cuv) * step(cuv, vec2(1.0));
  float inside = ib.x * ib.y;

  // The PHOTO never moves or warps: sample at the fixed pixel, lightly blurred
  // only to keep the black/white crisp.
  float e = 1.1 / uImg.y;
  float b = lum(texture2D(uTex, cuv).rgb) * 0.5
          + lum(texture2D(uTex, cuv + vec2( e, 0.0)).rgb) * 0.125
          + lum(texture2D(uTex, cuv + vec2(-e, 0.0)).rgb) * 0.125
          + lum(texture2D(uTex, cuv + vec2(0.0,  e)).rgb) * 0.125
          + lum(texture2D(uTex, cuv + vec2(0.0, -e)).rgb) * 0.125;
  float bw = smoothstep(0.40, 0.60, b);          // crisp black & white

  // A luminous wave travels OUTWARD from the rings' focal point (sonar). It
  // only changes brightness, never position, so the mural stays pin sharp.
  vec2 p = cuv - uCenter; p.x *= uImg.x / uImg.y;   // aspect-correct radius
  float d = length(p);
  // a gentle luminous wave travels outward through the rings; symmetric so the
  // mural keeps its full black & white (crests stay white, troughs dim a touch)
  float wave = sin(d * uFreq - uTime * uSpeed);   // -1..1
  float lit  = clamp(bw * (1.0 + uAmp * wave), 0.0, 1.0);

  vec3 bg = vec3(0.075, 0.065, 0.045);
  gl_FragColor = vec4(mix(bg, vec3(lit), inside), 1.0);
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

    const uRes    = gl.getUniformLocation(prog, 'uRes');
    const uImg    = gl.getUniformLocation(prog, 'uImg');
    const uTime   = gl.getUniformLocation(prog, 'uTime');
    const uZoom   = gl.getUniformLocation(prog, 'uZoom');
    const uCenter = gl.getUniformLocation(prog, 'uCenter');
    const uFreq   = gl.getUniformLocation(prog, 'uFreq');
    const uSpeed  = gl.getUniformLocation(prog, 'uSpeed');
    const uAmp    = gl.getUniformLocation(prog, 'uAmp');
    gl.uniform2f(uImg, img.naturalWidth || 1448, img.naturalHeight || 1086);
    gl.uniform1f(uZoom, 0.9);            // zoom out a little
    gl.uniform2f(uCenter, 0.42, 0.42);   // focal point of the rings
    gl.uniform1f(uFreq, 17.0);           // how many pulse rings travel at once
    gl.uniform1f(uSpeed, 2.2);           // outward pulse speed
    gl.uniform1f(uAmp, 0.25);            // pulse strength

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
