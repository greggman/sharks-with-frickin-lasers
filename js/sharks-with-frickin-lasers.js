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
void main() {
  gl_Position = position;
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

const lineVertexShader = `
attribute vec4 position;
attribute vec2 texcoord;

uniform mat4 matrix;

varying vec2 v_texcoord;

void main() {
  gl_Position = position;
}
`;


require([
  '../3rdparty/twgl-full.min',
  '../3rdparty/tweeny',
], (
  twgl,
  tweeny
) => {
  const m4 = twgl.m4;
  const v3 = twgl.v3;
  const gl = document.querySelector("canvas").getContext("webgl", { alpha: false });

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
    console.log(models);
    start(models);
  }).catch(e => {
    throw e;
  });

  function mungeShader(src) {
    return src.replace(/^.*?\/\/ #noNormalMap\n/gm, "");
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

    const quadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl);

    function drawLine(x1, y1, x2, y2) {
      gl.useProgra
    }

    function render(time) {
      time *= 0.001;
      twgl.resizeCanvasToDisplaySize(gl.canvas);

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      // -- draw caustics --
      gl.disable(gl.DEPTH_TEST);

      gl.useProgram(causticsProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, causticsProgramInfo, quadBufferInfo);
      twgl.setUniforms(causticsProgramInfo, {
        resolution: [gl.canvas.width, gl.canvas.height],
        time: time,
        color: [0, 0.3, 0.6, 1],
        power: 7,
        mult: 30,
      });
      twgl.drawBufferInfo(gl, quadBufferInfo);

      // -- draw sharks --
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);

      const projection = m4.perspective(Math.PI * 0.25, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.1, 100);
      const eye = [0, 0, 20];
      const target = [0, 0, 0];
      const up = [0, 1, 0];
      const camera = m4.lookAt(eye, target, up);
      const view = m4.inverse(camera);

      const viewProjection = m4.multiply(projection, view);

      const model = models[0];
      gl.useProgram(fishProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, fishProgramInfo, model.bufferInfo);
      twgl.setUniforms(fishProgramInfo, {
        scale: 1,
        time: time * 10.,
        fishLength: 10,
        fishWaveLength: -1,
        fishBendAmount: 0.5,
        lightWorldPos: [2, 5, 10],
        viewInverse: camera,
        viewProjection: viewProjection,
        worldPosition: [0, 0, 0],
        nextPosition: [Math.sin(time), 0, Math.cos(time)],
        ambient: [0, 0, 0, 0],
        diffuse: model.textures.diffuse,
        normalMap: model.textures.normalMap,
        specular: [1, 1, 1, 1],
        shininess: 5,
        specularFactor: 0.3,
      });
      twgl.drawBufferInfo(gl, model.bufferInfo);

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }
});

