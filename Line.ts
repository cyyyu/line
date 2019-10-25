import { max, min, LTTB, createLinearScale } from "./util";
import { Data, RawData } from "./types";
import { vec2, vec3, mat4 } from "gl-matrix";

export interface Options {
  canvas: HTMLCanvasElement;
  data: RawData[];
  color?: { r: number; g: number; b: number };
  downsample?: boolean | number;
}

// constants
const PADDING = 20;
const THICKNESS = 4;
const LINE_COLOR: Options["color"] = {
  r: 217,
  g: 21,
  b: 78
};

const DefaultOptions: Partial<Options> = {
  downsample: true,
  color: LINE_COLOR
};

export default class Line {
  private options: Options;
  private data: Data[];
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private numIndices: number;
  private frustum: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    near: number;
    far: number;
  };
  private xScale: (n: number) => number;
  private yScale: (n: number) => number;

  constructor(options: Options) {
    // merge default options with user defined
    this.options = Object.assign({}, DefaultOptions, options);

    const { data, canvas, downsample } = this.options;

    if (data.length < 2) {
      // two more points made lines
      return;
    }

    this.gl = canvas.getContext("webgl2");
    if (!this.gl) throw new Error("Unable to create webgl2 context.");

    const { width, height } = canvas;

    this.gl.viewport(0, 0, width, height);

    this.data = this.processData(data, downsample, width);

    this.frustum = {
      left: 0,
      right: width,
      bottom: 0,
      top: height,
      near: 1,
      far: 100
    };

    this.createScaleMappers();
    this.createProgram();
    this.buildLine();
    this.draw();
  }

  private createScaleMappers() {
    this.xScale = createLinearScale(
      [this.data[0].x, this.data[this.data.length - 1].x],
      [this.frustum.left, this.frustum.right]
    );
    this.yScale = createLinearScale(
      [min(this.data), max(this.data)],
      [this.frustum.bottom, this.frustum.top]
    );
  }

  // RawData -> Data
  // respect downsampling
  private processData(
    rawData: RawData[],
    downsample: Options["downsample"],
    width: number
  ): Data[] {
    const isOneDemensionData = typeof rawData[0] === "number";

    const result: Data[] = [];

    if (isOneDemensionData)
      rawData.forEach((item, index) =>
        result.push({ x: index, y: item as number })
      );
    else rawData.forEach(item => result.push({ x: item[0], y: item[1] }));

    if (typeof downsample == "number" || downsample)
      return LTTB(
        result,
        typeof downsample === "number"
          ? downsample
          : this.calThreshold(result, width)
      );
    else return result;
  }

  private createProgram() {
    const { gl } = this;
    const { color } = this.options;

    const program = gl.createProgram();

    const vShaderSrc = `
      attribute vec2 position;
      uniform mat4 mvp;
      void main() {
        gl_Position = mvp * vec4(position, 0.0, 1.0);
      }
    `;
    const fShaderSrc = `
      precision highp float;
      vec3 lineColor = vec3(${color!.r / 255.0}, ${color!.g / 255.0}, ${color!
      .b / 255.0});
      void main() {
        gl_FragColor = vec4(lineColor, 1.0);
      }
    `;

    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vShaderSrc);
    gl.compileShader(vShader);
    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fShaderSrc);
    gl.compileShader(fShader);

    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);

    gl.deleteShader(vShader);
    gl.deleteShader(fShader);

    // todo: check failure
    gl.linkProgram(program);
    this.program = program;
  }

  private calThreshold(data: Data[], width: number): number {
    const { length } = data;

    if (length < 2) return length;

    // The interval of two adjacent points is 5 display pixels
    const maxPoints = Math.floor(width / 5 + 1);

    return length > maxPoints ? maxPoints : length;
  }

  // build vertics and indices that form the line segments
  private buildLine() {
    const { gl } = this;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

    let vertices: number[] = [];
    let indices: number[] = [];

    // build first point
    {
      const p0 = vec2.fromValues(
        this.xScale(this.data[0].x),
        this.yScale(this.data[0].y)
      );
      const p1 = vec2.fromValues(
        this.xScale(this.data[1].x),
        this.yScale(this.data[1].y)
      );

      const p0p1 = vec2.sub(vec2.create(), p1, p0);
      const normal = vec2.normalize(
        vec2.create(),
        vec2.fromValues(-p0p1[1], p0p1[0])
      );

      const t = vec2.fromValues(normal[0] * THICKNESS, normal[1] * THICKNESS);
      const t0 = vec2.sub(vec2.create(), p0, t);
      const t1 = vec2.add(vec2.create(), p0, t);
      vertices.push(
        // 0
        t0[0],
        t0[1],
        // 1
        t1[0],
        t1[1]
      );
    }

    // build middle points
    for (let i = 1; i < this.data.length - 1; i++) {
      const p0 = vec2.fromValues(
        this.xScale(this.data[i - 1].x),
        this.yScale(this.data[i - 1].y)
      );
      const p1 = vec2.fromValues(
        this.xScale(this.data[i].x),
        this.yScale(this.data[i].y)
      );
      const p2 = vec2.fromValues(
        this.xScale(this.data[i + 1].x),
        this.yScale(this.data[i + 1].y)
      );

      const p0p1 = vec2.sub(vec2.create(), p1, p0);
      const p1p2 = vec2.sub(vec2.create(), p2, p1);

      const p0p1Norm = vec2.normalize(vec2.create(), p0p1);
      const p1p2Norm = vec2.normalize(vec2.create(), p1p2);
      const tangent = vec2.add(vec2.create(), p0p1Norm, p1p2Norm);
      const tangentNorm = vec2.normalize(vec2.create(), tangent);
      const miter = vec2.fromValues(-tangentNorm[1], tangentNorm[0]);

      const normal0 = vec2.normalize(
        vec2.create(),
        vec2.fromValues(-p0p1[1], p0p1[0])
      );

      const len = THICKNESS / vec2.dot(miter, normal0);

      const t2 = vec2.sub(
        vec2.create(),
        p1,
        vec2.fromValues(miter[0] * len, miter[1] * len)
      );

      const t3 = vec2.add(
        vec2.create(),
        p1,
        vec2.fromValues(miter[0] * len, miter[1] * len)
      );

      vertices.push(
        // 2
        t2[0],
        t2[1],
        // 3
        t3[0],
        t3[1]
      );
      indices.push(
        0 + (i - 1) * 2,
        1 + (i - 1) * 2,
        3 + (i - 1) * 2,
        0 + (i - 1) * 2,
        3 + (i - 1) * 2,
        2 + (i - 1) * 2
      );
    }

    // build last point
    {
      const i = this.data.length - 2;
      const p1 = vec2.fromValues(
        this.xScale(this.data[i].x),
        this.yScale(this.data[i].y)
      );
      const p2 = vec2.fromValues(
        this.xScale(this.data[i + 1].x),
        this.yScale(this.data[i + 1].y)
      );
      const p1p2 = vec2.sub(vec2.create(), p2, p1);

      const normal = vec2.normalize(
        vec2.create(),
        vec2.fromValues(-p1p2[1], p1p2[0])
      );
      const t = vec2.fromValues(normal[0] * THICKNESS, normal[1] * THICKNESS);
      const t4 = vec2.sub(vec2.create(), p2, t);
      const t5 = vec2.add(vec2.create(), p2, t);
      vertices.push(
        // 4
        t4[0],
        t4[1],
        // 5
        t5[0],
        t5[1]
      );
      indices.push(
        0 + i * 2,
        1 + i * 2,
        3 + i * 2,
        0 + i * 2,
        3 + i * 2,
        2 + i * 2
      );
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const attribLoc = gl.getAttribLocation(this.program, "position");
    gl.vertexAttribPointer(attribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLoc);

    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );

    this.numIndices = indices.length;
    this.buffer = vao;
  }

  private buildMVP() {
    const { gl, frustum } = this;

    const p = mat4.ortho(
      mat4.create(),
      frustum.left - PADDING,
      frustum.right + PADDING,
      frustum.bottom - PADDING,
      frustum.top + PADDING,
      frustum.near,
      frustum.far
    );
    const v = mat4.targetTo(
      mat4.create(),
      vec3.fromValues(0, 0, 2),
      vec3.fromValues(0, 0, -1),
      vec3.fromValues(0, 1, 0)
    );
    const m = mat4.create();
    const mvp = mat4.mul(mat4.create(), mat4.mul(mat4.create(), m, v), p);

    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "mvp"), false, mvp);
  }

  private draw() {
    const { gl } = this;
    gl.useProgram(this.program);

    gl.clearColor(0.9, 0.9, 0.9, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.buildMVP();

    gl.bindVertexArray(this.buffer);
    gl.drawElements(gl.TRIANGLES, this.numIndices, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
  }
}
