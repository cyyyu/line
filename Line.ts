import { getProperBounds, LTTB, createLinearScale, makeSmooth } from "./util";
import { Data, RawData, Color } from "./types";
import { vec2, vec3, mat4 } from "gl-matrix";
import Shader from "./Shader";

export interface Options {
  canvas: HTMLCanvasElement;
  data: RawData[];
  color?: Color;
  backgroundColor?: Color;
  downsample?: boolean | number;
}

// constants
const THICKNESS = 3.2;
const LINE_COLOR: Color = {
  r: 217,
  g: 21,
  b: 78
};
const BG_COLOR: Color = {
  r: 250,
  g: 250,
  b: 250
};

const DefaultOptions: Partial<Options> = {
  downsample: true,
  color: LINE_COLOR,
  backgroundColor: BG_COLOR
};

export default class Line {
  private options: Options;
  private data: Data[];
  private gl: WebGL2RenderingContext;

  private lineShader: Shader;
  private overlayShader: Shader;

  private lineVAO: WebGLVertexArrayObject;
  private overlayVAO: WebGLVertexArrayObject;

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
    if (!this.gl) throw new Error("You browser doesn't support WebGL2.");

    const { width, height } = canvas;

    // improve resolution
    const fact = 2;
    canvas.width = width * fact;
    canvas.height = height * fact;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    this.gl.viewport(0, 0, width * fact, height * fact);
    this.gl.enable(this.gl.DEPTH_TEST);

    this.data = this.processData(data, downsample, width);

    this.frustum = {
      left: 0,
      right: width * fact,
      bottom: 0,
      top: height * fact,
      near: 1,
      far: 100
    };

    this.createScaleMappers();
    this.createShaders();
    this.buildObjects();
    this.draw();
  }

  private createScaleMappers() {
    this.xScale = createLinearScale(
      [this.data[0].x, this.data[this.data.length - 1].x],
      [this.frustum.left, this.frustum.right]
    );

    const bounds = getProperBounds(this.data);
    this.yScale = createLinearScale(bounds, [
      this.frustum.bottom,
      this.frustum.top
    ]);
  }

  // RawData -> Data
  // respect downsampling
  private processData(
    rawData: RawData[],
    downsample: Options["downsample"],
    width: number
  ): Data[] {
    const isOneDemensionData = typeof rawData[0] === "number";

    let result: Data[] = [];

    if (isOneDemensionData)
      rawData.forEach((item, index) =>
        result.push({ x: index, y: item as number })
      );
    else rawData.forEach(item => result.push({ x: item[0], y: item[1] }));

    if (typeof downsample == "number" || downsample)
      result = LTTB(
        result,
        typeof downsample === "number"
          ? downsample
          : this.calThreshold(result, width)
      );

    // make corners smooth
    result = makeSmooth(result);

    return result;
  }

  private createShaders() {
    const { gl } = this;
    const { color, backgroundColor } = this.options;

    const lineVShaderSrc = `
      attribute vec2 position;
      uniform mat4 mvp;
      void main() {
        gl_Position = mvp * vec4(position, 0.0, 1.0);
      }
    `;
    const lineFShaderSrc = `
      precision highp float;
      vec3 lineColor = vec3(${color!.r / 250.0}, ${color!.g / 250.0}, ${color!
      .b / 250.0});
      void main() {
        gl_FragColor = vec4(lineColor, 1.0);
      }
    `;

    this.lineShader = new Shader(gl, lineVShaderSrc, lineFShaderSrc);

    const overlayVShaderSrc = `
      attribute vec2 position;
      uniform mat4 mvp;
      void main() {
        gl_Position = mvp * vec4(position, -0.1, 1.0);
      }
    `;
    const overlayFShaderSrc = `
      precision mediump float;
      uniform vec2 resolution;
      vec3 bg = vec3(${backgroundColor!.r / 250.0}, ${backgroundColor!.g /
      250.0}, ${backgroundColor!.b / 250.0});
      void main() {
        vec2 st = gl_FragCoord.xy / resolution;
        float c = smoothstep(1.2, 0.0, st.y);
        gl_FragColor = vec4(c * bg, 1.0);
      }
    `;

    this.overlayShader = new Shader(gl, overlayVShaderSrc, overlayFShaderSrc);
  }

  private calThreshold(data: Data[], width: number): number {
    const { length } = data;

    if (length < 2) return length;

    // The interval of two adjacent points is 15 display pixels
    const maxPoints = Math.floor(width / 15 + 1);

    return length > maxPoints ? maxPoints : length;
  }

  // build vertics and indices that form the line segments
  private buildObjects() {
    const { gl } = this;

    const lineVertices: number[] = [];
    const lineIndices: number[] = [];
    const overlayVertices: number[] = [];
    const overlayIndices: number[] = [];

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
      lineVertices.push(
        // 0
        t0[0],
        t0[1],
        // 1
        t1[0],
        t1[1]
      );

      if (t0[0] < t1[0]) {
        overlayVertices.push(
          // 0
          t0[0],
          this.frustum.bottom,
          // 1
          t0[0],
          t0[1]
        );
      } else {
        overlayVertices.push(
          // 0
          t1[0],
          this.frustum.bottom,
          // 1
          t1[0],
          t1[1]
        );
      }
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

      lineVertices.push(
        // 2
        t2[0],
        t2[1],
        // 3
        t3[0],
        t3[1]
      );
      overlayVertices.push(
        // 0
        t3[0],
        this.frustum.bottom,
        // 1
        t3[0],
        t3[1]
      );
      lineIndices.push(
        1 + (i - 1) * 2,
        0 + (i - 1) * 2,
        2 + (i - 1) * 2,
        1 + (i - 1) * 2,
        2 + (i - 1) * 2,
        3 + (i - 1) * 2
      );
      overlayIndices.push(
        1 + (i - 1) * 2,
        0 + (i - 1) * 2,
        2 + (i - 1) * 2,
        1 + (i - 1) * 2,
        2 + (i - 1) * 2,
        3 + (i - 1) * 2
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
      lineVertices.push(
        // 4
        t4[0],
        t4[1],
        // 5
        t5[0],
        t5[1]
      );
      if (t4[0] < t5[0]) {
        overlayVertices.push(
          // 0
          t5[0],
          this.frustum.bottom,
          // 1
          t5[0],
          t5[1]
        );
      } else {
        overlayVertices.push(
          // 0
          t4[0],
          this.frustum.bottom,
          // 1
          t4[0],
          t4[1]
        );
      }

      lineIndices.push(
        1 + i * 2,
        0 + i * 2,
        2 + i * 2,
        1 + i * 2,
        2 + i * 2,
        3 + i * 2
      );
      overlayIndices.push(
        1 + i * 2,
        0 + i * 2,
        2 + i * 2,
        1 + i * 2,
        2 + i * 2,
        3 + i * 2
      );
    }

    {
      const lineVAO = gl.createVertexArray();
      gl.bindVertexArray(lineVAO);

      const lineVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, lineVBO);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(lineVertices),
        gl.STATIC_DRAW
      );

      const lineEBO = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineEBO);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(lineIndices),
        gl.STATIC_DRAW
      );

      const positionLoc = gl.getAttribLocation(
        this.lineShader.program,
        "position"
      );
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(positionLoc);

      this.lineVAO = lineVAO;
      this.lineShader.setNumOfIndices(lineIndices.length);
    }

    {
      const overlayVAO = gl.createVertexArray();
      gl.bindVertexArray(overlayVAO);

      const overlayVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, overlayVBO);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(overlayVertices),
        gl.STATIC_DRAW
      );

      const overlayEBO = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, overlayEBO);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(overlayIndices),
        gl.STATIC_DRAW
      );

      const positionLoc = gl.getAttribLocation(
        this.overlayShader.program,
        "position"
      );
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(positionLoc);

      this.overlayVAO = overlayVAO;
      this.overlayShader.setNumOfIndices(overlayIndices.length);
    }
  }

  private buildMVP() {
    const { gl, frustum } = this;

    const p = mat4.ortho(
      mat4.create(),
      frustum.left,
      frustum.right,
      frustum.bottom,
      frustum.top,
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

    return mvp;
  }

  private draw() {
    const { gl } = this;
    const { backgroundColor } = this.options;

    gl.clearColor(
      backgroundColor.r / 250.0,
      backgroundColor.g / 250.0,
      backgroundColor.b / 250.0,
      1
    );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const mvp = this.buildMVP();

    this.lineShader.use();
    this.lineShader.setMat4("mvp", mvp);
    this.lineShader.draw(this.lineVAO);

    this.overlayShader.use();
    this.overlayShader.setMat4("mvp", mvp);
    this.overlayShader.set2fv(
      "resolution",
      new Float32Array([
        this.frustum.right - this.frustum.left,
        this.frustum.top - this.frustum.bottom
      ])
    );
    this.overlayShader.draw(this.overlayVAO);
  }
}
