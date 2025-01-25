export interface Point {
  x: number;
  y: number;
}

export interface Window {
  id: string;
  width: number;
  height: number;
  hasPersiana: boolean;
  color: string;
  glassType: string;
  position: number;
}

export interface LineElement {
  id: string;
  points: number[];
  selected: boolean;
  isHovered?: boolean;
  exteriorSide: 'positive' | 'negative';
  windows?: Window[];
}

export type DrawingMode = "select" | "draw" | "edit" | "split" | "pan" | "moveWalls" | "fillet";



export interface SelectionRect {
  startX: number;
  startY: number;
  width: number;
  height: number;
  isWindowSelection: boolean;
}

export interface Window {
  id: string;
  width: number;
  height: number;
  hasPersiana: boolean;
  color: string;
  glassType: string;
  position: number;
}


export interface ConnectionInfo {
  isConnected: boolean;
  connectedTo: LineElement | null;
} 




