"""Original score for "See through": 90 BPM, piano + sub pulse + restrained strings.

90 BPM at 30 fps is exactly 20 frames per beat, so every cut in the film is
written as beatF(n) = 20 * n and lands on the grid by construction.

    ../.venv/bin/python scripts/score.py   ->  public/audio/score.wav
"""
from __future__ import annotations

import os
import wave
from pathlib import Path

import numpy as np

SR = 48_000
BPM = 90
BEAT = 60 / BPM
# Length and the final-chord beat are parameters so other cuts can reuse the cue:
#   SCORE_END_BEAT=129 SCORE_SECONDS=93 SCORE_OUT=score-showcase.wav python scripts/score.py
END_BEAT = float(os.environ.get("SCORE_END_BEAT", 79))
DUR = float(os.environ.get("SCORE_SECONDS", 61.0))
rng = np.random.default_rng(7)  # deterministic

t_all = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t_all)
R = np.zeros_like(t_all)


def note_hz(name: str) -> float:
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave - 4)) / 12)


def add(sig: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(at * SR)
    j = min(len(L), i + len(sig))
    if j <= i:
        return
    lg = np.cos((pan + 1) * np.pi / 4)
    rg = np.sin((pan + 1) * np.pi / 4)
    L[i:j] += sig[: j - i] * gain * lg
    R[i:j] += sig[: j - i] * gain * rg


def piano(hz: float, length: float = 4.0, vel: float = 1.0) -> np.ndarray:
    t = np.arange(int(SR * length)) / SR
    out = np.zeros_like(t)
    for n in range(1, 10):
        f = hz * n * (1 + 0.0004 * n * n)  # slight string inharmonicity
        if f > SR / 2.2:
            break
        decay = 0.9 + 0.55 * n
        out += np.sin(2 * np.pi * f * t) * (1 / n**1.4) * np.exp(-t * decay * (0.6 if hz < 150 else 1.0))
    attack = np.clip(t / 0.004, 0, 1)
    hammer = rng.standard_normal(len(t)) * np.exp(-t * 90) * 0.02
    release = np.clip((length - t) / 0.25, 0, 1)
    return (out * attack + hammer) * release * vel


def sub_pulse(length: float = 0.6) -> np.ndarray:
    t = np.arange(int(SR * length)) / SR
    f = 46 + 26 * np.exp(-t * 30)  # soft thump: pitch glides 72 -> 46 Hz
    phase = 2 * np.pi * np.cumsum(f) / SR
    env = np.clip(t / 0.008, 0, 1) * np.exp(-t * 6.5)
    return np.sin(phase) * env


def strings(hz: float, length: float, attack: float = 1.8) -> np.ndarray:
    t = np.arange(int(SR * length)) / SR
    out = np.zeros_like(t)
    for cents in (-7, 0, 6):
        f0 = hz * 2 ** (cents / 1200)
        vib = 1 + 0.0025 * np.sin(2 * np.pi * 5.1 * t + cents)
        phase = 2 * np.pi * np.cumsum(f0 * vib) / SR
        for n in range(1, 14):
            out += np.sin(n * phase) / n
    # one-pole low-pass ~1.8 kHz for a darker, restrained section
    a = np.exp(-2 * np.pi * 1800 / SR)
    y = np.empty_like(out)
    acc = 0.0
    for i, x in enumerate(out):
        acc = (1 - a) * x + a * acc
        y[i] = acc
    env = np.clip(t / attack, 0, 1) * np.clip((length - t) / 1.5, 0, 1)
    return y * env / 3


def b(n: float) -> float:
    return n * BEAT


# --- 0–4 s: silence, one low piano note -------------------------------------
add(piano(note_hz("A1"), 6.0, 1.0), 0.15, 0.55)
add(piano(note_hz("A2"), 6.0, 0.5), 0.15, 0.25)

# Chord loop Am – F – C – G, two bars (8 beats) each from beat 6 (4.0 s)
CHORDS = [("A2", "C4", "E4", "A4"), ("F2", "A3", "C4", "F4"), ("C3", "E4", "G4", "C5"), ("G2", "B3", "D4", "G4")]

# --- 4–52 s: pulse on every beat -----------------------------------------------
THIN = int(END_BEAT) - 16  # pulse thins out over the last four bars before the final chord
for k in range(6, int(END_BEAT) - 1):
    g = 0.42 if k < THIN else 0.42 * max(0.0, 1 - (k - THIN) / 15)
    add(sub_pulse(), b(k), g)

# --- piano chords every two bars from 4 s; arpeggio eighths from 10 s ---------
for bar, start in enumerate(range(6, int(END_BEAT) - 1, 8)):
    root, *upper = CHORDS[bar % 4]
    add(piano(note_hz(root), 5.0, 0.8), b(start), 0.32, -0.15)
    for i, nme in enumerate(upper):
        add(piano(note_hz(nme), 4.0, 0.55), b(start) + 0.012 * i, 0.16, 0.25 - 0.15 * i)
    if start >= 15:  # 10 s
        arp = [upper[0], upper[1], upper[2], upper[1]] * 4
        for e, nme in enumerate(arp):
            hz = note_hz(nme) * 2
            add(piano(hz, 1.2, 0.35), b(start) + e * BEAT / 2, 0.07, 0.4 if e % 2 else -0.4)

# --- 20–42 s: strings swell; 42–52 s hold one pad ------------------------------
for bar, start in enumerate(range(30, THIN, 8)):
    root, *upper = CHORDS[(bar + 3) % 4]
    for i, nme in enumerate((root, *upper[:2])):
        hz = note_hz(nme) * (2 if i == 0 else 1)
        add(strings(hz, b(8) + 1.0), b(start), 0.05, -0.5 + 0.5 * i)
add(strings(note_hz("A3"), 13.0, 3.0), b(THIN), 0.06, -0.3)
add(strings(note_hz("E4"), 13.0, 3.0), b(THIN), 0.05, 0.3)

# --- 52.7 s: final chord, then let it ring -------------------------------------
END = b(END_BEAT)
for i, nme in enumerate(("A1", "A2", "E3", "C4", "E4", "A4")):
    add(piano(note_hz(nme), 8.0, 0.9), END + 0.01 * i, 0.3 if i < 2 else 0.18, -0.3 + 0.12 * i)
add(strings(note_hz("A3"), 7.5, 0.6), END, 0.05)
add(strings(note_hz("E4"), 7.5, 0.6), END, 0.04)
add(sub_pulse(1.6), END, 0.55)

# --- master: gentle glue, normalise to -1 dBFS peak, fade tail ----------------
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.4) / 1.4
fade = np.clip((DUR - t_all) / 3.0, 0, 1)[:, None]
mix *= fade
mix /= np.max(np.abs(mix)) / 10 ** (-1 / 20)
rms = np.sqrt(np.mean(mix[int(5 * SR):int(50 * SR)] ** 2))
print(f"peak -1.0 dBFS, body RMS {20 * np.log10(rms):.1f} dBFS")

out = Path(__file__).resolve().parent.parent / "public" / "audio" / os.environ.get("SCORE_OUT", "score.wav")
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(out)
