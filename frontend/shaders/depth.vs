#version 300 es

in uvec3 inputPosition;

uniform mat4 cameraMatrix;
uniform float pointSize;
uniform float scaleFactor;

out vec3 color;

void main() {
  gl_Position = cameraMatrix * vec4(vec3(inputPosition) / scaleFactor, 1.0);
  color = vec3(gl_Position.zzz);
  gl_PointSize = pointSize;
}