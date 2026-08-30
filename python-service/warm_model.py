"""Download the biometric models during the Docker image build.

ArcFace needs a five-point aligned face crop.  The small YuNet model provides
the detector and landmarks; keeping both models in the image makes first
requests deterministic on a scale-to-zero Cloud Run instance.
"""

from pathlib import Path
from urllib.request import Request, urlopen


MODELS = {
    "w600k_mbf.onnx": {
        "minimum_size": 1_000_000,
        "urls": (
            "https://huggingface.co/WePrompt/buffalo_sc/resolve/main/w600k_mbf.onnx",
            "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s/w600k_mbf.onnx",
        ),
    },
    "face_detection_yunet_2023mar.onnx": {
        "minimum_size": 100_000,
        "urls": (
            "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        ),
    },
}


def warm_model(filename: str, minimum_size: int, urls: tuple[str, ...]) -> None:
    model_path = Path(__file__).with_name(filename)
    if model_path.exists() and model_path.stat().st_size > minimum_size:
        print(f"{filename} already available ({model_path.stat().st_size} bytes).")
        return

    for url in urls:
        temporary_path = model_path.with_suffix(".onnx.part")
        try:
            print(f"Downloading {filename} from {url}...")
            request = Request(url, headers={"User-Agent": "PayFix-Biometric-Space/2.1"})
            with urlopen(request, timeout=90) as response, temporary_path.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            temporary_path.replace(model_path)
            if model_path.stat().st_size > minimum_size:
                print(f"{filename} ready ({model_path.stat().st_size} bytes).")
                return
        except Exception as error:
            temporary_path.unlink(missing_ok=True)
            print(f"Model download failed from {url}: {error}")

    raise RuntimeError(f"Could not download {filename} during image build.")


if __name__ == "__main__":
    for name, source in MODELS.items():
        warm_model(name, source["minimum_size"], source["urls"])