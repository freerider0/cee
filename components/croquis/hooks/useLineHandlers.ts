import { useState } from 'react';
import { Point, LineElement, DrawingMode } from '../types';
import { findNearestPoint, getLineLength, trimLinesToIntersection } from '../utils';

interface UseLineHandlersProps {
  lines: LineElement[];
  setLines: (lines: LineElement[]) => void;
  mode: DrawingMode;
  scale: number;
  position: Point;
  setSelectedLine: (id: string | null) => void;
  setFilletLines: (lines: string[]) => void;
  filletLines: string[];
  setMode: (mode: DrawingMode) => void;
}

interface MoveWallsState {
  isSelecting: boolean;
  basePoint: Point | null;
  destinationPoint: Point | null;
  snapPoint: Point | null;
}

interface PreviewElement {
  type: 'circle' | 'line';
  key: string;
  props: any;
}

export function useLineHandlers({
  lines,
  setLines,
  mode,
  scale,
  position,
  setSelectedLine,
  setFilletLines,
  filletLines,
  setMode
}: UseLineHandlersProps) {
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [moveWallsState, setMoveWallsState] = useState<MoveWallsState>({
    isSelecting: false,
    basePoint: null,
    destinationPoint: null,
    snapPoint: null
  });

  function handleLineClick(lineId: string, e: any) {
    if (mode === "select") {
      // Stop event propagation to prevent stage click from firing
      e.cancelBubble = true;
      
      const updatedLines = lines.map(line => ({
        ...line,
        selected: line.id === lineId,
      }));
      setLines(updatedLines);
      setSelectedLine(lineId);
    } else if (mode === "fillet") {
      e.cancelBubble = true;
      handleFilletClick(lineId);
    }
  }

  function handleLineSplit(lineId: string, e: any) {
    if (mode !== "split") return;

    const pos = e.target.getStage().getPointerPosition();
    const lineToSplit = lines.find(l => l.id === lineId);
    
    if (!lineToSplit) return;

    const [x1, y1, x2, y2] = lineToSplit.points;
    const newLines = lines.filter(l => l.id !== lineId);
    
    // Create two new lines from split point
    const line1: LineElement = {
      id: Date.now().toString(),
      points: [x1, y1, pos.x, pos.y],
      selected: false,
      exteriorSide: 'positive'
    };
    
    const line2: LineElement = {
      id: (Date.now() + 1).toString(),
      points: [pos.x, pos.y, x2, y2],
      selected: false,
      exteriorSide: 'positive'
    };
    
    setLines([...newLines, line1, line2]);
  }

  function handleLineHover(lineId: string) {
    if (mode === "select" || mode === "split") {
      setHoveredLine(lineId);
    }
  }

  function handleLineHoverEnd() {
    setHoveredLine(null);
  }

  function handleLengthChange(lineId: string, newLength: number) {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;

    // Get start point and angle
    const [x1, y1, x2, y2] = line.points;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Calculate new end point
    const newEndX = x1 + Math.cos(angle) * newLength;
    const newEndY = y1 + Math.sin(angle) * newLength;

    // Update line
    const newLines = lines.map(l => {
      if (l.id === lineId) {
        return {
          ...l,
          points: [x1, y1, newEndX, newEndY]
        };
      }
      return l;
    });
    
    setLines(newLines);
  }

  function handleFilletClick(lineId: string) {
    if (mode !== "fillet") return;
    
    if (filletLines.length === 0) {
      setFilletLines([lineId]);
    } else if (filletLines.length === 1 && filletLines[0] !== lineId) {
      const updatedLines = trimLinesToIntersection(lines, filletLines[0], lineId);
      setLines(updatedLines);
      setFilletLines([]);
    }
  }

  function handleExteriorMarkerClick(lineId: string, e: any) {
    e.cancelBubble = true;
    
    setLines(lines.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          exteriorSide: line.exteriorSide === 'positive' ? 'negative' : 'positive'
        };
      }
      return line;
    }));
  }

  function handleMoveWallsComplete() {
    if (!moveWallsState.basePoint || !moveWallsState.destinationPoint) return;

    const dx = moveWallsState.destinationPoint.x - moveWallsState.basePoint.x;
    const dy = moveWallsState.destinationPoint.y - moveWallsState.basePoint.y;

    const updatedLines = lines.map(line => {
      if (!line.selected) return line;

      return {
        ...line,
        points: [
          line.points[0] + dx,
          line.points[1] + dy,
          line.points[2] + dx,
          line.points[3] + dy,
        ]
      };
    });

    setLines(updatedLines);
    setMoveWallsState({
      isSelecting: false,
      basePoint: null,
      destinationPoint: null,
      snapPoint: null
    });
    setMode("select");
  }

  function handleMoveWallsMouseDown(e: any) {
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    const pos = {
      x: (pointerPos.x - position.x) / scale,
      y: (pointerPos.y - position.y) / scale
    };

    // Only use snap point if it exists in the current state
    const finalPos = moveWallsState.snapPoint || pos;

    if (!moveWallsState.isSelecting) {
      setMoveWallsState({
        isSelecting: true,
        basePoint: finalPos,
        destinationPoint: null,
        snapPoint: null
      });
    } else {
      // Use the current mouse position or snap point for destination
      const destinationPoint = moveWallsState.snapPoint || pos;
      const dx = destinationPoint.x - moveWallsState.basePoint!.x;
      const dy = destinationPoint.y - moveWallsState.basePoint!.y;

      const updatedLines = lines.map(line => {
        if (!line.selected) return line;

        return {
          ...line,
          points: [
            line.points[0] + dx,
            line.points[1] + dy,
            line.points[2] + dx,
            line.points[3] + dy,
          ]
        };
      });

      setLines(updatedLines);
      setMoveWallsState({
        isSelecting: false,
        basePoint: null,
        destinationPoint: null,
        snapPoint: null
      });
      setMode("select");
    }
  }

  function handleMoveWallsMouseMove(e: any) {
    if (mode !== "moveWalls") return;

    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    const pos = {
      x: (pointerPos.x - position.x) / scale,
      y: (pointerPos.y - position.y) / scale
    };

    // Find nearest snap point
    const nearestPoint = findNearestPoint(pos, '', lines);
    const snapPoint = nearestPoint && 
      Math.sqrt(Math.pow(pos.x - nearestPoint.x, 2) + Math.pow(pos.y - nearestPoint.y, 2)) <= 10 
      ? nearestPoint 
      : null;

    setMoveWallsState(prev => ({
      ...prev,
      destinationPoint: snapPoint || pos,
      snapPoint
    }));
  }

  function getMoveWallsPreview(): PreviewElement[] | null {
    if (mode !== "moveWalls") {
      // Show point handles for selected lines when not in moveWalls mode
      const selectedLineHandles: PreviewElement[] = [];
      
      lines.forEach(line => {
        if (!line.selected) return;
        
        // Add start point handle
        selectedLineHandles.push({
          type: 'circle',
          key: `handle-start-${line.id}`,
          props: {
            x: line.points[0],
            y: line.points[1],
            radius: 4,
            fill: "#ffffff",
            stroke: "#2563eb",
            strokeWidth: 2,
            perfectDrawEnabled: false,
          }
        });
        
        // Add end point handle
        selectedLineHandles.push({
          type: 'circle',
          key: `handle-end-${line.id}`,
          props: {
            x: line.points[2],
            y: line.points[3],
            radius: 4,
            fill: "#ffffff",
            stroke: "#2563eb",
            strokeWidth: 2,
            perfectDrawEnabled: false,
          }
        });
      });
      
      return selectedLineHandles;
    }

    const previewElements: PreviewElement[] = [];
    
    // Add snap point indicator
    if (moveWallsState.snapPoint) {
      previewElements.push({
        type: 'circle',
        key: 'snap-point',
        props: {
          x: moveWallsState.snapPoint.x,
          y: moveWallsState.snapPoint.y,
          radius: 6,
          fill: "rgba(34, 197, 94, 0.3)",
          stroke: "#22c55e",
          strokeWidth: 2,
          perfectDrawEnabled: false,
        }
      });
    }

    if (moveWallsState.basePoint) {
      previewElements.push({
        type: 'circle',
        key: 'base-point',
        props: {
          x: moveWallsState.basePoint.x,
          y: moveWallsState.basePoint.y,
          radius: 5,
          fill: "#22c55e",
          stroke: "#22c55e",
          strokeWidth: 2,
          perfectDrawEnabled: false,
        }
      });
    }

    if (moveWallsState.basePoint && moveWallsState.destinationPoint) {
      previewElements.push({
        type: 'line',
        key: 'vector-line',
        props: {
          points: [
            moveWallsState.basePoint.x,
            moveWallsState.basePoint.y,
            moveWallsState.destinationPoint.x,
            moveWallsState.destinationPoint.y
          ],
          stroke: "#22c55e",
          strokeWidth: 1,
          dash: [5, 5],
          perfectDrawEnabled: false,
        }
      });

      const dx = moveWallsState.destinationPoint.x - moveWallsState.basePoint.x;
      const dy = moveWallsState.destinationPoint.y - moveWallsState.basePoint.y;

      lines.forEach(line => {
        if (!line.selected) return;
        previewElements.push({
          type: 'line',
          key: `preview-${line.id}`,
          props: {
            points: [
              line.points[0] + dx,
              line.points[1] + dy,
              line.points[2] + dx,
              line.points[3] + dy
            ],
            stroke: "#22c55e",
            strokeWidth: 2,
            dash: [5, 5],
            perfectDrawEnabled: false,
          }
        });
      });
    }

    return previewElements;
  }

  function getMoveWallsStatus(): string {
    if (mode !== "moveWalls") return "";
    if (!moveWallsState.isSelecting) {
      return "Select base point";
    }
    return "Select destination point";
  }

  return {
    hoveredLine,
    handleLineClick,
    handleLineSplit,
    handleLineHover,
    handleLineHoverEnd,
    handleLengthChange,
    handleExteriorMarkerClick,
    handleMoveWallsMouseDown,
    handleMoveWallsMouseMove,
    getMoveWallsPreview,
    getMoveWallsStatus,
    moveWallsState
  };
} 