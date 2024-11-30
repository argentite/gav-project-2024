import { VTP } from "./vtp.js";
import { loadShaderProgram } from "./glutils.js";
import { vec3, mat4 } from "./glmatrix/index.js";
import { ArcballCamera, Controller } from "./webgl-util.js";

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

  // Initialize Arcball camera
  const eye = vec3.set(vec3.create(), 0, 0, 50);
  const center = vec3.set(vec3.create(), 0, 0, 0);
  const up = vec3.set(vec3.create(), 0.0, 1.0, 0.0);

  const camera = new ArcballCamera(eye, center, up, 2, [canvas.width, canvas.height]);

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

  gl.clearColor(0.0, 0.0, 0.5, 1.0);

  const shaderProgram = await loadShaderProgram(gl, './shaders/point.vs', './shaders/plain.fs');
  gl.useProgram(shaderProgram);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.bufferData(gl.ARRAY_BUFFER, vtpfile.piece[0].points.data, gl.STATIC_DRAW);

  gl.vertexAttribIPointer(0, vtpfile.piece[0].points.ncomp, gl.INT, false, 0, 0);
  gl.enableVertexAttribArray(0);

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

    const viewMatrix = camera.camera; // mat4.create();
    // mat4.lookAt(viewMatrix,
    //   new Float32Array([
    //     cameraDistanceSlider.value * Math.cos(cameraYawSlider.value),
    //     cameraDistanceSlider.value * Math.sin(cameraPitchSlider.value),
    //     cameraDistanceSlider.value * Math.sin(cameraYawSlider.value)
    //   ]),
    //   new Float32Array([0, 0, 0]),
    //   new Float32Array([0, 1, 0])
    // );

    const cameraMatrix = mat4.create();
    mat4.multiply(cameraMatrix, projectionMatrix, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "cameraMatrix"), false, cameraMatrix);

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
