import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';

class SettingsScreen extends StatefulWidget {
  final String installationId;
  final List<dynamic> locations;
  final Future<void> Function() onRefresh;

  const SettingsScreen({
    super.key,
    required this.installationId,
    required this.locations,
    required this.onRefresh,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;
  List<dynamic> _provinces = [];
  List<dynamic> _cities = [];
  bool _isLoadingRegions = false;

  @override
  void initState() {
    super.initState();
    _loadRegions();
  }

  Future<void> _loadRegions() async {
    setState(() {
      _isLoadingRegions = true;
    });
    final data = await ApiService.getRegions();
    if (data != null) {
      setState(() {
        _provinces = data['provinces'] ?? [];
        _cities = data['cities'] ?? [];
      });
    }
    setState(() {
      _isLoadingRegions = false;
    });
  }

  Future<void> _toggleNotification(bool value) async {
    setState(() {
      _notificationsEnabled = value;
    });
    final token = value ? 'fcm_token_mock_${widget.installationId}' : null;
    await ApiService.updatePushToken(widget.installationId, token);
  }

  Future<void> _deleteLocation(int id) async {
    final success = await ApiService.deleteLocation(widget.installationId, id);
    if (success) {
      widget.onRefresh();
    }
  }

  Future<void> _toggleLocation(int id, bool enabled) async {
    final data = await ApiService.updateLocation(widget.installationId, id, enabled: enabled);
    if (data != null) {
      widget.onRefresh();
    }
  }

  Future<void> _addGPSLocation() async {
    Navigator.pop(context); // close modal
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
        Position pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.medium,
        );

        Navigator.pop(context); // close progress loader
        
        final data = await ApiService.addLocation(
          widget.installationId,
          'Current Location',
          'current_location',
          pos.latitude,
          pos.longitude,
        );

        if (data != null) {
          widget.onRefresh();
        }
      } else {
        Navigator.pop(context); // close progress loader
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Izin GPS ditolak. Silakan gunakan input manual.')),
        );
      }
    } catch (e) {
      Navigator.pop(context); // close progress
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal mendapatkan lokasi GPS: $e')),
      );
    }
  }

  void _showAddLocationDialog() {
    if (widget.locations.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maksimal 5 lokasi pantauan tercapai.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF111318),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Tambah Lokasi Baru',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: const Icon(Icons.gps_fixed, color: Color(0xFF1890FF)),
                title: const Text('Gunakan Lokasi GPS Saat Ini'),
                subtitle: const Text('Akan merecord koordinat GPS Anda secara instant.'),
                onTap: _addGPSLocation,
              ),
              const Divider(color: Colors.white12),
              ListTile(
                leading: const Icon(Icons.map, color: Color(0xFFFA8C16)),
                title: const Text('Pilih Wilayah Secara Manual'),
                subtitle: const Text('Pilih Provinsi dan Kota/Kabupaten administratif.'),
                onTap: () {
                  Navigator.pop(context);
                  _showManualLocationDialog();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showManualLocationDialog() {
    dynamic selectedProvince;
    dynamic selectedCity;
    final nameController = TextEditingController();
    List<dynamic> filteredCities = [];

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF111318),
              title: const Text('Pilih Lokasi Manual'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButton<dynamic>(
                    isExpanded: true,
                    value: selectedProvince,
                    hint: const Text('Pilih Provinsi'),
                    dropdownColor: const Color(0xFF111318),
                    items: _provinces.map((prov) {
                      return DropdownMenuItem<dynamic>(
                        value: prov,
                        child: Text(prov['name']),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setDialogState(() {
                        selectedProvince = val;
                        selectedCity = null;
                        filteredCities = _cities.where((c) => c['province_id'] == val['id']).toList();
                      });
                    },
                  ),
                  const SizedBox(height: 10),
                  DropdownButton<dynamic>(
                    isExpanded: true,
                    value: selectedCity,
                    hint: const Text('Pilih Kota / Kabupaten'),
                    disabledHint: const Text('Pilih Provinsi Terlebih Dahulu'),
                    dropdownColor: const Color(0xFF111318),
                    items: filteredCities.map((city) {
                      return DropdownMenuItem<dynamic>(
                        value: city,
                        child: Text(city['name']),
                      );
                    }).toList(),
                    onChanged: selectedProvince == null
                        ? null
                        : (val) {
                            setDialogState(() {
                              selectedCity = val;
                              nameController.text = val['name'];
                            });
                          },
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Label Lokasi (e.g. Rumah, Kantor)',
                      labelStyle: TextStyle(color: Colors.white54),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Batal', style: TextStyle(color: Colors.white54)),
                ),
                ElevatedButton(
                  onPressed: selectedCity == null
                      ? null
                      : () async {
                          Navigator.pop(context);
                          final data = await ApiService.addLocation(
                            widget.installationId,
                            nameController.text,
                            'city',
                            selectedCity['latitude'],
                            selectedCity['longitude'],
                            provinceId: selectedProvince['id'],
                            cityId: selectedCity['id'],
                          );
                          if (data != null) {
                            widget.onRefresh();
                          }
                        },
                  child: const Text('Simpan'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showDisclaimerDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF111318),
          title: const Text('Official Disclaimer'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  '1. BUKAN ALAT PREDIKSI',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                Text(
                  'Aplikasi ini tidak memprediksi gempa bumi sebelum terjadi. Notifikasi dikirim sesaat setelah data kejadian tersedia pada sistem BMKG.',
                  style: TextStyle(fontSize: 12, color: Colors.white70),
                ),
                SizedBox(height: 8),
                Text(
                  '2. SUMBER DATA RESMI',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                Text(
                  'Seluruh data kebencanaan gempa bumi diperoleh langsung dari API Data Terbuka BMKG.',
                  style: TextStyle(fontSize: 12, color: Colors.white70),
                ),
                SizedBox(height: 8),
                Text(
                  '3. TANGGUNG JAWAB',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                Text(
                  'Utamakan petunjuk keselamatan resmi dari otoritas penanganan bencana setempat (BMKG, BNPB) saat terjadi bencana sesungguhnya.',
                  style: TextStyle(fontSize: 12, color: Colors.white70),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Saya Mengerti', style: TextStyle(color: Color(0xFF1890FF))),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pengaturan',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 26),
            ),
            const SizedBox(height: 20),

            // Notification switch
            Card(
              child: SwitchListTile(
                title: const Text('Notifikasi Gempa', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Kirim alert untuk guncangan yang relevan'),
                value: _notificationsEnabled,
                onChanged: _toggleNotification,
                activeColor: const Color(0xFF52C41A),
              ),
            ),
            const SizedBox(height: 20),

            // Locations List Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'LOKASI PANTALUAN (MAKS 5)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white54),
                ),
                if (!_isLoadingRegions)
                  TextButton(
                    onPressed: _showAddLocationDialog,
                    child: const Text('+ Tambah', style: TextStyle(color: Color(0xFF1890FF))),
                  )
                else
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // Locations management list
            if (widget.locations.isEmpty)
              Card(
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  child: const Text(
                    'Belum ada lokasi pantauan.',
                    textAlign: Center,
                    style: TextStyle(color: Colors.white54),
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
                      subtitle: Text('${loc['latitude'].toStringAsFixed(3)}, ${loc['longitude'].toStringAsFixed(3)}'),
                      leading: IconButton(
                        icon: Icon(
                          loc['enabled'] == true ? Icons.check_circle : Icons.radio_button_unchecked,
                          color: loc['enabled'] == true ? const Color(0xFF52C41A) : Colors.white24,
                        ),
                        onPressed: () => _toggleLocation(loc['id'], loc['enabled'] != true),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Color(0xFFFF4D4F)),
                        onPressed: () => _deleteLocation(loc['id']),
                      ),
                    ),
                  );
                },
              ),
            const SizedBox(height: 24),

            // App info card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Informasi Aplikasi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('Sumber Data', style: TextStyle(color: Colors.white54, fontSize: 13)),
                        Text('BMKG Terbuka', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('Versi Aplikasi', style: TextStyle(color: Colors.white54, fontSize: 13)),
                        Text('v1.0.0 (MVP)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 44),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _showDisclaimerDialog,
                      child: const Text('Disclaimer Resmi', style: TextStyle(color: Colors.white70)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
