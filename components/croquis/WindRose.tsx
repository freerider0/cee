import React from "react";
import { Layer, Circle, Arc, Line, Text } from "react-konva";

interface WindDirection {
  label: string;
  mainAngle: number;
  range: [number, number];
  main: boolean;
  color: string;
}

const WIND_DIRECTIONS: WindDirection[] = [
  { label: 'N', mainAngle: 0, range: [345, 15], main: true, color: '#E3F2FD' },
  { label: 'NE', mainAngle: 45, range: [15, 75], main: false, color: '#E8F5E9' },
  { label: 'E', mainAngle: 90, range: [75, 105], main: true, color: '#F1F8E9' },
  { label: 'SE', mainAngle: 135, range: [105, 165], main: false, color: '#FFF3E0' },
  { label: 'S', mainAngle: 180, range: [165, 195], main: true, color: '#FFE0B2' },
  { label: 'SO', mainAngle: 225, range: [195, 255], main: false, color: '#FFEBEE' },
  { label: 'O', mainAngle: 270, range: [255, 285], main: true, color: '#F3E5F5' },
  { label: 'NO', mainAngle: 315, range: [285, 345], main: false, color: '#E0F7FA' },
];

interface WindRoseProps {
  x: number;
  y: number;
  size: number;
}

export function WindRose({ x, y, size }: WindRoseProps) {
  const radius = size / 2;
  const innerCircleRadius = radius * 0.2; // 20% of radius for inner circle
  const middleCircleRadius = radius * 0.6; // 60% of radius for middle circle

  // Helper function to convert degrees to radians
  const toRadians = (degrees: number) => (degrees - 90) * (Math.PI / 180);

  // Helper function to normalize angle to 0-360 range
  const normalizeAngle = (angle: number) => {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  };

  return (
    <Layer>
      {/* Outer circle */}
      <Circle
        x={x}
        y={y}
        radius={radius}
        stroke="#000"
        strokeWidth={1}
        listening={false}
      />

      {/* Middle circle */}
      <Circle
        x={x}
        y={y}
        radius={middleCircleRadius}
        stroke="#000"
        strokeWidth={0.5}
        dash={[2, 2]}
        listening={false}
      />

      {/* Inner circle */}
      <Circle
        x={x}
        y={y}
        radius={innerCircleRadius}
        stroke="#000"
        strokeWidth={0.5}
        dash={[2, 2]}
        listening={false}
      />

      {/* Direction sectors and labels */}
      {WIND_DIRECTIONS.map(({ label, mainAngle, range, main, color }) => {
        const startAngle = range[0];
        const endAngle = range[1];
        const mainAngleRad = toRadians(mainAngle);

        // Handle the special case for North sector (crossing 0°)
        const arcAngle = startAngle > endAngle 
          ? 360 - startAngle + endAngle 
          : endAngle - startAngle;

        return (
          <React.Fragment key={label}>
            {/* Sector arc */}
            <Arc
              x={x}
              y={y}
              angle={arcAngle}
              rotation={startAngle}
              innerRadius={0}
              outerRadius={radius}
              fill={color}
              stroke="#000"
              strokeWidth={0.5}
              listening={false}
            />

            {/* Sector boundary lines */}
            {[startAngle, endAngle].map((angle, idx) => (
              <Line
                key={`${label}-line-${idx}`}
                points={[
                  x,
                  y,
                  x + radius * Math.cos(toRadians(angle)),
                  y + radius * Math.sin(toRadians(angle))
                ]}
                stroke="#000"
                strokeWidth={0.5}
                dash={[2, 2]}
                listening={false}
              />
            ))}

            {/* Main direction line */}
            <Line
              points={[
                x,
                y,
                x + radius * Math.cos(mainAngleRad),
                y + radius * Math.sin(mainAngleRad)
              ]}
              stroke="#000"
              strokeWidth={main ? 1.5 : 1}
              listening={false}
            />

            {/* Direction labels */}
            {/* Main label */}
            <Text
              x={x + (radius + 15) * Math.cos(mainAngleRad)}
              y={y + (radius + 15) * Math.sin(mainAngleRad)}
              text={label}
              fontSize={main ? 14 : 12}
              fontStyle={main ? "bold" : "normal"}
              fill="#000"
              align="center"
              verticalAlign="middle"
              offsetX={8}
              offsetY={8}
              listening={false}
            />

            {/* Angle range labels */}
            <Text
              x={x + (radius + 25) * Math.cos(mainAngleRad)}
              y={y + (radius + 25) * Math.sin(mainAngleRad)}
              text={`${range[0]}°-${range[1]}°`}
              fontSize={10}
              fill="#666"
              align="center"
              verticalAlign="middle"
              offsetX={8}
              offsetY={8}
              listening={false}
            />

            {/* Degree markers */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((degree) => {
              const degreeRad = toRadians(degree);
              return (
                <React.Fragment key={`degree-${degree}`}>
                  <Line
                    points={[
                      x + middleCircleRadius * Math.cos(degreeRad),
                      y + middleCircleRadius * Math.sin(degreeRad),
                      x + radius * Math.cos(degreeRad),
                      y + radius * Math.sin(degreeRad)
                    ]}
                    stroke="#000"
                    strokeWidth={0.5}
                    dash={[1, 2]}
                    listening={false}
                  />
                  <Text
                    x={x + (middleCircleRadius - 10) * Math.cos(degreeRad)}
                    y={y + (middleCircleRadius - 10) * Math.sin(degreeRad)}
                    text={`${degree}°`}
                    fontSize={8}
                    fill="#666"
                    align="center"
                    verticalAlign="middle"
                    rotation={degree}
                    listening={false}
                  />
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}

      {/* Center point */}
      <Circle
        x={x}
        y={y}
        radius={2}
        fill="#000"
        listening={false}
      />
    </Layer>
  );
} 