import { VTP } from "./vtp.js";
import { loadShaderProgram } from "./glutils.js";
import { vec3, mat4 } from "./glmatrix/index.js";
import { ArcballCamera, Controller, hexToRGBf } from "./webgl-util.js";
import { Raycaster } from "./volume.js";


(async function () {
  // ================= VTP ============================
  const vtpRequest = await fetch("vtps/hydrogen_atom_128x128x128_uint8.vtp");
  if (!vtpRequest.ok) {
    console.error(`Failed to download VTP file: ${vtpRequest.status}`);
  }
  let vtpfile = new VTP(await vtpRequest.text());

  console.log(vtpfile);

  const gpuInfoMonitor = document.querySelector("#gpuinfo");
  const frameTimeMonitor = document.querySelector("#frametime");
  const frameRateMonitor = document.querySelector("#framerate");

  const cameraFovSlider = document.querySelector("#camera_fov");
  cameraFovSlider.addEventListener("input", (event) => {
    event.target.nextElementSibling.value = event.target.value;
    draw();
  });

  const displayPointsCheckbox = document.querySelector("#display_points");
  const displayConnectivityCheckbox = document.querySelector("#display_connectivity");
  const displayRelationsCheckbox = document.querySelector("#display_relations");

  const pointsColorInput = document.querySelector("#color_points");
  const connectivityColorInput = document.querySelector("#color_connectivity");
  const relationsColorInput = document.querySelector("#color_relations");

  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true
  });
  if (gl === null) {
    console.error("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }
  gpuInfoMonitor.innerHTML = `${gl.getParameter(gl.VENDOR)} ${gl.getParameter(gl.RENDERER)}`;

  // Ray caster stuff
  const volSelector = document.getElementById("volumeList");
  const colormapSelector = document.getElementById("colormapList");

  const raycaster = new Raycaster();
  await raycaster.init(gl);
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

  let vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  let positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtpfile.piece[0].points.data, gl.STATIC_DRAW);

  gl.vertexAttribIPointer(0, vtpfile.piece[0].points.ncomp, gl.UNSIGNED_INT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.FRONT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let relationBuffer = gl.createBuffer();
  {
    const relationIndices = new Uint16Array(2 * vtpfile.piece[0].ncells);
    for (let i = 0; i < vtpfile.piece[0].ncells; i++) {
      relationIndices[2 * i + 0] = vtpfile.piece[0].cellData.get("SourceSaddle").data[i];
      relationIndices[2 * i + 1] = vtpfile.piece[0].cellData.get("DestinationExtremum").data[i];
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, relationBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, relationIndices, gl.STATIC_DRAW);
  }

  let edgeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vtpfile.piece[0].cells.connectivity.data, gl.STATIC_DRAW);

  async function setup(name) {
    // ================= VTP ============================
    const vtpRequest = await fetch("vtps/" + name + ".vtp");
    if (!vtpRequest.ok) {
      console.error(`Failed to download VTP file: ${vtpRequest.status}`);
    }
    vtpfile = new VTP(await vtpRequest.text());
    console.log(vtpfile);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vtpfile.piece[0].points.data, gl.STATIC_DRAW);

    gl.vertexAttribIPointer(0, vtpfile.piece[0].points.ncomp, gl.UNSIGNED_INT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    relationBuffer = gl.createBuffer();
    {
      const relationIndices = new Uint16Array(2 * vtpfile.piece[0].ncells);
      for (let i = 0; i < vtpfile.piece[0].ncells; i++) {
        relationIndices[2 * i + 0] = vtpfile.piece[0].cellData.get("SourceSaddle").data[i];
        relationIndices[2 * i + 1] = vtpfile.piece[0].cellData.get("DestinationExtremum").data[i];
      }

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, relationBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, relationIndices, gl.STATIC_DRAW);
    }

    edgeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vtpfile.piece[0].cells.connectivity.data, gl.STATIC_DRAW);
  }

  raycaster.volumeChangeCallback = setup;

  function draw() {
    const startTime = performance.now();

    if (raycaster.volume_dimension) {
      var scaleFactor = raycaster.volume_dimension[0];
      for (let i = 0; i < raycaster.volume_dimension.length; i++) {
        const f = raycaster.volume_dimension[i];
        if (scaleFactor != f) {
          console.error("Volume is not a cube :C", raycaster.volume_dimension);
          break;
        }
      }
    } else {
      var scaleFactor = 1;
    }

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
      const color = hexToRGBf(pointsColorInput.value);
      gl.uniform3f(gl.getUniformLocation(shaderProgram, "color"), color[0], color[1], color[2]);
      gl.uniform1f(gl.getUniformLocation(shaderProgram, "pointSize"), 5.0);
      gl.drawArrays(gl.POINTS, 0, vtpfile.piece[0].points.length);
    }

    if (displayConnectivityCheckbox.checked) {
      const color = hexToRGBf(connectivityColorInput.value);
      gl.uniform3f(gl.getUniformLocation(shaderProgram, "color"), color[0], color[1], color[2]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuffer);
      gl.drawElements(gl.LINES, vtpfile.piece[0].cells.connectivity.length, gl.UNSIGNED_INT, 0);
    }

    if (displayRelationsCheckbox.checked) {
      const color = hexToRGBf(relationsColorInput.value);
      gl.uniform3f(gl.getUniformLocation(shaderProgram, "color"), color[0], color[1], color[2]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, relationBuffer);
      gl.drawElements(gl.LINES, 2 * vtpfile.piece[0].ncells, gl.UNSIGNED_SHORT, 0);
    }

    gl.finish();
    const endTime = performance.now();
    const deltaTime = endTime - startTime;
    frameTimeMonitor.innerHTML = deltaTime.toPrecision(5);
    frameRateMonitor.innerHTML = Math.round(1000.0 / deltaTime);

    requestAnimationFrame(draw);
  }

  draw();
  // Keep drawing
  requestAnimationFrame(draw);
})();
