export function max(data: number[]): number {
  if (!data.length) return 0;
  let re = data[0];
  for (let i = 1, len = data.length; i < len; ++i) {
    if (data[i] > re) re = data[i];
  }
  return re;
}

// Largest triangles three buckets data dowmsampling algorithm
// Based on Sveinn Steinarsson's 2013 paper: https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
export function LTTB(data: number[], threshold: number): number[] {
  const buckets: number[][] = [];
  const { length } = data;

  // First point
  buckets.push([data[0]]);
  // Middle
  buckets.push(...divideIntoBuckets(data.slice(1, length - 1), threshold - 2));
  // Last point
  buckets.push([data[length - 1]]);

  return buildPointsFromBuckets(buckets);
}

function buildPointsFromBuckets(buckets: number[][]): number[] {
  const re: number[] = [];

  const { length } = buckets;
  // First
  re.push(buckets[0][0]);
  for (let i = 1; i < length - 1; ++i) {
    // Find the biggest triangle which is made up with
    // prePoint, nextBucketAvg and curPoint
    const nextBucket: number[] = buckets[i + 1];
    const prePoint: number = re[i - 1];
    const nextBucketAvg: number = avg(nextBucket);
    const curBucket: number[] = buckets[i];
    let maxArea = 0,
      curPoint = 0;
    for (let j = 0, curBucketLen = curBucket.length; j < curBucketLen; ++j) {
      const area = calTriangleArea([
        [0, prePoint],
        [1, curBucket[j]],
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

function avg(data: number[]) {
  return data.reduce((sum, item) => (sum += item)) / data.length;
}

function divideIntoBuckets(data: number[], numOfBuckets: number) {
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
