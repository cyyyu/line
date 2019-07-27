import * as THREE from "three";
import * as d3Scale from "d3-scale";
import { max, LTTB, Data, isYData } from "./util";

// Constants
const lineColor = 0xdf0054;
const activeLineColor = 0x000000;
const dotColor = 0x480032;
const overlayColor = 0xffece2;
const verticalLineMeshName = "verticalLineMesh";
const lineWidth = 6;
const resolution = 2; // like 2x zoomed out

export interface Options {
  canvas: HTMLCanvasElement;
  data: Data[];
  interactive?: boolean;
  onHover?: (value: Data) => void;
  onLeave?: () => void;
  downsample?: boolean | number;
  paddingX?: number;
  paddingY?: number;
}

const DefaultOptions: Partial<Options> = {
  interactive: true,
  downsample: true,
  paddingX: 10,
  paddingY: 10
};

export default class Line {
  private options: Options;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private size: { width: number; height: number }; // Actual size of rendering
  private xScale: d3Scale.ScaleLinear<number, number>;
  private yScale: d3Scale.ScaleLinear<number, number>;
  private data: Options["data"];
  private checkedIsYData: boolean;

  constructor(options: Options) {
    const { data, canvas } = options;
    const { length } = data;

    if (!length) return;

    this.checkedIsYData = isYData(data[0]);

    this.options = Object.assign({}, DefaultOptions, options);

    const { paddingX, paddingY, downsample, data } = this.options;

    const size = canvas.getBoundingClientRect();
    this.size = {
      width: size.width * resolution,
      height: size.height * resolution
    };
    canvas.width = this.size.width;
    canvas.height = this.size.height;
    canvas.style.width = size.width + "px";
    canvas.style.height = size.height + "px";

    if (typeof downsample == "number" || this.downsample) {
      this.data = LTTB(
          data,
          typeof downsample === "number"
            ? downsample
            : this.calThreshold(data)
        )
    } else this.data = data;

    this.xScale = d3Scale
      .scaleLinear()
      .domain(
        this.checkedIsYData
          ? [0, this.data.length - 1]
          : [this.data[0][0], this.data[this.data.length - 1][0]]
      )
      .range([paddingX, this.size.width - paddingX]);
    const maxVal = max(data); // Still use max val from original data
    this.yScale = d3Scale
      .scaleLinear()
      .domain([0, maxVal])
      .range([paddingY, this.size.height * 0.8 - paddingY]);

    this.initContext();
    this.buildLine();
    this.buildOverlay();
    this.options.interactive && this.bindListener();
    this.draw();
  }

  private calThreshold(data: Options["data"]): number {
    const { length } = data;

    if (length < 2) return length;

    // The interval of two adjacent points is 5 display pixels
    const maxPoints = Math.floor(this.size.width / 5 + 1);

    return length > maxPoints ? maxPoints : length;
  }

  private initContext() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.renderer.setSize(this.size.width, this.size.height);
    this.camera = new THREE.OrthographicCamera(
      0,
      this.size.width,
      this.size.height,
      0,
      10,
      100
    );
    this.camera.position.z = 20;
  }

  private buildLine() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    const Z = 0;

    const halfLineWidth = lineWidth / 2;

    const firstPointX = this.xScale(this.checkedIsYData ? 0 : this.data[0][0]);
    const firstPointY = this.yScale(
      this.checkedIsYData ? this.data[0] : this.data[0][1]
    );
    let tempPrePoint12 = [
      [firstPointX, firstPointY - halfLineWidth],
      [firstPointX, firstPointY + halfLineWidth]
    ];
    let tempDeltas = [0, 0];

    // Drawing rectangles like:
    // 1 2 4
    // 0 3 5
    for (let i = 1, len = this.data.length; i < len; ++i) {
      const preX = this.xScale(
        this.checkedIsYData ? i - 1 : this.data[i - 1][0]
      );
      const preY = this.yScale(
        this.checkedIsYData ? this.data[i - 1] : this.data[i - 1][1]
      );
      const curX = this.xScale(this.checkedIsYData ? i : this.data[i][0]);
      const curY = this.yScale(
        this.checkedIsYData ? this.data[i] : this.data[i][1]
      );

      let x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        deltaB1: number,
        deltaB2: number,
        k1: number,
        k2: number,
        b1: number,
        b2: number;

      // Not last point
      if (i !== len - 1) {
        const nexX = this.xScale(
          this.checkedIsYData ? i + 1 : this.data[i + 1][0]
        );
        const nexY = this.yScale(
          this.checkedIsYData ? this.data[i + 1] : this.data[i + 1][1]
        );

        // line segment from point 1 to 2
        k1 = (curY - preY) / (curX - preX);
        b1 = preY - preX * k1;
        deltaB1 = halfLineWidth / Math.cos(Math.atan(k1));

        // line segment from point 2 to 4
        k2 = (nexY - curY) / (nexX - curX);
        b2 = curY - curX * k2;

        // when the slops of two line are same, skip it
        if (k1 === k2) continue;

        deltaB2 = halfLineWidth / Math.cos(Math.atan(k2));
        tempDeltas[0] = deltaB1;
        tempDeltas[1] = deltaB2;
      } else {
        deltaB1 = tempDeltas[0];
        deltaB2 = tempDeltas[1];
      }

      // point 0: (x0, y0)
      x0 = i === 1 ? preX : tempPrePoint12[0][0];
      y0 = i === 1 ? preY - deltaB1 : tempPrePoint12[0][1];

      // point 1: (x1, y1)
      x1 = i === 1 ? preX : tempPrePoint12[1][0];
      y1 = i === 1 ? preY + deltaB1 : tempPrePoint12[1][1];

      // point 2: (x2, y2)
      x2 = i === len - 1 ? curX : (b2 - b1 + deltaB2 - deltaB1) / (k1 - k2);
      y2 = i === len - 1 ? curY + deltaB2 : k1 * x2 + b1 + deltaB1;

      // point 3: (x3, y3)
      x3 = i === len - 1 ? curX : (b2 - b1 - deltaB2 + deltaB1) / (k1 - k2);
      y3 = i === len - 1 ? curY - deltaB2 : k1 * x3 + b1 - deltaB1;

      vertices.push(
        // 0
        x0,
        y0,
        Z,
        // 1
        x1,
        y1,
        Z,
        // 2
        x2,
        y2,
        Z,
        // 0
        x0,
        y0,
        Z,
        // 2
        x2,
        y2,
        Z,
        // 3
        x3,
        y3,
        Z
      );

      tempPrePoint12[0] = [x3, y3];
      tempPrePoint12[1] = [x2, y2];
    }

    geometry.addAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(lineColor),
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = Z;
    this.scene.add(mesh);
  }

  private buildOverlay() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    const Z = -1;

    for (let i = 1, len = this.data.length; i < len; ++i) {
      const preX = this.xScale(
        this.checkedIsYData ? i - 1 : this.data[i - 1][0]
      );
      const preY = this.yScale(
        this.checkedIsYData ? this.data[i - 1] : this.data[i - 1][1]
      );
      const curX = this.xScale(this.checkedIsYData ? i : this.data[i][0]);
      const curY = this.yScale(
        this.checkedIsYData ? this.data[i] : this.data[i][1]
      );
      vertices.push(
        // 0
        preX,
        0,
        Z,
        // 1
        preX,
        preY,
        Z,
        // 2
        curX,
        curY,
        Z,
        // 0
        preX,
        0,
        Z,
        // 2
        curX,
        curY,
        Z,
        // 3
        curX,
        0,
        Z
      );
    }

    geometry.addAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(overlayColor),
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = Z;
    this.scene.add(mesh);
  }

  private bindListener() {
    const { canvas } = this.options;
    canvas.addEventListener("mousemove", this.drawVerticalLine.bind(this));
    canvas.addEventListener("mouseleave", this.onMouseLeave.bind(this));
  }

  private getXIndexByOffset(offsetX: number) {
    const roughX = this.xScale.invert(offsetX * resolution);
    if (this.checkedIsYData) {
      return Math.round(roughX);
    } else {
      for (let i = 0, len = this.data.length - 1; i < len; i++) {
        const cur = this.data[i];
        const nex = this.data[i + 1];
        if (cur[0] <= roughX && nex[0] >= roughX) {
          return roughX - cur[0] > nex[0] - roughX ? i + 1 : i;
        }
      }
    }
  }

  private drawVerticalLine(e: MouseEvent) {
    const { onHover } = this.options;
    const { offsetX } = e;
    let xIndex = this.getXIndexByOffset(offsetX);
    const x = this.xScale(this.checkedIsYData ? xIndex : this.data[xIndex][0]);
    const y = this.yScale(
      this.checkedIsYData ? this.data[xIndex] : this.data[xIndex][1]
    );

    const verticalLineMesh = new THREE.Object3D();
    verticalLineMesh.name = verticalLineMeshName;

    // Line
    const Z = 2;
    {
      const geometry = new THREE.BufferGeometry();
      const halfLineWidth = lineWidth / 2;
      const vertices = [
        x - halfLineWidth,
        0,
        Z,
        x - halfLineWidth,
        this.size.height,
        Z,
        x + halfLineWidth,
        this.size.height,
        Z,
        x - halfLineWidth,
        0,
        Z,
        x + halfLineWidth,
        this.size.height,
        Z,
        x + halfLineWidth,
        0,
        Z
      ];
      geometry.addAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3)
      );
      geometry.computeBoundingSphere();
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(activeLineColor),
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      verticalLineMesh.add(mesh);
    }
    // Dot
    {
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute(
        "position",
        new THREE.Float32BufferAttribute([x, y, Z], 3)
      );
      geometry.computeBoundingSphere();
      const material = new THREE.PointsMaterial({
        color: new THREE.Color(dotColor),
        size: 18
      });
      const mesh = new THREE.Points(geometry, material);
      verticalLineMesh.add(mesh);
    }

    this.removeVerticalLine();
    this.scene.add(verticalLineMesh);
    this.draw();

    // Emit callback
    onHover && onHover(this.data[xIndex]);
  }

  private onMouseLeave() {
    const { onLeave } = this.options;
    this.removeVerticalLine();
    onLeave && onLeave();
  }

  private removeVerticalLine() {
    const prevLine = this.scene.getObjectByName(verticalLineMeshName);
    if (prevLine) this.scene.remove(prevLine);
    this.draw();
  }

  private draw() {
    const { canvas } = this.options;
    this.renderer.render(this.scene, this.camera);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, this.size.width, this.size.height);
      ctx.drawImage(
        this.renderer.domElement,
        0,
        0,
        this.size.width,
        this.size.height
      );
    }
  }
}
