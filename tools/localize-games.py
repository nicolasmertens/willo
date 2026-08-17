#!/usr/bin/env python3
"""Copy klas memory + pick into mama (FR) and papa (NL) with localized chrome.

Uses each taal's existing games/animals.json + games/name/*.mp3.
Images/sounds stay on klas via animals.json relative paths (same as soundboard).
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LOCALES = {
    "mama": {
        "lang": "fr",
        "html_lang": "fr",
        "nav_active": "mama",
        "exit_href": "/willo/mama/",
        "memory": {
            "title": "Mémoire",
            "easy": "Facile",
            "medium": "Moyen",
            "hard": "Difficile",
            "yay": "Bravo !",
            "again": "Encore",
            "tel": "mama-memory-v1",
            "tile_title": "Mémoire",
        },
        "pick": {
            "title": "Lequel ?",
            "easy": "Facile",
            "medium": "Moyen",
            "hard": "Difficile",
            "rounds": "6 tours",
            "yay": "Bravo !",
            "again": "Encore",
            "replay_aria": "Écouter encore",
            "tel": "mama-pick-v1",
            "tile_title": "Lequel ?",
        },
        "games_json": "tracks/mama-games.json",
        "games_title": "Jeux",
    },
    "papa": {
        "lang": "nl",
        "html_lang": "nl",
        "nav_active": "papa",
        "exit_href": "/willo/papa/",
        "memory": {
            "title": "Memory",
            "easy": "Makkelijk",
            "medium": "Middel",
            "hard": "Moeilijk",
            "yay": "Hoera!",
            "again": "Nog een keer",
            "tel": "papa-memory-v1",
            "tile_title": "Memory",
        },
        "pick": {
            "title": "Welke?",
            "easy": "Makkelijk",
            "medium": "Middel",
            "hard": "Moeilijk",
            "rounds": "6 rondes",
            "yay": "Hoera!",
            "again": "Nog een keer",
            "replay_aria": "Nog eens horen",
            "tel": "papa-pick-v1",
            "tile_title": "Welke?",
        },
        "games_json": "tracks/papa-games.json",
        "games_title": "Spelen",
    },
}


def set_nav_active(html: str, active: str) -> str:
    # Reset any active, then mark the right navtile.
    for name in ("mama", "papa", "klas"):
        html = html.replace(
            f'class="navtile active" data-href="/willo/{name}/"',
            f'class="navtile" data-href="/willo/{name}/"',
        )
    html = html.replace(
        f'class="navtile" data-href="/willo/{active}/"',
        f'class="navtile active" data-href="/willo/{active}/"',
        1,
    )
    return html


def localize_memory(src: str, loc: dict, exit_href: str) -> str:
    m = loc["memory"]
    html = src
    html = html.replace('lang="en"', f'lang="{loc["html_lang"]}"', 1)
    html = html.replace("<title>Memory</title>", f"<title>{m['title']}</title>")
    html = html.replace('window.TEL_APP="klas-memory-v1"', f'window.TEL_APP="{m["tel"]}"')
    html = html.replace("<h1>Memory</h1>", f"<h1>{m['title']}</h1>")
    html = html.replace('<span class="word">Easy</span>', f'<span class="word">{m["easy"]}</span>')
    html = html.replace('<span class="word">Medium</span>', f'<span class="word">{m["medium"]}</span>')
    html = html.replace('<span class="word">Hard</span>', f'<span class="word">{m["hard"]}</span>')
    html = html.replace("<h2>Yay!</h2>", f"<h2>{m['yay']}</h2>")
    html = html.replace(">Play again</button>", f">{m['again']}</button>")
    html = html.replace('window.location = "/willo/klas/";', f'window.location = "{exit_href}";')
    html = set_nav_active(html, loc["nav_active"])
    return html


def localize_pick(src: str, loc: dict, exit_href: str) -> str:
    p = loc["pick"]
    html = src
    html = html.replace('lang="en"', f'lang="{loc["html_lang"]}"', 1)
    html = html.replace("<title>Which One?</title>", f"<title>{p['title']}</title>")
    html = html.replace('window.TEL_APP="klas-pick-v1"', f'window.TEL_APP="{p["tel"]}"')
    html = html.replace("<h1>Which One?</h1>", f"<h1>{p['title']}</h1>")
    html = html.replace('<span class="word">Easy</span>', f'<span class="word">{p["easy"]}</span>')
    html = html.replace('<span class="word">Medium</span>', f'<span class="word">{p["medium"]}</span>')
    html = html.replace('<span class="word">Hard</span>', f'<span class="word">{p["hard"]}</span>')
    html = html.replace('<span class="rounds">6 rounds</span>', f'<span class="rounds">{p["rounds"]}</span>')
    html = html.replace("<h2>Yay!</h2>", f"<h2>{p['yay']}</h2>")
    html = html.replace(">Play again</button>", f">{p['again']}</button>")
    html = html.replace(
        'aria-label="Play the word again"',
        f'aria-label="{p["replay_aria"]}"',
    )
    html = html.replace('window.location = "/willo/klas/";', f'window.location = "{exit_href}";')
    html = set_nav_active(html, loc["nav_active"])
    return html


def write_games_json(path: Path, title: str, lang: str, memory_title: str, pick_title: str, sound_title: str, sound_href: str) -> None:
    # Match klas order: Memory, Sounds, Which One
    taal = "mama" if "mama" in path.name else "papa"
    data = {
        "title": title,
        "lang": lang,
        "tracks": [
            {
                "n": 1,
                "title": memory_title,
                "icon": "/willo/klas/games/hero-memory.jpg",
                "href": f"/willo/{taal}/games/memory/",
            },
            {
                "n": 2,
                "title": sound_title,
                "icon": "/willo/klas/games/hero-sounds.jpg",
                "href": sound_href,
            },
            {
                "n": 3,
                "title": pick_title,
                "icon": "/willo/klas/games/hero-pick.jpg",
                "href": f"/willo/{taal}/games/pick/",
            },
        ],
    }
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    mem_src = (ROOT / "klas/games/memory/index.html").read_text(encoding="utf-8")
    pick_src = (ROOT / "klas/games/pick/index.html").read_text(encoding="utf-8")
    tel_src = ROOT / "mama/games/tel.js"
    if not tel_src.exists():
        tel_src = ROOT / "klas/games/tel.js"

    for taal, loc in LOCALES.items():
        games_dir = ROOT / taal / "games"
        games_dir.mkdir(parents=True, exist_ok=True)

        # tel.js for papa (mama already has it)
        dest_tel = games_dir / "tel.js"
        if not dest_tel.exists():
            shutil.copy2(tel_src, dest_tel)
            print(f"[ok] {taal}/games/tel.js")

        for game, src, fn in (
            ("memory", mem_src, localize_memory),
            ("pick", pick_src, localize_pick),
        ):
            out_dir = games_dir / game
            out_dir.mkdir(parents=True, exist_ok=True)
            html = fn(src, loc, loc["exit_href"])
            (out_dir / "index.html").write_text(html, encoding="utf-8")
            print(f"[ok] {taal}/games/{game}/index.html")

        sound_title = "Sons" if taal == "mama" else "Geluiden"
        sound_href = f"/willo/{taal}/games/soundboard/"
        write_games_json(
            ROOT / loc["games_json"],
            loc["games_title"],
            loc["lang"],
            loc["memory"]["tile_title"],
            loc["pick"]["tile_title"],
            sound_title,
            sound_href,
        )
        print(f"[ok] {loc['games_json']}")

    print("done")


if __name__ == "__main__":
    main()
