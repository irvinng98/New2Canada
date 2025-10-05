/**
 * =================================================================
 * BACKGROUND-EFFECTS.JS
 * Unified script to handle both Iridescence (OGL) and Hyperspeed (Three.js) backgrounds
 * based on the 'data-effect' attribute in the HTML.
 *
 * NOTE: This script assumes the necessary libraries (THREE, POSTPROCESSING, ogl)
 * are loaded via CDN links in the respective HTML files.
 * =================================================================
 */

// =================================================================
// 1. GLOBAL HELPER FUNCTIONS
// =================================================================

function parseData(element, key, defaultValue) {
    const value = element.getAttribute(key);
    if (value === null) return defaultValue;

    try {
        if (key.includes('speed') || key.includes('amplitude') || key.includes('length') || key.includes('road-width') || key.includes('width') || key.includes('lines') || key.includes('fov')) {
            return parseFloat(value);
        }
        if (key.includes('color') || key.includes('cars') || key.includes('lines') || key.includes('sticks')) {
            // Handle hex strings (Three.js) or array strings (OGL)
            if (value.startsWith('[') || value.startsWith('{')) return JSON.parse(value);
            return value;
        }
        if (key.includes('mouse-react')) {
            return value.toLowerCase() === 'true';
        }
        return JSON.parse(value);
    } catch {
        // If JSON fails, return the raw value or default
        return value || defaultValue;
    }
}

function resizeRendererToDisplaySize(renderer, setSize) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        setSize(width, height, false);
    }
    return needResize;
}

function lerp(current, target, speed = 0.1, limit = 0.001) {
    let change = (target - current) * speed;
    if (Math.abs(change) < limit) {
        change = target - current;
    }
    return change;
}

// =================================================================
// 2. IRIDESCENCE EFFECT (OGL Translation)
// =================================================================

const iridescenceVertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const iridescenceFragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  // Add mouse reaction to distortion
  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

class IridescenceEffect {
    constructor(container, options) {
        this.container = container;
        this.options = options;
        this.mousePos = { x: 0.5, y: 0.5 };
        this.animateId = null;

        // Check for OGL library availability
        if (typeof ogl === 'undefined' || !ogl.Renderer) {
            console.error('OGL library not loaded. Cannot run Iridescence effect.');
            return;
        }

        this.init();
        this.setupListeners();
        this.resize();
        this.update(0);
    }

    init() {
        const { Renderer, Program, Mesh, Color, Triangle } = ogl;

        this.renderer = new Renderer();
        const gl = this.renderer.gl;
        this.gl = gl;
        gl.clearColor(0, 0, 0, 0);

        gl.canvas.style.position = 'absolute';
        gl.canvas.style.top = '0';
        gl.canvas.style.left = '0';
        gl.canvas.style.width = '100%';
        gl.canvas.style.height = '100%';
        gl.canvas.style.pointerEvents = 'none';

        this.container.appendChild(gl.canvas);

        const colorVec = this.options.color;
        const colorVal = new Color(colorVec[0], colorVec[1], colorVec[2]);

        this.geometry = new Triangle(gl);
        this.program = new Program(gl, {
            vertex: iridescenceVertexShader,
            fragment: iridescenceFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: colorVal },
                uResolution: { value: new Color(1, 1, 1) },
                uMouse: { value: new Float32Array([this.mousePos.x, this.mousePos.y]) },
                uAmplitude: { value: this.options.amplitude },
                uSpeed: { value: this.options.speed }
            }
        });

        this.mesh = new Mesh(gl, { geometry: this.geometry, program: this.program });
    }

    setupListeners() {
        if (this.options.mouseReact) {
            this.onPointerMove = (e) => {
                const rect = this.container.getBoundingClientRect();
                const x = (e.clientX - rect.left) / Math.max(rect.width, 1);
                const y = 1.0 - (e.clientY - rect.top) / Math.max(rect.height, 1); // Flip Y for OGL convention
                this.mousePos = { x, y };
                this.program.uniforms.uMouse.value[0] = x;
                this.program.uniforms.uMouse.value[1] = y;
            };
            this.container.addEventListener('pointermove', this.onPointerMove, { passive: true });
        }

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
    }

    resize() {
        const w = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        this.renderer.setSize(w, h);

        const gl = this.renderer.gl;
        if (this.program) {
            this.program.uniforms.uResolution.value = new ogl.Color(
                gl.canvas.width,
                gl.canvas.height,
                gl.canvas.width / gl.canvas.height
            );
        }
    }

    update(now) {
        this.animateId = requestAnimationFrame(this.update.bind(this));
        if (this.program) {
            this.program.uniforms.uTime.value = now * 0.001;
            this.renderer.render({ scene: this.mesh });
        }
    }
}


// =================================================================
// 3. HYPERSPEED EFFECT (Three.js Translation)
// =================================================================

// Three.js specific helper functions
function nsin(val) { return Math.sin(val) * 0.5 + 0.5; }
function random(base) {
    if (Array.isArray(base)) return Math.random() * (base[1] - base[0]) + base[0];
    return Math.random() * base;
}
function pickRandom(arr) {
    if (Array.isArray(arr)) return arr[Math.floor(Math.random() * arr.length)];
    return arr;
}
function hexToColor(hex) {
    if (typeof hex === 'string') {
        if (hex.startsWith('0x')) {
            hex = parseInt(hex.slice(2), 16);
        } else if (hex.startsWith('#')) {
            hex = parseInt(hex.slice(1), 16);
        }
    }
    return new THREE.Color(hex);
}

// Default options (based on your Hyperspeed code)
const defaultHyperspeedOptions = {
    length: 400,
    roadWidth: 10,
    islandWidth: 2,
    lanesPerRoad: 4,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2,
    carLightsFade: 0.4,
    totalSideLightSticks: 20,
    lightPairsPerRoadWay: 40,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5],
    lightStickHeight: [1.3, 1.7],
    movingAwaySpeed: [60, 80],
    movingCloserSpeed: [-120, -160],
    carLightsLength: [400 * 0.03, 400 * 0.2],
    carLightsRadius: [0.05, 0.14],
    carWidthPercentage: [0.3, 0.5],
    carShiftX: [-0.8, 0.8],
    carFloorSeparation: [0, 5],
    distortion: 'turbulentDistortion', // Default distortion name
    colors: {
        roadColor: '0x080808',
        islandColor: '0x0a0a0a',
        background: '0x000000',
        shoulderLines: '0xFFFFFF',
        brokenLines: '0xFFFFFF',
        leftCars: ['0xD856BF', '0x6750A2', '0xC247AC'],
        rightCars: ['0x03B3C3', '0x0E5EA5', '0x324555'],
        sticks: '0x03B3C3',
    }
};


// Distortion definitions (GLSL and JS components)
const turbulentUniforms = {
    uFreq: { value: new THREE.Vector4(4, 8, 8, 1) },
    uAmp: { value: new THREE.Vector4(25, 5, 10, 10) }
};
const distortions = {
    turbulentDistortion: {
        uniforms: turbulentUniforms,
        getDistortion: `
          uniform vec4 uFreq;
          uniform vec4 uAmp;
          float nsin(float val){
            return sin(val) * 0.5 + 0.5;
          }
          #define PI 3.14159265358979
          float getDistortionX(float progress){
            return (
              cos(PI * progress * uFreq.r + uTime) * uAmp.r +
              pow(cos(PI * progress * uFreq.g + uTime * (uFreq.g / uFreq.r)), 2. ) * uAmp.g
            );
          }
          float getDistortionY(float progress){
            return (
              -nsin(PI * progress * uFreq.b + uTime) * uAmp.b +
              -pow(nsin(PI * progress * uFreq.a + uTime / (uFreq.b / uFreq.a)), 5.) * uAmp.a
            );
          }
          vec3 getDistortion(float progress){
            return vec3(
              getDistortionX(progress) - getDistortionX(0.0125),
              getDistortionY(progress) - getDistortionY(0.0125),
              0.
            );
          }
        `,
        getJS: (progress, time) => {
            const uFreq = turbulentUniforms.uFreq.value;
            const uAmp = turbulentUniforms.uAmp.value;

            const getX = p =>
                Math.cos(Math.PI * p * uFreq.x + time) * uAmp.x +
                Math.pow(Math.cos(Math.PI * p * uFreq.y + time * (uFreq.y / uFreq.x)), 2) * uAmp.y;

            const getY = p =>
                -nsin(Math.PI * p * uFreq.z + time) * uAmp.z -
                Math.pow(nsin(Math.PI * p * uFreq.w + time / (uFreq.z / uFreq.w)), 5) * uAmp.w;

            let distortion = new THREE.Vector3(
                getX(progress) - getX(progress + 0.007),
                getY(progress) - getY(progress + 0.007),
                0
            );
            let lookAtAmp = new THREE.Vector3(-2, -5, 0);
            let lookAtOffset = new THREE.Vector3(0, 0, -10);
            return distortion.multiply(lookAtAmp).add(lookAtOffset);
        }
    },
};

// Shader code for Car Lights
const carLightsFragment = `
    #define USE_FOG;
    ${THREE.ShaderChunk['fog_pars_fragment']}
    varying vec3 vColor;
    varying vec2 vUv;
    uniform vec2 uFade;
    void main() {
      vec3 color = vec3(vColor);
      float alpha = smoothstep(uFade.x, uFade.y, vUv.x);
      gl_FragColor = vec4(color, alpha);
      if (gl_FragColor.a < 0.0001) discard;
      ${THREE.ShaderChunk['fog_fragment']}
    }
`;
const carLightsVertex = `
    #define USE_FOG;
    ${THREE.ShaderChunk['fog_pars_vertex']}
    attribute vec3 aOffset;
    attribute vec3 aMetrics;
    attribute vec3 aColor;
    uniform float uTravelLength;
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vColor;
    #include <getDistortion_vertex>
    void main() {
      vec3 transformed = position.xyz;
      float radius = aMetrics.r;
      float myLength = aMetrics.g;
      float speed = aMetrics.b;

      transformed.xy *= radius;
      transformed.z *= myLength;

      transformed.z += myLength - mod(uTime * speed + aOffset.z, uTravelLength);
      transformed.xy += aOffset.xy;

      float progress = abs(transformed.z / uTravelLength);
      transformed.xyz += getDistortion(progress);

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
      gl_Position = projectionMatrix * mvPosition;
      vUv = uv;
      vColor = aColor;
      ${THREE.ShaderChunk['fog_vertex']}
    }
`;

// Shader code for Road/Island
const roadMarkings_vars = `
    uniform float uLanes;
    uniform vec3 uBrokenLinesColor;
    uniform vec3 uShoulderLinesColor;
    uniform float uShoulderLinesWidthPercentage;
    uniform float uBrokenLinesWidthPercentage;
    uniform float uBrokenLinesLengthPercentage;
    highp float random(vec2 co) {
      highp float a = 12.9898;
      highp float b = 78.233;
      highp float c = 43758.5453;
      highp float dt = dot(co.xy, vec2(a, b));
      highp float sn = mod(dt, 3.14);
      return fract(sin(sn) * c);
    }
`;
const roadMarkings_fragment = `
    vec2 uv = vUv;
    uv.y = mod(uv.y + uTime * 0.05, 1.);
    float laneWidth = 1.0 / uLanes;
    float brokenLineWidth = laneWidth * uBrokenLinesWidthPercentage;
    float laneEmptySpace = 1. - uBrokenLinesLengthPercentage;

    float brokenLines = step(1.0 - brokenLineWidth, fract(uv.x * 2.0)) * step(laneEmptySpace, fract(uv.y * 10.0));
    float sideLines = step(1.0 - brokenLineWidth, fract((uv.x - laneWidth * (uLanes - 1.0)) * 2.0)) + step(brokenLineWidth, uv.x);

    brokenLines = mix(brokenLines, sideLines, uv.x);
    // Mix lines with the road color
    color = mix(uColor, uBrokenLinesColor, brokenLines);
`;

const roadBaseFragment = `
    #define USE_FOG;
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uTime;
    #include <roadMarkings_vars>
    ${THREE.ShaderChunk['fog_pars_fragment']}
    void main() {
      vec3 color = vec3(uColor);
      #include <roadMarkings_fragment>
      gl_FragColor = vec4(color, 1.);
      ${THREE.ShaderChunk['fog_fragment']}
    }
`;
const islandFragment = roadBaseFragment
    .replace('#include <roadMarkings_fragment>', '')
    .replace('#include <roadMarkings_vars>', '');
const roadFragment = roadBaseFragment
    .replace('#include <roadMarkings_fragment>', roadMarkings_fragment)
    .replace('#include <roadMarkings_vars>', roadMarkings_vars);
const roadVertex = `
    #define USE_FOG;
    uniform float uTime;
    ${THREE.ShaderChunk['fog_pars_vertex']}
    uniform float uTravelLength;
    varying vec2 vUv;
    #include <getDistortion_vertex>
    void main() {
      vec3 transformed = position.xyz;
      vec3 distortion = getDistortion((transformed.y + uTravelLength / 2.) / uTravelLength);
      transformed.x += distortion.x;
      transformed.z += distortion.y;
      transformed.y += -1. * distortion.z;

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
      gl_Position = projectionMatrix * mvPosition;
      vUv = uv;
      ${THREE.ShaderChunk['fog_vertex']}
    }
`;


// Shader code for Side Sticks
const sideSticksVertex = `
    #define USE_FOG;
    ${THREE.ShaderChunk['fog_pars_vertex']}
    attribute float aOffset;
    attribute vec3 aColor;
    attribute vec2 aMetrics;
    uniform float uTravelLength;
    uniform float uTime;
    varying vec3 vColor;
    mat4 rotationY( in float angle ) {
      return mat4(   cos(angle),    0,      sin(angle),    0,
                    0,      1.0,           0,    0,
                  -sin(angle),    0,      cos(angle),    0,
                  0,        0,           0,    1);
    }
    #include <getDistortion_vertex>
    void main(){
      vec3 transformed = position.xyz;
      float width = aMetrics.x;
      float height = aMetrics.y;

      transformed.xy *= vec2(width, height);
      float time = mod(uTime * 60. * 2. + aOffset, uTravelLength);

      transformed = (rotationY(3.14/2.) * vec4(transformed,1.)).xyz;

      transformed.z += - uTravelLength + time;

      float progress = abs(transformed.z / uTravelLength);
      transformed.xyz += getDistortion(progress);

      transformed.y += height / 2.;
      transformed.x += -width / 2.;
      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
      gl_Position = projectionMatrix * mvPosition;
      vColor = aColor;
      ${THREE.ShaderChunk['fog_vertex']}
    }
`;

const sideSticksFragment = `
    #define USE_FOG;
    ${THREE.ShaderChunk['fog_pars_fragment']}
    varying vec3 vColor;
    void main(){
      vec3 color = vec3(vColor);
      gl_FragColor = vec4(color,1.);
      ${THREE.ShaderChunk['fog_fragment']}
    }
`;


class CarLights {
    constructor(webgl, options, colors, speed, fade) {
        this.webgl = webgl;
        this.options = options;
        this.colors = colors;
        this.speed = speed;
        this.fade = fade;
    }

    init() {
        const options = this.options;
        let curve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
        let geometry = new THREE.TubeGeometry(curve, 40, 1, 8, false);

        let instanced = new THREE.InstancedBufferGeometry().copy(geometry);
        instanced.instanceCount = options.lightPairsPerRoadWay * 2;

        let laneWidth = options.roadWidth / options.lanesPerRoad;

        let aOffset = [];
        let aMetrics = [];
        let aColor = [];

        let colors = Array.isArray(this.colors) ? this.colors.map(hexToColor) : [hexToColor(this.colors)];

        for (let i = 0; i < options.lightPairsPerRoadWay; i++) {
            let radius = random(options.carLightsRadius);
            let length = random(options.carLightsLength);
            let speed = random(this.speed);

            let carLane = i % options.lanesPerRoad;
            let laneX = carLane * laneWidth - options.roadWidth / 2 + laneWidth / 2;

            let carWidth = random(options.carWidthPercentage) * laneWidth;
            let carShiftX = random(options.carShiftX) * laneWidth;
            laneX += carShiftX;

            let offsetY = random(options.carFloorSeparation) + radius * 1.3;

            let offsetZ = -random(options.length);

            // Left light
            aOffset.push(laneX - carWidth / 2);
            aOffset.push(offsetY);
            aOffset.push(offsetZ);

            // Right light
            aOffset.push(laneX + carWidth / 2);
            aOffset.push(offsetY);
            aOffset.push(offsetZ);

            // Metrics for both lights
            aMetrics.push(radius, length, speed);
            aMetrics.push(radius, length, speed);

            // Color for both lights (instance pair)
            let color = pickRandom(colors);
            aColor.push(color.r, color.g, color.b);
            aColor.push(color.r, color.g, color.b);
        }

        instanced.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 3, false));
        instanced.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 3, false));
        instanced.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));

        let material = new THREE.ShaderMaterial({
            fragmentShader: carLightsFragment,
            vertexShader: carLightsVertex,
            transparent: true,
            uniforms: Object.assign(
                {
                    uTime: { value: 0 },
                    uTravelLength: { value: options.length },
                    uFade: { value: this.fade }
                },
                this.webgl.fogUniforms,
                options.distortion.uniforms
            )
        });

        material.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <getDistortion_vertex>',
                options.distortion.getDistortion
            );
        };

        let mesh = new THREE.Mesh(instanced, material);
        mesh.frustumCulled = false;
        this.webgl.scene.add(mesh);
        this.mesh = mesh;
    }

    update(time) {
        this.mesh.material.uniforms.uTime.value = time;
    }
}

class LightsSticks {
    constructor(webgl, options) {
        this.webgl = webgl;
        this.options = options;
    }

    init() {
        const options = this.options;
        const geometry = new THREE.PlaneGeometry(1, 1);
        let instanced = new THREE.InstancedBufferGeometry().copy(geometry);
        let totalSticks = options.totalSideLightSticks;
        instanced.instanceCount = totalSticks;

        let stickoffset = options.length / (totalSticks - 1);
        const aOffset = [];
        const aColor = [];
        const aMetrics = [];

        let colors = Array.isArray(options.colors.sticks) ? options.colors.sticks.map(hexToColor) : [hexToColor(options.colors.sticks)];

        for (let i = 0; i < totalSticks; i++) {
            let width = random(options.lightStickWidth);
            let height = random(options.lightStickHeight);
            aOffset.push((i - 1) * stickoffset * 2 + stickoffset * Math.random());

            let color = pickRandom(colors);
            aColor.push(color.r, color.g, color.b);

            aMetrics.push(width, height);
        }

        instanced.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 1, false));
        instanced.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));
        instanced.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 2, false));

        const material = new THREE.ShaderMaterial({
            fragmentShader: sideSticksFragment,
            vertexShader: sideSticksVertex,
            side: THREE.DoubleSide,
            uniforms: Object.assign(
                {
                    uTravelLength: { value: options.length },
                    uTime: { value: 0 }
                },
                this.webgl.fogUniforms,
                options.distortion.uniforms
            )
        });

        material.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <getDistortion_vertex>',
                options.distortion.getDistortion
            );
        };

        const mesh = new THREE.Mesh(instanced, material);
        mesh.frustumCulled = false;
        this.webgl.scene.add(mesh);
        this.mesh = mesh;
    }

    update(time) {
        this.mesh.material.uniforms.uTime.value = time;
    }
}

class Road {
    constructor(webgl, options) {
        this.webgl = webgl;
        this.options = options;
        this.uTime = { value: 0 };
    }

    createPlane(side, width, isRoad) {
        const options = this.options;
        let segments = 100;
        const geometry = new THREE.PlaneGeometry(
            isRoad ? options.roadWidth : options.islandWidth,
            options.length,
            20,
            segments
        );
        let uniforms = {
            uTravelLength: { value: options.length },
            uColor: { value: hexToColor(isRoad ? options.colors.roadColor : options.colors.islandColor) },
            uTime: this.uTime
        };

        if (isRoad) {
            uniforms = Object.assign(uniforms, {
                uLanes: { value: options.lanesPerRoad },
                uBrokenLinesColor: { value: hexToColor(options.colors.brokenLines) },
                uShoulderLinesColor: { value: hexToColor(options.colors.shoulderLines) },
                uShoulderLinesWidthPercentage: { value: options.shoulderLinesWidthPercentage },
                uBrokenLinesLengthPercentage: { value: options.brokenLinesLengthPercentage },
                uBrokenLinesWidthPercentage: { value: options.brokenLinesWidthPercentage }
            });
        }

        const material = new THREE.ShaderMaterial({
            fragmentShader: isRoad ? roadFragment : islandFragment,
            vertexShader: roadVertex,
            side: THREE.DoubleSide,
            uniforms: Object.assign(uniforms, this.webgl.fogUniforms, options.distortion.uniforms)
        });

        material.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <getDistortion_vertex>',
                options.distortion.getDistortion
            );
        };

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.z = -options.length / 2;
        mesh.position.x += (this.options.islandWidth / 2 + options.roadWidth / 2) * side;
        this.webgl.scene.add(mesh);

        return mesh;
    }

    init() {
        this.leftRoadWay = this.createPlane(-1, this.options.roadWidth, true);
        this.rightRoadWay = this.createPlane(1, this.options.roadWidth, true);
        this.island = this.createPlane(0, this.options.islandWidth, false);
    }

    update(time) {
        this.uTime.value = time;
    }
}


class HyperspeedApp {
    constructor(container, options = {}) {
        if (typeof THREE === 'undefined' || typeof POSTPROCESSING === 'undefined') {
             console.error('Three.js or Postprocessing libraries not loaded. Cannot run Hyperspeed effect.');
             return;
        }

        // Merge data attributes with defaults
        const mergedOptions = { ...defaultHyperspeedOptions, ...options };
        mergedOptions.colors = { ...defaultHyperspeedOptions.colors, ...options.colors };

        // Select the correct distortion implementation
        const distortionKey = mergedOptions.distortion || defaultHyperspeedOptions.distortion;
        this.options = {
            ...mergedOptions,
            distortion: distortions[distortionKey] || distortions[defaultHyperspeedOptions.distortion]
        };

        const { WebGLRenderer, PerspectiveCamera, Scene, Fog, Clock, Vector3, Vector2 } = THREE;
        const { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset } = POSTPROCESSING;

        this.container = container;
        this.renderer = new WebGLRenderer({
            antialias: false,
            alpha: true
        });
        this.renderer.setSize(container.offsetWidth, container.offsetHeight, false);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Append canvas before composer setup
        container.append(this.renderer.domElement);
        
        this.composer = new EffectComposer(this.renderer);


        this.camera = new PerspectiveCamera(
            this.options.fov,
            container.offsetWidth / container.offsetHeight,
            0.1,
            10000
        );
        this.camera.position.z = -5;
        this.camera.position.y = 8;
        this.camera.position.x = 0;
        this.scene = new Scene();
        this.scene.background = null;
        
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';

        let fogColor = hexToColor(this.options.colors.background);
        let fog = new Fog(fogColor, this.options.length * 0.2, this.options.length * 500);
        this.scene.fog = fog;
        this.fogUniforms = {
            fogColor: { value: fog.color },
            fogNear: { value: fog.near },
            fogFar: { value: fog.far }
        };
        this.clock = new Clock();
        this.disposed = false;

        this.road = new Road(this, this.options);
        this.leftCarLights = new CarLights(
            this,
            this.options,
            this.options.colors.leftCars,
            this.options.movingAwaySpeed,
            new THREE.Vector2(0, 1 - this.options.carLightsFade)
        );
        this.rightCarLights = new CarLights(
            this,
            this.options,
            this.options.colors.rightCars,
            this.options.movingCloserSpeed,
            new THREE.Vector2(1, 0 + this.options.carLightsFade)
        );
        this.leftSticks = new LightsSticks(this, this.options);

        this.fovTarget = this.options.fov;
        this.speedUpTarget = 0;
        this.speedUp = 0;
        this.timeOffset = 0;

        this.tick = this.tick.bind(this);
        this.initSceneObjects = this.initSceneObjects.bind(this);
        this.setSize = this.setSize.bind(this);
        
        this.setupListeners();

        // Start initialization
        this.initPasses();
        this.initSceneObjects();
        this.tick();
    }

    setupListeners() {
        this.onWindowResize = () => {
            const width = this.container.offsetWidth;
            const height = this.container.offsetHeight;

            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.composer.setSize(width, height);
        };

        this.onMouseDown = (ev) => {
            this.fovTarget = this.options.fovSpeedUp;
            this.speedUpTarget = this.options.speedUp;
        };

        this.onMouseUp = (ev) => {
            this.fovTarget = this.options.fov;
            this.speedUpTarget = 0;
        };

        this.onContextMenu = (ev) => ev.preventDefault();

        window.addEventListener('resize', this.onWindowResize);
        this.container.addEventListener('mousedown', this.onMouseDown);
        this.container.addEventListener('mouseup', this.onMouseUp);
        this.container.addEventListener('mouseout', this.onMouseUp);
        this.container.addEventListener('touchstart', this.onMouseDown, { passive: true }); // Touch uses the same logic
        this.container.addEventListener('touchend', this.onMouseUp, { passive: true });
        this.container.addEventListener('touchcancel', this.onMouseUp, { passive: true });
        this.container.addEventListener('contextmenu', this.onContextMenu);
    }

    initPasses() {
        const { RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset } = POSTPROCESSING;
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.bloomPass = new EffectPass(
            this.camera,
            new BloomEffect({
                luminanceThreshold: 0.2,
                luminanceSmoothing: 0,
                resolutionScale: 1
            })
        );
        const smaaPass = new EffectPass(
            this.camera,
            new SMAAEffect({
                preset: SMAAPreset.MEDIUM
            })
        );
        this.renderPass.renderToScreen = false;
        this.bloomPass.renderToScreen = false;
        smaaPass.renderToScreen = true;
        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(smaaPass);
    }

    initSceneObjects() {
        const options = this.options;
        this.road.init();
        this.leftCarLights.init();
        this.leftCarLights.mesh.position.setX(-options.roadWidth / 2 - options.islandWidth / 2);
        this.rightCarLights.init();
        this.rightCarLights.mesh.position.setX(options.roadWidth / 2 + options.islandWidth / 2);
        this.leftSticks.init();
        this.leftSticks.mesh.position.setX(-(options.roadWidth + options.islandWidth / 2));
    }

    update(delta) {
        let lerpPercentage = Math.exp(-(-60 * Math.log2(1 - 0.1)) * delta);
        this.speedUp += lerp(this.speedUp, this.speedUpTarget, lerpPercentage, 0.00001);
        this.timeOffset += this.speedUp * delta;

        let time = this.clock.elapsedTime + this.timeOffset;

        this.rightCarLights.update(time);
        this.leftCarLights.update(time);
        this.leftSticks.update(time);
        this.road.update(time);

        let updateCamera = false;
        let fovChange = lerp(this.camera.fov, this.fovTarget, lerpPercentage);
        if (fovChange !== 0) {
            this.camera.fov += fovChange * delta * 6;
            updateCamera = true;
        }

        if (this.options.distortion.getJS) {
            const distortion = this.options.distortion.getJS(0.025, time);

            this.camera.lookAt(
                new THREE.Vector3(
                    this.camera.position.x + distortion.x,
                    this.camera.position.y + distortion.y,
                    this.camera.position.z + distortion.z
                )
            );
            updateCamera = true;
        }
        if (updateCamera) {
            this.camera.updateProjectionMatrix();
        }
    }

    render(delta) {
        this.composer.render(delta);
    }

    dispose() {
        this.disposed = true;

        if (this.renderer) this.renderer.dispose();
        if (this.composer) this.composer.dispose();
        if (this.scene) this.scene.clear();

        window.removeEventListener('resize', this.onWindowResize);
        this.container.removeEventListener('mousedown', this.onMouseDown);
        this.container.removeEventListener('mouseup', this.onMouseUp);
        this.container.removeEventListener('mouseout', this.onMouseUp);
        this.container.removeEventListener('touchstart', this.onMouseDown);
        this.container.removeEventListener('touchend', this.onMouseUp);
        this.container.removeEventListener('touchcancel', this.onMouseUp);
        this.container.removeEventListener('contextmenu', this.onContextMenu);
        
        try {
            this.container.removeChild(this.renderer.domElement);
        } catch {}
    }

    setSize(width, height, updateStyles) {
        this.composer.setSize(width, height, updateStyles);
    }

    tick() {
        if (this.disposed || !this) return;
        if (resizeRendererToDisplaySize(this.renderer, this.setSize)) {
            const canvas = this.renderer.domElement;
            this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }
        const delta = this.clock.getDelta();
        this.render(delta);
        this.update(delta);
        requestAnimationFrame(this.tick);
    }
}


// =================================================================
// 4. INITIALIZATION AND ROUTING
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('.background-container');

    containers.forEach(container => {
        const effectType = container.getAttribute('data-effect');
        let backgroundEffect = null;
        
        // Remove any old canvas elements if they exist inside the container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (effectType === 'iridescence') {
            const options = {
                color: parseData(container, 'data-color', [0.5, 0.7, 1.0]),
                speed: parseData(container, 'data-speed', 0.7),
                amplitude: parseData(container, 'data-amplitude', 0.2),
                mouseReact: parseData(container, 'data-mouse-react', true),
            };
            backgroundEffect = new IridescenceEffect(container, options);

        } else if (effectType === 'hyperspeed') {
            const options = {
                length: parseData(container, 'data-length', 400),
                roadWidth: parseData(container, 'data-road-width', 10),
                islandWidth: parseData(container, 'data-island-width', 2),
                lanesPerRoad: parseData(container, 'data-lanes-per-road', 4),
                fov: parseData(container, 'data-fov', 90),
                fovSpeedUp: parseData(container, 'data-fov-speed-up', 150),
                speedUp: parseData(container, 'data-speed-up', 2),
                distortion: parseData(container, 'data-distortion', 'turbulentDistortion'),
                colors: {
                    leftCars: parseData(container, 'data-left-cars', defaultHyperspeedOptions.colors.leftCars),
                    rightCars: parseData(container, 'data-right-cars', defaultHyperspeedOptions.colors.rightCars),
                    shoulderLines: parseData(container, 'data-shoulder-lines', defaultHyperspeedOptions.colors.shoulderLines),
                    brokenLines: parseData(container, 'data-broken-lines', defaultHyperspeedOptions.colors.brokenLines),
                    roadColor: parseData(container, 'data-road-color', defaultHyperspeedOptions.colors.roadColor),
                    islandColor: parseData(container, 'data-island-color', defaultHyperspeedOptions.colors.islandColor),
                    background: parseData(container, 'data-background', defaultHyperspeedOptions.colors.background),
                }
            };
            backgroundEffect = new HyperspeedApp(container, options);
        }
    });
});

// Simpler looping scroll
document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.assistance-container');
    const leftBtn = document.querySelector('.scroll-btn-left');
    const rightBtn = document.querySelector('.scroll-btn-right');
    
    if (!container || !leftBtn || !rightBtn) return;
    
    const scrollAmount = 200;
    
    function scrollLeft() {
        if (container.scrollLeft <= 0) {
            // If at beginning, scroll to end
            container.scrollLeft = container.scrollWidth;
        } else {
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        }
    }
    
    function scrollRight() {
        if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
            // If at end, scroll to beginning
            container.scrollLeft = 0;
        } else {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }
    
    leftBtn.addEventListener('click', scrollLeft);
    rightBtn.addEventListener('click', scrollRight);
});
