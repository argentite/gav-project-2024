#version 300 es

in vec2 inputPosition;
uniform mat4 cameraMatrix;

void main() {
  gl_Position = cameraMatrix * vec4(inputPosition, 0, 1.0);
}