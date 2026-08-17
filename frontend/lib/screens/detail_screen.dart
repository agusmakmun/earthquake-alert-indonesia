import 'package:flutter/material.dart';

class DetailScreen extends StatelessWidget {
  final Map<String, dynamic> earthquake;

  const DetailScreen({
    super.key,
    required this.earthquake,
  });

  @override
  Widget build(BuildContext context) {
    final double magnitude = earthquake['magnitude'];
    final bool isCritical = magnitude >= 6.0 ||
        (earthquake['tsunami_potential'] != null &&
            earthquake['tsunami_potential'].toString().toLowerCase().contains('tsunami'));

    final feltAreas = earthquake['dirasakan']?.toString().split(',') ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detail Gempabumi', style: TextStyle(fontFamily: 'Outfit')),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  colors: [Color(0xFF181920), Color(0xFF111218)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(color: Colors.white12),
              ),
              child: Column(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isCritical ? const Color(0xFFFF4D4F) : const Color(0xFFFA8C16),
                      boxShadow: [
                        BoxShadow(
                          color: (isCritical ? const Color(0xFFFF4D4F) : const Color(0xFFFA8C16)).withOpacity(0.4),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        )
                      ],
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      magnitude.toStringAsFixed(1),
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    earthquake['region'] ?? '',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateTime.parse(earthquake['event_time']).toLocal().toString().substring(0, 16),
                    style: const TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Specs grid
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              childAspectRatio: 2.2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              children: [
                _buildSpecBox('Magnitudo', 'M ${magnitude.toStringAsFixed(1)}'),
                _buildSpecBox('Kedalaman', '${earthquake['depth_km']} Km'),
                _buildSpecBox('Koordinat', '${earthquake['latitude'].toStringAsFixed(2)}, ${earthquake['longitude'].toStringAsFixed(2)}'),
                _buildSpecBox('Potensi Tsunami', earthquake['tsunami_potential'] ?? 'Tidak Berpotensi'),
              ],
            ),
            const SizedBox(height: 24),

            // Felt list
            if (feltAreas.isNotEmpty && feltAreas[0].toString().trim().isNotEmpty) ...[
              const Text(
                'WILAYAH DIRASAKAN (MMI)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white54, letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: feltAreas.map((area) {
                  return Chip(
                    backgroundColor: Colors.white12,
                    label: Text(area.trim(), style: const TextStyle(fontSize: 12, color: Colors.white70)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    side: BorderSide.none,
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
            ],

            // Shakemap image
            if (earthquake['shakemap_url'] != null) ...[
              const Text(
                'PETA GUNCANGAN (SHAKEMAP)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white54, letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  earthquake['shakemap_url'],
                  width: double.infinity,
                  height: 200,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: double.infinity,
                      height: 150,
                      color: const Color(0xFF111318),
                      alignment: Alignment.center,
                      child: const Text(
                        'Peta guncangan tidak tersedia.',
                        style: TextStyle(color: Colors.white30),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Disclaimer
            const Center(
              child: Text(
                'Sumber data resmi diperoleh dari Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) Indonesia Terbuka.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 10, color: Colors.white38),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpecBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF111318),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(fontSize: 10, color: Colors.white38, fontWeight: FontWeight.bold, letterSpacing: 0.5),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
