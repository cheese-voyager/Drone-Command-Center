import pytest

from app.schemas import BatteryConfig
from app.services.battery_service import BatteryService
from app.services.config_store import ConfigStore


@pytest.fixture
def store(tmp_path):
    return ConfigStore(tmp_path / "config.json")  # default: 10000 mAh, min aman 25%


@pytest.fixture
def battery(store, clock):
    return BatteryService(store, clock=clock)


def test_sampel_pertama_belum_menambah_mah(battery):
    battery.update_current(10.0)
    assert battery.used_mah == 0.0


def test_arus_kali_waktu_menjadi_mah(battery, clock):
    battery.update_current(10.0)
    clock.advance(36)  # 10 A x 36 s = 360 A*s = 100 mAh
    battery.update_current(10.0)
    assert battery.used_mah == pytest.approx(100.0)

    status = battery.status()
    assert status.used_mah == 100.0
    assert status.remaining_mah == 9900.0
    assert status.remaining_percent == 99.0
    assert status.low is False


def test_estimasi_waktu_terbang(battery, clock):
    battery.update_current(10.0)
    clock.advance(36)
    battery.update_current(10.0)
    # sisa 9.9 Ah / 10 A = 0.99 jam = 59.4 menit
    assert battery.status().estimated_minutes_left == pytest.approx(59.4)


def test_tanpa_estimasi_kalau_arus_kecil(battery):
    battery.update_current(0.3)
    status = battery.status()
    assert status.avg_current == pytest.approx(0.3)
    assert status.estimated_minutes_left is None


def test_tanpa_data_arus(battery):
    status = battery.status()
    assert status.avg_current is None
    assert status.estimated_minutes_left is None
    assert status.remaining_percent == 100.0


def test_flag_low_di_bawah_batas_aman(store, clock):
    store.update_section("battery", {"capacity_mah": 1000})
    battery = BatteryService(store, clock=clock)
    battery.update_current(10.0)
    clock.advance(288)  # 800 mAh terpakai -> sisa 20% < 25%
    battery.update_current(10.0)
    status = battery.status()
    assert status.remaining_percent == 20.0
    assert status.low is True


def test_sisa_tidak_negatif_kalau_pemakaian_melebihi_kapasitas(store, clock):
    store.update_section("battery", {"capacity_mah": 100})
    battery = BatteryService(store, clock=clock)
    battery.update_current(20.0)
    clock.advance(3600)
    battery.update_current(20.0)
    status = battery.status()
    assert status.remaining_mah == 0.0
    assert status.remaining_percent == 0.0
    assert status.low is True


def test_arus_negatif_tidak_membuat_mah_terpakai_minus(battery, clock):
    battery.update_current(-5.0)
    clock.advance(10)
    battery.update_current(-5.0)
    assert battery.used_mah == 0.0
    assert battery.status().remaining_percent == 100.0


def test_jeda_data_tidak_dihitung_sebagai_pemakaian(battery, clock):
    battery.update_current(10.0)
    clock.advance(36)
    battery.update_current(10.0)  # 100 mAh
    battery.pause()  # koneksi putus
    clock.advance(600)  # 10 menit tanpa data
    battery.update_current(10.0)
    assert battery.used_mah == pytest.approx(100.0)


def test_reset_saat_ganti_baterai(battery, clock):
    battery.update_current(10.0)
    clock.advance(36)
    battery.update_current(10.0)
    battery.reset()
    status = battery.status()
    assert status.used_mah == 0.0
    assert status.avg_current is None


def test_configure_menyimpan_dan_mereset(battery, store, clock):
    battery.update_current(10.0)
    clock.advance(36)
    battery.update_current(10.0)

    result = battery.configure(BatteryConfig(capacity_mah=16000, cells=6))

    assert result.min_safe_percent == 25
    assert store.section("battery") == {"capacity_mah": 16000, "cells": 6, "min_safe_percent": 25}
    assert battery.used_mah == 0.0


def test_rata_rata_arus_hanya_50_sampel_terakhir(battery):
    for _ in range(50):
        battery.update_current(1.0)
    for _ in range(50):
        battery.update_current(3.0)
    assert battery.status().avg_current == pytest.approx(3.0)


def test_kapasitas_nol_tidak_error(store, battery):
    store.update_section("battery", {"capacity_mah": 0})
    status = battery.status()
    assert status.remaining_percent == 0.0
    assert status.low is True
