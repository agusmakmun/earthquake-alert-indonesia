import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'detail_screen.dart';

class MapScreen extends StatelessWidget {
  final List<dynamic> locations;
  final Map<String, dynamic>? earthquakeData;

  const MapScreen({
    super.key,
    required this.locations,
    required this.earthquakeData,
  });

  Color _getMarkerColor(double mag) {
    if (mag >= 6.0) return const Color(0xFFFF4D4F);
    if (mag >= 4.0) return const Color(0xFFFA8C16);
    return const Color(0xFFFADB14);
  }

  double _getDistThresh(double mag) {
    if (mag >= 6.0) return 500;
    if (mag >= 5.0) return 250;
    if (mag >= 4.0) return 100;
    if (mag >= 3.0) return 50;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final latest = earthquakeData?['latest'];
    final LatLng center = latest != null
        ? LatLng(latest['latitude'], latest['longitude'])
        : const LatLng(-2.5, 118.0); // Center of Indonesia

    final markers = <Marker>[];
    final circles = <CircleMarker>[];

    // User locations markers (blue markers)
    for (var loc in locations) {
      if (loc['enabled'] != true) continue;
      final latLng = LatLng(loc['latitude'], loc['longitude']);
      markers.add(
        Marker(
          point: latLng,
          width: 30,
          height: 30,
          child: const Tooltip(
            message: 'Lokasi Pantauan',
            child: Icon(Icons.location_pin, color: Color(0xFF1890FF), size: 30),
          ),
        ),
      );
    }

    // Epicenter marker (Red/Orange/Yellow circle)
    if (latest != null) {
      final double eqLat = latest['latitude'];
      final double eqLng = latest['longitude'];
      final double eqMag = latest['magnitude'];
      final LatLng eqLatLng = LatLng(eqLat, eqLng);
      final Color color = _getMarkerColor(eqMag);

      // Pulse visual representing magnitude threshold
      circles.add(
        CircleMarker(
          point: eqLatLng,
          radius: _getDistThresh(eqMag) * 1000, // convert km to meters
          useRadiusInMeter: true,
          color: color.withOpacity(0.1),
          borderColor: color,
          borderStrokeWidth: 1.5,
        ),
      );

      markers.add(
        Marker(
          point: eqLatLng,
          width: 40,
          height: 40,
          child: GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => DetailScreen(earthquake: latest),
                ),
              );
            },
            child: Tooltip(
              message: 'Epicenter: M ${eqMag.toStringAsFixed(1)}',
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.4),
                      shape: BoxShape.circle,
                    ),
                  ),
                  Container(
                    width: 12,
                    height: 12,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: center,
              initialZoom: latest != null ? 5.5 : 4.5,
              maxZoom: 10,
              minZoom: 3,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                subdomains: const ['a', 'b', 'c', 'd'],
              ),
              CircleLayer(circles: circles),
              MarkerLayer(markers: markers),
            ],
          ),

          // Map Legend Overlay
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: Card(
              color: const Color(0xFF111318).withOpacity(0.9),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildLegendItem('M \u2265 6.0', const Color(0xFFFF4D4F)),
                    _buildLegendItem('M 4.0 - 5.9', const Color(0xFFFA8C16)),
                    _buildLegendItem('M < 4.0', const Color(0xFFFADB14)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Colors.white70),
        ),
      ],
    );
  }
}
