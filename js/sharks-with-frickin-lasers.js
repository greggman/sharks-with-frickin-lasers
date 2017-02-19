const fishVertexShader = `
uniform vec3 lightWorldPos;
uniform mat4 viewInverse;
uniform mat4 viewProjection;
uniform vec3 worldPosition;
uniform vec3 nextPosition;
uniform float scale;
uniform float time;
uniform float fishLength;
uniform float fishWaveLength;
uniform float fishBendAmount;
attribute vec4 position;
attribute vec3 normal;
attribute vec2 texCoord;
attribute vec3 tangent;  // #normalMap
attribute vec3 binormal;  // #normalMap
varying vec4 v_position;
varying vec2 v_texCoord;
varying vec3 v_tangent;  // #normalMap
varying vec3 v_binormal;  // #normalMap
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
void main() {
  vec3 vz = normalize(worldPosition - nextPosition);
  vec3 vx = normalize(cross(vec3(0,1,0), vz));
  vec3 vy = cross(vz, vx);
  mat4 orientMat = mat4(
    vec4(vx, 0),
    vec4(vy, 0),
    vec4(vz, 0),
    vec4(worldPosition, 1));
  mat4 scaleMat = mat4(
    vec4(scale, 0, 0, 0),
    vec4(0, scale, 0, 0),
    vec4(0, 0, scale, 0),
    vec4(0, 0, 0, 1));
  mat4 world = orientMat * scaleMat;
  mat4 worldViewProjection = viewProjection * world;
  mat4 worldInverseTranspose = world;

  v_texCoord = texCoord;
  // NOTE:If you change this you need to change the laser code to match!
  float mult = position.z > 0.0 ?
      (position.z / fishLength) :
      (-position.z / fishLength * 2.0);
  float s = sin(time + mult * fishWaveLength);
  float a = sign(s);
  float offset = pow(mult, 2.0) * s * fishBendAmount;
  v_position = (
      worldViewProjection *
      (position +
       vec4(offset, 0, 0, 0)));
  v_normal = (worldInverseTranspose * vec4(normal, 0)).xyz;
  v_surfaceToLight = lightWorldPos - (world * position).xyz;
  v_surfaceToView = (viewInverse[3] - (world * position)).xyz;
  v_binormal = (worldInverseTranspose * vec4(binormal, 0)).xyz;  // #normalMap
  v_tangent = (worldInverseTranspose * vec4(tangent, 0)).xyz;  // #normalMap
  gl_Position = v_position;
}
`;
const fishNormalMapFragmentShader = `
precision mediump float;
uniform vec4 lightColor;
varying vec4 v_position;
varying vec2 v_texCoord;
varying vec3 v_tangent;  // #normalMap
varying vec3 v_binormal;  // #normalMap
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;

uniform vec4 ambient;
uniform sampler2D diffuse;
uniform vec4 specular;
uniform sampler2D normalMap;  // #normalMap
uniform float shininess;
uniform float specularFactor;
// #fogUniforms

vec4 lit(float l ,float h, float m) {
  return vec4(1.0,
              max(l, 0.0),
              (l > 0.0) ? pow(max(0.0, h), m) : 0.0,
              1.0);
}
void main() {
  vec4 diffuseColor = texture2D(diffuse, v_texCoord);
  mat3 tangentToWorld = mat3(v_tangent,  // #normalMap
                             v_binormal,  // #normalMap
                             v_normal);  // #normalMap
  vec4 normalSpec = texture2D(normalMap, v_texCoord.xy);  // #normalMap
  vec4 normalSpec = vec4(0,0,0,0);  // #noNormalMap
  vec3 tangentNormal = normalSpec.xyz - vec3(0.5, 0.5, 0.5);  // #normalMap
  tangentNormal = normalize(tangentNormal + vec3(0, 0, 2));  // #normalMap
  vec3 normal = (tangentToWorld * tangentNormal);  // #normalMap
  normal = normalize(normal);  // #normalMap
  vec3 normal = normalize(v_normal);   // #noNormalMap
  vec3 surfaceToLight = normalize(v_surfaceToLight);
  vec3 surfaceToView = normalize(v_surfaceToView);
  vec3 halfVector = normalize(surfaceToLight + surfaceToView);
  vec4 litR = lit(dot(normal, surfaceToLight),
                    dot(normal, halfVector), shininess);
  vec4 outColor = vec4(
    (lightColor * (diffuseColor * litR.y + diffuseColor * ambient +
                  specular * litR.z * specularFactor * normalSpec.a)).rgb,
      diffuseColor.a);
  // #fogCode
  gl_FragColor = outColor;
  gl_FragColor = diffuseColor;
}
`;

const positionOnlyVertexShader = `
attribute vec4 position;
uniform mat4 matrix;
void main() {
  gl_Position = matrix * position;
}
`;

const causticsFS = `
precision mediump float;

uniform vec2 resolution;
uniform vec4 color;
uniform float power;
uniform float mult;
uniform float time;

float twist(inout vec4 uv, float m) {
  return length(.5-fract(uv.xyz *= mat3(-2,-1,2, 3,-2,1, 1,2,2) * m));
}

void main() {
  vec4 uv = vec4(gl_FragCoord.xy / 200.0, time * 0.3, 0);
  float lum = pow(min(min(twist(uv, 0.51), twist(uv, 0.43)), twist(uv, 0.32)), power) * mult;
  gl_FragColor = vec4(lum) + color;
}
`;

const textureVertexShader = `
attribute vec4 position;
attribute vec2 texcoord;

uniform mat4 matrix;

varying vec2 v_texcoord;

void main() {
  gl_Position = matrix * position;
  v_texcoord = texcoord;
}
`;

const textureFragmentShader = `
precision mediump float;

uniform sampler2D texture;
uniform vec4 mult;
uniform vec4 offset;

varying vec2 v_texcoord;

void main() {
  gl_FragColor = texture2D(texture, v_texcoord) * mult + offset;
}
`;

const lineVertexShader = `
attribute vec4 position;

uniform mat4 matrix;

void main() {
  gl_Position = matrix * position;
}
`;

const lineFragmentShader = `
precision mediump float;

uniform vec4 color;

void main() {
  gl_FragColor = color;
}
`;

const flatVS = `
attribute vec4 position;
attribute vec3 normal;

uniform mat4 matrix;

varying vec3 v_normal;

void main() {
  gl_Position = matrix * position;
  v_normal = normalize((matrix * vec4(normal, 0)).xyz);
}
`;

const flatFS = `
precision mediump float;

varying vec3 v_normal;

uniform vec4 color;
uniform vec3 lightDir;

void main() {
  vec3 normal = normalize(v_normal);
  float l = dot(normal, lightDir) * .5 + .5;
  gl_FragColor = vec4(color.rgb * l, color.a);
}
`;

require([
  '../3rdparty/chroma.min',
  '../3rdparty/twgl-full.min',
  '../3rdparty/tweeny',
], (
  chroma,
  twgl,
  tweeny
) => {
  const m4 = twgl.m4;
  const v3 = twgl.v3;
  const gl = document.querySelector("canvas").getContext("webgl", { alpha: false });
  var isMobile = window.navigator.userAgent.match(/Android|iPhone|iPad|iPod|Windows Phone/i);

  const getRelativeUrl = (function() {
    const a = document.createElement("a");
    return function getRelativeUrl(baseUrl, url) {
      if (url[0] === '/' || url.indexOf("://") >= 0) {
        return url;
      }
      a.href = baseUrl;
      let path = a.pathname;
      const slashNdx = path.lastIndexOf("/");
      if (slashNdx >= 0) {
        path = path.substring(0, slashNdx + 1);
      }
      return a.origin + path + url;
    }
  }());

  function loadXHRP(url, options) {
    options = options || {};
    return new Promise((fulfill, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.verb || 'GET', url);
      xhr.onload = function() {
        if (xhr.status === 200) {
          fulfill(xhr);
        } else {
          reject(xhr);
        }
      };
      xhr.send(options.body);
    });
  }

  function loadJSONP(url, options) {
    return loadXHRP(url, options).then(xhr => {
      return JSON.parse(xhr.responseText);
    });
  }

  function loadModelP(gl, url, options) {
    return loadJSONP(url, options).then(data => {
      return data.models.map(model => {
        const textures = {};
        Object.keys(model.textures).forEach(type => {
          textures[type] = twgl.createTexture(gl, {
            src: getRelativeUrl(url, model.textures[type]),
            flipY: true,
          });
        });
        const arrays = {};
        Object.keys(model.fields).forEach(type => {
          const field = model.fields[type];
          arrays[type] = {
            numComponents: field.numComponents,
            data: new window[field.type](field.data),
          };
        });
        return {
          bufferInfo: twgl.createBufferInfoFromArrays(gl, arrays),
          textures: textures,
        };
      });
    });
  }

  loadModelP(gl, "assets/models/BigFishA.js").then(models => {
    start(models);
  }).catch(e => {
    throw e;
  });

  function mungeShader(src) {
    return src.replace(/^.*?\/\/ #noNormalMap\n/gm, "");
  }

  let started = false;
  const a = new Audio();
  a.src = "assets/music/sharks.mp3";
  if (isMobile) {
    tryPlay();
  } else {
    a.addEventListener('canplaythrough', tryPlay);
  }

  function tryPlay() {
    document.querySelector("#loading").style.display = "none";
    const elem = document.querySelector("#play");
    elem.style.display = "flex";
    elem.addEventListener('click', gogogo);
    elem.addEventListener('touchstart', gogogo);
  };


  function gogogo() {
    if (!started) {
      started = true
      a.play();
      const elem = document.querySelector("#play");
      elem.style.display = "";
    }
  }


  function start(models) {
    const fishProgramInfo = twgl.createProgramInfo(gl, [
      mungeShader(fishVertexShader),
      mungeShader(fishNormalMapFragmentShader),
    ]);

    const causticsProgramInfo = twgl.createProgramInfo(gl, [
      positionOnlyVertexShader,
      causticsFS,
    ]);

    const textureProgramInfo = twgl.createProgramInfo(gl, [
      textureVertexShader,
      textureFragmentShader,
    ]);

    const lineProgramInfo = twgl.createProgramInfo(gl, [
      lineVertexShader,
      lineFragmentShader,
    ]);

    const flatProgramInfo = twgl.createProgramInfo(gl, [
      flatVS,
      flatFS,
    ]);

    const plane1Verts = twgl.primitives.createPlaneVertices(1, 1, 1, 1, m4.translation([0, 0, -.5]));
    const plane2Verts = twgl.primitives.reorientVertices(twgl.primitives.duplicateVertices(plane1Verts), m4.rotationZ(Math.PI * 0.5));
    const laserArrays = twgl.primitives.concatVertices([plane1Verts, plane2Verts]);
    const laserBufferInfo = twgl.createBufferInfoFromArrays(gl, laserArrays);

    const quadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl);

    //const cubeArrays = twgl.primitives.createCubeVertices();
    //cubeArrays.indices = makeQuadLines(cubeArrays.indices);
    const cubeArrays = createLineCubeVertices();
    const cubeBufferInfo = twgl.createBufferInfoFromArrays(gl, cubeArrays);
    const cubeTriBufferInfo = twgl.primitives.createCubeBufferInfo(gl);

    const sphereArrays = createSphereVertices(1, 6, 6);
    const sphereBufferInfo = twgl.createBufferInfoFromArrays(gl, sphereArrays);
    const sphereTriBufferInfo = twgl.createBufferInfoFromArrays(gl, twgl.primitives.flattenNormals(twgl.primitives.deindexVertices(twgl.primitives.createSphereVertices(1, 6, 6))));

    function makeQuadLines(indices) {
      const newIndices = [];
      for (let i = 0; i < indices.length; i += 6) {
        newIndices.push(indices[i + 0], indices[i + 1]);
        newIndices.push(indices[i + 1], indices[i + 2]);
        newIndices.push(indices[i + 2], indices[i + 5]);
        newIndices.push(indices[i + 5], indices[i + 0]);
      }
      return newIndices;
    }

    const laserTex = twgl.createTexture(gl, {
      src: [0, 64, 128, 255, 255, 128, 64, 0],
      format: gl.LUMINANCE,
      wrap: gl.CLAMP_TO_EDGE,
    });
    const white = twgl.createTexture(gl, { src: [255, 255, 255, 255] });
    let frameCount = 0;
    const wireOffsets = [
      [ -2,  0, ],
      [ -1,  0, ],
      [  0,  0, ],
      [  1,  0, ],
      [  2,  0, ],
      [  0, -2, ],
      [  0, -1, ],
      [  0,  0, ],
      [  0,  1, ],
      [  0,  2, ],
    ];

    /*
  00.50 - Sound starts
  12.40 - Sharks
  20.02 - Key change
  35.26 - Lasersharks
  50.50 - Key change
  65.73 - Ending tag
  66.74 - Notes off
  68.49 - Reverb mostly inaudible

    */

    let sequenceNdx = 0;
    const sequence = [
      { time:   0.50, fn: addWaterMsg, },
      { time:   3.50, fn: addWater, },
      { time:   9.40, fn: addSharksMsg, },
      { time:  12.40, fn: addSharks, },
      { time:  17.02, fn: addLasersMsg, },
      { time:  20.02, fn: addLasers, },
      { time:  32.26, fn: addFrickinMsg, },
      { time:  35.26, fn: addFrickin, },
      { time:  43.00, fn: addFrickin2, },
      { time:  50.50, fn: addFrickin3, },
      { time:  65.72, fn: addEnd, },
    ];

    let drawArrays = sphereArrays;
    let drawBufferInfo = sphereBufferInfo;
    let drawTriBufferInfo = sphereTriBufferInfo;

    let showWater = false;
    let swimSharks = false;
    let shapeSharks = false;
    let showLasers = false;
    let drawShape = false;
    let waterOffset = -1;
    let moveWater = true;
    let funkyScale = false;
    let funkyOffset = 0;

    function addWaterMsg() {
      const elem = document.querySelector("#msg1");
      elem.style.display = "flex";
    }

    function addWater() {
      const elem = document.querySelector("#msg1");
      elem.style.display = "";
      showWater = true;
    }

    function addSharksMsg() {
      const elem = document.querySelector("#msg2");
      elem.style.display = "flex";
      waterOffset = 0;
      moveWater = false;
    }

    function addSharks() {
      const elem = document.querySelector("#msg2");
      elem.style.display = "";
      swimSharks = true;
    }

    function addLasersMsg() {
      const elem = document.querySelector("#msg3");
      elem.style.display = "flex";
    }

    function addLasers() {
      const elem = document.querySelector("#msg3");
      elem.style.display = "";
      showLasers = true;
    }

    function addFrickinMsg() {
      const elem = document.querySelector("#msg4");
      elem.style.display = "flex";
    }

    function addFrickin() {
      const elem = document.querySelector("#msg4");
      elem.style.display = "";

      swimSharks = false;
      shapeSharks = true;
      showLasers = true;
      drawShape = true;
      drawArrays = cubeArrays;
      drawBufferInfo = cubeBufferInfo;
      drawTriBufferInfo = cubeTriBufferInfo;

    }

    function addFrickin2() {
      funkyScale = true;
    }

    function addFrickin3() {
      drawArrays = sphereArrays;
      drawBufferInfo = sphereBufferInfo;
      drawTriBufferInfo = sphereTriBufferInfo;
    }

    function addEnd() {
      const elem = document.querySelector("#msg5");
      elem.style.display = "flex";
    }

    const RANDOM_RANGE = Math.pow(2, 32);
    let randomSeed = 0;
    function pseudoRandom() {
      return (randomSeed =
          (134775813 * randomSeed + 1) %
          RANDOM_RANGE) / RANDOM_RANGE;
    }

    function resetPseudoRandom() {
      randomSeed = 0;
    }

    function render(time) {
      ++frameCount;
      time *= 0.001;
      twgl.resizeCanvasToDisplaySize(gl.canvas);

      resetPseudoRandom();

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      const musicTime = a.currentTime;
      let seq = sequence[sequenceNdx];
      while (seq && musicTime >= seq.time) {
        seq.fn();
        ++sequenceNdx;
        seq = sequence[sequenceNdx];
      }

      const projection = m4.perspective(Math.PI * 0.25, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.1, 100);
      const eye = [0, 0, 4];
      const target = [0, 0, 0];
      const up = [0, 1, 0];
      const camera = m4.lookAt(eye, target, up);
      const view = m4.inverse(camera);

      const viewProjection = m4.multiply(projection, view);

      // -- draw caustics --
      gl.disable(gl.DEPTH_TEST);

      if (showWater) {
        if (moveWater) {
          waterOffset = (-1 + ((musicTime - 3.50) / (9.40 - 3.50))) * 2;
        }
        gl.useProgram(causticsProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, causticsProgramInfo, quadBufferInfo);
        twgl.setUniforms(causticsProgramInfo, {
          resolution: [gl.canvas.width, gl.canvas.height],
          matrix: m4.translation([0, waterOffset, 0]),
          time: time,
          color: [0, 0.1, 0.3, 1],
          power: 7,
          mult: 30,
        });
        twgl.drawBufferInfo(gl, quadBufferInfo);
        check();
      }

      gl.disable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);

      let rmat = m4.rotationY(time);
      rmat = m4.rotateX(rmat, time * 0.137);

      if (funkyScale) {
        let ss = Math.sin(time * 10) * .5 + 1;
        rmat = m4.scale(rmat, [ss, ss, ss]);
      }
      const spread = 0.01;

      // -- draw inner shape --
      if (drawShape) {
        gl.useProgram(flatProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, flatProgramInfo, drawTriBufferInfo);
        {
          let mat = m4.multiply(viewProjection, rmat);
          mat = m4.scale(mat, [0.9, 0.9, 0.9]);
          twgl.setUniforms(flatProgramInfo, {
            matrix: mat,
            lightDir: v3.normalize([1, 4, -10]),
            color: chroma.hsv((time * 100) % 360, 1.0, 1.).gl(),
          });
        }
        twgl.drawBufferInfo(gl, drawTriBufferInfo);

        // -- draw line frame --
        gl.useProgram(lineProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, lineProgramInfo, drawBufferInfo);
        const screenX = [view[0], view[1], view[2]];
        const screenY = [view[4], view[5], view[6]];
        wireOffsets.forEach(offset => {
          const offx = v3.mulScalar(screenX, offset[0] * spread);
          const offy = v3.mulScalar(screenY, offset[1] * spread);
          const off = v3.add(offx, offy);
          let mat = m4.translate(viewProjection, off);
          mat = m4.multiply(mat, rmat);
          const dist = v3.length(off);
          const c = Math.cos(dist / 2) * (frameCount % 3) / 3;
          twgl.setUniforms(lineProgramInfo, {
            matrix: mat,
            color: [0, 0, 0, 0], //0.5 + c * 0.5, c / 2, c / 2, 1],
          });
          twgl.drawBufferInfo(gl, drawBufferInfo, gl.LINES);
          check();
        });
      }

      // -- draw sharks --

      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.depthFunc(gl.LESS);

      const positions = drawArrays.position;
      const numPositions = positions.length / 3;

      const startPositions = [];
      const endPositions = [];
      const model = models[0];
      gl.useProgram(fishProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, fishProgramInfo, model.bufferInfo);
      twgl.setUniforms(fishProgramInfo, {
        time: time * 10.,
        fishLength: 10,
        fishWaveLength: -1,
        fishBendAmount: 0.5,
        lightWorldPos: [2, 5, 10],
        viewInverse: camera,
        viewProjection: viewProjection,
        ambient: [0, 0, 0, 0],
        diffuse: model.textures.diffuse,
        normalMap: model.textures.normalMap,
        specular: [1, 1, 1, 1],
        shininess: 5,
        specularFactor: 0.3,
      });

      if (shapeSharks) {
        for (let i = 0; i < numPositions; ++i) {
          let off1 = i * 3;
          let off2 = ((i + 1) % numPositions) * 3;
          let p1 = m4.transformPoint(rmat, [positions[off1], positions[off1 + 1], positions[off1 + 2]]);
          let p2 = m4.transformPoint(rmat, [positions[off2], positions[off2 + 1], positions[off2 + 2]]);
          twgl.setUniforms(fishProgramInfo, {
            scale: 0.04,
            worldPosition: p1,
            nextPosition: p2,
          });
          twgl.drawBufferInfo(gl, model.bufferInfo);
          check();
          startPositions.push(p1);
          endPositions.push(p2);
        }
      }

      if (swimSharks) {
        const numSharks = 20;
        for (let s = 0; s < numSharks; ++s) {
          const u = s / (numSharks - 1);
          const v = u * 2 - 1;
          const y = v * 1;
          const z = 2;
          const dir = pseudoRandom() > .5 ? 1 : -1;
          const clock = ((pseudoRandom() + time * .1) % 1) * 2 - 1;
          const x = clock * 8 * dir;
          const p1 = [x, y, z];
          const p2 = [x - dir, y, z];
          twgl.setUniforms(fishProgramInfo, {
            time: time * 10. + s,
            scale: 0.04,
            worldPosition: p1,
            nextPosition: p2,
          });
          twgl.drawBufferInfo(gl, model.bufferInfo);
          check();
          startPositions.push(p1);
          endPositions.push(p2);
        }
      }

      if (showLasers) {
        gl.enable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);

        // -- draw lasers --
        const laserSize = 0.05;
        const laserLength = 100;
        gl.useProgram(textureProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, textureProgramInfo, laserBufferInfo);
        startPositions.forEach((startPos, ndx) => {
          const endPos = endPositions[ndx];
          const laserOrient = m4.lookAt(startPos, endPos, [0, 1, 0]);
          const c = ((frameCount + ndx) % 3) / 2 * .5 + .5;
          let mat = m4.multiply(viewProjection, laserOrient);
          mat = m4.scale(mat, [laserSize, laserSize, -laserLength]);
          twgl.setUniforms(textureProgramInfo, {
            matrix: mat,
            offset: [0, 0, 0, 0],
            mult: [c, 0.2 * c, 0.2 * c, 1],
            texture: laserTex,
          });
          twgl.drawBufferInfo(gl, laserBufferInfo);
          check();
        });

        gl.depthMask(true);
      }

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  function check() {
    //if (gl.getError() !== gl.NO_ERROR) {
    //  debugger;
    //}
  }

  function createLineCubeVertices(size) {
    size = size || 1;
    var k = size / 2;

    var cornerVertices = [
      -k, -k, -k,
      +k, -k, -k,
      -k, +k, -k,
      +k, +k, -k,
      -k, -k, +k,
      +k, -k, +k,
      -k, +k, +k,
      +k, +k, +k,
    ];

    var CUBE_FACE_INDICES = [
      3, 7, 5, 1,  // right
      6, 2, 0, 4,  // left
      6, 7, 3, 2,  // ??
      0, 1, 5, 4,  // ??
      7, 6, 4, 5,  // front
      2, 3, 1, 0,  // back
    ];



    var numVertices = 6 * 4;
    var positions = new Float32Array(cornerVertices);
    var indices   = [];

    CUBE_FACE_INDICES.forEach((ndx, i) => {
      let f = i / 4 | 0;
      let fp = (i + 1) % 4;
      indices.push(ndx, CUBE_FACE_INDICES[f * 4 + fp]);
    });

    return {
      position: positions,
      indices: indices,
    };
  }

  function createSphereVertices(
      radius,
      subdivisionsAxis,
      subdivisionsHeight,
      opt_startLatitudeInRadians,
      opt_endLatitudeInRadians,
      opt_startLongitudeInRadians,
      opt_endLongitudeInRadians) {
    if (subdivisionsAxis <= 0 || subdivisionsHeight <= 0) {
      throw Error('subdivisionAxis and subdivisionHeight must be > 0');
    }

    opt_startLatitudeInRadians = opt_startLatitudeInRadians || 0;
    opt_endLatitudeInRadians = opt_endLatitudeInRadians || Math.PI;
    opt_startLongitudeInRadians = opt_startLongitudeInRadians || 0;
    opt_endLongitudeInRadians = opt_endLongitudeInRadians || (Math.PI * 2);

    var latRange = opt_endLatitudeInRadians - opt_startLatitudeInRadians;
    var longRange = opt_endLongitudeInRadians - opt_startLongitudeInRadians;

    // We are going to generate our sphere by iterating through its
    // spherical coordinates and generating 2 triangles for each quad on a
    // ring of the sphere.
    var numVertices = (subdivisionsAxis + 1) * (subdivisionsHeight + 1);
    var positions = twgl.primitives.createAugmentedTypedArray(3, numVertices);

    // Generate the individual vertices in our vertex buffer.
    for (var y = 0; y <= subdivisionsHeight; y++) {
      for (var x = 0; x < subdivisionsAxis; x++) {
        // Generate a vertex based on its spherical coordinates
        var u = x / subdivisionsAxis;
        var v = y / subdivisionsHeight;
        var theta = longRange * u;
        var phi = latRange * v;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);
        var sinPhi = Math.sin(phi);
        var cosPhi = Math.cos(phi);
        var ux = cosTheta * sinPhi;
        var uy = cosPhi;
        var uz = sinTheta * sinPhi;
        positions.push(radius * ux, radius * uy, radius * uz);
      }
    }

    var numVertsAround = subdivisionsAxis;
    var indices = twgl.primitives.createAugmentedTypedArray(3, subdivisionsAxis * subdivisionsHeight * 2, Uint16Array);
    for (var x = 0; x < subdivisionsAxis; x++) {  // eslint-disable-line
      for (var y = 0; y < subdivisionsHeight; y++) {  // eslint-disable-line
        // Make triangle 1 of quad.
        indices.push(
            (y + 0) * numVertsAround + x,
            (y + 0) * numVertsAround + (x + 1) % numVertsAround,
            (y + 1) * numVertsAround + x);

        // Make triangle 2 of quad.
        indices.push(
            (y + 1) * numVertsAround + x,
            (y + 0) * numVertsAround + (x + 1) % numVertsAround,
            (y + 1) * numVertsAround + (x + 1) % numVertsAround);
      }
    }

    return {
      position: positions,
      indices: indices,
    };
  }

});

