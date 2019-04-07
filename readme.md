# Line

[![npm version](https://badge.fury.io/js/simple-line-chart.svg)](https://badge.fury.io/js/simple-line-chart)

Dead simple line chart in webgl.

<img src="./imgs/screenshot.png" width="280" />

### Highlights

- Due to limitations of the OpenGL Core Profile on most platforms, the maximun line width is not constant(mostly is 1.0). So instead of drawing lines on webgl, use triangles to simulate the line and render them as regular buffergeometries.

<img src="./imgs/line-wireframe.png" width="400" />

- To improve 2D canvas resolution by setting its display size 4x as the size of its drawing buffer. The result looks really promising as a avg chart.

### Demo

Please visit: [demo](https://cyyyu.github.io/projects/simple-line-chart/)

### Usage

`npm install --save simple-line-chart`

```
import line from "simple-line-chart";

line({
  canvas: document.querySelector("canvas"),
  data: [100, 200, 300, 200, 400, 100],
  interactive: true, // Optional
  onHover: value => {}, // Optional. Require 'interactive' to be true
  onLeave: () => {} // Optional. Require 'interactive' to be true
});
```

### License

MIT ([Chuang Yu <cyu9960@gmail.com>](https://github.com/cyyyu))
