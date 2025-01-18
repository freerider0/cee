"use client";

import React from "react";
import { Stage, Layer, Line, Circle, Rect, Text } from "react-konva";
import { useState, useRef } from "react";
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

interface Point {
  x: number;
  y: number;
}

interface LineElement extends LineWithWindows {
  id: string;
  points: number[];
  selected: boolean;
  isHovered?: boolean;
}

interface SelectionRect {
  startX: number;
  startY: number;
  width: number;
  height: number;
  isWindowSelection: boolean;
}

type DrawingMode = "select" | "draw" | "edit" | "split" | "pan" | "moveWalls";

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
  
  const stageRef = useRef(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Add snap threshold constant
  const SNAP_THRESHOLD = 10;

  // Helper function to find nearest point from other lines only
  function findNearestPoint(currentPoint: Point, currentLineId: string): Point | null {
    let nearest: Point | null = null;
    let minDistance = SNAP_THRESHOLD;

    lines.forEach(line => {
      if (line.id === currentLineId) return;

      // Use exact coordinates for start and end points
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
    const nearestPoint = findNearestPoint(pos);
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
      
      const nearestPoint = findNearestPoint(finalPos, currentLine.id);
      
      if (nearestPoint) {
        const distance = Math.sqrt(
          Math.pow(finalPos.x - nearestPoint.x, 2) + 
          Math.pow(finalPos.y - nearestPoint.y, 2)
        );
        
        if (distance <= SNAP_THRESHOLD * 2) {
          setSnapPoint(nearestPoint);
          if (distance <= SNAP_THRESHOLD) {
            currentLine.points = [
              currentLine.points[0],
              currentLine.points[1],
              nearestPoint.x,
              nearestPoint.y,
            ];
          } else {
            currentLine.points = [
              currentLine.points[0],
              currentLine.points[1],
              Math.round(finalPos.x),
              Math.round(finalPos.y),
            ];
          }
        } else {
          setSnapPoint(null);
          currentLine.points = [
            currentLine.points[0],
            currentLine.points[1],
            Math.round(finalPos.x),
            Math.round(finalPos.y),
          ];
        }
      } else {
        setSnapPoint(null);
        currentLine.points = [
          currentLine.points[0],
          currentLine.points[1],
          Math.round(finalPos.x),
          Math.round(finalPos.y),
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
      setIsDrawing(false);
      setSnapPoint(null);
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
    };
    
    const line2: LineElement = {
      id: (Date.now() + 1).toString(),
      points: [pos.x, pos.y, x2, y2],
      selected: false,
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
    if (mode === "moveWalls") {
      const hasSelectedWalls = lines.some(line => line.selected);
      if (!hasSelectedWalls) {
        handleMouseDown(e); // Use existing selection logic
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

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 items-center">
          <Button
            variant={mode === "select" ? "default" : "outline"}
            onClick={() => setMode("select")}
          >
            <MousePointer2 className="w-4 h-4 mr-2" />
            Select
          </Button>
          <Button
            variant={mode === "draw" ? "default" : "outline"}
            onClick={() => setMode("draw")}
          >
            <PenLine className="w-4 h-4 mr-2" />
            Draw
          </Button>
          <Button
            variant={mode === "pan" ? "default" : "outline"}
            onClick={() => setMode("pan")}
          >
            <Move className="w-4 h-4 mr-2" />
            Pan
          </Button>
          <Button
            variant={mode === "split" ? "default" : "outline"}
            onClick={() => setMode("split")}
          >
            <Scissors className="w-4 h-4 mr-2" />
            Split
          </Button>
          <Button
            variant={isOrthogonal ? "default" : "outline"}
            onClick={() => setIsOrthogonal(!isOrthogonal)}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Orthogonal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={!lines.some(line => line.selected)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button
            variant={mode === "moveWalls" ? "default" : "outline"}
            onClick={() => setMode("moveWalls")}
          >
            <Move className="w-4 h-4 mr-2" />
            Move Walls
          </Button>
          <Button
            variant="destructive"
            onClick={handleClearAll}
            className="ml-2"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
          
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleResetZoom}
              title="Reset Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {activeSelectedLine && (
            <div className="flex items-center gap-2 ml-4">
              <Label htmlFor="lineLength">Length:</Label>
              <Input
                id="lineLength"
                type="number"
                min="0"
                step="1"
                className="w-24"
                value={Math.round(getLineLength(activeSelectedLine.points))}
                onChange={(e) => {
                  const newLength = parseFloat(e.target.value);
                  if (!isNaN(newLength) && newLength > 0) {
                    handleLengthChange(activeSelectedLine.id, newLength);
                  }
                }}
              />
            </div>
          )}
        </div>
        
        <Stage
          width={800}
          height={600}
          ref={stageRef}
          onMouseDown={handleStageMouseDown}
          onMouseMove={(e) => {
            if (isDraggingWalls) {
              handleWallDrag(e);
            } else {
              handleStageMouseMove(e);
            }
          }}
          onMouseUp={handleStageMouseUp}
          onClick={handleStageClick}
          className={`border border-gray-200 rounded-lg ${
            mode === "pan" ? 'cursor-grab active:cursor-grabbing' : 
            mode === "moveWalls" ? 'cursor-move' : ''
          }`}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable={mode === "pan" && !isDraggingHandler}
          onDragEnd={(e) => {
            if (!isDraggingHandler) {
              setPosition({
                x: e.target.x(),
                y: e.target.y()
              });
            }
          }}
        >
          <Layer ref={layerRef} listening={true}>
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
          </Layer>
        </Stage>
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
