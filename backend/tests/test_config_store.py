import json

from app.schemas import DropRecord
from app.services.config_store import ConfigStore
from app.services.drop_history import DropHistory


def test_membuat_config_default_kalau_belum_ada(tmp_path):
    path = tmp_path / "data" / "config.json"
    store = ConfigStore(path)
    assert path.exists()
    assert store.section("battery") == {"capacity_mah": 10000, "cells": 6, "min_safe_percent": 25}
    assert store.section("drop")["servo_channel"] == 9
    assert store.section("seed") == {"loaded": 0, "dropped": 0}


def test_perubahan_tersimpan_dan_terbaca_ulang(tmp_path):
    path = tmp_path / "config.json"
    ConfigStore(path).update_section("seed", {"loaded": 42})
    assert ConfigStore(path).section("seed")["loaded"] == 42


def test_key_yang_hilang_diisi_default(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"drop": {"thrust_percent": 33}}))
    store = ConfigStore(path)
    assert store.section("drop")["thrust_percent"] == 33
    assert store.section("drop")["pwm_max"] == 2000
    assert store.section("battery")["capacity_mah"] == 10000


def test_config_rusak_dibackup_dan_dipulihkan(tmp_path):
    path = tmp_path / "config.json"
    path.write_text("{ ini bukan json")
    store = ConfigStore(path)
    assert store.section("seed") == {"loaded": 0, "dropped": 0}
    assert (tmp_path / "config.json.corrupt").read_text() == "{ ini bukan json"
    assert json.loads(path.read_text())["battery"]["capacity_mah"] == 10000


def test_increment(tmp_path):
    store = ConfigStore(tmp_path / "config.json")
    assert store.increment("seed", "dropped", 2) == 2
    assert store.increment("seed", "dropped", 1) == 3


def test_section_mengembalikan_salinan(tmp_path):
    store = ConfigStore(tmp_path / "config.json")
    store.section("seed")["loaded"] = 999
    assert store.section("seed")["loaded"] == 0


def test_tidak_ada_file_sementara_tersisa(tmp_path):
    store = ConfigStore(tmp_path / "config.json")
    store.update_section("seed", {"loaded": 1})
    assert [p.name for p in tmp_path.iterdir()] == ["config.json"]


# ---------- DropHistory ----------
def _record(i: int) -> DropRecord:
    return DropRecord(time=float(i), lat=-6.9, lon=107.6, thrust=60, duration=1.5)


def test_riwayat_drop_tersimpan_antar_restart(tmp_path):
    path = tmp_path / "drops.json"
    history = DropHistory(path)
    history.add(_record(1))
    history.add(_record(2))
    assert [r.time for r in DropHistory(path).list()] == [1.0, 2.0]


def test_riwayat_dibatasi_jumlahnya(tmp_path):
    history = DropHistory(tmp_path / "drops.json", max_records=3)
    for i in range(5):
        history.add(_record(i))
    assert [r.time for r in history.list()] == [2.0, 3.0, 4.0]
    assert len(DropHistory(tmp_path / "drops.json", max_records=3)) == 3


def test_riwayat_rusak_dikosongkan(tmp_path):
    path = tmp_path / "drops.json"
    path.write_text("[[[")
    assert DropHistory(path).list() == []
    assert (tmp_path / "drops.json.corrupt").exists()


def test_entri_riwayat_tidak_valid_dilewati(tmp_path):
    path = tmp_path / "drops.json"
    path.write_text(json.dumps([{"time": 1, "thrust": 50, "duration": 1}, {"foo": "bar"}]))
    assert len(DropHistory(path).list()) == 1
