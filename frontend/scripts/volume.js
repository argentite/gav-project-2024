import { Shader } from "./webgl-util.js";

export class Raycaster {
  async init(gl) {
    this.volumes = {
      "Hydrogen Atom": "hydrogen_atom_128x128x128_uint8",
      "Fuel": "fuel_64x64x64_uint8",
      "Neghip": "neghip_64x64x64_uint8",
      // "Boston Teapot": "boston_teapot_256x256x178_uint8",
      // "Engine": "engine_256x256x128_uint8",
      "Bonsai": "bonsai_256x256x256_uint8",
      // "Foot": "foot_256x256x256_uint8",
      // "Skull": "skull_256x256x256_uint8",
      "Aneurysm": "aneurism_256x256x256_uint8",
      "Zeiss": "zeiss_680x680x680_uint8",
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
    this.fileRegex = /.*(\w+)_(\d+)x(\d+)x(\d+)_(\w+)*/;

    this.gl = gl;
    this.volumeTexture = null;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.cubeStrip), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const rcVertShader = await (await fetch("./shaders/volume.vs")).text();
    const rcFragShader = await (await fetch("./shaders/volume.fs")).text();
    this.shader = new Shader(gl, rcVertShader, rcFragShader);
    this.shader.use(gl);
    gl.uniform1i(this.shader.uniforms["volume"], 0);
    gl.uniform1i(this.shader.uniforms["colormap"], 1);
    gl.uniform1i(this.shader.uniforms["depth"], 2);
    gl.uniform1f(this.shader.uniforms["dt_scale"], 1.0);

    // init colormap texture and volumn texture
    var colormapImage = new Image();
    const that = this;
    colormapImage.onload = function () {
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
    this.targetFrameTime = 1000 / 60;

    this.volumeChangeCallback = null;
  }
  
  set_resolution(width, height) {
    const gl = this.gl;
    gl.uniform1i(this.shader.uniforms["canvas_width"], width);
    gl.uniform1i(this.shader.uniforms["canvas_height"], height);
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

    var url = "/scalarfield/" + file + ".raw";
    var req = new XMLHttpRequest();
    // var loadingProgressText = document.getElementById("loadingText");
    // var loadingProgressBar = document.getElementById("loadingProgressBar");

    // loadingProgressText.innerHTML = "Loading Volume";
    // loadingProgressBar.setAttribute("style", "width: 0%");

    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onprogress = function (evt) {
      // var vol_size = volDims[0] * volDims[1] * volDims[2];
      // var percent = evt.loaded / vol_size * 100;
      // loadingProgressBar.setAttribute("style", "width: " + percent.toFixed(2) + "%");
    };
    req.onerror = function (evt) {
      // loadingProgressText.innerHTML = "Error Loading Volume";
      // loadingProgressBar.setAttribute("style", "width: 0%");
    };
    req.onload = function (evt) {
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
    if (this.volumeChangeCallback != null) {
      this.volumeChangeCallback(this.volumes[vol]);
    }
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
      this.volume_dimension = volDims;

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
    colormapImage.onload = function () {
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
