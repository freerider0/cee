'use client';

import { Stage, Layer, Group } from 'react-konva';
import { Floor, LineElement, DrawingMode } from './types';
import { useDrawing } from './hooks/useDrawing';
import { useLineHandlers } from './hooks/useLineHandlers';
import { useZoomAndPan } from './hooks/useZoomAndPan';

interface FloorPlanProps {
  floor: Floor;
  isActive: boolean;
  mode: DrawingMode;
  onLinesUpdate: (lines: LineElement[]) => void;
}

export function FloorPlan({ floor, isActive, mode, onLinesUpdate }: FloorPlanProps) {
  // Reuse your existing hooks
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
    // ... other line handlers
  } = useLineHandlers({
    lines: floor.lines,
    setLines: onLinesUpdate,
    mode,
    scale,
    position
  });

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDrawing,
    snapPoint,
    alignmentPoints,
    // ... other drawing states and handlers
  } = useDrawing({
    lines: floor.lines,
    setLines: onLinesUpdate,
    mode,
    scale,
    position
  });

  return (
    <Stage
      width={800}
      height={600}
      opacity={isActive ? 1 : floor.opacity}
      scaleX={scale}
      scaleY={scale}
      x={position.x}
      y={position.y}
      draggable={mode === "pan"}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDragEnd={handleStageDragEnd}
    >
      <Layer>
        {/* Grid */}
        <Group>
          {/* Your existing grid rendering */}
        </Group>

        {/* Lines */}
        {floor.lines.map((line) => (
          <Group key={line.id}>
            {/* Your existing line rendering */}
          </Group>
        ))}

        {/* Drawing previews, snap points, etc */}
        {/* ... rest of your rendering logic ... */}
      </Layer>
    </Stage>
  );
} 