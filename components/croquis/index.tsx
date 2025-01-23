"use client";

import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Rect, Text } from "react-konva";
import { Button } from "@/components/ui/button";
import { 
  MousePointer2, 
  PenLine, 
  Scissors,
  Move,
  LayoutGrid,
  Trash2,
  Plus,
  Minus,
  ZoomIn
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WindowsPanel, Window, LineWithWindows } from "./WindowsPanel";
import { WindRose } from "./WindRose";
import { MapComponent } from './MapComponent';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import LayerSwitcher from 'ol-layerswitcher';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Point {
  x: number;
  y: number;
}

interface LineElement extends LineWithWindows {
  id: string;
  points: number[];
  selected: boolean;
  isHovered?: boolean;
  exteriorSide: 'positive' | 'negative';
}

interface SelectionRect {
  startX: number;
  startY: number;
  width: number;
  height: number;
  isWindowSelection: boolean;
}

type DrawingMode = "select" | "draw" | "edit" | "split" | "pan" | "moveWalls" | "fillet";

interface ConnectionInfo {
  isConnected: boolean;
  connectedTo: LineElement | null;
}

export function CroquisCanvas() {
  const [lines, setLines] = useState<LineElement[]>([]);
  const [mode, setMode] = useState<DrawingMode>("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [snapPoint, setSnapPoint] = useState<Point | null>(null);
  const [isOrthogonal, setIsOrthogonal] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDraggingHandler, setIsDraggingHandler] = useState(false);
  const [isDraggingWalls, setIsDraggingWalls] = useState(false);
  const [lastPointerPosition, setLastPointerPosition] = useState<Point | null>(null);
  const [alignmentPoints, setAlignmentPoints] = useState<Point[]>([]);
  const [isMiddleMousePanning, setIsMiddleMousePanning] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState<Point | null>(null);
  const [filletLines, setFilletLines] = useState<string[]>([]);

  const stageRef = useRef(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Add snap threshold constant
  const SNAP_THRESHOLD = 10;

  // Add WindRose constants
  const WIND_ROSE_MARGIN = 20;
  const WIND_ROSE_SIZE = 200;

  // Helper function to find nearest point from other lines only
  function findNearestPoint(currentPoint: Point, currentLineId: string): Point | null {
    let nearest: Point | null = null;
    let minDistance = SNAP_THRESHOLD;

    // Only check endpoints of existing lines
    lines.forEach(line => {
      if (line.id === currentLineId) return;

      const startPoint = { 
        x: Math.round(line.points[0]), 
        y: Math.round(line.points[1]) 
      };
      const endPoint = { 
        x: Math.round(line.points[2]), 
        y: Math.round(line.points[3]) 
      };
      
      const distanceToStart = Math.sqrt(
        Math.pow(currentPoint.x - startPoint.x, 2) + 
        Math.pow(currentPoint.y - startPoint.y, 2)
      );
      
      const distanceToEnd = Math.sqrt(
        Math.pow(currentPoint.x - endPoint.x, 2) + 
        Math.pow(currentPoint.y - endPoint.y, 2)
      );

      if (distanceToStart < minDistance) {
        minDistance = distanceToStart;
        nearest = startPoint;
      }

      if (distanceToEnd < minDistance) {
        minDistance = distanceToEnd;
        nearest = endPoint;
      }
    });

    return nearest;
  }

  // Helper function to handle point dragging with snapping
  function handlePointDrag(lineId: string, isStart: boolean, pos: Point) {
    const nearestPoint = findNearestPoint(pos, '');
    const finalPos = nearestPoint || pos;

    const newLines = lines.map(l => {
      if (l.id === lineId) {
        return {
          ...l,
          points: isStart 
            ? [finalPos.x, finalPos.y, l.points[2], l.points[3]]
            : [l.points[0], l.points[1], finalPos.x, finalPos.y]
        };
      }
      return l;
    });
    setLines(newLines);
    
    if (layerRef.current) {
      layerRef.current.batchDraw();
    }
  }

  // Handle drawing new lines
  function handleMouseDown(e: any) {
    if (mode === "draw") {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      // Transform point from screen space to world space
      const pos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };
      
      setIsDrawing(true);
      
      // Check if we're starting near a snap point
      const nearestPoint = findNearestPoint(pos, '');
      const startPos = nearestPoint || pos;
      
      const newLine: LineElement = {
        id: Date.now().toString(),
        points: [startPos.x, startPos.y, startPos.x, startPos.y],
        selected: false,
        exteriorSide: 'positive',
        windows: []
      };
      
      setLines([...lines, newLine]);
    } else if (mode === "select") {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      const pos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };
      
      setSelectionRect({
        startX: pos.x,
        startY: pos.y,
        width: 0,
        height: 0,
        isWindowSelection: false
      });
    }
  }

  // Helper function to get orthogonal point
  function getOrthogonalPoint(start: Point, end: Point): Point {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    
    // If horizontal distance is greater, make it horizontal
    if (dx > dy) {
      return { x: end.x, y: start.y };
    }
    // Otherwise make it vertical
    return { x: start.x, y: end.y };
  }

  // Add new handler for general mouse movement
  function handleStageMouseMove(e: any) {
    // Handle middle mouse panning
    if (isMiddleMousePanning && lastMousePosition) {
      const dx = e.evt.clientX - lastMousePosition.x;
      const dy = e.evt.clientY - lastMousePosition.y;
      
      setPosition(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      setLastMousePosition({
        x: e.evt.clientX,
        y: e.evt.clientY
      });
      return;
    }

    if (mode === "draw") {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      const pos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };
      
      // If we're not drawing, just check for potential snap points
      if (!isDrawing) {
        const nearestPoint = findNearestPoint(pos, '');
        if (nearestPoint) {
          const distance = Math.sqrt(
            Math.pow(pos.x - nearestPoint.x, 2) + 
            Math.pow(pos.y - nearestPoint.y, 2)
          );
          
          if (distance <= SNAP_THRESHOLD * 2) {
            setSnapPoint(nearestPoint);
          } else {
            setSnapPoint(null);
          }
        } else {
          setSnapPoint(null);
        }
        return;
      }

      // Existing drawing logic
      const lastLine = [...lines];
      const currentLine = lastLine[lastLine.length - 1];
      const startPoint = { x: currentLine.points[0], y: currentLine.points[1] };
      
      let finalPos = pos;
      if (isOrthogonal) {
        finalPos = getOrthogonalPoint(startPoint, pos);
      }
      
      // Find alignment points
      const alignPoints = findAlignmentPoints(finalPos, currentLine.id);
      setAlignmentPoints(alignPoints);

      // Check for alignment and snap to it
      let snappedPos = { ...finalPos };
      alignPoints.forEach(point => {
        // Check for vertical alignment (same X coordinate)
        if (Math.abs(point.x - finalPos.x) < SNAP_THRESHOLD) {
          snappedPos.x = point.x;
        }
        // Check for horizontal alignment (same Y coordinate)
        if (Math.abs(point.y - finalPos.y) < SNAP_THRESHOLD) {
          snappedPos.y = point.y;
        }
      });

      // Check for endpoint snapping
      const nearestPoint = findNearestPoint(snappedPos, currentLine.id);
      if (nearestPoint && 
          Math.sqrt(Math.pow(snappedPos.x - nearestPoint.x, 2) + 
                   Math.pow(snappedPos.y - nearestPoint.y, 2)) <= SNAP_THRESHOLD) {
        setSnapPoint(nearestPoint);
        currentLine.points = [
          currentLine.points[0],
          currentLine.points[1],
          nearestPoint.x,
          nearestPoint.y,
        ];
      } else {
        setSnapPoint(null);
        currentLine.points = [
          currentLine.points[0],
          currentLine.points[1],
          Math.round(snappedPos.x),
          Math.round(snappedPos.y),
        ];
      }
      
      if (isDrawing) {
        setLines(lastLine);
      }
    } else if (mode === "select" && selectionRect) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      const pos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };
      
      const width = pos.x - selectionRect.startX;
      const height = pos.y - selectionRect.startY;
      
      setSelectionRect({
        ...selectionRect,
        width,
        height,
        isWindowSelection: width < 0
      });
    }
  }

  function handleMouseUp(e: any) {
    if (mode === "draw") {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      const pos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };

      if (isDrawing) {
        const lastLine = [...lines];
        const currentLine = lastLine[lastLine.length - 1];
        const nearestPoint = findNearestPoint(pos, currentLine.id);

        if (nearestPoint) {
          currentLine.points = [
            currentLine.points[0],
            currentLine.points[1],
            nearestPoint.x,
            nearestPoint.y
          ];
          setLines(lastLine);
        }
      }

      setIsDrawing(false);
      setSnapPoint(null);
      setAlignmentPoints([]);
    } else if (mode === "select" && selectionRect) {
      // Apply selection to lines
      const updatedLines = lines.map(line => ({
        ...line,
        selected: isLineInSelection(line, selectionRect)
      }));
      setLines(updatedLines);
      setSelectionRect(null);
    }
  }

  // Handle line selection and endpoint dragging
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

  // Handle splitting lines by adding points
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

  // Add a stage click handler to deselect all lines when clicking empty space
  function handleStageClick(e: any) {
    if (e.target === e.target.getStage()) {
      const updatedLines = lines.map(line => ({
        ...line,
        selected: false,
      }));
      setLines(updatedLines);
      setSelectedLine(null);
    }
  }

  // Add helper function to check if a line is contained in or intersects with rectangle
  function isLineInSelection(line: LineElement, rect: SelectionRect): boolean {
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

    // For crossing selection (left to right), check if line intersects
    // Simple bounding box intersection check
    const lineLeft = Math.min(x1, x2);
    const lineRight = Math.max(x1, x2);
    const lineTop = Math.min(y1, y2);
    const lineBottom = Math.max(y1, y2);

    return !(
      lineLeft > rectRight ||
      lineRight < rectLeft ||
      lineTop > rectBottom ||
      lineBottom < rectTop
    );
  }

  // Add new function to handle deletion
  function handleDeleteSelected() {
    setLines(lines.filter(line => !line.selected));
    setSelectedLine(null);
  }

  // Add zoom handlers
  function handleZoomIn() {
    setScale(prev => Math.min(prev * 1.2, 5)); // Limit max zoom to 5x
  }

  function handleZoomOut() {
    setScale(prev => Math.max(prev / 1.2, 0.2)); // Limit min zoom to 0.2x
  }

  function handleResetZoom() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  // Update the point drag handlers to set isDraggingHandler
  function handlePointDragStart() {
    setIsDraggingHandler(true);
    if (layerRef.current) {
      layerRef.current.batchDraw();
    }
  }

  function handlePointDragEnd() {
    setIsDraggingHandler(false);
    if (layerRef.current) {
      layerRef.current.batchDraw();
    }
  }

  // Add function to calculate line length
  function getLineLength(points: number[]): number {
    const [x1, y1, x2, y2] = points;
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  // Add function to update line length
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
    
    if (layerRef.current) {
      layerRef.current.batchDraw();
    }
  }

  // Get selected line
  const activeSelectedLine = lines.find(line => line.selected);

  function handleAddWindow(lineId: string) {
    const newWindow: Window = {
      id: Date.now().toString(),
      width: 100,
      height: 100,
      hasPersiana: false,
      color: '#FFFFFF',
      glassType: 'simple',
      position: 0.5
    };

    setLines(lines.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          windows: [...(line.windows || []), newWindow]
        };
      }
      return line;
    }));
  }

  function handleUpdateWindow(lineId: string, windowId: string, updates: Partial<Window>) {
    setLines(lines.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          windows: (line.windows || []).map(window => 
            window.id === windowId ? { ...window, ...updates } : window
          )
        };
      }
      return line;
    }));
  }

  function handleDeleteWindow(lineId: string, windowId: string) {
    setLines(lines.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          windows: (line.windows || []).filter(w => w.id !== windowId)
        };
      }
      return line;
    }));
  }

  function handleWallSelect(lineId: string) {
    setLines(lines.map(line => ({
      ...line,
      selected: line.id === lineId
    })));
  }

  // Add this function to handle canvas wall clicks
  function handleCanvasWallClick(lineId: string) {
    handleWallSelect(lineId);
  }

  function handleWallDrag(e: any) {
    if (mode !== "moveWalls") return;
    
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    const pos = {
      x: (pointerPos.x - position.x) / scale,
      y: (pointerPos.y - position.y) / scale
    };

    if (!lastPointerPosition) {
      setLastPointerPosition(pos);
      return;
    }

    const dx = pos.x - lastPointerPosition.x;
    const dy = pos.y - lastPointerPosition.y;

    setLines(lines.map(line => {
      if (line.selected) {
        return {
          ...line,
          points: [
            line.points[0] + dx,
            line.points[1] + dy,
            line.points[2] + dx,
            line.points[3] + dy,
          ]
        };
      }
      return line;
    }));

    setLastPointerPosition(pos);
  }

  function handleStageMouseDown(e: any) {
    // Handle middle mouse button separately
    if (e.evt.button === 1) {
      e.evt.preventDefault(); // Prevent default middle mouse behavior
      setIsMiddleMousePanning(true);
      const stage = e.target.getStage();
      stage.container().style.cursor = 'grabbing';
      setLastMousePosition({
        x: e.evt.clientX,
        y: e.evt.clientY
      });
      return;
    }

    // Original mouse down logic
    if (mode === "moveWalls") {
      const hasSelectedWalls = lines.some(line => line.selected);
      if (!hasSelectedWalls) {
        handleMouseDown(e);
      } else {
        setIsDraggingWalls(true);
        const stage = e.target.getStage();
        const pointerPos = stage.getPointerPosition();
        setLastPointerPosition({
          x: (pointerPos.x - position.x) / scale,
          y: (pointerPos.y - position.y) / scale
        });
      }
    } else {
      handleMouseDown(e);
    }
  }

  function handleStageMouseUp(e: any) {
    // Handle middle mouse button
    if (e.evt.button === 1) {
      setIsMiddleMousePanning(false);
      setLastMousePosition(null);
      const stage = e.target.getStage();
      stage.container().style.cursor = 'default';
      return;
    }

    // Original mouse up logic
    if (mode === "moveWalls") {
      setIsDraggingWalls(false);
      setLastPointerPosition(null);
    }
    handleMouseUp(e);
  }

  // Add this function near your other handlers
  function handleClearAll() {
    setLines([]);
    setSelectedLine(null);
    setSnapPoint(null);
    setHoveredLine(null);
    setSelectionRect(null);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  // Add this helper function to find points at same X or Y coordinates
  function findAlignmentPoints(currentPoint: Point, currentLineId: string): Point[] {
    const alignmentPoints: Point[] = [];
    const threshold = 10; // Snap threshold in pixels

    lines.forEach(line => {
      if (line.id === currentLineId) return;

      // Get start and end points
      const [x1, y1, x2, y2] = line.points;
      const points = [
        { x: x1, y: y1 },
        { x: x2, y: y2 }
      ];

      points.forEach(point => {
        // Check for vertical alignment (same X coordinate)
        if (Math.abs(point.x - currentPoint.x) < threshold) {
          alignmentPoints.push({ x: point.x, y: point.y });
        }
        // Check for horizontal alignment (same Y coordinate)
        if (Math.abs(point.y - currentPoint.y) < threshold) {
          alignmentPoints.push({ x: point.x, y: point.y });
        }
      });
    });

    return alignmentPoints;
  }

  // Add these helper functions near the top of the file
  function calculateMidpoint(points: number[]): Point {
    return {
      x: (points[0] + points[2]) / 2,
      y: (points[1] + points[3]) / 2
    };
  }

  function calculateNormalVector(points: number[]): Point {
    const dx = points[2] - points[0];
    const dy = points[3] - points[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize the normal vector
    return {
      x: -dy / length,
      y: dx / length
    };
  }

  function calculateExteriorMarkerPosition(
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

  // Add function to handle exterior marker clicks
  function handleExteriorMarkerClick(lineId: string, e: any) {
    e.cancelBubble = true; // Prevent event bubbling
    
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

  // Add these helper functions
  function findLineIntersection(
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

  function arePointsEqual(p1: Point, p2: Point, tolerance: number = 0.1): boolean {
    return Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance;
  }

  function findConnectedEndpoint(line: LineElement, otherLines: LineElement[]): {
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

  function trimLinesToIntersection(lines: LineElement[], firstLineId: string, secondLineId: string): LineElement[] {
    const firstLine = lines.find(l => l.id === firstLineId);
    const secondLine = lines.find(l => l.id === secondLineId);
    
    if (!firstLine || !secondLine) return lines;

    const otherLines = lines.filter(l => l.id !== firstLineId && l.id !== secondLineId);
    
    // Check for connected endpoints
    const firstLineConnections = findConnectedEndpoint(firstLine, otherLines);
    const secondLineConnections = findConnectedEndpoint(secondLine, otherLines);
    
    const intersection = findLineIntersection(
      firstLine.points[0], firstLine.points[1], firstLine.points[2], firstLine.points[3],
      secondLine.points[0], secondLine.points[1], secondLine.points[2], secondLine.points[3]
    );
    
    if (!intersection) return lines;
    
    return lines.map(line => {
      if (line.id === firstLineId) {
        // For first line: determine which end to move based on connections
        let shouldMoveStart = false;
        
        if (firstLineConnections.startConnection.isConnected && 
            !firstLineConnections.endConnection.isConnected) {
          shouldMoveStart = false; // Move end point if start is connected
        } else if (!firstLineConnections.startConnection.isConnected && 
                   firstLineConnections.endConnection.isConnected) {
          shouldMoveStart = true; // Move start point if end is connected
        } else if (!firstLineConnections.startConnection.isConnected && 
                   !firstLineConnections.endConnection.isConnected) {
          // If no connections, move the closest point
          shouldMoveStart = Math.hypot(
            line.points[0] - intersection.x,
            line.points[1] - intersection.y
          ) < Math.hypot(
            line.points[2] - intersection.x,
            line.points[3] - intersection.y
          );
        } else {
          // Both ends are connected, don't modify the line
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
        // For second line: determine which end to move based on connections
        let shouldMoveStart = false;
        
        if (secondLineConnections.startConnection.isConnected && 
            !secondLineConnections.endConnection.isConnected) {
          shouldMoveStart = false; // Move end point if start is connected
        } else if (!secondLineConnections.startConnection.isConnected && 
                   secondLineConnections.endConnection.isConnected) {
          shouldMoveStart = true; // Move start point if end is connected
        } else if (!secondLineConnections.startConnection.isConnected && 
                   !secondLineConnections.endConnection.isConnected) {
          // If no connections, move the closest point
          shouldMoveStart = Math.hypot(
            line.points[0] - intersection.x,
            line.points[1] - intersection.y
          ) < Math.hypot(
            line.points[2] - intersection.x,
            line.points[3] - intersection.y
          );
        } else {
          // Both ends are connected, don't modify the line
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

  // Add this handler
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

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "select" ? "default" : "outline"}
                  onClick={() => setMode("select")}
                  size="icon"
                >
                  <MousePointer2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "draw" ? "default" : "outline"}
                  onClick={() => setMode("draw")}
                  size="icon"
                >
                  <PenLine className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Draw</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "pan" ? "default" : "outline"}
                  onClick={() => setMode("pan")}
                  size="icon"
                >
                  <Move className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pan</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "split" ? "default" : "outline"}
                  onClick={() => setMode("split")}
                  size="icon"
                >
                  <Scissors className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isOrthogonal ? "default" : "outline"}
                  onClick={() => setIsOrthogonal(!isOrthogonal)}
                  size="icon"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Orthogonal</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  disabled={!lines.some(line => line.selected)}
                  size="icon"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Selected</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "moveWalls" ? "default" : "outline"}
                  onClick={() => setMode("moveWalls")}
                  size="icon"
                >
                  <Move className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move Walls</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  onClick={handleClearAll}
                  size="icon"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear All</TooltipContent>
            </Tooltip>

            <div className="ml-auto flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleZoomIn}
                    size="icon"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleZoomOut}
                    size="icon"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleResetZoom}
                    size="icon"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset Zoom</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "fillet" ? "default" : "outline"}
                  onClick={() => {
                    setMode("fillet");
                    setFilletLines([]);
                  }}
                  size="icon"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M 4 20 L 12 12" />
                    <path d="M 12 12 L 20 4" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fillet (Join Lines)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="relative w-[800px] h-[600px]">
          {/* Replace map div with MapComponent */}
          <MapComponent className="absolute inset-0 z-0" />
          
          {/* Konva Stage Container */}
          <div className="absolute inset-0 z-10">
            <Stage
              width={800}
              height={600}
              ref={stageRef}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onClick={handleStageClick}
              className={`${
                mode === "pan" ? 'cursor-grab active:cursor-grabbing' : 
                mode === "moveWalls" ? 'cursor-move' : ''
              }`}
              scaleX={scale}
              scaleY={scale}
              x={position.x}
              y={position.y}
              draggable={mode === "pan"}
              onDragEnd={(e) => {
                if (!isDraggingHandler) {
                  setPosition({
                    x: e.target.x(),
                    y: e.target.y()
                  });
                }
              }}
            >
              <Layer 
                ref={layerRef}
                listening={true}
                clearBeforeDraw={true}
              >
                {lines.map((line) => (
                  <Line
                    key={`line-${line.id}`}
                    points={line.points}
                    stroke={line.selected ? "#2563eb" : "#000"}
                    strokeWidth={line.selected ? 3 : 2}
                    hitStrokeWidth={20}
                    perfectDrawEnabled={false}
                    listening={!line.selected}
                    onClick={(e) => handleLineClick(line.id, e)}
                    onTap={(e) => handleLineClick(line.id, e)}
                    onDblClick={(e) => handleLineSplit(line.id, e)}
                    onDblTap={(e) => handleLineSplit(line.id, e)}
                    onMouseEnter={() => handleLineHover(line.id)}
                    onMouseLeave={handleLineHoverEnd}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}
                
                {lines.map((line) => line.selected && (
                  <React.Fragment key={`handlers-${line.id}`}>
                    <Circle
                      x={line.points[0]}
                      y={line.points[1]}
                      radius={5}
                      fill="#fff"
                      stroke="#2563eb"
                      strokeWidth={2}
                      draggable
                      listening={true}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                      transformsEnabled="position"
                      hitStrokeWidth={12}
                      onDragStart={handlePointDragStart}
                      onDragEnd={handlePointDragEnd}
                      onDragMove={(e) => {
                        handlePointDrag(line.id, true, e.target.position());
                      }}
                    />
                    {mode === "split" && (
                      <Circle
                        x={(line.points[0] + line.points[2]) / 2}
                        y={(line.points[1] + line.points[3]) / 2}
                        radius={5}
                        fill="#fff"
                        stroke="#2563eb"
                        strokeWidth={2}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                        transformsEnabled="position"
                        listening={true}
                      />
                    )}
                    <Circle
                      x={line.points[2]}
                      y={line.points[3]}
                      radius={5}
                      fill="#fff"
                      stroke="#2563eb"
                      strokeWidth={2}
                      draggable
                      listening={true}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                      transformsEnabled="position"
                      hitStrokeWidth={12}
                      onDragStart={handlePointDragStart}
                      onDragEnd={handlePointDragEnd}
                      onDragMove={(e) => {
                        handlePointDrag(line.id, false, e.target.position());
                      }}
                    />
                  </React.Fragment>
                ))}

                {/* Snap point indicator while drawing */}
                {snapPoint && mode === "draw" && (
                  <Circle
                    x={snapPoint.x}
                    y={snapPoint.y}
                    radius={6}
                    fill="rgba(37, 99, 235, 0.3)"
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                )}

                {/* Add selection rectangle */}
                {selectionRect && (
                  <React.Fragment>
                    <Rect
                      x={selectionRect.startX}
                      y={selectionRect.startY}
                      width={selectionRect.width}
                      height={selectionRect.height}
                      stroke={selectionRect.isWindowSelection ? "#2563eb" : "#22c55e"}
                      fill={selectionRect.isWindowSelection ? 
                        "rgba(37, 99, 235, 0.1)" : 
                        "rgba(34, 197, 94, 0.1)"
                      }
                      dash={[4, 4]}
                    />
                  </React.Fragment>
                )}

                {lines.map((line) => {
                  const length = Math.round(getLineLength(line.points));
                  const midX = (line.points[0] + line.points[2]) / 2;
                  const midY = (line.points[1] + line.points[3]) / 2;
                  
                  // Calculate angle for text rotation
                  const angle = Math.atan2(
                    line.points[3] - line.points[1],
                    line.points[2] - line.points[0]
                  ) * 180 / Math.PI;
                  
                  // Offset the text slightly above the line
                  const offset = 15;
                  const perpAngle = angle * Math.PI / 180 + Math.PI / 2;
                  const textX = midX + Math.cos(perpAngle) * offset;
                  const textY = midY + Math.sin(perpAngle) * offset;

                  return (
                    <Text
                      key={`length-${line.id}`}
                      x={textX}
                      y={textY}
                      text={`${length}`}
                      fontSize={14}
                      fill={line.selected ? "#2563eb" : "#000"}
                      rotation={angle > 90 || angle < -90 ? angle + 180 : angle}
                      offsetX={20}
                      offsetY={0}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                      transformsEnabled="all"
                    />
                  );
                })}

                {/* Add alignment guides */}
                {mode === "draw" && isDrawing && alignmentPoints.map((point, index) => {
                  const currentLine = lines[lines.length - 1];
                  const currentPoint = {
                    x: currentLine.points[2],
                    y: currentLine.points[3]
                  };

                  // Only draw guides if points are aligned
                  const isVerticalAlign = Math.abs(point.x - currentPoint.x) < SNAP_THRESHOLD;
                  const isHorizontalAlign = Math.abs(point.y - currentPoint.y) < SNAP_THRESHOLD;

                  return (
                    <React.Fragment key={`guide-${index}`}>
                      {isVerticalAlign && (
                        <Line
                          points={[
                            point.x,
                            Math.min(point.y, currentPoint.y),
                            point.x,
                            Math.max(point.y, currentPoint.y)
                          ]}
                          stroke="#2563eb"
                          strokeWidth={1}
                          dash={[4, 4]}
                          opacity={0.5}
                          listening={false}
                          perfectDrawEnabled={false}
                        />
                      )}
                      {isHorizontalAlign && (
                        <Line
                          points={[
                            Math.min(point.x, currentPoint.x),
                            point.y,
                            Math.max(point.x, currentPoint.x),
                            point.y
                          ]}
                          stroke="#2563eb"
                          strokeWidth={1}
                          dash={[4, 4]}
                          opacity={0.5}
                          listening={false}
                          perfectDrawEnabled={false}
                        />
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Add exterior markers */}
                {lines.map((line) => {
                  const { markerPos, connectionStart } = calculateExteriorMarkerPosition(
                    line.points,
                    line.exteriorSide
                  );
                  
                  return (
                    <React.Fragment key={`exterior-${line.id}`}>
                      <Line
                        points={[
                          connectionStart.x,
                          connectionStart.y,
                          markerPos.x,
                          markerPos.y
                        ]}
                        stroke={line.selected ? "#2563eb" : "#000"}
                        strokeWidth={1}
                        perfectDrawEnabled={false}
                        listening={false}
                      />
                      <Circle
                        x={markerPos.x}
                        y={markerPos.y}
                        radius={3}
                        fill={line.selected ? "#2563eb" : "#000"}
                        stroke={line.selected ? "#2563eb" : "#000"}
                        strokeWidth={1}
                        perfectDrawEnabled={false}
                        onClick={(e) => handleExteriorMarkerClick(line.id, e)}
                        onTap={(e) => handleExteriorMarkerClick(line.id, e)}
                        hitStrokeWidth={10}
                      />
                    </React.Fragment>
                  );
                })}

                {/* Add visual feedback for the first selected line */}
                {mode === "fillet" && filletLines.length === 1 && (
                  <Line
                    points={lines.find(l => l.id === filletLines[0])?.points || []}
                    stroke="#2563eb"
                    strokeWidth={3}
                    dash={[5, 5]}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

      <WindowsPanel
        lines={lines}
        onAddWindow={handleAddWindow}
        onUpdateWindow={handleUpdateWindow}
        onDeleteWindow={handleDeleteWindow}
        onWallSelect={handleWallSelect}
      />
    </div>
  );
}
