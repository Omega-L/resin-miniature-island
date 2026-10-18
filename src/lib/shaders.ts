/* ------------------------------------------------------------------------- *
 *  Terrain shader
 * ------------------------------------------------------------------------- */

export const terrainVertexShader = /* glsl */ `
  attribute vec3 aColor;

  varying vec3 vColor;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec2 vLocal;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vColor = aColor;
    vLocal = position.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const terrainFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uDeepColor;
  uniform float uWaterY;
  uniform float uMaskHalf;
  uniform float uMaskRadius;
  uniform sampler2D uReflection;
  uniform mat4 uReflectMatrix;
  uniform float uReflectionStrength;

  varying vec3 vColor;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec2 vLocal;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(41.13, 289.7))) * 43758.5453);
  }

  // Soft, animated caustic dapples on the sea floor.

  float caustics(vec2 uv, float time) {
    vec2 p = uv * 1.35 + vec2(time * 0.1, -time * 0.08);
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 3; n++) {
      float t = time * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      vec2 denom = vec2(sin(i.x + t), cos(i.y + t)) / inten;
      denom += 0.004 * sign(denom + vec2(0.0001, 0.0001));
      vec2 q = p / denom;
      c += 1.0 / max(length(q), 0.0001);
    }
    c /= 3.0;
    c = 1.17 - pow(clamp(c, 0.0, 16.0), 1.4);
    return pow(clamp(abs(c), 0.0, 1.0), 6.0);
  }



  void main() {
    // clip the sea floor to the rounded resin footprint
    vec2 q = abs(vLocal) - vec2(uMaskHalf) + uMaskRadius;
    float sdf = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - uMaskRadius;
    if (sdf > 0.0) discard;

    vec3 N = normalize(vNormalW);
    vec3 L = normalize(uSunDir);
    float ndl = max(dot(N, L), 0.0);
    float wrap = clamp((dot(N, L) + 0.4) / 1.4, 0.0, 1.0);

    vec3 albedo = vColor;
    float grain = hash21(floor(vLocal * 90.0));
    albedo *= 0.93 + grain * 0.14;
    float strata = 0.5 + 0.5 * sin(vWorldPos.y * 11.0 + vWorldPos.x * 1.1 + vWorldPos.z * 0.7);
    float mottle = hash21(floor(vWorldPos.xz * 26.0) + floor(vWorldPos.y * 40.0));
    albedo *= 0.9 + 0.1 * strata + 0.08 * mottle;

    // fine rock grain + crevices on steep faces
    float slopeN = 1.0 - clamp(N.y, 0.0, 1.0);
    float rockGrain = hash21(floor(vWorldPos.xz * 72.0 + vWorldPos.y * 31.0));
    float crevice = smoothstep(0.55, 0.92, rockGrain) * smoothstep(0.22, 0.62, slopeN);
    albedo *= 1.0 - crevice * 0.3;

    // mossy streaks clinging to the cliff, only above the tide line
    float relY = vWorldPos.y - uWaterY;
    float mossNoise = hash21(floor(vWorldPos.xz * 18.0 + vWorldPos.y * 40.0) + 3.7);
    float mossy = smoothstep(0.42, 0.8, mossNoise) * smoothstep(0.12, 0.5, relY) * smoothstep(0.25, 0.6, slopeN);
    albedo = mix(albedo, vec3(0.06, 0.1, 0.045), mossy * 0.5);

    vec3 lit = albedo * (uSunColor * (wrap * 1.15 + 0.12) + uSkyColor * (0.36 + 0.22 * max(N.y, 0.0)));

    float depth = max(uWaterY - vWorldPos.y, 0.0);
    float under = smoothstep(0.0, 1.1, depth);

    // underwater absorption → cool tint
    vec3 tinted = lit * uDeepColor * 1.05;
    lit = mix(lit, tinted, under * 0.82);

    // caustic lace on the sand and submerged rock (skip dry land)
    if (depth > 0.03 && N.y > 0.2) {
      float caus = caustics(vWorldPos.xz * 2.4, uTime * 0.42);
      float causMask =
        smoothstep(0.02, 0.3, depth) *
        (1.0 - smoothstep(1.6, 2.6, depth)) *
        smoothstep(0.25, 0.9, N.y);
      lit += caus * causMask * vec3(0.65, 1.0, 0.95) * 0.38;
    }

    // wet sheen just at the waterline
    float wet = 1.0 - smoothstep(0.0, 0.06, abs(vWorldPos.y - uWaterY));
    lit += wet * 0.04 * vec3(0.8, 0.95, 1.0);

    gl_FragColor = vec4(clamp(lit, 0.0, 16.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/* ------------------------------------------------------------------------- *
 *  Water surface shader
 * ------------------------------------------------------------------------- */

export const waterVertexShader = /* glsl */ `
  uniform sampler2D uSim;
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uRippleHeight;
  uniform float uSimTexel;
  uniform float uSimResolution;
  uniform vec2 uJelly;
  uniform float uJellyAmount;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying vec2 vLocal;
  varying float vWave;

  float ambientWaves(vec2 p, float t) {
    float h = 0.0;
    h += sin(dot(p, vec2(0.82, 0.57)) * 3.05 + t * 1.05);
    h += sin(dot(p, vec2(-0.45, 0.89)) * 4.35 + t * 1.34) * 0.55;
    h += sin(dot(p, vec2(0.36, -0.93)) * 6.10 + t * 1.78) * 0.30;
    h += sin(dot(p, vec2(-0.88, -0.47)) * 8.70 + t * 2.31) * 0.14;
    return h / 1.99;
  }

  void main() {
    vLocal = position.xz;
    vUv = vec2(position.x / 10.0 + 0.5, position.z / 10.0 + 0.5);

    float sC = texture2D(uSim, vUv).r;
    float sX = texture2D(uSim, vUv + vec2(uSimTexel, 0.0)).r;
    float sZ = texture2D(uSim, vUv + vec2(0.0, uSimTexel)).r;

    float amp = uWaveHeight * 0.105;

    float hC = ambientWaves(position.xz, uTime);
    float hX = ambientWaves(position.xz + vec2(0.14, 0.0), uTime);
    float hZ = ambientWaves(position.xz + vec2(0.0, 0.14), uTime);

    vec3 p = position;
    float simH = clamp(sC, -0.45, 0.45) * uRippleHeight;
    p.y += simH + hC * amp;

    // Jelly swell: only the water surface moves; zero displacement at the rim.
    float jx = position.x / 5.0;
    float jz = position.z / 5.0;
    float jellyMask = (1.0 - jx * jx) * (1.0 - jz * jz);
    float jelly = (jx * uJelly.x + jz * uJelly.y) * uJellyAmount * jellyMask;
    p.y += jelly;
    vWave = hC;

    // gradient from the ambient swell + GPU height field + fine wind chop
    vec2 grad = vec2((hX - hC) / 0.14, (hZ - hC) / 0.14) * amp;
    float simScale = uRippleHeight * uSimResolution / 22.0;
    grad += vec2(sX - sC, sZ - sC) * simScale;
    grad += vec2(uJelly.x, uJelly.y) * (uJellyAmount / 5.0) * jellyMask;

    vec2 q = position.xz;
    float chopX =
      cos(q.x * 22.0 + uTime * 3.1) * 0.042 +
      cos(q.x * 37.0 - q.y * 11.0 + uTime * 4.7) * 0.024;
    float chopZ =
      cos(q.y * 26.0 - uTime * 2.7) * 0.042 +
      cos(q.y * 41.0 + q.x * 13.0 - uTime * 4.2) * 0.024;
    grad += vec2(chopX, chopZ) * (0.35 + uWaveHeight * 0.8);

    vNormalW = normalize(vec3(-grad.x, 1.0, -grad.y));
    vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
  }
`

export const waterFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTerrain;
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;
  uniform float uWaterY;
  uniform float uHeightMin;
  uniform float uHeightMax;
  uniform float uMaskHalf;
  uniform float uMaskRadius;
  uniform float uWaveHeight;
  uniform sampler2D uReflection;
  uniform mat4 uReflectMatrix;
  uniform float uReflectionStrength;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying vec2 vLocal;
  varying float vWave;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm2q(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += vnoise(p) * a;
      p = p * 2.03 + vec2(7.1, 3.3);
      a *= 0.5;
    }
    return v;
  }

  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    float sdf = sdRoundedBox(vLocal, vec2(uMaskHalf), uMaskRadius);
    if (sdf > 0.0) discard;
    float edge = 1.0 - smoothstep(-0.1, 0.0, sdf);

    // depth below this waterline, from the baked terrain height map
    float hEnc = texture2D(uTerrain, vUv).r;
    float terrainY = mix(uHeightMin, uHeightMax, hEnc);
    float depth = max(uWaterY - terrainY, 0.0);
    float depthN = clamp(depth / 3.0, 0.0, 1.0);

    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 4.0);

    // turquoise shallows → deep teal
    vec3 col = mix(uShallow, mix(uShallow, uDeep, 0.55), smoothstep(0.03, 0.45, depthN));
    col = mix(col, uDeep, smoothstep(0.45, 0.95, depthN));
    col += uShallow * 0.22 * (1.0 - smoothstep(0.0, 0.25, depthN));

    // studio sky reflection
    vec3 R = reflect(-V, N);
    vec3 sky = mix(vec3(0.97, 0.94, 0.88), vec3(0.68, 0.82, 0.9), smoothstep(-0.4, 0.7, R.y));
    col = mix(col, sky, fres * 0.3);

    // real planar reflection of the island
    vec4 reflectClip = uReflectMatrix * vec4(vWorldPos, 1.0);
    vec2 reflectUv = reflectClip.xy / max(reflectClip.w, 0.0001) * 0.5 + 0.5;
    reflectUv += N.xz * 0.035;
    float inside =
      step(0.0, reflectClip.w) *
      step(0.0, reflectUv.x) * step(reflectUv.x, 1.0) *
      step(0.0, reflectUv.y) * step(reflectUv.y, 1.0);
    vec3 reflectionCol = texture2D(uReflection, clamp(reflectUv, 0.002, 0.998)).rgb;
    float reflLum = dot(reflectionCol, vec3(0.299, 0.587, 0.114));
    float objectMask = smoothstep(0.62, 0.22, reflLum);
    col = mix(
      col,
      reflectionCol,
      clamp((0.03 + fres * 0.85) * inside * objectMask * uReflectionStrength, 0.0, 0.9)
    );

    // sun glints + glitter
    vec3 L = normalize(uSunDir);
    vec3 H = normalize(V + L);
    float ndh = max(dot(N, H), 0.0);
    float sparkle = fbm2q(vWorldPos.xz * 20.0 + vec2(uTime * 0.3, -uTime * 0.2));
    float spec = pow(ndh, 260.0) * 1.3 + pow(ndh, 1200.0) * 7.0;
    col += spec * (0.45 + 0.55 * sparkle) * vec3(1.0, 0.96, 0.88);

    // shoreline foam
    float fn = fbm2q(vLocal * 4.6 + vec2(uTime * 0.05, -uTime * 0.04));
    float fn2 = fbm2q(vLocal * 13.0 - vec2(uTime * 0.08, uTime * 0.06));
    float shore = 1.0 - smoothstep(0.0, 0.24, depth);
    float bands = smoothstep(0.5, 0.95, sin(depth * 55.0 - uTime * 2.0) * 0.5 + 0.5);
    float lace = smoothstep(0.45, 0.8, fn * 0.6 + fn2 * 0.4);
    float foam = shore * mix(0.15, 1.0, lace) * (0.55 + 0.45 * bands);
    foam += smoothstep(0.74, 1.0, vWave * 0.5 + 0.5) * 0.08 * smoothstep(0.4, 0.9, fn);
    foam = clamp(foam, 0.0, 1.0);
    col = mix(col, uFoam, foam * 0.7);

    float alpha = mix(0.52, 0.84, smoothstep(0.0, 2.1, depth));
    alpha = max(alpha, fres * 0.42);
    alpha = clamp(alpha + foam * 0.25, 0.0, 0.96) * edge;

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/* ------------------------------------------------------------------------- *
 *  GPU height field (ping-pong wave equation)
 * ------------------------------------------------------------------------- */

export const waterSimVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const waterSimFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uState;
  uniform vec2 uTexel;
  uniform vec2 uMouse;
  uniform vec2 uMouseVel;
  uniform float uImpulse;
  uniform float uPropagation;
  uniform float uDamping;
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    vec4 state = texture2D(uState, vUv);
    float h = state.r;
    float hPrev = state.g;

    float l = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
    float r = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
    float d = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
    float u = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;

    float laplace = (l + r + d + u) - 4.0 * h;
    float next = (2.0 * h - hPrev) + uPropagation * laplace;
    next *= uDamping;

    // absorb energy at the resin walls
    vec2 e = smoothstep(vec2(0.0), vec2(0.05), vUv) * smoothstep(vec2(0.0), vec2(0.05), 1.0 - vUv);
    next *= mix(0.9, 1.0, e.x * e.y);

    // brush trail
    vec2 dp = vUv - uMouse;
    float brush = exp(-dot(dp, dp) / 0.0018);
    next -= uImpulse * brush;

    vec2 trail = dp - uMouseVel * 7.0;
    float wake = exp(-dot(trail, trail) / 0.0048);
    next += uImpulse * 0.5 * wake;

    // faint organic motion so the surface never looks frozen
    next += 0.00004 * sin(vUv.x * 24.0 + uTime * 0.8) * sin(vUv.y * 19.0 - uTime * 0.6);

    gl_FragColor = vec4(next, h, 0.0, 1.0);
  }
`
