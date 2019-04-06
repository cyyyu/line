import * as THREE from "three";
import * as d3Scale from "d3-scale";
import { max } from "./util";

// Constants
const lineColor = 0xdf0054;
const dotColor = 0x480032;
const overlayColor = 0xffece2;
const verticalLineMeshName = "verticalLineMesh";

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
    this.size = { width: size.width * 2, height: size.height * 2 };
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
    const positions = [];
    const Z = 0;

    for (let i = 0, len = data.length; i < len; ++i) {
      positions.push(this.xScale(i), this.yScale(data[i]), Z);
    }

    geometry.addAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.computeBoundingSphere();
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(lineColor)
    });
    const mesh = new THREE.Line(geometry, material);
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
      size: 6
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
    const xIndex = Math.round(this.xScale.invert(offsetX * 2));
    const x = this.xScale(xIndex);
    const y = this.yScale(data[xIndex]);

    const verticalLineMesh = new THREE.Object3D();
    verticalLineMesh.name = verticalLineMeshName;

    // Line
    const Z = 2;
    {
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute(
        "position",
        new THREE.Float32BufferAttribute([x, this.size.height, Z, x, 0, Z], 3)
      );
      geometry.computeBoundingSphere();
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(lineColor)
      });
      const mesh = new THREE.Line(geometry, material);
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
        size: 12 // Double size
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
