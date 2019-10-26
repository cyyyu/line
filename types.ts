type TupleData = [number, number]; // [x, y]
type YData = number; // Only y values
export type RawData = TupleData | YData;

export interface Data {
  x: number;
  y: number;
}

export type Color = { r: number; g: number; b: number };
