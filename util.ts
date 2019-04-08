export function max(data: number[]): number {
  if (!data.length) return 0;
  let re = data[0];
  for (let i = 1, len = data.length; i < len; ++i) {
    if (data[i] > re) re = data[i];
  }
  return re;
}

// Largest triangles dynamic data dowmsampling algorithm
// Based on Sveinn Steinarsson's 2013 paper: https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
export function LTD(data: number[], threshold: number): number[] {
  // Todo
  return data;
}
