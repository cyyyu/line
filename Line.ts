import * as THREE from "three";
import * as d3Scale from "d3-scale";
import { max } from "./util";

const lineColor = 0xdf0054;
const dotColor = 0x480032;
const overlayColor = 0xffece2;

export interface Options {
  canvas: HTMLCanvasElement;
  data: number[];
}

export default class Line {
  private options: Options;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private size: ClientRect;
  private xScale: d3Scale.ScaleLinear<number, number>;
  private yScale: d3Scale.ScaleLinear<number, number>;

  constructor(options: Options) {
    this.options = options;
    this.initContext();
    this.buildLine();
    this.buildDots();
    this.buildOverlay();
    this.draw();
  }

  private initContext() {
    const { canvas, data } = this.options;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.size = canvas.getBoundingClientRect();
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
      size: 3
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

  private draw() {
    const { canvas } = this.options;
    this.renderer.render(this.scene, this.camera);
    const ctx = canvas.getContext("2d");
    if (ctx) {
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
