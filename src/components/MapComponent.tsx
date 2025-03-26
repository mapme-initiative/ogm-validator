import React from "react";
import { MapContainer, TileLayer, GeoJSON, LayersControl, useMap } from "react-leaflet";
import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import 'leaflet.fullscreen/Control.FullScreen.css';
import 'leaflet.fullscreen';


interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point" | "Polygon" | "LineString";
    coordinates: number[] | number[][] | number[][][];
  };
  properties: {};
}
interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

interface MapComponentProps {
  geoJsonData?: {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
  };
}
let controlAdded = false;

// Fullscreen control component
const FullscreenControl: React.FC = () => {
  const map = useMap();
  // Add fullscreen control only once
  if (!controlAdded) {
    const fullscreenControl = L.control.fullscreen({ position: "topright" });
    fullscreenControl.addTo(map);
    controlAdded = true; // Mark as added
  }

  return null;
};

/**
 * Checks if the given coordinates array contains any NaN values.
 * @param coordinates - The coordinates to check.
 * @returns true if any NaN is found, false otherwise.
 */
function hasInvalidCoordinates(coordinates: number[] | number[][] | number[][][]): boolean {
  if (Array.isArray(coordinates)) {
    return coordinates.some((coord) =>
      Array.isArray(coord) ? hasInvalidCoordinates(coord) : isNaN(coord)
    );
  }
  return false;
}

/**
 * Filters the features array to remove those with invalid coordinates.
 * @param features - Array of GeoJSON features.
 * @returns A new array containing only valid features.
 */
function filterValidFeatures(features: GeoJSONFeature[]): GeoJSONFeature[] {
  return features.filter((feature) => !hasInvalidCoordinates(feature.geometry.coordinates));
}

const MapComponent: React.FC<MapComponentProps> = ({ geoJsonData }) => {

  const validGeoJsonData: GeoJSONCollection = geoJsonData && geoJsonData.features ? {
    type: "FeatureCollection",
    features: filterValidFeatures(geoJsonData?.features)
  } : null;

  const onEachFeature = (feature: any, layer: L.Layer) => {
    if (feature.properties) {
      const timeLapseLink = feature.timelapse_link ? `<br><br><a href="${feature.timelapse_link}" target="_blank">Timelapse Link</a>` : ""
      layer.bindPopup(
        `<b>${feature.properties.uniqueId}</b><br>${feature.properties.kfwProjectNoINPRO}<br><br>${feature.properties.locationName}<br><br>${feature.properties.activityDescriptionGeneral}<br>Type: ${feature.properties.sector_location.location_type}${timeLapseLink}`
      );
    }
  };

  return (
    <MapContainer
      center={[20, 30]} // Default center of the map
      zoom={2} // Default zoom level
      style={mapContainerStyle}
    >
      {/* Add Fullscreen Control */}
      <FullscreenControl />

      {/* Base Layers */}
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="GoogleStreets">
          <TileLayer
            url="http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={["mt0", "mt1", "mt2", "mt3"]}
            maxZoom={20}
            attribution="Map data © GoogleMaps contributors"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked name="GoogleHybrid">
          <TileLayer
            url="http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
            subdomains={["mt0", "mt1", "mt2", "mt3"]}
            maxZoom={20}
            attribution="Map data © GoogleMaps contributors"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="GoogleEarth">
          <TileLayer
            url="http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            subdomains={["mt0", "mt1", "mt2", "mt3"]}
            maxZoom={20}
            attribution="Map data © GoogleMaps contributors"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="GoogleTerrain">
          <TileLayer
            url="http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
            subdomains={["mt0", "mt1", "mt2", "mt3"]}
            maxZoom={20}
            attribution="Map data © GoogleMaps contributors"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="OpenStreetMap">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* GeoJSON Layer */}
      {validGeoJsonData && <GeoJSON data={validGeoJsonData} onEachFeature={onEachFeature} />}
    </MapContainer>

  );
};

export default MapComponent;

const mapContainerStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "left",
  width: "100%", // Full width or set a specific width, e.g., "70%"
  maxWidth: "1280px", // Optional: limit the max width of the map
  aspectRatio: "16 / 9", // Maintain the 16:9 ratio
  margin: "20px 0",
};