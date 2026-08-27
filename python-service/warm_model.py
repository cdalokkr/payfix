"""Download the ArcFace model during a Docker Space image build."""

from pathlib import Path
from urllib.request import Request, urlopen


MODEL_PATH = Path(__file__).with_name("w600k_mbf.onnx")
MODEL_URLS = (
    "https://huggingface.co/WePrompt/buffalo_sc/resolve/main/w600k_mbf.onnx",
    "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s/w600k_mbf.onnx",
)


def model_is_ready() -> bool:
    return MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 1_000_000


def warm_model() -> None:
    if model_is_ready():
        print(f"ArcFace model already available ({MODEL_PATH.stat().st_size} bytes).")
        return

    for url in MODEL_URLS:
        temporary_path = MODEL_PATH.with_suffix(".onnx.part")
        try:
            print(f"Downloading ArcFace model from {url}...")
            request = Request(url, headers={"User-Agent": "PayFix-Biometric-Space/2.1"})
            with urlopen(request, timeout=90) as response, temporary_path.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            temporary_path.replace(MODEL_PATH)
            if model_is_ready():
                print(f"ArcFace model ready ({MODEL_PATH.stat().st_size} bytes).")
                return
        except Exception as error:
            temporary_path.unlink(missing_ok=True)
            print(f"Model download failed from {url}: {error}")

    raise RuntimeError("Could not download the required ArcFace ONNX model during image build.")


if __name__ == "__main__":
    warm_model()