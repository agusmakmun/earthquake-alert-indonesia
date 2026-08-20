import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'services/api_service.dart';
import 'screens/home_screen.dart';
import 'screens/map_screen.dart';
import 'screens/settings_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EarthquakeAlertApp());
}

class EarthquakeAlertApp extends StatelessWidget {
  const EarthquakeAlertApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Earthquake Alert Indonesia',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0D0E12),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF1890FF),
          secondary: Color(0xFF52C41A),
          error: Color(0xFFFF4D4F),
          surface: Color(0xFF111318),
          background: Color(0xFF0A0B0D),
        ),
        textTheme: const TextTheme(
          titleLarge: TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.bold),
          bodyLarge: TextStyle(fontFamily: 'Outfit'),
          bodyMedium: TextStyle(fontFamily: 'Outfit'),
        ),
        cardTheme: CardTheme(
          color: const Color(0xFF111318),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: Colors.white12, width: 1),
          ),
        ),
      ),
      home: const MainTabContainer(),
    );
  }
}

class MainTabContainer extends StatefulWidget {
  const MainTabContainer({super.key});

  @override
  State<MainTabContainer> createState() => _MainTabContainerState();
}

class _MainTabContainerState extends State<MainTabContainer> {
  int _currentIndex = 0;
  String _installationId = '';
  List<dynamic> _locations = [];
  Map<String, dynamic>? _earthquakeData;
  bool _isLoading = true;
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    final prefs = await SharedPreferences.getInstance();
    String? instId = prefs.getString('installation_id');
    
    if (instId == null) {
      // Generate installation id
      instId = 'app_${Random().nextInt(90000000) + 10000000}';
      await prefs.setString('installation_id', instId);
    }

    setState(() {
      _installationId = instId!;
    });

    // Register on backend
    final platform = Theme.of(context).platform == TargetPlatform.iOS ? 'ios' : 'android';
    await ApiService.registerDevice(_installationId, platform);
    
    // Setup FCM messaging
    _setupPushNotifications();
    
    // Fetch data
    await refreshData();
  }

  Future<void> _setupPushNotifications() async {
    try {
      FirebaseMessaging messaging = FirebaseMessaging.instance;
      
      // Request permission
      NotificationSettings settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: true,
        provisional: false,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        String? token = await messaging.getToken();
        if (token != null) {
          await ApiService.updatePushToken(_installationId, token);
        }
        
        // Listen to token refresh
        messaging.onTokenRefresh.listen((newToken) {
          ApiService.updatePushToken(_installationId, newToken);
        });

        // Listen for foreground messages
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          // Trigger local in-app alert dialog or snackbar
          if (message.notification != null) {
            _showNotificationBanner(
              message.notification!.title ?? 'Gempa Baru Terdeteksi',
              message.notification!.body ?? '',
            );
          }
        });
      }
    } catch (e) {
      print('FCM Init failed: $e');
    }
  }

  void _showNotificationBanner(String title, String body) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF111318),
        duration: const Duration(seconds: 7),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFFF4D4F), width: 1),
        ),
                  content: Row(
          children: [
            const Icon(Icons.warning_rounded, color: Color(0xFFFF3B30), size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 2),
                  Text(body, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> refreshData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final locs = await ApiService.getLocations(_installationId);
      final eqData = await ApiService.getLatestEarthquakes();

      setState(() {
        _locations = locs;
        _earthquakeData = eqData;
        _isOffline = false;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isOffline = true;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _installationId.isEmpty) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    final List<Widget> screens = [
      HomeScreen(
        installationId: _installationId,
        locations: _locations,
        earthquakeData: _earthquakeData,
        isOffline: _isOffline,
        onRefresh: refreshData,
      ),
      MapScreen(
        locations: _locations,
        earthquakeData: _earthquakeData,
      ),
      SettingsScreen(
        installationId: _installationId,
        locations: _locations,
        onRefresh: refreshData,
      ),
    ];

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: refreshData,
          child: IndexedStack(
            index: _currentIndex,
            children: screens,
          ),
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        backgroundColor: const Color(0xFF111318),
        selectedItemColor: Colors.white,
        unselectedItemColor: Colors.white38,
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.map_outlined),
            activeIcon: Icon(Icons.map),
            label: 'Map',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings_outlined),
            activeIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
