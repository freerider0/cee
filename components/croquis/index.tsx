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
import { findNearestPoint, getOrthogonalPoint, calculateExteriorMarkerPosition, calculateMidpoint, isLineInSelection, calculateNormalVector, trimLinesToIntersection, getLineLength, findAlignmentPoints, findConnectedEndpoint, findLineIntersection } from './utils';
import { useLineHandlers } from './hooks/useLineHandlers';
import { ToolbarButtons } from './components/ToolbarButtons';
import { usePointHandlers } from './hooks/usePointHandlers';


export function CroquisCanvas() {
  const [showMap, setShowMap] = useState(false);
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
  const [showGrid, setShowGrid] = useState(false);

  const stageRef = useRef(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Add snap threshold constant
  const SNAP_THRESHOLD = 10;

  // Add WindRose constants
  const WIND_ROSE_MARGIN = 20;
  const WIND_ROSE_SIZE = 200;

  // Add this near the top with other constants
  const GRID_SIZE = 10; // 10px between dots

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

  const {
    handlePointDrag,
    handlePointDragStart,
    handlePointDragEnd
  } = usePointHandlers({
    lines,
    setLines,
    scale,
    position,
    layerRef: layerRef as React.RefObject<Konva.Layer>
  });

  // Handle drawing new lines
  function handleMouseDown(e: any) {
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
        windows: [],
        level: 0
      };
      
      setLines([...lines, newLine]);
    } 
    else if (mode === "select" && e.target === e.target.getStage()) {
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


  // Add new handler for general mouse movement
  function handleStageMouseMove(e: any) {
    // Get the stage
    const stage = e.target.getStage();
    // Get the pointer position in the canvas coordinates
    const pointerPos = stage.getPointerPosition();
    const pos = {
      x: (pointerPos.x - position.x) / scale,
      y: (pointerPos.y - position.y) / scale
    };
    // If we're moving walls, handle the movement
    if (mode === "moveWalls") {
      handleMoveWallsMouseMove(e);
      return;
    }
   

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
        
        // Find alignment points for both start and end points
        const startAlignPoints = findAlignmentPoints(startPoint, currentLine.id, lines);
        const endAlignPoints = findAlignmentPoints(finalPos, currentLine.id, lines);
        
        // Combine alignment points, removing duplicates
        const combinedAlignPoints = [...startAlignPoints, ...endAlignPoints]
          .filter((point, index, self) => 
            index === self.findIndex((p) => p.x === point.x && p.y === point.y)
          );
        
        setAlignmentPoints(combinedAlignPoints);

        // Check for alignment and snap to it
        let snappedPos = { ...finalPos };
        combinedAlignPoints.forEach(point => {
          const distanceX = Math.abs(point.x - finalPos.x);
          const distanceY = Math.abs(point.y - finalPos.y);
          
          if (distanceX < SNAP_THRESHOLD) {
            snappedPos.x = point.x;
          }
          if (distanceY < SNAP_THRESHOLD) {
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
  }



  // Add new function to handle deletion
  function handleDeleteSelected() {
    setLines(lines.filter(line => !line.selected));
    setSelectedLine(null);
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
          setShowMap={setShowMap}
          showMap={showMap}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
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
          {showMap && <MapComponent className="absolute inset-0 z-0" />}
          
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
              className={`
                ${mode === "pan" ? 'cursor-grab active:cursor-grabbing' : 
                  mode === "moveWalls" ? 'cursor-move' : ''}
              `}
              style={{
                backgroundImage: showGrid ? `radial-gradient(circle at center, #ddd 1px, transparent 1px)` : 'none',
                backgroundSize: showGrid ? `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px` : undefined,
                backgroundPosition: showGrid ? 
                  `${position.x % (GRID_SIZE * scale)}px ${position.y % (GRID_SIZE * scale)}px` : 
                  undefined
              }}
              scaleX={scale}
              scaleY={scale}
              x={position.x}
              y={position.y}
              draggable={mode === "pan" && !isDraggingHandler}
              onDragEnd={(e) => handleStageDragEnd(e, isDraggingHandler)}
            >
              {/* Main Layer for lines and other elements */}
              <Layer 
                ref={layerRef}
                listening={true}
                clearBeforeDraw={true}
              >
                {/* Lines */}
                {lines.map((line) => (
                  <React.Fragment key={line.id}>
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
                      hitStrokeWidth={10}
                    />
                  </React.Fragment>
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
                {mode === "draw" && alignmentPoints.map((point, index) => {
                  const currentLine = lines[lines.length - 1];
                  const currentPoint = {
                    x: currentLine.points[2],
                    y: currentLine.points[3]
                  };

                  // Calculate exact distances
                  const distanceX = Math.abs(point.x - currentPoint.x);
                  const distanceY = Math.abs(point.y - currentPoint.y);

                  // Only show alignment if within threshold and it's the closer alignment
                  const isVerticalAlign = distanceX < SNAP_THRESHOLD && distanceX < distanceY;
                  const isHorizontalAlign = distanceY < SNAP_THRESHOLD && distanceY < distanceX;

                  const CANVAS_SIZE = 2000;

                  return (
                    <Group key={`guide-${index}`}>
                      {/* Render vertical guide */}
                      {isVerticalAlign && (
                        <>
                          <Line
                            points={[point.x, -CANVAS_SIZE, point.x, CANVAS_SIZE]}
                            stroke="#2563eb"
                            strokeWidth={1}
                            dash={[4, 4]}
                            opacity={0.5}
                            listening={false}
                            perfectDrawEnabled={false}
                          />
                          <Circle
                            x={point.x}
                            y={point.y}
                            radius={4}
                            fill="#2563eb"
                            opacity={0.8}
                            perfectDrawEnabled={false}
                            listening={false}
                          />
                        </>
                      )}
                      {/* Render horizontal guide */}
                      {isHorizontalAlign && (
                        <>
                          <Line
                            points={[-CANVAS_SIZE, point.y, CANVAS_SIZE, point.y]}
                            stroke="#2563eb"
                            strokeWidth={1}
                            dash={[4, 4]}
                            opacity={0.5}
                            listening={false}
                            perfectDrawEnabled={false}
                          />
                          <Circle
                            x={point.x}
                            y={point.y}
                            radius={4}
                            fill="#2563eb"
                            opacity={0.8}
                            perfectDrawEnabled={false}
                            listening={false}
                          />
                        </>
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

              {/* New Layer specifically for circles/points */}
              <Layer>
                {/* Selected point handlers */}
                {lines.map((line) => (
                  line.selected && (
                    <React.Fragment key={`points-${line.id}`}>
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
                        }, e)}
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
                        }, e)}
                        onDragEnd={handlePointDragEnd}
                        hitStrokeWidth={10}
                      />
                    </React.Fragment>
                  )
                ))}

                {/* Snap points */}
                {snapPoint && (
                  <Circle
                    x={snapPoint.x}
                    y={snapPoint.y}
                    radius={6}
                    fill="rgba(34, 197, 94, 0.3)"
                    stroke="#22c55e"
                    strokeWidth={2}
                    perfectDrawEnabled={false}
                  />
                )}

                {/* Alignment points */}
                {mode === "draw" && alignmentPoints.map((point, index) => {
                  const currentPoint = {
                    x: lines[lines.length - 1]?.points[2],
                    y: lines[lines.length - 1]?.points[3]
                  };
                  const distanceX = Math.abs(point.x - currentPoint.x);
                  const distanceY = Math.abs(point.y - currentPoint.y);
                  const isAligned = distanceX < SNAP_THRESHOLD || distanceY < SNAP_THRESHOLD;

                  return isAligned && (
                    <Circle
                      key={`align-point-${index}`}
                      x={point.x}
                      y={point.y}
                      radius={4}
                      fill="#2563eb"
                      opacity={0.8}
                      perfectDrawEnabled={false}
                      listening={false}
                    />
                  );
                })}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
}
