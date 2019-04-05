export function max(data: number[]): number {
  if (!data.length) return 0;
  let re = data[0];
  for (let i = 1, len = data.length; i < len; ++i) {
    if (data[i] > re) re = data[i];
  }
  return re;
}
