/// Lenient JSON readers. The backend's payloads are large unions; reading them
/// through these helpers keeps the app working if an optional field is missing.
typedef Json = Map<String, dynamic>;

Json asMap(dynamic v) => v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};

List<Json> asMapList(dynamic v) => v is List ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : <Json>[];

List<String> asStringList(dynamic v) => v is List ? v.map((e) => e?.toString() ?? '').where((e) => e.isNotEmpty).toList() : <String>[];

String? asString(dynamic v) => v == null ? null : (v is String ? v : v.toString());

String str(dynamic v, [String fallback = '']) => asString(v) ?? fallback;

int? asInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

double? asDouble(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

bool asBool(dynamic v, [bool fallback = false]) => v is bool ? v : fallback;
