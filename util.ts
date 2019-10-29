import { Data } from "./types";

export function getProperBounds(data: Data[]): [number, number] {
  const minVal = min(data);
  const maxVal = max(data);
  const range = maxVal - minVal;
  const tickRange = getProperTickRange(range / 16); // assume 16 ticks
  const lowerBound = Math.floor(tickRange * Math.floor(minVal / tickRange - 1));
  const upperBound = Math.ceil(tickRange * Math.ceil(1 + maxVal / tickRange));
  return [lowerBound, upperBound];
}

function getProperTickRange(n: number): number {
  const p = Math.pow(10, Math.ceil(Math.log10(n)));
  const x = n / p;
  if (x < 0.1) return 0.1 * p;
  if (x <= 0.2) return 0.2 * p;
  if (x <= 0.25) return 0.25 * p;
  if (x <= 0.3) return 0.3 * p;
  if (x <= 0.4) return 0.4 * p;
  if (x <= 0.5) return 0.5 * p;
  if (x <= 0.6) return 0.6 * p;
  if (x <= 0.7) return 0.7 * p;
  if (x <= 0.75) return 0.75 * p;
  if (x <= 0.8) return 0.8 * p;
  if (x <= 0.9) return 0.9 * p;
  return 1.0 * p;
}

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
function max(data: Data[]): number {
  let max = Number.MIN_VALUE;
  data.forEach(d => (max = Math.max(max, d.y)));
  return max;
}

// Find min value
function min(data: Data[]): number {
  let min = Number.MAX_VALUE;
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
