#version 300 es

in vec3 inputPosition;

uniform mat4 cameraMatrix;
uniform float pointSize;
uniform float scaleFactor;

void main() {
  vec3 offset = vec3(0.5, 0.5, 0.5);
  gl_Position = cameraMatrix * vec4((inputPosition / scaleFactor) + offset, 1.0);
  gl_PointSize = pointSize;
}