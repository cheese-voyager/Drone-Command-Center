"""Exception aplikasi. Semuanya dikirim ke klien sebagai `{"detail": ..., "code": ...}`."""


class AppError(Exception):
    status_code = 400
    code = "app_error"
    default_message = "Terjadi kesalahan"

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class DroneNotConnectedError(AppError):
    code = "drone_not_connected"
    default_message = "Pixhawk belum terhubung"


class BusyError(AppError):
    code = "busy"
    default_message = "Thruster sedang berjalan"


class DroneArmedError(AppError):
    code = "drone_armed"
    default_message = "Tes motor hanya boleh saat drone disarm"


class NotEnoughSeedsError(AppError):
    code = "not_enough_seeds"
    default_message = "Benih tidak cukup"


class InvalidParameterError(AppError):
    code = "invalid_parameter"
    default_message = "Parameter tidak valid"


class MavlinkCommandError(AppError):
    status_code = 502
    code = "mavlink_command_failed"
    default_message = "Gagal mengirim perintah ke Pixhawk"


class CameraUnavailableError(AppError):
    status_code = 503
    code = "camera_unavailable"
    default_message = "Kamera tidak tersedia"
