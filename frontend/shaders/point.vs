#version 300 es

in ivec3 inputPosition;

uniform mat4 cameraMatrix;

void main() {
  gl_Position = cameraMatrix * vec4(vec3(inputPosition), 1.0);
  gl_PointSize = 3.0;
}