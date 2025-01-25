import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { DrawingMode } from "../types";

interface ToolbarButtonsProps {
  mode: DrawingMode;
  setMode: (mode: DrawingMode) => void;
  isOrthogonal: boolean;
  setIsOrthogonal: (value: boolean) => void;
  handleDeleteSelected: () => void;
  handleClearAll: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  hasSelectedLines: boolean;
  setFilletLines: (lines: string[]) => void;
}

export function ToolbarButtons({
  mode,
  setMode,
  isOrthogonal,
  setIsOrthogonal,
  handleDeleteSelected,
  handleClearAll,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  hasSelectedLines,
  setFilletLines,
}: ToolbarButtonsProps) {
  return (
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
              disabled={!hasSelectedLines}
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
  );
} 