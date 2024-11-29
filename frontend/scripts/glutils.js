/**
 * 
 * @param {WebGL2RenderingContext} gl 
 * @param {GLenum} type 
 * @param {String} path 
 */
export async function loadShaderModule(gl, type, path) {
  let source = await (await fetch(path)).text();

  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Error compiling shader:\n${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * 
 * @param {WebGL2RenderingContext} gl 
 * @param {String} vspath 
 * @param {String} fspath 
 */
export async function loadShaderProgram(gl, vspath, fspath) {
  const [vertexShader, fragmentShader] = await Promise.all([
    loadShaderModule(gl, gl.VERTEX_SHADER, vspath),
    loadShaderModule(gl, gl.FRAGMENT_SHADER, fspath)
  ]);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(`Unable to link shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
    return null;
  }

  return shaderProgram;
}
