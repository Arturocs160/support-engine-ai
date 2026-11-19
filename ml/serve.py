import argparse
import json
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import joblib


MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "tickets.joblib"
# La sustitución de secretos puede ampliar el JSON que envía Express.
MAX_BODY_BYTES = 64 * 1024


class PredictionHandler(BaseHTTPRequestHandler):
    timeout = 5

    def __init__(self, *args, model, **kwargs):
        self.model = model
        super().__init__(*args, **kwargs)

    def log_message(self, *_args):
        pass

    def do_POST(self):
        if self.path != "/predict":
            return self.send_json(404, {"error": "Ruta no encontrada."})
        if self.headers.get_content_type() != "application/json":
            return self.send_json(415, {"error": "Se requiere JSON."})
        try:
            length = int(self.headers.get("Content-Length", ""))
            if not 0 < length <= MAX_BODY_BYTES:
                return self.send_json(413, {"error": "Tamaño de JSON inválido."})
            body = json.loads(self.rfile.read(length))
        except (ValueError, RecursionError):
            return self.send_json(400, {"error": "JSON inválido."})
        except OSError:
            return

        message = body.get("message") if isinstance(body, dict) else None
        if not isinstance(message, str) or not message:
            return self.send_json(400, {"error": "Se requiere un mensaje."})
        try:
            category = str(self.model.predict([message])[0])
        except Exception:
            return self.send_json(500, {"error": "No se pudo clasificar el mensaje."})
        return self.send_json(200, {"category": category})

    def send_json(self, status, body):
        data = json.dumps(body).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except OSError:
            pass


def main():
    parser = argparse.ArgumentParser(description="Sirve el clasificador ML en localhost.")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port debe estar entre 1 y 65535")
    try:
        model = joblib.load(MODEL_PATH)
    except Exception:
        raise SystemExit("No se pudo cargar el modelo. Ejecuta primero python ml/train.py.") from None

    handler = partial(PredictionHandler, model=model)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError:
        raise SystemExit(f"No se pudo iniciar el servicio ML en el puerto {args.port}.") from None

    with server:
        print(f"Motor ML disponible en http://127.0.0.1:{args.port}/predict", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
