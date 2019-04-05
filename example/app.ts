import line from "../index";

const data = [];

for (let i = 1; i < 20; i++) {
  data.push(Math.random() * 50 + 20);
}

line({
  canvas: document.querySelector("canvas"),
  data,
  interactive: true,
  onHover: value => {
    document.querySelector("#val").textContent = value.toString();
  },
  onLeave: () => {
    document.querySelector("#val").textContent = "";
  }
});
