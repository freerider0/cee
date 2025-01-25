import { useState } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseZoomAndPanProps {
  minZoom?: number;
  maxZoom?: number;
  initialScale?: number;
  initialPosition?: Position;
}

interface UseZoomAndPanReturn {
  scale: number;
  position: Position;
  isMiddleMousePanning: boolean;
  lastMousePosition: Position | null;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  handleMiddleMouseDown: (e: any) => void;
  handleMiddleMouseUp: (e: any) => void;
  handlePanning: (e: any) => void;
  handleWheel: (e: any) => void;
  handleStageDragEnd: (e: any, isDraggingHandler: boolean) => void;
}

export function useZoomAndPan({
  minZoom = 0.2,
  maxZoom = 5,
  initialScale = 1,
  initialPosition = { x: 0, y: 0 }
}: UseZoomAndPanProps = {}): UseZoomAndPanReturn {
  const [scale, setScale] = useState(initialScale);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isMiddleMousePanning, setIsMiddleMousePanning] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState<Position | null>(null);

  function handleZoomIn() {
    console.log('Zoom In clicked', { currentScale: scale });
    const oldScale = scale;
    const newScale = Math.min(oldScale * 1.2, maxZoom);
    console.log('New scale will be:', newScale);
    
    // Zoom to center
    const stageWidth = window.innerWidth;
    const stageHeight = window.innerHeight;
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;

    const newPos = {
      x: centerX - (centerX - position.x) * (newScale / oldScale),
      y: centerY - (centerY - position.y) * (newScale / oldScale)
    };

    setScale(newScale);
    setPosition(newPos);
  }

  function handleZoomOut() {
    console.log('Zoom Out clicked', { currentScale: scale });
    const oldScale = scale;
    const newScale = Math.max(oldScale / 1.2, minZoom);
    console.log('New scale will be:', newScale);
    
    // Zoom to center
    const stageWidth = window.innerWidth;
    const stageHeight = window.innerHeight;
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;

    const newPos = {
      x: centerX - (centerX - position.x) * (newScale / oldScale),
      y: centerY - (centerY - position.y) * (newScale / oldScale)
    };

    setScale(newScale);
    setPosition(newPos);
  }

  function handleResetZoom() {
    setScale(initialScale);
    setPosition(initialPosition);
  }

  function handleMiddleMouseDown(e: any) {
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsMiddleMousePanning(true);
      const stage = e.target.getStage();
      stage.container().style.cursor = 'grabbing';
      setLastMousePosition({
        x: e.evt.clientX,
        y: e.evt.clientY
      });
    }
  }

  function handleMiddleMouseUp(e: any) {
    if (e.evt.button === 1) {
      setIsMiddleMousePanning(false);
      setLastMousePosition(null);
      const stage = e.target.getStage();
      stage.container().style.cursor = 'default';
    }
  }

  function handlePanning(e: any) {
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
    }
  }

  function handleWheel(e: any) {
    e.evt.preventDefault();
    
    const stage = e.target.getStage();
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 
      ? Math.min(oldScale * scaleBy, maxZoom)
      : Math.max(oldScale / scaleBy, minZoom);

    // Get pointer position relative to stage
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale
    };

    // Calculate new position
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };

    console.log('Updating scale and position:', { newScale, newPos });
    setScale(newScale);
    setPosition(newPos);
  }

  function handleStageDragEnd(e: any, isDraggingHandler: boolean) {
    if (!isDraggingHandler) {
      setPosition({
        x: e.target.x(),
        y: e.target.y()
      });
    }
  }

  return {
    scale,
    position,
    isMiddleMousePanning,
    lastMousePosition,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMiddleMouseDown,
    handleMiddleMouseUp,
    handlePanning,
    handleWheel,
    handleStageDragEnd
  };
} 