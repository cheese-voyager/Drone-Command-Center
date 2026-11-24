# Mode detail command center web

Mode detail membuka data lengkap setiap fitur tanpa sidebar/topbar aplikasi utama. Setiap halaman bisa dibuka langsung dari laptop berbeda.

Akses detail memakai satu ikon mata pada kartu/header tiap fitur. Dashboard tidak memakai daftar tombol detail lagi.

## Rute

| Rute | Fitur | Sumber data |
| --- | --- | --- |
| `/detail/status` | Kesehatan armada | `GET /status`, MQTT `status`, payload Mission Planner |
| `/detail/peta` | Peta | MQTT `status`, `GET /drops`, riwayat telemetri browser |
| `/detail/drop` | Drop benih | `GET /drops`, MQTT `drop_event`, MQTT `status` |
| `/detail/thruster` | Tes thruster dan motor | MQTT `status`, Mission Planner servo |
| `/detail/baterai` | Baterai dan daya | `GET /status`, MQTT `status`, riwayat telemetri browser |
| `/detail/benih` | Benih | `GET /status`, MQTT `status`, riwayat telemetri browser |
| `/detail/video` | Kamera | `GET /video`, MQTT `status` |
| `/detail/cuaca` | Cuaca | BMKG, GPS dari MQTT `status` |
| `/detail/penerbangan` | Riwayat penerbangan | localStorage browser |

`/detail` dialihkan ke `/detail/status`.

## Perilaku data

- Header detail memuat ringkasan telemetri, sumber data, legenda, tombol kembali ke halaman utama, detail terkait, layar penuh, dan ekspor bila tersedia.
- Halaman detail mengambil snapshot REST saat dibuka, lalu memakai MQTT untuk pembaruan live.
- Koneksi MQTT dijalankan oleh provider global sehingga tidak berhenti ketika halaman berada di luar layout utama.
- Status koneksi ditampilkan di header: `LIVE`, `STALE`, `CONNECTING`, `OFFLINE`, atau `ERROR`.
- Tombol `Layar penuh` memakai Fullscreen API browser. Alternatif: F11/kiosk mode browser.

## Data Mission Planner

Jika payload status mengandung grup berikut, halaman detail akan merangkumnya menjadi kartu Status misi, GPS dan waktu, Navigasi, Kesehatan sistem, Daya dan tautan, Servo, dan Pesan status:

- `time`
- `power`
- `gps`
- `nav`
- `mission`
- `health`
- `link`
- `servo`
- `messages`
- `schema_version`

Jika field belum ada, tampilan menunjukkan `-` atau pesan menunggu data. Payload mentah tetap tersedia melalui panel `Lihat payload mentah` pada kartu Mission Planner. Backend tidak diubah untuk fitur ini.

## Field yang sengaja dikosongkan

Field berikut belum tersedia dari endpoint yang ada dan saat ini ditampilkan kosong/`-`:

- Konfigurasi drop aktif: thrust, durasi, channel servo, PWM min/max, benih per drop.
- Metadata kamera: nama kamera, resolusi, frame rate, exposure, zoom, fokus, waktu terakhir.
- Riwayat penerbangan backend dan jalur peta backend: saat ini memakai data lokal browser.
- Riwayat baterai dan riwayat benih: saat ini diturunkan dari sampel telemetri browser, bukan endpoint backend.

Jika backend kelak mengirim field-field ini, cukup tambahkan pemetaan di frontend dan perbarui dokumen ini. Tidak perlu mengubah endpoint agar halaman detail tetap berfungsi.
