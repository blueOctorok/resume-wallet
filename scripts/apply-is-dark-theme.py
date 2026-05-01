"""One-off: replace theme === 'dark' / theme !== 'dark' with isDarkTheme(theme) and add import."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
SKIP = {
    ROOT / "lib" / "theme-storage.ts",
    ROOT / "contexts" / "ThemeContext.tsx",
}
IMPORT_LINE = "import { isDarkTheme } from '@/lib/theme-storage'"


def patch_file(path: Path) -> bool:
    if path in SKIP or "embed" in path.parts and path.name == "page.tsx":
        return False
    text = path.read_text(encoding="utf-8")
    if "theme === 'dark'" not in text and "theme !== 'dark'" not in text:
        return False
    orig = text
    text = re.sub(r"\btheme !== 'dark'\b", "!isDarkTheme(theme)", text)
    text = re.sub(r"\btheme === 'dark'\b", "isDarkTheme(theme)", text)
    if text == orig:
        return False
    if IMPORT_LINE not in text and "isDarkTheme" in text:
        lines = text.split("\n")
        insert = 0
        if lines and lines[0].strip() in ("'use client'", '"use client"'):
            insert = 1
            while insert < len(lines) and lines[insert].strip() == "":
                insert += 1
        lines.insert(insert, IMPORT_LINE)
        text = "\n".join(lines)
    path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    n = 0
    for path in sorted(ROOT.rglob("*.tsx")) + sorted(ROOT.rglob("*.ts")):
        if patch_file(path):
            print(path.relative_to(ROOT))
            n += 1
    print(f"Patched {n} files")


if __name__ == "__main__":
    main()
