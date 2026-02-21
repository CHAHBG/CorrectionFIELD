/**
 * @deprecated v2 uses `screens/MapScreen.tsx` with full layer system.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

// Set access token if needed (null for vector tiles / self-hosted)
MapLibreGL.setAccessToken(null);

export const MapViewComponent = () => {

    useEffect(() => {
        MapLibreGL.setConnected(true);
    }, []);

    return (
        <View style={styles.container}>
            <MapLibreGL.MapView
                style={styles.map}
                // @ts-ignore
                styleURL="https://demotiles.maplibre.org/style.json"
                logoEnabled={false}
                attributionEnabled={false}
            >
                <MapLibreGL.Camera
                    defaultSettings={{
                        centerCoordinate: [-13.01, 14.03],
                        zoomLevel: 14,
                    }}
                />

                {/* Example ShapeSource for Parcels */}
                <MapLibreGL.ShapeSource
                    id="parcelsSource"
                    shape={{
                        type: 'FeatureCollection',
                        features: [] // TODO: Bind to state
                    }}
                >
                    <MapLibreGL.FillLayer
                        id="parcelsFill"
                        style={{
                            fillColor: '#3b82f6',
                            fillOpacity: 0.5,
                            fillOutlineColor: '#000000',
                        }}
                    />
                </MapLibreGL.ShapeSource>
            </MapLibreGL.MapView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
});
