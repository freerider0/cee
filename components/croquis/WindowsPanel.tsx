import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface Window {
  id: string;
  width: number;
  height: number;
  hasPersiana: boolean;
  color: string;
  glassType: 'simple' | 'double';
  position: number;
}

export interface LineWithWindows {
  id: string;
  points: number[];
  selected: boolean;
  isHovered?: boolean;
  windows: Window[];
}

interface WindowsPanelProps {
  lines: LineWithWindows[];
  onAddWindow: (lineId: string) => void;
  onUpdateWindow: (lineId: string, windowId: string, updates: Partial<Window>) => void;
  onDeleteWindow: (lineId: string, windowId: string) => void;
  onWallSelect?: (lineId: string) => void;
}

export function WindowsPanel({ 
  lines, 
  onAddWindow, 
  onUpdateWindow, 
  onDeleteWindow,
  onWallSelect 
}: WindowsPanelProps) {
  return (
    <Sheet open={true} modal={false}>
      <SheetContent side="right" className="w-[400px]">
        <SheetHeader>
          <SheetTitle>Wall Windows</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] pr-4">
          {lines.map((line, index) => (
            <Card 
              key={line.id} 
              className={`mb-4 cursor-pointer transition-colors ${
                line.selected ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => onWallSelect?.(line.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between py-2">
                <h4 className="font-semibold">Wall {index + 1}</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddWindow(line.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Window
                </Button>
              </CardHeader>
              <CardContent>
                {(line.windows || []).map((window) => (
                  <div key={window.id} className="border rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`width-${window.id}`}>Width (cm)</Label>
                        <Input
                          id={`width-${window.id}`}
                          type="number"
                          value={window.width}
                          onChange={(e) => onUpdateWindow(line.id, window.id, {
                            width: Number(e.target.value)
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`height-${window.id}`}>Height (cm)</Label>
                        <Input
                          id={`height-${window.id}`}
                          type="number"
                          value={window.height}
                          onChange={(e) => onUpdateWindow(line.id, window.id, {
                            height: Number(e.target.value)
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`glass-${window.id}`}>Glass Type</Label>
                        <Select
                          value={window.glassType}
                          onValueChange={(value) => onUpdateWindow(line.id, window.id, {
                            glassType: value as 'simple' | 'double'
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">Simple</SelectItem>
                            <SelectItem value="double">Double</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`color-${window.id}`}>Color</Label>
                        <Input
                          id={`color-${window.id}`}
                          type="color"
                          value={window.color}
                          onChange={(e) => onUpdateWindow(line.id, window.id, {
                            color: e.target.value
                          })}
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <Label htmlFor={`persiana-${window.id}`}>Has Persiana</Label>
                        <Input
                          id={`persiana-${window.id}`}
                          type="checkbox"
                          className="w-4 h-4"
                          checked={window.hasPersiana}
                          onChange={(e) => onUpdateWindow(line.id, window.id, {
                            hasPersiana: e.target.checked
                          })}
                        />
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-4"
                      onClick={() => onDeleteWindow(line.id, window.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Window
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
} 