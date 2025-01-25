import { Point, LineElement, ConnectionInfo } from './types';

// Constants
export const SNAP_THRESHOLD = 10;
export const WIND_ROSE_MARGIN = 20;
export const WIND_ROSE_SIZE = 200;

export function findNearestPoint(point: Point, currentLineId: string, lines: LineElement[] = []): Point | null {
  if (!Array.isArray(lines)) return null;
  
  let nearestPoint: Point | null = null;
  let minDistance = Infinity;

  console.log('original line is', currentLineId);
  lines.forEach(line => {
    if (line.selected) {
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

export function findAlignmentPoints(point: Point, currentLineId: string, lines: LineElement[] = []): Point[] {
  if (!Array.isArray(lines)) return [];
  
  const alignmentPoints: Point[] = [];
  const threshold = 5;

  lines.forEach(line => {
    if (line.id === currentLineId) return;

    const points = [
      { x: line.points[0], y: line.points[1] },
      { x: line.points[2], y: line.points[3] }
    ];

    points.forEach(p => {
      // Vertical alignment
      if (Math.abs(point.x - p.x) < threshold) {
        alignmentPoints.push({ x: p.x, y: point.y });
      }
      // Horizontal alignment
      if (Math.abs(point.y - p.y) < threshold) {
        alignmentPoints.push({ x: point.x, y: p.y });
      }
    });
  });

  return alignmentPoints;
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