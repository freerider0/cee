import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LineElement, Window } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface WindowsPanelProps {
  lines: LineElement[];
  onAddWindow: (lineId: string, window: Window) => void;
  onUpdateWindow: (lineId: string, windowId: string, window: Window) => void;
  onDeleteWindow: (lineId: string, windowId: string) => void;
  onWallSelect: (lineId: string) => void;
}

export function WindowsPanel({
  lines,
  onAddWindow,
  onUpdateWindow,
  onDeleteWindow,
  onWallSelect
}: WindowsPanelProps) {
  const selectedLine = lines.find(line => line.selected);

  const handleAddWindow = () => {
    if (!selectedLine) return;

    const newWindow: Window = {
      id: uuidv4(),
      width: 100,
      height: 100,
      position: 0.5, // centered on the wall
      hasPersiana: false,
      color: '#ffffff',
      glassType: 'clear'
    };

    onAddWindow(selectedLine.id, newWindow);
  };

  return (
    <div className="w-64 p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Windows</h3>
      
      {lines.map(line => (
        <div
          key={line.id}
          className={`p-2 mb-2 cursor-pointer rounded ${
            line.selected ? 'bg-blue-100' : 'hover:bg-gray-100'
          }`}
          onClick={() => onWallSelect(line.id)}
        >
          <div className="flex justify-between items-center">
            <span>Wall {line.id.slice(0, 4)}</span>
            {line.selected && (
              <Button
                size="sm"
                onClick={handleAddWindow}
              >
                Add Window
              </Button>
            )}
          </div>

          {line.selected && line.windows?.map(window => (
            <div key={window.id} className="mt-2 p-2 bg-gray-50 rounded">
              <Input
                type="number"
                value={window.width}
                onChange={(e) => onUpdateWindow(line.id, window.id, {
                  ...window,
                  width: Number(e.target.value)
                })}
                className="mb-2"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDeleteWindow(line.id, window.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
} 