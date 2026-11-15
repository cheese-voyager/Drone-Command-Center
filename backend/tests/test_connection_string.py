import pytest

from app.services.mavlink_client import split_connection


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("COM3,57600", ("COM3", 57600)),
        ("/dev/ttyACM0,115200", ("/dev/ttyACM0", 115200)),
        ("/dev/serial0, 921600", ("/dev/serial0", 921600)),
        ("COM3", ("COM3", None)),
        ("udpin:127.0.0.1:14551", ("udpin:127.0.0.1:14551", None)),
        ("udpin:0.0.0.0:14551,5", ("udpin:0.0.0.0:14551,5", None)),
        ("tcp:192.168.2.2:5760", ("tcp:192.168.2.2:5760", None)),
    ],
)
def test_split_connection(raw, expected):
    assert split_connection(raw) == expected
