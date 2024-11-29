#version 300 es

in ivec3 inputPosition;

uniform mat4 cameraMatrix;
uniform float pointSize;

void main() {
  gl_Position = cameraMatrix * vec4(vec3(inputPosition), 1.0);
  gl_PointSize = pointSize;
}