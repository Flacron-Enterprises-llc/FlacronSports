import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

/// An error from the backend. The body is usually `{success:false, code, error}`,
/// but some routes return a bare `{error}`, so [code] can be null.
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, {this.body});

  final int status;
  final String? code;
  final String message;
  final Map<String, dynamic>? body;

  bool get isUnauthenticated => status == 401;
  bool get needsPlan => status == 402 || code == 'subscription_required';
  bool get needsHigherPlan => code == 'plan_required';
  bool get isNetwork => status == 0;
  bool get isRateLimited => status == 429;

  @override
  String toString() => 'ApiException($status, $code, $message)';
}

/// Thin JSON client for the FlacronSport backend. Identity is the Firebase ID
/// token sent as a Bearer header, exactly as the web app's authFetch does.
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  static const _timeout = Duration(seconds: 25);

  Uri uri(String path, [Map<String, Object?>? query]) {
    final clean = <String, String>{};
    query?.forEach((key, value) {
      if (value == null) return;
      final text = value.toString();
      if (text.isEmpty) return;
      clean[key] = text;
    });
    final base = Uri.parse('${AppConfig.apiBase}$path');
    return clean.isEmpty ? base : base.replace(queryParameters: clean);
  }

  Future<Map<String, String>> _headers({bool json = false, bool forceRefresh = false}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (json) headers['Content-Type'] = 'application/json';
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final token = await user.getIdToken(forceRefresh);
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<dynamic> get(String path, {Map<String, Object?>? query}) =>
      _send('GET', path, query: query);

  Future<dynamic> post(String path, {Object? body, Map<String, Object?>? query}) =>
      _send('POST', path, body: body, query: query);

  Future<dynamic> put(String path, {Object? body}) => _send('PUT', path, body: body);

  Future<dynamic> delete(String path, {Object? body, Map<String, Object?>? query}) =>
      _send('DELETE', path, body: body, query: query);

  /// For binary responses (PDF exports, data export).
  Future<Uint8List> bytes(String method, String path, {Object? body}) async {
    final response = await _raw(method, path, body: body);
    if (response.statusCode >= 200 && response.statusCode < 300) return response.bodyBytes;
    throw _error(response);
  }

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, Object?>? query}) async {
    final response = await _raw(method, path, body: body, query: query);
    final text = utf8.decode(response.bodyBytes, allowMalformed: true);
    dynamic decoded;
    if (text.isNotEmpty) {
      try {
        decoded = jsonDecode(text);
      } catch (_) {
        decoded = null;
      }
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return decoded ?? <String, dynamic>{};
    throw _error(response, decoded);
  }

  Future<http.Response> _raw(String method, String path,
      {Object? body, Map<String, Object?>? query, bool retried = false}) async {
    final target = uri(path, query);
    try {
      final request = http.Request(method, target);
      request.headers.addAll(await _headers(json: body != null, forceRefresh: retried));
      if (body != null) request.body = jsonEncode(body);
      final streamed = await _client.send(request).timeout(_timeout);
      final response = await http.Response.fromStream(streamed);
      // A token revoked or rotated server-side (e.g. after MFA enrolment):
      // refresh once before giving up.
      if (response.statusCode == 401 && !retried && FirebaseAuth.instance.currentUser != null) {
        return _raw(method, path, body: body, query: query, retried: true);
      }
      return response;
    } on SocketException {
      throw ApiException(0, 'network', 'No internet connection');
    } on TimeoutException {
      throw ApiException(0, 'timeout', 'The server took too long to respond');
    } on http.ClientException {
      throw ApiException(0, 'network', 'Could not reach FlacronSport');
    } on FirebaseAuthException catch (e) {
      throw ApiException(401, 'invalid_token', e.message ?? 'Sign in again');
    }
  }

  ApiException _error(http.Response response, [dynamic decoded]) {
    if (decoded == null) {
      try {
        decoded = jsonDecode(utf8.decode(response.bodyBytes, allowMalformed: true));
      } catch (_) {}
    }
    final map = decoded is Map<String, dynamic> ? decoded : null;
    final code = map?['code'] is String ? map!['code'] as String : null;
    final message = map?['error'] is String ? map!['error'] as String : 'Request failed (${response.statusCode})';
    return ApiException(response.statusCode, code, message, body: map);
  }
}

final api = ApiClient();
