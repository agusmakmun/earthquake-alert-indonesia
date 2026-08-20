import 'dart:math';
import 'package:flutter/material.dart';
import 'detail_screen.dart';

class HomeScreen extends StatefulWidget {
  final String installationId;
  final List<dynamic> locations;
  final Map<String, dynamic>? earthquakeData;
  final bool isOffline;
  final Future<void> Function() onRefresh;

  const HomeScreen({
    super.key,
    required this.installationId,
    required this.locations,
    required this.earthquakeData,
    required this.isOffline,
    required this.onRefresh,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _activeHistoryTab = 'felt';

  bool _checkMockFeltMatch(String locName, String? feltStr) {
    if (feltStr == null) return false;
    final cleanLoc = locName.toLowerCase().replaceAll(RegExp(r'kabupaten|kab\.|kota'), '').trim();
    return feltStr.toLowerCase().contains(cleanLoc);
  }

  double _getHaversineDist(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371; // earth radius
    final dLat = (lat2 - lat1) * pi / 180;
    final dLon = (lon2 - lon1) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180) * cos(lat2 * pi / 180) * sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return r * c;
  }

  double _getDistThresh(double mag) {
    if (mag >= 6.0) return 500;
    if (mag >= 5.0) return 250;
    if (mag >= 4.0) return 100;
    if (mag >= 3.0) return 50;
    return 0;
  }

  Map<String, dynamic>? _getRelevantEarthquake() {
    final latest = widget.earthquakeData?['latest'];
    if (latest == null || widget.locations.isEmpty) return null;

    final double eqLat = latest['latitude'];
    final double eqLng = latest['longitude'];
    final double eqMag = latest['magnitude'];
    final String? dirasakan = latest['dirasakan'];

    for (var loc in widget.locations) {
      if (loc['enabled'] != true) continue;
      
      final bool isFelt = _checkMockFeltMatch(loc['name'], dirasakan);
      final double dist = _getHaversineDist(loc['latitude'], loc['longitude'], eqLat, eqLng);
      final double thresh = _getDistThresh(eqMag);

      if (isFelt || (dist <= thresh && eqMag >= 4.0)) {
        return latest;
      }
    }
    return null;
  }

  Widget _buildHistoryList() {
    final list = _activeHistoryTab == 'felt'
        ? (widget.earthquakeData?['felt'] as List<dynamic>?)
        : (widget.earthquakeData?['m5'] as List<dynamic>?);

    if (list == null || list.isEmpty) {
      return Card(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0x2E3C3C43)),
        ),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          child: const Text(
            'Belum ada data riwayat gempa.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white30, fontSize: 13),
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final eq = list[index];
        final double magnitude = (eq['magnitude'] as num).toDouble();
        final isRed = magnitude >= 6.0;
        final isOrange = magnitude >= 4.0 && magnitude < 6.0;
        
        final color = isRed
            ? const Color(0xFFFF4D4F)
            : (isOrange ? const Color(0xFFFA8C16) : const Color(0xFFFADB14));

        final formattedTime = DateTime.parse(eq['event_time']).toLocal().toString().split(' ')[0] +
            ' ' +
            DateTime.parse(eq['event_time']).toLocal().toString().split(' ')[1].substring(0, 5);

        final subText = _activeHistoryTab == 'felt' ? (eq['dirasakan'] ?? eq['location_description'] ?? '') : 'Kedalaman: ${eq['depth_km']} Km';

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0x2E3C3C43)),
          ),
          child: ListTile(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => DetailScreen(earthquake: eq),
                ),
              );
            },
            leading: CircleAvatar(
              backgroundColor: color.withOpacity(0.15),
              child: Text(
                'M ${magnitude.toStringAsFixed(1)}',
                style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
              ),
            ),
            title: Text(
              eq['region'] ?? eq['location_description'] ?? 'Gempa Bumi',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 2),
                Text(
                  subText,
                  style: const TextStyle(fontSize: 12, color: Colors.white70),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  formattedTime,
                  style: const TextStyle(fontSize: 10, color: Colors.white30),
                ),
              ],
            ),
            trailing: const Icon(Icons.chevron_right, color: Colors.white24),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final relevantEq = _getRelevantEarthquake();
    final isCritical = relevantEq != null &&
        (relevantEq['magnitude'] >= 6.0 ||
            (relevantEq['tsunami_potential'] != null &&
                relevantEq['tsunami_potential'].toString().toLowerCase().contains('tsunami')));

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: widget.onRefresh,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Earthquake Alert',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 26),
                      ),
                      const Text(
                        'INDONESIA',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1890FF),
                          letterSpacing: 3,
                        ),
                      ),
                    ],
                  ),
                  if (widget.isOffline)
                    IconButton(
                      icon: const Icon(Icons.cloud_off, color: Color(0xFFFF4D4F)),
                      onPressed: widget.onRefresh,
                    ),
                ],
              ),
              const SizedBox(height: 20),

              // Active monitoring card
              Card(
                color: widget.isOffline
                    ? const Color(0xFFFF4D4F).withOpacity(0.06)
                    : const Color(0xFF52C41A).withOpacity(0.06),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: widget.isOffline ? const Color(0xFFFF4D4F).withOpacity(0.2) : const Color(0xFF52C41A).withOpacity(0.2),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      _PulseIndicator(isOffline: widget.isOffline),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.isOffline ? 'Offline Mode' : 'Alert Active',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            Text(
                              widget.isOffline ? 'Gempabumi tidak dapat dimuat.' : 'Memantau data resmi BMKG',
                              style: const TextStyle(color: Color(0xFF6E6E73), fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Locations Pantauan
              const Text(
                'LOKASI PANTAUAN',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF6E6E73), letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              if (widget.locations.isEmpty)
                Card(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    child: const Text(
                      'Belum ada lokasi pantauan. Buka Settings untuk menambahkan.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFF6E6E73)),
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: widget.locations.length,
                  itemBuilder: (context, index) {
                    final loc = widget.locations[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        title: Text(loc['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(loc['type'] == 'current_location' ? 'GPS Koordinat' : 'Wilayah Manual'),
                        trailing: Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: loc['enabled'] == true ? const Color(0xFF34C759) : const Color(0xFF8E8E93),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              const SizedBox(height: 24),

              // Relevant earthquake
              const Text(
                'GEMPA RELEVAN TERBARU',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF6E6E73), letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              if (relevantEq == null)
                Card(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      children: const [
                        Icon(Icons.show_chart_rounded, color: Color(0xFF8E8E93), size: 34),
                        SizedBox(height: 8),
                        Text(
                          'Tidak ada gempa relevan terbaru.',
                          style: TextStyle(color: Color(0xFF6E6E73)),
                        ),
                      ],
                    ),
                  ),
                )
              else
                Card(
                  color: isCritical ? const Color(0xFFFF4D4F).withOpacity(0.08) : const Color(0xFFFA8C16).withOpacity(0.08),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                      color: isCritical ? const Color(0xFFFF4D4F).withOpacity(0.3) : const Color(0xFFFA8C16).withOpacity(0.2),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                '${relevantEq['region']}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: isCritical ? const Color(0xFFFF4D4F) : const Color(0xFFFA8C16),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                'M ${relevantEq['magnitude']}',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          relevantEq['location_description'] ?? '',
                          style: const TextStyle(color: Colors.white70),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Icon(Icons.waves, size: 14, color: Colors.white38),
                            const SizedBox(width: 4),
                            Text('Dalaman: ${relevantEq['depth_km']} Km', style: const TextStyle(fontSize: 12, color: Colors.white38)),
                            const SizedBox(width: 16),
                            Icon(Icons.access_time, size: 14, color: Colors.white38),
                            const SizedBox(width: 4),
                            Text(
                              'Jam: ${DateTime.parse(relevantEq['event_time']).toLocal().toString().split(' ')[1].substring(0, 5)}',
                              style: const TextStyle(fontSize: 12, color: Colors.white38),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white12,
                            elevation: 0,
                            minimumSize: const Size(double.infinity, 44),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => DetailScreen(earthquake: relevantEq),
                              ),
                            );
                          },
                          child: const Text('Lihat Detail', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 24),

              // Riwayat Gempa Bumi
              const Text(
                'RIWAYAT GEMPA BUMI',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF6E6E73), letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.04),
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.all(3),
                child: Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          setState(() {
                            _activeHistoryTab = 'felt';
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _activeHistoryTab == 'felt' ? Colors.white.withOpacity(0.08) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Dirasakan',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          setState(() {
                            _activeHistoryTab = 'm5';
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _activeHistoryTab == 'm5' ? Colors.white.withOpacity(0.08) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'M 5.0+',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _buildHistoryList(),
            ],
          ),
        ),
      ),
    );
  }
}

class _PulseIndicator extends StatefulWidget {
  final bool isOffline;
  const _PulseIndicator({required this.isOffline});

  @override
  State<_PulseIndicator> createState() => _PulseIndicatorState();
}

class _PulseIndicatorState extends State<_PulseIndicator> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isOffline ? const Color(0xFFFF4D4F) : const Color(0xFF52C41A);
    return Stack(
      alignment: Alignment.center,
      children: [
        AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Container(
              width: 20 * _controller.value,
              height: 20 * _controller.value,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withOpacity(1 - _controller.value),
              ),
            );
          },
        ),
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
          ),
        ),
      ],
    );
  }
}
