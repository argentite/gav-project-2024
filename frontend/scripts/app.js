import { VTP } from "./vtp.js";
import { loadShaderProgram } from "./glutils.js";
import { vec3, mat4 } from "./glmatrix/index.js";
import { ArcballCamera, Controller, Shader } from "./webgl-util.js";
import { rcVertShader, rcFragShader } from "./rc-shaders.js";

class Raycaster {
  constructor(gl) {
    this.volumes = {
      "Hydrogen Atom": "jwbav8s3wmmxd5x/hydrogen_atom_128x128x128_uint8.raw",
      "Fuel": "7d87jcsh0qodk78/fuel_64x64x64_uint8.raw",
      "Neghip": "zgocya7h33nltu9/neghip_64x64x64_uint8.raw",
      "Boston Teapot": "w4y88hlf2nbduiv/boston_teapot_256x256x178_uint8.raw",
      "Engine": "ld2sqwwd3vaq4zf/engine_256x256x128_uint8.raw",
      "Bonsai": "rdnhdxmxtfxe0sa/bonsai_256x256x256_uint8.raw",
      "Foot": "ic0mik3qv4vqacm/foot_256x256x256_uint8.raw",
      "Skull": "5rfjobn0lvb7tmo/skull_256x256x256_uint8.raw",
      "Aneurysm": "3ykigaiym8uiwbp/aneurism_256x256x256_uint8.raw",
    };

    this.colormaps = {
      "Cool Warm": "colormaps/cool-warm-paraview.png",
      "Matplotlib Plasma": "colormaps/matplotlib-plasma.png",
      "Matplotlib Virdis": "colormaps/matplotlib-virdis.png",
      "Rainbow": "colormaps/rainbow.png",
      "Samsel Linear Green": "colormaps/samsel-linear-green.png",
      "Samsel Linear YGB 1211G": "colormaps/samsel-linear-ygb-1211g.png",
    };

    this.cubeStrip = [
      1, 1, 0,
      0, 1, 0,
      1, 1, 1,
      0, 1, 1,
      0, 0, 1,
      0, 1, 0,
      0, 0, 0,
      1, 1, 0,
      1, 0, 0,
      1, 1, 1,
      1, 0, 1,
      0, 0, 1,
      1, 0, 0,
      0, 0, 0
    ];
    
    this.volSelector = null;
    this.colormapSelector = null;
    this.fileRegex = /.*\/(\w+)_(\d+)x(\d+)x(\d+)_(\w+)\.*/;
    
    this.gl = gl;
    this.volumeTexture = null;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.cubeStrip), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    this.shader = new Shader(gl, rcVertShader, rcFragShader);
    this.shader.use(gl);
    gl.uniform1i(this.shader.uniforms["volume"], 0);
    gl.uniform1i(this.shader.uniforms["colormap"], 1);
    gl.uniform1f(this.shader.uniforms["dt_scale"], 1.0);

    // init colormap texture and volumn texture
    var colormapImage = new Image();
    const that = this;
    colormapImage.onload = function() {
      var colormap = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, colormap);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.SRGB8_ALPHA8, 180, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 180, 1,
        gl.RGBA, gl.UNSIGNED_BYTE, colormapImage);
      that.selectVolume("Hydrogen Atom");
    };
    colormapImage.src = "colormaps/cool-warm-paraview.png";
    
    this.samplingRate = 1.0;
    this.targetFrameTime = 1000/60;
  }
  
  setVolSelector(volSelector) {
    this.volSelector = volSelector;
    this.volSelector.onchange = () => this.onVolSelect();
    for (let v in this.volumes) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.innerHTML = v;
      volSelector.appendChild(opt);
    }
  }
  
  setColormapSelector(colormapSelector) {
    this.colormapSelector = colormapSelector;
    this.colormapSelector.onchange = () => this.onColormapSelect();
    for (let p in this.colormaps) {
      var opt = document.createElement("option");
      opt.value = p;
      opt.innerHTML = p;
      colormapSelector.appendChild(opt);
    }
  }

  loadVolume(file, onload) {
    var m = file.match(this.fileRegex);
    var volDims = [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];
    
    var url = "https://www.dl.dropboxusercontent.com/s/" + file + "?dl=1";
    var req = new XMLHttpRequest();
    // var loadingProgressText = document.getElementById("loadingText");
    // var loadingProgressBar = document.getElementById("loadingProgressBar");

    // loadingProgressText.innerHTML = "Loading Volume";
    // loadingProgressBar.setAttribute("style", "width: 0%");

    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onprogress = function(evt) {
      // var vol_size = volDims[0] * volDims[1] * volDims[2];
      // var percent = evt.loaded / vol_size * 100;
      // loadingProgressBar.setAttribute("style", "width: " + percent.toFixed(2) + "%");
    };
    req.onerror = function(evt) {
      // loadingProgressText.innerHTML = "Error Loading Volume";
      // loadingProgressBar.setAttribute("style", "width: 0%");
    };
    req.onload = function(evt) {
      // loadingProgressText.innerHTML = "Loaded Volume";
      // loadingProgressBar.setAttribute("style", "width: 100%");
      var dataBuffer = req.response;
      if (dataBuffer) {
        dataBuffer = new Uint8Array(dataBuffer);
        onload(file, dataBuffer);
      } else {
        alert("Unable to load buffer properly from volume?");
        console.log("no buffer?");
      }
    };
    req.send();
  }
  
  onVolSelect() {
    if (this.volSelector == null)
      return;
    const vol = this.volSelector.value;
    this.selectVolume(vol);
  }

  onColormapSelect() {
    if (this.colormapSelector == null)
      return;
    var cm = this.colormapSelector.value;
    this.selectColormap(cm);
  }
  
  selectVolume(vol) {
    const gl = this.gl;

    this.loadVolume(this.volumes[vol], (file, dataBuffer) => {
      var m = file.match(this.fileRegex);
      var volDims = [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];

      var tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, tex);
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R8, volDims[0], volDims[1], volDims[2]);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0,
        volDims[0], volDims[1], volDims[2],
        gl.RED, gl.UNSIGNED_BYTE, dataBuffer);

      var longestAxis = Math.max(volDims[0], Math.max(volDims[1], volDims[2]));
      var volScale = [volDims[0] / longestAxis, volDims[1] / longestAxis,
        volDims[2] / longestAxis];

      this.shader.use(gl);
      gl.uniform3iv(this.shader.uniforms["volume_dims"], volDims);
      gl.uniform3fv(this.shader.uniforms["volume_scale"], volScale);

      if (!this.volumeTexture) {
        this.volumeTexture = tex;
      } else {
        gl.deleteTexture(this.volumeTexture);
        this.volumeTexture = tex;
      }
    });
  }

  selectColormap(cm) {
    const colormapImage = new Image();
    const gl = this.gl;
    colormapImage.onload = function() {
      gl.activeTexture(gl.TEXTURE1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 180, 1,
        gl.RGBA, gl.UNSIGNED_BYTE, colormapImage);
    };
    colormapImage.src = this.colormaps[cm];
  }
  
  draw(projView, eye) {
    const gl = this.gl;
    this.shader.use(gl);
    gl.bindVertexArray(this.vao);

    // Save them some battery if they're not viewing the tab
    if (document.hidden) {
      return;
    }
    var startTime = performance.now();

    gl.uniformMatrix4fv(this.shader.uniforms["proj_view"], false, projView);

    gl.uniform3fv(this.shader.uniforms["eye_pos"], eye);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.cubeStrip.length / 3);
    // Wait for rendering to actually finish
    gl.finish();
    var endTime = performance.now();
    var renderTime = endTime - startTime;
    var targetSamplingRate = renderTime / this.targetFrameTime;

    // If we're dropping frames, decrease the sampling rate
    if (targetSamplingRate > this.samplingRate) {
      this.samplingRate = 0.8 * this.samplingRate + 0.2 * targetSamplingRate;
      gl.uniform1f(this.shader.uniforms["dt_scale"], this.samplingRate);
    }

    startTime = endTime;
  }
}

(async function () {
  // ================= VTP ============================
  const vtpRequest = await fetch("/hydrogen_atom.vtp");
  if (!vtpRequest.ok) {
    console.error(`Failed to download VTP file: ${vtpRequest.status}`);
  }
  const vtpfile = new VTP(await vtpRequest.text());

  console.log(vtpfile);

  const cameraFovSlider = document.querySelector("#camera_fov");
  cameraFovSlider.addEventListener("input", (event) => {
    event.target.nextElementSibling.value = event.target.value;
    draw();
  });

  const displayPointsCheckbox = document.querySelector("#display_points");
  const displayConnectivityCheckbox = document.querySelector("#display_connectivity");
  const displayRelationsCheckbox = document.querySelector("#display_relations");

  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true
  });
  if (gl === null) {
    console.error("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }

  // Ray caster stuff
  const volSelector = document.getElementById("volumeList");
  const colormapSelector = document.getElementById("colormapList");

  const raycaster = new Raycaster(gl);
  raycaster.setVolSelector(volSelector);
  raycaster.setColormapSelector(colormapSelector);
  
  // Initialize Arcball camera
  const eye = vec3.set(vec3.create(), 0.5, 0.5, 1.5);
  const center = vec3.set(vec3.create(), 0.5, 0.5, 0.5);
  const up = vec3.set(vec3.create(), 0.0, 1.0, 0.0);

  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().width;
  var camera = new ArcballCamera(eye, center, up, 2, [w, h]);
  const resetCamera = () => {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().width;
    var camera = new ArcballCamera(eye, center, up, 2, [w, h]);
  };
  window.onresize = resetCamera;

  // Initialize controller
  var controller = new Controller();
  controller.mousemove = function (prev, cur, evt) {
    if (evt.buttons == 1) {
      camera.rotate(prev, cur);

    } else if (evt.buttons == 2) {
      camera.pan([cur[0] - prev[0], prev[1] - cur[1]]);
    }
  };
  controller.wheel = function (amt) { camera.zoom(amt); };
  controller.pinch = controller.wheel;
  controller.twoFingerDrag = function (drag) { camera.pan(drag); };
  controller.registerForCanvas(canvas);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);

  const shaderProgram = await loadShaderProgram(gl, './shaders/point.vs', './shaders/plain.fs');
  gl.useProgram(shaderProgram);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.bufferData(gl.ARRAY_BUFFER, vtpfile.piece[0].points.data, gl.STATIC_DRAW);

  gl.vertexAttribIPointer(0, vtpfile.piece[0].points.ncomp, gl.INT, false, 0, 0);
  gl.enableVertexAttribArray(0);

	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const relationBuffer = gl.createBuffer();
  {
    const relationIndices = new Uint16Array(2 * vtpfile.piece[0].ncells);
    for (let i = 0; i < vtpfile.piece[0].ncells; i++) {
      relationIndices[2 * i + 0] = vtpfile.piece[0].cellData.get("SourceSaddle").data[i];
      relationIndices[2 * i + 1] = vtpfile.piece[0].cellData.get("DestinationExtremum").data[i];
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, relationBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, relationIndices, gl.STATIC_DRAW);
  }

  const edgeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vtpfile.piece[0].cells.connectivity.data, gl.STATIC_DRAW);
  
  var scaleFactor = 0;
  for (let comp = 0; comp < vtpfile.piece[0].points.ncomp; comp++) {
    const bc = vtpfile.piece[0].points.bounding_box[comp];
    scaleFactor = Math.max(scaleFactor, bc[1] - bc[0]);
  }

  function draw() {
    {
      const { width, height } = canvas.getBoundingClientRect();
      gl.canvas.width = width;
      gl.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, cameraFovSlider.value, gl.canvas.width / gl.canvas.height, 0.1, 10000);

    const viewMatrix = camera.camera;

    const projViewMatrix = mat4.create();
    mat4.multiply(projViewMatrix, projectionMatrix, viewMatrix);

    const cameraMatrix = mat4.create();

    var eye = [camera.invCamera[12], camera.invCamera[13], camera.invCamera[14]]
    raycaster.draw(projViewMatrix, eye);

    gl.useProgram(shaderProgram);
    gl.bindVertexArray(vao);

    mat4.multiply(cameraMatrix, projectionMatrix, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "cameraMatrix"), false, cameraMatrix);

    gl.uniform1f(gl.getUniformLocation(shaderProgram, "scaleFactor"), scaleFactor);

    if (displayPointsCheckbox.checked) {
      gl.uniform1f(gl.getUniformLocation(shaderProgram, "pointSize"), 3.0);
      gl.uniform3f(gl.getUniformLocation(shaderProgram, "color"), 1.0, 1.0, 1.0);
      gl.drawArrays(gl.POINTS, 0, vtpfile.piece[0].points.length);
    }

    if (displayConnectivityCheckbox.checked) {
      gl.uniform3f(gl.getUniformLocation(shaderProgram, "color"), 0.0, 1.0, 0.0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuffer);
      gl.drawElements(gl.LINES, vtpfile.piece[0].cells.connectivity.length, gl.UNSIGNED_INT, 0);
    }

    if (displayRelationsCheckbox.checked) {
      gl.uniform3f(gl.getUniformLocation(shaderProgram, "color"), 1.0, 0.0, 0.0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, relationBuffer);
      gl.drawElements(gl.LINES, 2 * vtpfile.piece[0].ncells, gl.UNSIGNED_SHORT, 0);
    }
  }

  draw();
  // Keep drawing
  setInterval(draw, 1000 / 60);
})();
