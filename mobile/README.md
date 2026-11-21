# Drone Command Center — Mobile (Flutter)

Lapisan tampilan "tactical HUD" yang sama dengan web: tema gelap/terang dan menu radial 10 fitur.
Seluruh halaman kini memakai data/perintah backend: Dashboard/Peta (`GET /status`, `GET /drops`), Cuaca (BMKG memakai koordinat drone), Drop (`POST /drop/config`, `POST /drop`), Thruster (`POST /thruster/test`, `POST /thruster/stop`), Baterai (`POST /battery`), Benih (`POST /seed/load`), Riwayat (`GET /drops`, `GET /mqtt`), Kamera (`GET /video`), dan Setelan.
Fitur analitik web juga tersedia di mobile: grafik baterai/tegangan/arus dengan tombol tampil/sembunyi, PDF & CSV, riwayat benih dengan titik koordinat, riwayat penerbangan (sesi + jarak + grafik), flight path di peta, indikator kesiapan drop, dan grafik PWM motor.
Alamat default `http://192.168.1.105:8000` bisa diubah di menu **Setelan** di HP; emulator Android memakai IP yang sama atau `http://10.0.2.2:8000`. Untuk build emulator: `flutter build apk --debug --dart-define=DCC_BACKEND_URL=http://10.0.2.2:8000`.

## Mode data dummy
Menu **Setelan → Mode data dummy** mengisi seluruh fitur dengan data sintetis yang memakai kunci payload backend yang sama (`connected`, `armed`, `battery`, `seed`, `motors`, `thrust_percent`, dan lain-lain), sehingga perbandingan layout/perilaku bisa dilakukan tanpa backend, BMKG, atau kamera. Aksi seperti drop, muat benih, konfigurasi baterai, tes thruster, dan STOP juga mengubah state dummy. Matikan toggle untuk kembali memakai backend/BMKG/MJPEG asli. Flag awal bisa di-set lewat `--dart-define=DCC_DUMMY=true`.

## Menjalankan
```bash
cd mobile
flutter create . --platforms=android,ios   # membuat folder android/ ios/ (file di lib/ dan pubspec.yaml tidak diganti)
flutter pub get
flutter run
flutter test
```
Pastikan `lib/main.dart` dan `pubspec.yaml` tetap versi dari repo ini setelah `flutter create`.

## Struktur
- `lib/core/constants/app_colors.dart` — token warna gelap/terang (`DccColors`, `context.dcc`)
- `lib/core/theme/app_theme.dart` — `ThemeData` dan gaya teks (`DccText`)
- `lib/shared/widgets/hud_panel.dart` — panel bersiku HUD dan `StatusPill`
- `lib/shared/widgets/radial_menu.dart` — tombol tengah + menu radial 10 fitur (2 busur)
- `lib/features/shell/app_shell.dart` — app bar (tema, STOP), halaman aktif, menu radial
- `lib/features/dashboard/` — Dashboard, provider backend terpusat, dan painter (peta, gauge, horizon)
- `lib/features/map/`, `weather/`, `drop/`, `thruster_test/`, `battery/`, `seed/`, `history/`, `video/` — halaman fitur radial
- `lib/shared/widgets/charts.dart` — chart garis dan batang tanpa library chart
- `lib/core/export/report_exporter.dart` — ekspor PDF/CSV via `pdf` + `share_plus`
- `lib/data/services/telemetry_history.dart`, `flight_summary.dart` — history dummy/real-time dan ringkasan sesi penerbangan
- `lib/data/` — model, datasource REST + BMKG, dan repository

## Menambah fitur ke menu radial
Tambahkan `RadialItem` di `radialItems` (`app_shell.dart`), lalu petakan `id` ke halaman di `_pageFor`.
Busur dalam (`ring: 0`) untuk operasi, busur luar (`ring: 1`) untuk sistem; `angle` 180 = kiri, 90 = atas, 0 = kanan.

## Font
Chakra Petch dan JetBrains Mono dibundel di `assets/fonts/` (lisensi SIL OFL) agar tampil benar tanpa internet.
