"""Bake selectable original pilot voices with OmniVoice; never runs in the browser."""
import argparse
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".voicegen"
ASSETS = ROOT / "dist/audio/pilot"
os.environ.setdefault("HF_HOME", str(CACHE / "huggingface"))


def prepare_audio(samples, sample_rate):
    import numpy as np
    from scipy.signal import butter, sosfilt

    samples = np.asarray(samples, dtype=np.float32).reshape(-1)
    if not len(samples) or not np.isfinite(samples).all():
        raise ValueError("OmniVoice returned invalid audio")
    # Light comms EQ; keep consonants and avoid distorting the performance.
    samples = sosfilt(butter(2, [140, 6500], btype="bandpass", fs=sample_rate, output="sos"), samples)
    active = np.flatnonzero(np.abs(samples) > .008)
    if not len(active):
        raise ValueError("OmniVoice returned silence")
    pad = int(sample_rate * .035)
    samples = samples[max(0, active[0] - pad):min(len(samples), active[-1] + pad + 1)]
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(samples ** 2)))
    samples *= min(.88 / peak, .20 / max(rms, .0001))
    fade = min(int(sample_rate * .008), len(samples) // 2)
    samples[:fade] *= np.linspace(0, 1, fade)
    samples[-fade:] *= np.linspace(1, 0, fade)
    if not .15 < len(samples) / sample_rate < 7:
        raise ValueError(f"Unexpected callout duration: {len(samples) / sample_rate:.2f}s; review the generated take")
    if float(np.sqrt(np.mean(samples ** 2))) < .02:
        raise ValueError("Generated take has too little speech energy; review the voice reference")
    return samples


def validate_reference(reference):
    import numpy as np
    import soundfile as sf
    from scipy.signal import butter, sosfilt

    samples, rate = sf.read(reference, dtype="float32")
    speech = sosfilt(butter(2, [140, 6500], btype="bandpass", fs=rate, output="sos"), samples)
    rms = float(np.sqrt(np.mean(samples ** 2)))
    speech_rms = float(np.sqrt(np.mean(speech ** 2)))
    if not np.isfinite(samples).all() or speech_rms < .01 or speech_rms / max(rms, .0001) < .3:
        raise ValueError(f"Unusable voice-design reference: {reference}. Choose another profile seed and redesign it.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="+", help="Generate only these line IDs")
    parser.add_argument("--force", action="store_true", help="Replace existing takes")
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--voice", default="all", help="Profile ID, or all (default)")
    args = parser.parse_args()
    catalog = json.loads((ASSETS / "callouts.json").read_text(encoding="utf-8"))
    generation = catalog["generation"]
    if args.voice != "all" and args.voice not in catalog["profiles"]:
        parser.error("Unknown voice: " + args.voice)
    lines = [line for event in catalog["events"].values() for line in event["lines"]]
    if args.only:
        unknown = set(args.only) - {line["id"] for line in lines}
        if unknown:
            parser.error("Unknown line IDs: " + ", ".join(sorted(unknown)))
        lines = [line for line in lines if line["id"] in args.only]
    selected = {key: profile for key, profile in catalog["profiles"].items() if args.voice in ("all", key)}
    pending = {key: [line for line in lines if args.force or not (ASSETS / key / (line["id"] + ".wav")).exists()]
               for key in selected}
    if not any(pending.values()):
        print("All selected callouts already exist. Use --force to regenerate.")
        return

    import numpy as np
    import soundfile as sf
    import torch
    from huggingface_hub import snapshot_download
    from omnivoice import OmniVoice

    CACHE.mkdir(exist_ok=True)
    torch.set_num_threads(4)
    checkpoint = snapshot_download(generation["model"], revision=generation["modelRevision"])
    model = OmniVoice.from_pretrained(checkpoint, device_map=args.device,
                                     dtype=torch.float32, attn_implementation="eager", load_asr=False)
    # Keep codec convolution on CPU: this Windows CUDA setup produced invalid
    # waveforms when encoding/decoding on the GPU, even with float32 weights.
    model.audio_tokenizer.to("cpu")
    for key, profile in selected.items():
        if not pending[key]:
            continue
        torch.manual_seed(profile["seed"])
        np.random.seed(profile["seed"])
        reference = ROOT / f"scripts/voice/{key}-reference.wav"
        if not reference.exists():
            reference.parent.mkdir(parents=True, exist_ok=True)
            print(f"Designing the original {profile['name']} voice...", flush=True)
            audio = model.generate(text=profile["referenceText"], language="English",
                                   instruct=profile["instruct"], num_step=32, speed=1.05, denoise=False)
            sf.write(reference, audio[0], model.sampling_rate, subtype="PCM_16")
        validate_reference(reference)
        prompt = model.create_voice_clone_prompt(ref_audio=str(reference), ref_text=profile["referenceText"])
        output = ASSETS / key
        output.mkdir(exist_ok=True)
        for line in pending[key]:
            seed = profile["seed"] + int(hashlib.sha256(line["id"].encode()).hexdigest()[:6], 16)
            torch.manual_seed(seed)
            np.random.seed(seed)
            text = line["text"].format(pilot=profile["name"])
            print(f'{key}/{line["id"]}: {text}', flush=True)
            audio = model.generate(text=text, language="English", voice_clone_prompt=prompt,
                                   num_step=32, speed=line.get("speed", profile["speed"]), denoise=False)
            sf.write(CACHE / f"{key}-{line['id']}-raw.wav", audio[0], model.sampling_rate, subtype="PCM_16")
            samples = prepare_audio(audio[0], model.sampling_rate)
            sf.write(output / (line["id"] + ".wav"), samples, model.sampling_rate, subtype="PCM_16")
            print(f"  {len(samples) / model.sampling_rate:.2f}s", flush=True)


if __name__ == "__main__":
    main()
