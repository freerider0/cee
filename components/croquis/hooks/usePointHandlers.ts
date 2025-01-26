import { useState } from 'react';
import Konva from 'konva';
import { LineElement, Point } from '../types';
import { findNearestPoint } from '../utils';

interface UsePointHandlersProps {
  lines: LineElement[];
  setLines: (lines: LineElement[]) => void;
  scale: number;
  position: Point;
  layerRef: React.RefObject<Konva.Layer>;
}

export function usePointHandlers({
  lines,
  setLines,
  scale,
  position,
  layerRef
}: UsePointHandlersProps) {
  const [isDraggingHandler, setIsDraggingHandler] = useState(false);

  // Helper function to handle point dragging with snapping
  function handlePointDrag(lineId: string, isStart: boolean, pos: Point, e: Konva.KonvaEventObject<DragEvent>) {
    const nearestPoint = findNearestPoint(pos, lineId, lines);
    const finalPos = nearestPoint || pos;

    // Find the original line and point position
    const originalLine = lines.find(l => l.id === lineId);
  
    if (!originalLine) return;
    
    const originalPoint = {
      x: isStart ? originalLine.points[0] : originalLine.points[2],
      y: isStart ? originalLine.points[1] : originalLine.points[3]
    };

    // Update lines
    const newLines = lines.map(l => {
      if (!l.selected) return l;

      const startMatches = Math.abs(l.points[0] - originalPoint.x) < 0.1 && 
                          Math.abs(l.points[1] - originalPoint.y) < 0.1;
      const endMatches = Math.abs(l.points[2] - originalPoint.x) < 0.1 && 
                        Math.abs(l.points[3] - originalPoint.y) < 0.1;

      if (startMatches || endMatches) {
        return {
          ...l,
          points: [
            startMatches ? finalPos.x : l.points[0],
            startMatches ? finalPos.y : l.points[1],
            endMatches ? finalPos.x : l.points[2],
            endMatches ? finalPos.y : l.points[3]
          ]
        };
      }
      return l;
    });

    setLines(newLines);

    // Update the Circle position to match the snap point
    if (nearestPoint) {
      const circle = e.target;
      circle.position({
        x: nearestPoint.x,
        y: nearestPoint.y
      });
    }
    
    if (layerRef.current) {
      layerRef.current.batchDraw();
    }
  }

  function handlePointDragStart() {
    setIsDraggingHandler(true);
  }

  function handlePointDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;  // Prevent bubbling to stage
    e.evt.stopPropagation();
    e.evt.preventDefault();
    
    requestAnimationFrame(() => {
      setIsDraggingHandler(false);
    });
  }

  return {
    isDraggingHandler,
    handlePointDrag,
    handlePointDragStart,
    handlePointDragEnd
  };
} 