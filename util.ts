export type TupleData = [number, number]; // [x, y]
export type YData = number; // Only y values
export type Data = TupleData | YData;

export const isYData = (data: Data) => typeof data === "number";

// Find max value
export function max(data: Data[]): number {
  if (!data.length) return 0;
  let re = data[0];
  const checkedIsYData = isYData(re);
  for (let i = 1, len = data.length; i < len; ++i) {
    if (checkedIsYData) {
      if (data[i] > re) re = data[i];
    } else {
      if (data[i][1] > re[1]) re = data[i];
    }
  }
  if (checkedIsYData) return re as YData;
  return re[1];
}

// Largest triangles three buckets data dowmsampling algorithm
// Based on Sveinn Steinarsson's 2013 paper: https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
export function LTTB(data: Data[], threshold: number): Data[] {
  const buckets: Data[][] = [];
  const { length } = data;

  if (!length || length <= threshold) return data;

  const first = data[0];
  const checkedIsYData = isYData(first);

  if (checkedIsYData) {
    const yData = data as YData[];
    // First point
    buckets.push([yData[0]]);
    // Middle
    buckets.push(
      ...divideIntoBuckets(yData.slice(1, length - 1), threshold - 2)
    );
    // Last point
    buckets.push([yData[length - 1]]);

    return buildPointsFromBuckets(buckets, checkedIsYData);
  } else {
    const tupleData = data as TupleData[];
    // First point
    buckets.push([tupleData[0]]);
    // Middle
    buckets.push(
      ...divideIntoBuckets(tupleData.slice(1, length - 1), threshold - 2)
    );
    // Last point
    buckets.push([tupleData[length - 1]]);

    return buildPointsFromBuckets(buckets, checkedIsYData);
  }
}

function buildPointsFromBuckets(buckets: Data[][], isYData: boolean): Data[] {
  const re: Data[] = [];

  const { length } = buckets;

  // First
  re.push(buckets[0][0]);
  for (let i = 1; i < length - 1; ++i) {
    // Find the biggest triangle which is made up with
    // prePoint, nextBucketAvg and curPoint
    const nextBucket: Data[] = buckets[i + 1];
    const prePoint: Data = re[i - 1];
    const nextBucketAvg: number = avg(nextBucket, isYData);
    const curBucket: Data[] = buckets[i];
    let maxArea = 0,
      curPoint: Data;
    for (let j = 0, curBucketLen = curBucket.length; j < curBucketLen; ++j) {
      const area = calTriangleArea([
        [0, isYData ? prePoint : prePoint[1]],
        [1, isYData ? curBucket[j] : curBucket[j][1]],
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

function avg(data: Data[], isYData: boolean) {
  if (isYData)
    return (data as YData[]).reduce((sum, item) => (sum += item)) / data.length;
  return (
    (data as TupleData).reduce((sum, item) => (sum += item[1]), 0) / data.length
  );
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
