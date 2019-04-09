import Line, { Options } from "./Line";

export default function line(options: Options): Line {
  return new Line(options);
}
