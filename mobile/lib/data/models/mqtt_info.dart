class MqttInfo {
  const MqttInfo({
    required this.enabled,
    required this.commandsEnabled,
    required this.connected,
    required this.host,
    required this.port,
    required this.wsPort,
    required this.baseTopic,
  });

  final bool enabled;
  final bool commandsEnabled;
  final bool connected;
  final String host;
  final int port;
  final int wsPort;
  final String baseTopic;

  factory MqttInfo.fromJson(Map<String, dynamic> json) {
    return MqttInfo(
      enabled: json['enabled'] as bool? ?? false,
      commandsEnabled: json['commands_enabled'] as bool? ?? false,
      connected: json['connected'] as bool? ?? false,
      host: json['host'] as String? ?? '-',
      port: (json['port'] as num?)?.toInt() ?? 0,
      wsPort: (json['ws_port'] as num?)?.toInt() ?? 0,
      baseTopic: json['base_topic'] as String? ?? '-',
    );
  }
}
