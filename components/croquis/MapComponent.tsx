"use client";

import { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import { fromLonLat, transform, get as getProjection } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MapComponentProps {
  className?: string;
}

// Definir las proyecciones UTM
const UTM_PROJECTIONS = {
  28: { 
    code: 'EPSG:32628', 
    extent: [-18, 27, -12, 30] // Islas Canarias
  },
  30: { 
    code: 'EPSG:32630', 
    extent: [-6, 35, 0, 44]    // España peninsular occidental
  },
  31: { 
    code: 'EPSG:32631', 
    extent: [0, 35, 6, 44]     // España peninsular central y parte de Baleares
  },
  32: { 
    code: 'EPSG:32632', 
    extent: [6, 35, 12, 44]    // Parte oriental de Baleares
  }
}

interface MapComponentProps {
  className?: string;
}

export function MapComponent({ className }: MapComponentProps) {
  const [map, setMap] = useState<Map | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [currentLayer, setCurrentLayer] = useState<'osm' | 'pnoa'>('osm');

  useEffect(() => {
    if (!mapRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: currentLayer === 'osm'
    });

    const pnoaLayer = new TileLayer({
      source: new XYZ({
        url: 'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&Format=image/jpeg&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}',
        attributions: '© <a href="http://www.ign.es/ign/main/index.do" target="_blank">IGN PNOA</a>'
      }),
      visible: currentLayer === 'pnoa'
    });

    const initialMap = new Map({
      target: mapRef.current,
      layers: [osmLayer, pnoaLayer],
      view: new View({
        center: fromLonLat([-3.7, 40.4]), // Center on Spain
        zoom: 6,
        maxZoom: 19
      })
    });

    setMap(initialMap);

    return () => {
      initialMap.setTarget(undefined);
    };
  }, [currentLayer]);

  useEffect(() => {
    if (!map) return;
    
    const updateMapSize = () => {
      map.updateSize();
    };

    window.addEventListener('resize', updateMapSize);
    return () => window.removeEventListener('resize', updateMapSize);
  }, [map]);

  const handleLayerChange = (value: string) => {
    setCurrentLayer(value as 'osm' | 'pnoa');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-center">
        <Select value={currentLayer} onValueChange={handleLayerChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select map layer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="osm">OpenStreetMap</SelectItem>
            <SelectItem value="pnoa">PNOA Aerial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div 
        ref={mapRef} 
        className={className}
      />
    </div>
  );
} 