'use client';

import Konva from 'konva';
import React, { useEffect, useRef, useState } from "react";
import { LineElement, DrawingMode, Point, SelectionRect } from "./types";
import { Stage, Layer, Line, Circle, Rect, Text, Group } from "react-konva";
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
import { useZoomAndPan } from './hooks/useZoomAndPan';
import { findNearestPoint, getOrthogonalPoint, calculateExteriorMarkerPosition, calculateMidpoint, calculateNormalVector, trimLinesToIntersection, getLineLength, findAlignmentPoints, findConnectedEndpoint, findLineIntersection } from './utils';
import { useLineHandlers } from './hooks/useLineHandlers';
import { ToolbarButtons } from './components/ToolbarButtons';


export function CroquisCanvas() {
  const [lines, setLines] = useState<LineElement[]>([]);
  const [mode, setMode] = useState<DrawingMode>("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [snapPoint, setSnapPoint] = useState<Point | null>(null);
  const [isOrthogonal, setIsOrthogonal] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
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

  const {
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMiddleMouseDown,
    handleMiddleMouseUp,
    handlePanning,
    handleStageDragEnd,
    handleWheel,
    scale,
    position
  } = useZoomAndPan();

  const {
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
  } = useLineHandlers({
    lines,
    setLines,
    mode,
    scale,
    position,
    setSelectedLine,
    setFilletLines,
    filletLines,
    setMode
  });

  // Helper function to handle point dragging with snapping
  function handlePointDrag(lineId: string, isStart: boolean, pos: Point) {
    const nearestPoint = findNearestPoint(pos, lineId, lines);
    const finalPos =  nearestPoint || pos;

    console.log('finalPos', finalPos);

    // Find the original line and point position
    const originalLine = lines.find(l => l.id === lineId);
  
    if (!originalLine) return;
    
    const originalPoint = {
      x: isStart ? originalLine.points[0] : originalLine.points[2],
      y: isStart ? originalLine.points[1] : originalLine.points[3]
    };

    // Update only selected lines that share the same point
    const newLines = lines.map(l => {
      // Skip unselected lines
      if (!l.selected) return l;

      // Check start point
      const startMatches = Math.abs(l.points[0] - originalPoint.x) < 0.1 && 
                          Math.abs(l.points[1] - originalPoint.y) < 0.1;
      // Check end point
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
    
    if (layerRef.current) {
      layerRef.current.batchDraw();
    }
  }

  // Handle drawing new lines
  function handleMouseDown(e: any) {
    if (e.target === e.target.getStage() || e.target.attrs.radius === 6) {
      if (mode === "moveWalls") {
        handleMoveWallsMouseDown(e);
        return;
      }
      if (mode === "draw") {
        const stage = e.target.getStage();
        const pointerPos = stage.getPointerPosition();
        const pos = {
          x: (pointerPos.x - position.x) / scale,
          y: (pointerPos.y - position.y) / scale
        };
        console.log(pos);
        setIsDrawing(true);
        
        // Check if we're starting near a snap point
        const nearestPoint = findNearestPoint(pos, '', lines);
        const startPos = nearestPoint || pos;
        
        const newLine: LineElement = {
          id: Date.now().toString(),
          points: [startPos.x, startPos.y, startPos.x, startPos.y],
          selected: false,
          exteriorSide: 'positive',
          windows: []
        };
        
        setLines([...lines, newLine]);
      } else if (mode === "select" && e.target === e.target.getStage()) {
        // Clear selection only on direct stage click
        const updatedLines = lines.map(line => ({
          ...line,
          selected: false
        }));
        setLines(updatedLines);
        setSelectedLine(null);

        // Then start selection rect if needed
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
  }


  // Add new handler for general mouse movement
  function handleStageMouseMove(e: any) {
    if (mode === "moveWalls") {
      handleMoveWallsMouseMove(e);
      return;
    }
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    const pos = {
      x: (pointerPos.x - position.x) / scale,
      y: (pointerPos.y - position.y) / scale
    };

    if (isMiddleMousePanning && lastMousePosition) {
      return;
    }

    if (mode === "draw") {
      // If we're not drawing, just check for potential snap points
      if (!isDrawing) {
        const nearestPoint = findNearestPoint(pos, '', lines);
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

      // Update the current line while drawing
      if (isDrawing && lines.length > 0) {
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
          if (Math.abs(point.x - finalPos.x) < SNAP_THRESHOLD) {
            snappedPos.x = point.x;
          }
          if (Math.abs(point.y - finalPos.y) < SNAP_THRESHOLD) {
            snappedPos.y = point.y;
          }
        });

        // Check for endpoint snapping
        const nearestPoint = findNearestPoint(snappedPos, currentLine.id, lines);
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
    // Skip if the event came from a point handler
    if (e.target.nodeType === 'Circle' && e.target.radius() === 6) {
      return;
    }

    if (mode === "draw") {
      console.log('mouse up');
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      const pos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };

      if (isDrawing) {
        console.log('isDrawing');
        const lastLine = [...lines];
        const currentLine = lastLine[lastLine.length - 1];
        const nearestPoint = findNearestPoint(pos, currentLine.id, lines);

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
    setSelectionRect(null);
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

  // Add new function to handle deletion
  function handleDeleteSelected() {
    setLines(lines.filter(line => !line.selected));
    setSelectedLine(null);
  }

  // Update the point drag handlers
  function handlePointDragStart() {
    setIsDraggingHandler(true);
  }

  function handlePointDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    // This handler should ONLY deal with point dragging cleanup
    e.cancelBubble = true;  // Prevent bubbling to stage
    e.evt.stopPropagation();
    e.evt.preventDefault();
    
    // Small delay to ensure state update happens after the event
    requestAnimationFrame(() => {
      setIsDraggingHandler(false);
    });
  }


  function arePointsEqual(p1: Point, p2: Point, tolerance: number = 0.1): boolean {
    return Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance;
  }

  function handleClearAll() {
    setLines([]);
    setSelectedLine(null);
    setSnapPoint(null);
    setSelectionRect(null);
    setAlignmentPoints([]);
    setFilletLines([]);
    setIsDrawing(false);
    setIsDraggingHandler(false);
    setIsDraggingWalls(false);
  }

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-4">
        <ToolbarButtons
          mode={mode}
          setMode={setMode}
          isOrthogonal={isOrthogonal}
          setIsOrthogonal={setIsOrthogonal}
          handleDeleteSelected={handleDeleteSelected}
          handleClearAll={handleClearAll}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          handleResetZoom={handleResetZoom}
          hasSelectedLines={lines.some(line => line.selected)}
          setFilletLines={setFilletLines}
        />
        
        {/* Add status banner */}
        {mode === "moveWalls" && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-green-100 border border-green-500 text-green-700 px-4 py-2 rounded-md shadow-md">
              {getMoveWallsStatus()}
            </div>
          </div>
        )}

        <div className="relative w-[800px] h-[600px]">
          {/* Replace map div with MapComponent */}
          <MapComponent className="absolute inset-0 z-0" />
          
          {/* Konva Stage Container */}
          <div className="absolute inset-0 z-10">
            <Stage
              width={800}
              height={600}
              ref={stageRef}
              onMouseDown={(e) => {
                // Check if it's middle mouse button (button === 1)
                if (e.evt.button === 1) {
                  handleMiddleMouseDown(e);
                  return;
                }
                // Only handle left click (button === 0) for drawing/selecting
                if (e.evt.button === 0) {
                  handleMouseDown(e);
                }
              }}
              onMouseMove={(e) => {
                if (isMiddleMousePanning) {
                  handlePanning(e);
                } else {
                  handleStageMouseMove(e);
                }
              }}
              onMouseUp={(e) => {
                // Check if it's middle mouse button
                if (e.evt.button === 1) {
                  handleMiddleMouseUp(e);
                  return;
                }
                // Only handle left click release for drawing/selecting
                if (e.evt.button === 0) {
                  handleMouseUp(e);
                }
              }}
              onWheel={handleWheel}
              className={`${
                mode === "pan" ? 'cursor-grab active:cursor-grabbing' : 
                mode === "moveWalls" ? 'cursor-move' : ''
              }`}
              scaleX={scale}
              scaleY={scale}
              x={position.x}
              y={position.y}
              draggable={mode === "pan" && !isDraggingHandler}
              onDragEnd={handleStageDragEnd}
            >
              <Layer 
                ref={layerRef}
                listening={true}
                clearBeforeDraw={true}
              >
                {/* Grid */}
                <Group key="grid">
                  {/* ... grid elements ... */}
                </Group>

                {/* Lines */}
                {lines.map((line) => (
                  <Group key={line.id}>
                    <Line
                      points={line.points}
                      stroke={line.selected ? "#22c55e" : hoveredLine === line.id ? "#64748b" : "#334155"}
                      strokeWidth={2}
                      onClick={(e) => handleLineClick(line.id, e)}
                      onMouseEnter={() => handleLineHover(line.id)}
                      onMouseLeave={handleLineHoverEnd}
                      perfectDrawEnabled={false}
                      lineCap='round'
                      lineJoin='round'
                      hitStrokeWidth={20}
                    />
                    
                    {/* Add endpoint handles for selected lines */}
                    {line.selected && (
                      <>
                        <Circle
                          x={line.points[0]}
                          y={line.points[1]}
                          radius={6}
                          fill="#fff"
                          stroke="#22c55e"
                          strokeWidth={2}
                          draggable
                          onDragStart={handlePointDragStart}
                          onDragMove={(e) => handlePointDrag(line.id, true, {
                            x: e.target.x(),
                            y: e.target.y()
                          })}
                          onDragEnd={handlePointDragEnd}
                          hitStrokeWidth={10}
                        />
                        <Circle
                          x={line.points[2]}
                          y={line.points[3]}
                          radius={6}
                          fill="#fff"
                          stroke="#22c55e"
                          strokeWidth={2}
                          draggable
                          onDragStart={handlePointDragStart}
                          onDragMove={(e) => handlePointDrag(line.id, false, {
                            x: e.target.x(),
                            y: e.target.y()
                          })}
                          onDragEnd={handlePointDragEnd}
                          hitStrokeWidth={10}
                        />
                      </>
                    )}
                  </Group>
                ))}

                {/* Move walls preview */}
                {mode === "moveWalls" && getMoveWallsPreview()?.map(element => {
                  const { key, props } = element;

                  if (element.type === 'circle') {
                    return <Circle key={key} {...props} />;
                  }
                  if (element.type === 'line') {
                    return <Line key={key} {...props} />;
                  }
                  return null;
                })}

                {/* Drawing preview */}
                {isDrawing && (
                  <Group key="drawing-preview">
                    <Line
                      points={lines[lines.length - 1].points}
                      stroke="#22c55e"
                      strokeWidth={2}
                      perfectDrawEnabled={false}
                    />
                  </Group>
                )}

                {/* Snap points */}
                {snapPoint && (
                  <Group key="snap-points">
                    <Circle
                      x={snapPoint.x}
                      y={snapPoint.y}
                      radius={6}
                      fill="rgba(34, 197, 94, 0.3)"
                      stroke="#22c55e"
                      strokeWidth={2}
                      perfectDrawEnabled={false}
                    />
                  </Group>
                )}

                {/* Add selection rectangle */}
                {selectionRect && (
                  <Group key="selection-rect">
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
                  </Group>
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
                    <Group key={`length-${line.id}`}>
                      <Text
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
                    </Group>
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
                    <Group key={`guide-${index}`}>
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
                    </Group>
                  );
                })}

                {/* Add exterior markers */}
                {lines.map((line) => {
                  const { markerPos, connectionStart } = calculateExteriorMarkerPosition(
                    line.points,
                    line.exteriorSide
                  );
                  
                  return (
                    <Group key={`exterior-${line.id}`}>
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
                    </Group>
                  );
                })}

                {/* Add visual feedback for the first selected line when fillet two walls*/}
                {mode === "fillet" && filletLines.length === 1 && (
                  <Group key="fillet-line">
                    <Line
                      points={lines.find(l => l.id === filletLines[0])?.points || []}
                      stroke="#2563eb"
                      strokeWidth={3}
                      dash={[5, 5]}
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  </Group>
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
}
