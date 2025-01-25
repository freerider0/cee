import { useState, useCallback } from 'react';
import type { Point, LineElement, DrawingMode } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { findNearestPoint, getOrthogonalPoint, findAlignmentPoints } from '../utils';
import { SNAP_THRESHOLD } from '../constants';

export function useDrawing() {
  const [lines, setLines] = useState<LineElement[]>([]);
  const [mode, setMode] = useState<DrawingMode>("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [snapPoint, setSnapPoint] = useState<Point | null>(null);
  const [isOrthogonal, setIsOrthogonal] = useState(false);
  const [alignmentPoints, setAlignmentPoints] = useState<Point[]>([]);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);

  const startDrawing = useCallback((point: Point) => {
    const newLine: LineElement = {
      id: uuidv4(),
      points: [point.x, point.y, point.x, point.y],
      selected: false,
      exteriorSide: 'positive',
      windows: []
    };
    setLines(prev => [...prev, newLine]);
    setIsDrawing(true);
  }, []);

  const finishDrawing = useCallback(() => {
    setIsDrawing(false);
    setSnapPoint(null);
    setAlignmentPoints([]);
    
    // Remove lines that are too short
    setLines(prev => prev.filter(line => {
      const [x1, y1, x2, y2] = line.points;
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      return length > 5;
    }));
  }, []);

  const handleDrawing = useCallback((point: Point, scale: number, stagePosition: Point) => {
    if (!isDrawing) {
      // Snapping logic when not drawing
      const nearestPoint = findNearestPoint(point, '', lines);
      if (nearestPoint) {
        const distance = Math.sqrt(
          Math.pow(point.x - nearestPoint.x, 2) + 
          Math.pow(point.y - nearestPoint.y, 2)
        );
        
        if (distance <= SNAP_THRESHOLD / scale) {
          setSnapPoint(nearestPoint);
        } else {
          setSnapPoint(null);
        }
      } else {
        setSnapPoint(null);
      }
      return;
    }

    // Update the current line while drawing
    setLines(prev => {
      const lastLine = [...prev];
      const currentLine = lastLine[lastLine.length - 1];
      
      if (!currentLine) return prev;

      const startPoint = {
        x: currentLine.points[0],
        y: currentLine.points[1]
      };

      let finalPoint = point;

      // Apply orthogonal constraint if enabled
      if (isOrthogonal) {
        finalPoint = getOrthogonalPoint(startPoint, point);
      }

      // Check for snap points
      const nearestPoint = findNearestPoint(finalPoint, currentLine.id, lines);
      if (nearestPoint) {
        const distance = Math.sqrt(
          Math.pow(finalPoint.x - nearestPoint.x, 2) + 
          Math.pow(finalPoint.y - nearestPoint.y, 2)
        );
        
        if (distance <= SNAP_THRESHOLD / scale) {
          finalPoint = nearestPoint;
          setSnapPoint(nearestPoint);
        } else {
          setSnapPoint(null);
        }
      }

      // Find alignment points
      const alignPoints = findAlignmentPoints(finalPoint, currentLine.id, lines);
      setAlignmentPoints(alignPoints);

      // Update the line
      currentLine.points = [
        currentLine.points[0],
        currentLine.points[1],
        finalPoint.x,
        finalPoint.y
      ];

      return lastLine;
    });
  }, [isDrawing, isOrthogonal, lines]);

  return {
    lines,
    setLines,
    mode,
    setMode,
    isDrawing,
    setIsDrawing,
    snapPoint,
    setSnapPoint,
    isOrthogonal,
    setIsOrthogonal,
    alignmentPoints,
    setAlignmentPoints,
    selectedLine,
    setSelectedLine,
    startDrawing,
    finishDrawing,
    handleDrawing
  };
} 