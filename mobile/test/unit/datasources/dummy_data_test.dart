import 'package:drone_command_center/core/config/app_config.dart';
import 'package:drone_command_center/data/datasources/dummy_drone_datasource.dart';
import 'package:drone_command_center/data/datasources/dummy_weather.dart';
import 'package:drone_command_center/data/datasources/weather_remote_datasource.dart';
import 'package:drone_command_center/data/models/battery_info.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('dummy status uses backend-shaped payload and has populated telemetry', () async {
    final source = DummyDroneDataSource();

    final status = await source.fetchStatus();
    final drops = await source.fetchDrops();
    final mqtt = await source.fetchMqtt();

    expect(status.connected, isTrue);
    expect(status.armed, isTrue);
    expect(status.gpsFix, 3);
    expect(status.lat, isNotNull);
    expect(status.motors, hasLength(4));
    expect(status.battery.remainingPercent, greaterThan(0));
    expect(status.seed.remaining, greaterThan(0));
    expect(drops, hasLength(6));
    expect(mqtt.connected, isTrue);
  });

  test('dummy actions mutate drop, seed, battery, and thruster data', () async {
    final source = DummyDroneDataSource();
    final before = await source.fetchStatus();

    final drop = await source.dropNow();
    final loaded = await source.loadSeed(120);
    final battery = await source.configureBattery(
      const BatterySetup(capacityMah: 12000, cells: 6, minSafePercent: 20),
    );
    final thrust = await source.testThruster(
      target: 'motor_1',
      thrustPercent: 28,
      durationS: 1.5,
    );
    final stopped = await source.stopThruster();
    final after = await source.fetchStatus();

    expect(drop.thrust, before.armed ? greaterThan(0) : 0);
    expect(loaded.loaded, 120);
    expect(battery.capacityMah, 12000);
    expect(thrust.pwm, 1280);
    expect(stopped.stopped, isTrue);
    expect(after.battery.capacityMah, 12000);
    expect(after.armed, isFalse);
    expect(await source.fetchDrops(), hasLength(7));
  });

  test('dummy weather returns BMKG-shaped slots', () {
    final forecast = DummyWeatherForecast.build(-6.8971983, 107.636371);

    expect(forecast.slots, hasLength(12));
    expect(forecast.adm4, '3204050001');
    expect(forecast.current, isNotNull);
    expect(forecast.upcoming, isNotEmpty);
    expect(forecast.slots.first.temperature, isNotNull);
  });

  test('weather service uses dummy forecast without network when mode is on', () async {
    AppConfig.dummyMode.value = true;
    addTearDown(() => AppConfig.dummyMode.value = false);
    final service = WeatherService();

    final forecast = await service.fetch(-6.8971983, 107.636371);
    service.close();

    expect(forecast.slots, hasLength(12));
    expect(forecast.adm4, '3204050001');
  });
}
