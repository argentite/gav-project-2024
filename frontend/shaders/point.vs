#version 300 es

in uvec3 inputPosition;

uniform mat4 cameraMatrix;
uniform float pointSize;
uniform float scaleFactor;

void main() {
  gl_Position = cameraMatrix * vec4(vec3(inputPosition) / scaleFactor, 1.0);
  gl_PointSize = pointSize;
}