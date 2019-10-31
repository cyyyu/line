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

// make corners smooth
export function makeSmooth(data: Data[]): Data[] {
  let res: Data[] = [];
  res.push(data[0]);
  for (let i = 1; i < data.length - 1; i++) {
    const prePoint = data[i - 1];
    const curPoint = data[i];
    const nextPoint = data[i + 1];

    const p1: Data = {
      x: (9 * curPoint.x + prePoint.x) / 10,
      y: (9 * curPoint.y + prePoint.y) / 10
    };
    const p2: Data = {
      x: (9 * curPoint.x + nextPoint.x) / 10,
      y: (9 * curPoint.y + nextPoint.y) / 10
    };
    res.push(...getPoints(5, p1, curPoint, p2));
  }
  res.push(data[data.length - 1]);
  return res;
}

function getPoints(divisions: number = 5, p0: Data, p1: Data, p2: Data) {
  const points: Data[] = [];
  for (let i = 0; i < divisions; i++) {
    const t = i / divisions;
    points.push({
      x: QuadraticBezier(t, p0.x, p1.x, p2.x),
      y: QuadraticBezier(t, p0.y, p1.y, p2.y)
    });
  }
  return points;
}

function QuadraticBezier(t: number, p0: number, p1: number, p2: number) {
  return (
    QuadraticBezierP0(t, p0) +
    QuadraticBezierP1(t, p1) +
    QuadraticBezierP2(t, p2)
  );
}

function QuadraticBezierP0(t: number, p: number) {
  const k = 1 - t;
  return k * k * p;
}

function QuadraticBezierP1(t: number, p: number) {
  return 2 * (1 - t) * t * p;
}

function QuadraticBezierP2(t: number, p: number) {
  return t * t * p;
}

// Largest triangles three buckets data dowmsampling algorithm
// Based on Sveinn Steinarsson's 2013 paper: https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
export function LTTB(data: Data[], threshold: number): Data[] {
  const buckets: Data[][] = [];
  const { length } = data;

  if (!length || length <= threshold) return data;

  // First point
  buckets.push([data[0]]);
  // Rest
  buckets.push(...divideIntoBuckets(data.slice(1, length), threshold - 2));

  return buildPointsFromBuckets(buckets);
}

function buildPointsFromBuckets(buckets: Data[][]): Data[] {
  const re: Data[] = [];

  const { length } = buckets;

  // First
  re.push(buckets[0][0]);
  // Middles
  for (let i = 1; i < length; ++i) {
    // Find the biggest triangle which is made up with
    // prePoint, nextBucketAvg and curPoint
    const prePoint: Data = re[i - 1];

    let nextBucketAvg: [number, number];
    if (i === length - 1) {
      nextBucketAvg = [0, 0];
    } else {
      const nextBucket: Data[] = buckets[i + 1];
      nextBucketAvg = avg(nextBucket);
    }

    const curBucket: Data[] = buckets[i];

    let maxArea = 0,
      curPoint: Data;
    for (let j = 0, curBucketLen = curBucket.length; j < curBucketLen; ++j) {
      const area = calTriangleArea([
        [prePoint.x, prePoint.y],
        [curBucket[j].x, curBucket[j].y],
        nextBucketAvg
      ]);
      if (area > maxArea) curPoint = curBucket[j];
    }
    re.push(curPoint);
  }

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
  const re = data.reduce(
    (sum, item) => {
      sum[0] += item.x;
      sum[1] += item.y;
      return sum;
    },
    [0, 0]
  );
  return [re[0] / data.length, re[1] / data.length] as [number, number];
}

function divideIntoBuckets(data: Data[], numOfBuckets: number) {
  if (numOfBuckets <= 0) {
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
