import json

import pytest


def test_set_baterai(client, settings):
    r = client.post("/battery", json={"capacity_mah": 16000, "cells": 6})
    assert r.status_code == 200
    assert r.json() == {"capacity_mah": 16000, "cells": 6, "min_safe_percent": 25}

    saved = json.loads(settings.config_path.read_text())
    assert saved["battery"] == {"capacity_mah": 16000, "cells": 6, "min_safe_percent": 25}


def test_min_safe_percent_bisa_diatur(client):
    r = client.post("/battery", json={"capacity_mah": 5000, "cells": 4, "min_safe_percent": 30})
    assert r.json()["min_safe_percent"] == 30


def test_status_memakai_kapasitas_baru(client):
    client.post("/battery", json={"capacity_mah": 16000, "cells": 6})
    battery = client.get("/status").json()["battery"]
    assert battery["capacity_mah"] == 16000
    assert battery["remaining_mah"] == 16000.0
    assert battery["remaining_percent"] == 100.0


def test_ganti_baterai_mereset_mah_terpakai(client, container, clock, monkeypatch):
    monkeypatch.setattr(container.battery, "_clock", clock)
    container.battery.update_current(10.0)
    clock.advance(36)
    container.battery.update_current(10.0)
    assert client.get("/status").json()["battery"]["used_mah"] == 100.0

    client.post("/battery", json={"capacity_mah": 10000, "cells": 6})

    battery = client.get("/status").json()["battery"]
    assert battery["used_mah"] == 0.0
    assert battery["avg_current"] is None


@pytest.mark.parametrize(
    "body",
    [
        {"capacity_mah": 0, "cells": 6},
        {"capacity_mah": -5, "cells": 6},
        {"capacity_mah": 10000, "cells": 0},
        {"capacity_mah": 10000, "cells": 6, "min_safe_percent": 101},
        {"capacity_mah": 10000, "cells": 6, "min_safe_percent": -1},
        {"cells": 6},
        {"capacity_mah": 10000},
    ],
)
def test_baterai_tidak_valid_ditolak(client, body):
    assert client.post("/battery", json=body).status_code == 422


def test_data_baterai_tidak_berubah_kalau_ditolak(client):
    before = client.get("/status").json()["battery"]["capacity_mah"]
    client.post("/battery", json={"capacity_mah": 0, "cells": 6})
    assert client.get("/status").json()["battery"]["capacity_mah"] == before
