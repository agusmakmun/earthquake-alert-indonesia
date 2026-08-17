import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Use Mac's local network IP for physical iOS testing over the same Wi-Fi network
  static String baseUrl = 'http://192.168.1.4:8000'; 

  static Future<Map<String, dynamic>?> registerDevice(String installationId, String platform) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/v1/devices'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'installation_id': installationId,
          'platform': platform,
          'app_version': '1.0.0',
          'os_version': 'Native Mobile'
        }),
      );
      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Error registering device: $e');
    }
    return null;
  }

  static Future<void> updatePushToken(String installationId, String? token) async {
    try {
      await http.patch(
        Uri.parse('$baseUrl/api/v1/devices/$installationId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'push_token': token}),
      );
    } catch (e) {
      print('Error updating push token: $e');
    }
  }

  static Future<List<dynamic>> getLocations(String installationId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/v1/locations'),
        headers: {'X-Installation-Id': installationId},
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Error loading locations: $e');
    }
    return [];
  }

  static Future<Map<String, dynamic>?> addLocation(
    String installationId,
    String name,
    String type,
    double latitude,
    double longitude, {
    int? provinceId,
    int? cityId,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/v1/locations'),
        headers: {
          'Content-Type': 'application/json',
          'X-Installation-Id': installationId,
        },
        body: jsonEncode({
          'name': name,
          'type': type,
          'latitude': latitude,
          'longitude': longitude,
          'province_id': provinceId,
          'city_id': cityId,
        }),
      );
      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Error adding location: $e');
    }
    return null;
  }

  static Future<Map<String, dynamic>?> updateLocation(
    String installationId,
    int locationId, {
    String? name,
    bool? enabled,
  }) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/api/v1/locations/$locationId'),
        headers: {
          'Content-Type': 'application/json',
          'X-Installation-Id': installationId,
        },
        body: jsonEncode({
          if (name != null) 'name': name,
          if (enabled != null) 'enabled': enabled,
        }),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Error updating location: $e');
    }
    return null;
  }

  static Future<bool> deleteLocation(String installationId, int locationId) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/api/v1/locations/$locationId'),
        headers: {'X-Installation-Id': installationId},
      );
      return response.statusCode == 204;
    } catch (e) {
      print('Error deleting location: $e');
    }
    return false;
  }

  static Future<Map<String, dynamic>?> getLatestEarthquakes() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/v1/earthquakes/latest'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Error fetching earthquakes: $e');
    }
    return null;
  }

  static Future<Map<String, dynamic>?> getRegions() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/v1/regions'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Error fetching regions: $e');
    }
    return null;
  }
}
