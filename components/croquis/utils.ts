import { Point, LineElement, ConnectionInfo, SelectionRect } from './types';

// Constants
export const SNAP_THRESHOLD = 10;
export const WIND_ROSE_MARGIN = 20;
export const WIND_ROSE_SIZE = 200;

export function findNearestPoint(point: Point, currentLineId: string, lines: LineElement[] = [], excludeSelected: boolean = true): Point | null {
  if (!Array.isArray(lines)) return null;
  
  let nearestPoint: Point | null = null;
  let minDistance = Infinity;

  lines.forEach(line => {
    if (excludeSelected && line.selected) {
      return null;
    }
    if (line.id === currentLineId) return;

    const points = [
      { x: line.points[0], y: line.points[1] },
      { x: line.points[2], y: line.points[3] }
    ];

    points.forEach(p => {
      const distance = Math.sqrt(
        Math.pow(point.x - p.x, 2) + 
        Math.pow(point.y - p.y, 2)
      );

      if (distance < minDistance && distance <= SNAP_THRESHOLD) {
        minDistance = distance;
        nearestPoint = p;
      }
    });
  });

  return nearestPoint;
}

export function getOrthogonalPoint(start: Point, end: Point): Point {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  if (dx > dy) {
    return { x: end.x, y: start.y };
  } else {
    return { x: start.x, y: end.y };
  }
}

export function calculateMidpoint(points: number[]): Point {
  return {
    x: (points[0] + points[2]) / 2,
    y: (points[1] + points[3]) / 2
  };
}

export function calculateNormalVector(points: number[]): Point {
  const dx = points[2] - points[0];
  const dy = points[3] - points[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  
  return {
    x: -dy / length,
    y: dx / length
  };
}

export function calculateExteriorMarkerPosition(
  points: number[], 
  exteriorSide: 'positive' | 'negative'
): { markerPos: Point, connectionStart: Point } {
  const MARKER_DISTANCE = 15;
  const midpoint = calculateMidpoint(points);
  const normal = calculateNormalVector(points);
  const direction = exteriorSide === 'positive' ? 1 : -1;
  
  return {
    markerPos: {
      x: midpoint.x + normal.x * MARKER_DISTANCE * direction,
      y: midpoint.y + normal.y * MARKER_DISTANCE * direction
    },
    connectionStart: midpoint
  };
}

export function findLineIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): Point | null {
  const denominator = ((x2 - x1) * (y4 - y3)) - ((y2 - y1) * (x4 - x3));
  if (denominator === 0) return null;
  
  const t = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
  
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

export function arePointsEqual(p1: Point, p2: Point, tolerance: number = 0.1): boolean {
  return Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance;
}

export function findConnectedEndpoint(line: LineElement, otherLines: LineElement[]): {
  startConnection: ConnectionInfo;
  endConnection: ConnectionInfo;
} {
  const startPoint = { x: line.points[0], y: line.points[1] };
  const endPoint = { x: line.points[2], y: line.points[3] };
  
  let startConnection: ConnectionInfo = { isConnected: false, connectedTo: null };
  let endConnection: ConnectionInfo = { isConnected: false, connectedTo: null };

  for (const otherLine of otherLines) {
    if (otherLine.id === line.id) continue;

    const otherStart = { x: otherLine.points[0], y: otherLine.points[1] };
    const otherEnd = { x: otherLine.points[2], y: otherLine.points[3] };

    if (arePointsEqual(startPoint, otherStart) || arePointsEqual(startPoint, otherEnd)) {
      startConnection = { isConnected: true, connectedTo: otherLine };
    }

    if (arePointsEqual(endPoint, otherStart) || arePointsEqual(endPoint, otherEnd)) {
      endConnection = { isConnected: true, connectedTo: otherLine };
    }
  }

  return { startConnection, endConnection };
}

export function findAlignmentPoints(point: Point, currentLineId: string, lines: LineElement[]): Point[] {
  const alignmentPoints: Point[] = [];

  lines.forEach(line => {
    if (line.id === currentLineId) return;

    // Add start point of each line
    const startPoint = { x: line.points[0], y: line.points[1] };
    alignmentPoints.push(startPoint);

    // Add end point of each line
    const endPoint = { x: line.points[2], y: line.points[3] };
    alignmentPoints.push(endPoint);
  });

  // Remove duplicates
  return alignmentPoints.filter((point, index, self) =>
    index === self.findIndex(p => 
      p.x === point.x && p.y === point.y
    )
  );
}

export function getLineLength(points: number[]): number {
  const [x1, y1, x2, y2] = points;
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function trimLinesToIntersection(
  lines: LineElement[], 
  firstLineId: string, 
  secondLineId: string
): LineElement[] {
  const firstLine = lines.find(l => l.id === firstLineId);
  const secondLine = lines.find(l => l.id === secondLineId);
  
  if (!firstLine || !secondLine) return lines;

  const otherLines = lines.filter(l => l.id !== firstLineId && l.id !== secondLineId);
  
  const firstLineConnections = findConnectedEndpoint(firstLine, otherLines);
  const secondLineConnections = findConnectedEndpoint(secondLine, otherLines);
  
  const intersection = findLineIntersection(
    firstLine.points[0], firstLine.points[1], firstLine.points[2], firstLine.points[3],
    secondLine.points[0], secondLine.points[1], secondLine.points[2], secondLine.points[3]
  );
  
  if (!intersection) return lines;
  
  return lines.map(line => {
    if (line.id === firstLineId) {
      let shouldMoveStart = false;
      
      if (firstLineConnections.startConnection.isConnected && 
          !firstLineConnections.endConnection.isConnected) {
        shouldMoveStart = false;
      } else if (!firstLineConnections.startConnection.isConnected && 
                 firstLineConnections.endConnection.isConnected) {
        shouldMoveStart = true;
      } else if (!firstLineConnections.startConnection.isConnected && 
                 !firstLineConnections.endConnection.isConnected) {
        shouldMoveStart = Math.hypot(
          line.points[0] - intersection.x,
          line.points[1] - intersection.y
        ) < Math.hypot(
          line.points[2] - intersection.x,
          line.points[3] - intersection.y
        );
      } else {
        return line;
      }
      
      return {
        ...line,
        points: shouldMoveStart
          ? [intersection.x, intersection.y, line.points[2], line.points[3]]
          : [line.points[0], line.points[1], intersection.x, intersection.y]
      };
    }
    
    if (line.id === secondLineId) {
      let shouldMoveStart = false;
      
      if (secondLineConnections.startConnection.isConnected && 
          !secondLineConnections.endConnection.isConnected) {
        shouldMoveStart = false;
      } else if (!secondLineConnections.startConnection.isConnected && 
                 secondLineConnections.endConnection.isConnected) {
        shouldMoveStart = true;
      } else if (!secondLineConnections.startConnection.isConnected && 
                 !secondLineConnections.endConnection.isConnected) {
        shouldMoveStart = Math.hypot(
          line.points[0] - intersection.x,
          line.points[1] - intersection.y
        ) < Math.hypot(
          line.points[2] - intersection.x,
          line.points[3] - intersection.y
        );
      } else {
        return line;
      }
      
      return {
        ...line,
        points: shouldMoveStart
          ? [intersection.x, intersection.y, line.points[2], line.points[3]]
          : [line.points[0], line.points[1], intersection.x, intersection.y]
      };
    }
    
    return line;
  });
} 

  // Add helper function to check if a line is contained in or intersects with rectangle
  export function isLineInSelection(line: LineElement, rect: SelectionRect): boolean {
    const [x1, y1, x2, y2] = line.points;
    const rectLeft = Math.min(rect.startX, rect.startX + rect.width);
    const rectRight = Math.max(rect.startX, rect.startX + rect.width);
    const rectTop = Math.min(rect.startY, rect.startY + rect.height);
    const rectBottom = Math.max(rect.startY, rect.startY + rect.height);

    // For window selection (right to left), check if line is fully contained
    if (rect.isWindowSelection) {
      return (
        x1 >= rectLeft && x1 <= rectRight &&
        x2 >= rectLeft && x2 <= rectRight &&
        y1 >= rectTop && y1 <= rectBottom &&
        y2 >= rectTop && y2 <= rectBottom
      );
    }

    // For crossing selection (left to right), use Cohen-Sutherland algorithm
    // Helper function to get point position code relative to rectangle
    function getPointCode(x: number, y: number): number {
      let code = 0;
      if (x < rectLeft) code |= 1;     // left
      if (x > rectRight) code |= 2;    // right
      if (y < rectTop) code |= 4;      // top
      if (y > rectBottom) code |= 8;   // bottom
      return code;
    }

    // Get codes for line endpoints
    const code1 = getPointCode(x1, y1);
    const code2 = getPointCode(x2, y2);

    // If both points are outside on the same side, no intersection
    if (code1 & code2) return false;

    // If both points are inside, line is contained
    if (code1 === 0 && code2 === 0) return true;

    // Check intersection with rectangle edges
    const m = (y2 - y1) / (x2 - x1); // Line slope
    
    // Helper function to check if point is within line segment
    function isPointInSegment(px: number, py: number): boolean {
      const buffer = 0.1; // Small buffer for floating point precision
      return px >= Math.min(x1, x2) - buffer && 
             px <= Math.max(x1, x2) + buffer && 
             py >= Math.min(y1, y2) - buffer && 
             py <= Math.max(y1, y2) + buffer;
    }

    // Check intersection with vertical edges
    if (!isFinite(m)) {
      // Vertical line
      return x1 >= rectLeft && x1 <= rectRight &&
             Math.min(y1, y2) <= rectBottom &&
             Math.max(y1, y2) >= rectTop;
    }

    // Check intersection with horizontal edges
    if (m === 0) {
      // Horizontal line
      return y1 >= rectTop && y1 <= rectBottom &&
             Math.min(x1, x2) <= rectRight &&
             Math.max(x1, x2) >= rectLeft;
    }

    // Check intersections with all edges
    const b = y1 - m * x1; // y-intercept

    // Left edge intersection
    const leftY = m * rectLeft + b;
    if (leftY >= rectTop && leftY <= rectBottom && isPointInSegment(rectLeft, leftY)) return true;

    // Right edge intersection
    const rightY = m * rectRight + b;
    if (rightY >= rectTop && rightY <= rectBottom && isPointInSegment(rectRight, rightY)) return true;

    // Top edge intersection
    const topX = (rectTop - b) / m;
    if (topX >= rectLeft && topX <= rectRight && isPointInSegment(topX, rectTop)) return true;

    // Bottom edge intersection
    const bottomX = (rectBottom - b) / m;
    if (bottomX >= rectLeft && bottomX <= rectRight && isPointInSegment(bottomX, rectBottom)) return true;

    return false;
  }