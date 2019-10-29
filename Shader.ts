export default class Shader {
  public program: WebGLProgram;
  private gl: WebGL2RenderingContext;
  private numOfIndices: number;

  constructor(
    gl: WebGL2RenderingContext,
    vShaderSrc: string,
    fShaderSrc: string
  ) {
    const program = gl.createProgram();

    let compiled: boolean;

    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vShaderSrc);
    gl.compileShader(vShader);
    compiled = gl.getShaderParameter(vShader, gl.COMPILE_STATUS);
    if (!compiled) {
      console.warn(
        "Vertex shader compiler log: " + gl.getShaderInfoLog(vShader)
      );
    }

    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fShaderSrc);
    gl.compileShader(fShader);
    compiled = gl.getShaderParameter(fShader, gl.COMPILE_STATUS);
    if (!compiled) {
      console.warn(
        "Fragment shader compiler log: " + gl.getShaderInfoLog(fShader)
      );
    }

    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);

    gl.deleteShader(vShader);
    gl.deleteShader(fShader);

    // todo: check failure
    gl.linkProgram(program);

    this.program = program;
    this.gl = gl;
  }

  public use() {
    this.gl.useProgram(this.program);
  }

  public set2fv(name: string, v: Float32Array) {
    this.gl.uniform2fv(this.gl.getUniformLocation(this.program, name), v);
  }

  public setMat4(name: string, mat4: Float32Array) {
    this.gl.uniformMatrix4fv(
      this.gl.getUniformLocation(this.program, name),
      false,
      mat4
    );
  }

  public setNumOfIndices(n: number) {
    this.numOfIndices = n;
  }

  public draw(buffer: WebGLVertexArrayObject) {
    const { gl } = this;
    gl.bindVertexArray(buffer);
    gl.drawElements(gl.TRIANGLES, this.numOfIndices, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
}
