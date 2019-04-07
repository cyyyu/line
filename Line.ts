import * as THREE from "three";
import * as d3Scale from "d3-scale";
import { max } from "./util";

// Constants
const lineColor = 0xdf0054;
const dotColor = 0x480032;
const overlayColor = 0xffece2;
const verticalLineMeshName = "verticalLineMesh";
const lineWidth = 10;

export interface Options {
  canvas: HTMLCanvasElement;
  data: number[];
  interactive?: boolean;
  onHover?: (value: number) => void;
  onLeave?: () => void;
}

export default class Line {
  private options: Options;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private size: { width: number; height: number };
  private xScale: d3Scale.ScaleLinear<number, number>;
  private yScale: d3Scale.ScaleLinear<number, number>;

  constructor(options: Options) {
    this.options = options;
    this.initContext();
    this.buildLine();
    this.buildDots();
    this.buildOverlay();
    options.interactive && this.bindListener();
    this.draw();
  }

  private initContext() {
    const { canvas, data } = this.options;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    const size = canvas.getBoundingClientRect();
    this.size = { width: size.width * 4, height: size.height * 4 };
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
    this.xScale = d3Scale
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([0, this.size.width]);
    const maxVal = max(data);
    this.yScale = d3Scale
      .scaleLinear()
      .domain([0, maxVal])
      .range([0, this.size.height * 0.8]);

    canvas.width = this.size.width;
    canvas.height = this.size.height;
    canvas.style.width = size.width + "px";
    canvas.style.height = size.height + "px";
  }

  private buildLine() {
    const { data } = this.options;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    const Z = 0;

    const halfLineWidth = lineWidth / 2;

    const firstPointX = this.xScale(0);
    const firstPointY = this.yScale(data[0]);
    let tempPrePoint12 = [
      [firstPointX, firstPointY - halfLineWidth],
      [firstPointX, firstPointY + halfLineWidth]
    ];
    let tempDeltas = [0, 0];

    // Drawing rectangles like:
    // 1 2 4
    // 0 3 5
    for (let i = 1, len = data.length; i < len; ++i) {
      const preX = this.xScale(i - 1);
      const preY = this.yScale(data[i - 1]);
      const curX = this.xScale(i);
      const curY = this.yScale(data[i]);

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
        const nexX = this.xScale(i + 1);
        const nexY = this.yScale(data[i + 1]);

        // line segment from point 1 to 2
        k1 = (curY - preY) / (curX - preX);
        b1 = preY - preX * k1;
        deltaB1 = halfLineWidth / Math.cos(Math.atan(k1));

        // line segment from point 2 to 4
        k2 = (nexY - curY) / (nexX - curX);
        b2 = curY - curX * k2;
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

  private buildDots() {
    const { data } = this.options;
    const geometry = new THREE.BufferGeometry();
    const positions = [];

    const Z = 1;

    for (let i = 0, len = data.length; i < len; ++i) {
      positions.push(this.xScale(i), this.yScale(data[i]), Z);
    }

    geometry.addAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.computeBoundingSphere();
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(dotColor),
      size: 24
    });
    const mesh = new THREE.Points(geometry, material);
    this.scene.add(mesh);
  }

  private buildOverlay() {
    const { data } = this.options;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    const Z = -1;

    for (let i = 1, len = data.length; i < len; ++i) {
      const preX = this.xScale(i - 1);
      const preY = this.yScale(data[i - 1]);
      const curX = this.xScale(i);
      const curY = this.yScale(data[i]);
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

  private drawVerticalLine(e: MouseEvent) {
    const { data, onHover } = this.options;
    const { offsetX } = e;
    const xIndex = Math.round(this.xScale.invert(offsetX * 4));
    const x = this.xScale(xIndex);
    const y = this.yScale(data[xIndex]);

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
        color: new THREE.Color(lineColor),
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
        size: 36
      });
      const mesh = new THREE.Points(geometry, material);
      verticalLineMesh.add(mesh);
    }

    this.removeVerticalLine();
    this.scene.add(verticalLineMesh);
    this.draw();

    // Emit callback
    onHover && onHover(data[xIndex]);
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
