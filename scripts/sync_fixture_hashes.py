#!/usr/bin/env python3
"""
Rewrites byteSize and hash in every fixtures/case.*.ts to match the real files
in fixtures/documents/.

Run this after regenerating the corpus. `npm run fixtures` verifies the same
correspondence and fails if it has drifted, so this is the fixer and that is
the check.

    python3 scripts/make_fixture_documents.py
    python3 scripts/sync_fixture_hashes.py
    npm run fixtures
"""

import hashlib
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "fixtures" / "documents"

# Two shapes to handle. Object literals in the fixtures:
#     fileName: "receipt.jpg", ... byteSize: 123, ... hash: "sha256:...",
# and property assignments, which case.adverse.ts uses to override a cloned doc:
#     chat.fileName = "whatsapp-thread-full.png";
#     chat.byteSize = 0;
#     chat.hash = "sha256:pending";
DOC_BLOCK = re.compile(
    r'fileName: "(?P<file>[^"]+)",'      # the file it claims to be
    r'(?P<mid1>.*?)'
    r'byteSize: (?P<size>[0-9_]+),'
    r'(?P<mid2>.*?)'
    r'hash: "(?P<hash>[^"]*)",',
    re.S,
)


DOC_ASSIGN = re.compile(
    r'(?P<var>\w+)\.fileName = "(?P<file>[^"]+)";'
    r"(?P<mid1>.*?)"
    r"\1\.byteSize = (?P<size>[0-9]+);"
    r"(?P<mid2>.*?)"
    r'\1\.hash = "(?P<hash>[^"]*)";',
    re.S,
)


def main() -> int:
    changed = 0
    missing = []

    for src in sorted((ROOT / "fixtures").glob("case.*.ts")):
        text = src.read_text()

        def patch_assign(m: re.Match) -> str:
            nonlocal changed
            path = DOCS / m.group("file")
            if not path.exists():
                missing.append(f"{src.name}: {m.group('file')}")
                return m.group(0)
            data = path.read_bytes()
            size, digest = len(data), "sha256:" + hashlib.sha256(data).hexdigest()[:16]
            if str(size) != m.group("size") or digest != m.group("hash"):
                changed += 1
                print(f"  {src.name:<20}{m.group('file'):<28}{size:>8}  {digest}")
            v = m.group("var")
            return (
                f'{v}.fileName = "{m.group("file")}";{m.group("mid1")}'
                f"{v}.byteSize = {size};{m.group('mid2')}"
                f'{v}.hash = "{digest}";'
            )

        def patch(m: re.Match) -> str:
            nonlocal changed
            path = DOCS / m.group("file")
            if not path.exists():
                missing.append(f"{src.name}: {m.group('file')}")
                return m.group(0)
            data = path.read_bytes()
            size = len(data)
            digest = "sha256:" + hashlib.sha256(data).hexdigest()[:16]
            if str(size) != m.group("size").replace("_", "") or digest != m.group("hash"):
                changed += 1
                print(f"  {src.name:<20}{m.group('file'):<28}{size:>8}  {digest}")
            return (
                f'fileName: "{m.group("file")}",{m.group("mid1")}'
                f'byteSize: {size},{m.group("mid2")}hash: "{digest}",'
            )

        new = DOC_BLOCK.sub(patch, text)
        new = DOC_ASSIGN.sub(patch_assign, new)
        if new != text:
            src.write_text(new)

    if missing:
        print("\nNo such file in fixtures/documents/:", file=sys.stderr)
        for m in missing:
            print(f"  ✗ {m}", file=sys.stderr)
        return 1

    print(f"\n{changed} document(s) updated" if changed else "\nalready in sync")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
