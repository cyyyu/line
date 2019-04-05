import * as THREE from "three";
import * as d3Scale from "d3-scale";
import { max } from "./util";

export interface Options {
  canvas: HTMLCanvasElement;
  data: number[];
}

export default class Line {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor({ canvas, data }: Options) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new THREE.Scene();

    const size = canvas.getBoundingClientRect();
    this.renderer.setSize(size.width, size.height);
    this.camera = new THREE.OrthographicCamera(
      0,
      size.width,
      size.height,
      0,
      10,
      100
    );
    this.camera.position.z = 20;

    const geometry = new THREE.BufferGeometry();

    const positions = [];
    const xScale = d3Scale
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([0, size.width]);
    const maxVal = max(data);
    const yScale = d3Scale
      .scaleLinear()
      .domain([0, maxVal])
      .range([0, size.height * 0.8]);
    const Z = 0;

    for (let i = 0, len = data.length; i < len; ++i) {
      positions.push(xScale(i), yScale(data[i]), Z);
    }

    geometry.addAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.computeBoundingSphere();
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(0xffffff),
      linewidth: 4
    });
    const mesh = new THREE.Line(geometry, material);
    this.scene.add(mesh);

    this.renderer.render(this.scene, this.camera);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(this.renderer.domElement, 0, 0, size.width, size.height);
    }
  }
}
