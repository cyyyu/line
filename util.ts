import { Data } from "./types";

export function createLinearScale(
  domain: [number, number],
  range: [number, number]
): (n: number) => number {
  const a = domain[1] - domain[0];
  const b = range[1] - range[0];
  return function(n: number) {
    const c = n - domain[0];
    return (c / a) * b + range[0];
  };
}

// Find max value
export function max(data: Data[]): number {
  let max = Number.MIN_VALUE;
  data.forEach(d => (max = Math.max(max, d.y)));
  return max;
}

// Find min value
export function min(data: Data[]): number {
  let min = Number.MIN_VALUE;
  data.forEach(d => (min = Math.min(min, d.y)));
  return min;
}

// Largest triangles three buckets data dowmsampling algorithm
// Based on Sveinn Steinarsson's 2013 paper: https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
export function LTTB(data: Data[], threshold: number): Data[] {
  const buckets: Data[][] = [];
  const { length } = data;

  if (!length || length <= threshold) return data;

  // First point
  buckets.push([data[0]]);
  // Middle
  buckets.push(...divideIntoBuckets(data.slice(1, length - 1), threshold - 2));
  // Last point
  buckets.push([data[length - 1]]);

  return buildPointsFromBuckets(buckets);
}

function buildPointsFromBuckets(buckets: Data[][]): Data[] {
  const re: Data[] = [];

  const { length } = buckets;

  // First
  re.push(buckets[0][0]);
  for (let i = 1; i < length - 1; ++i) {
    // Find the biggest triangle which is made up with
    // prePoint, nextBucketAvg and curPoint
    const nextBucket: Data[] = buckets[i + 1];
    const prePoint: Data = re[i - 1];
    const nextBucketAvg: number = avg(nextBucket);
    const curBucket: Data[] = buckets[i];
    let maxArea = 0,
      curPoint: Data;
    for (let j = 0, curBucketLen = curBucket.length; j < curBucketLen; ++j) {
      const area = calTriangleArea([
        [0, prePoint.y],
        [1, curBucket[j].y],
        [2, nextBucketAvg]
      ]);
      if (area > maxArea) curPoint = curBucket[j];
    }
    re.push(curPoint);
  }
  // Last
  re.push(buckets[length - 1][0]);

  return re;
}

function calTriangleArea(points: [number, number][]) {
  const [x1, y1] = points[0];
  const [x2, y2] = points[1];
  const [x3, y3] = points[2];
  return Math.abs(
    (x1 * y2 + x2 * y3 + x3 * y1 - x1 * y3 - x2 * y1 - x3 * y2) / 2
  );
}

function avg(data: Data[]) {
  return data.reduce((sum, item) => (sum += item.y), 0) / data.length;
}

function divideIntoBuckets(data: Data[], numOfBuckets: number) {
  if (numOfBuckets === 0) {
    return [data];
  }

  const { length } = data;
  const firstBucketCount = Math.ceil(data.length / numOfBuckets);

  if (length <= firstBucketCount) {
    return [data];
  } else {
    return [data.slice(0, firstBucketCount)].concat(
      divideIntoBuckets(data.slice(firstBucketCount), numOfBuckets - 1)
    );
  }
}
