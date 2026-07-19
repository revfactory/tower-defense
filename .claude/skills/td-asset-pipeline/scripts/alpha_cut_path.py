#!/usr/bin/env python3
"""길 타일 잔디 여백을 알파 투명으로 도려낸다 (스티커 현상 제거).
tilemap.buildBackground는 모든 셀에 변형 잔디 바닥을 먼저 그리고 길 PNG를 위에 얹는다
(코드 주석: "길 코너 PNG의 투명 영역 밑에 비친다"). 즉 길 타일의 잔디 여백은
투명이어야 실제 잔디 필드가 비쳐 이음새가 사라진다. 도로는 불투명 유지, 경계는 페더.
멤버십: g-r (grass=양수 지배). alpha *= (1 - smoothstep(g-r, LO, HI)).
"""
import argparse
import shutil
from pathlib import Path
from PIL import Image, ImageFilter


def smoothstep(x, lo, hi):
    if hi == lo:
        return 1.0 if x >= hi else 0.0
    t = max(0.0, min(1.0, (x - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("targets", nargs="+")
    ap.add_argument("--lo", type=float, default=0.0, help="per-pixel g-r 하단")
    ap.add_argument("--hi", type=float, default=10.0, help="per-pixel g-r 상단")
    ap.add_argument("--blur", type=float, default=6.0, help="멤버십 가우시안 블러 반경(영역화 — 잎 노이즈 평균)")
    ap.add_argument("--gamma", type=float, default=1.0, help="블러 후 마스크 감마(>1=도로쪽 보존 강화)")
    ap.add_argument("--backup-dir", default="assets/reference/pre_alphacut")
    args = ap.parse_args()

    bdir = Path(args.backup_dir)
    bdir.mkdir(parents=True, exist_ok=True)

    for tp in args.targets:
        tp = Path(tp)
        img = Image.open(tp).convert("RGBA")
        w, h = img.size
        px = list(img.getdata())
        # 1) per-pixel grass 멤버십(0~255)
        raw = Image.new("L", (w, h))
        raw.putdata([int(255 * smoothstep(g - r, args.lo, args.hi)) for r, g, b, a in px])
        # 2) 영역화: 가우시안 블러로 잎-레벨 노이즈 평균 → 매끄러운 지역 마스크
        mask = raw.filter(ImageFilter.GaussianBlur(args.blur))
        mdata = list(mask.getdata())
        out = []
        for (r, g, b, a), m in zip(px, mdata):
            wgt = (m / 255.0) ** args.gamma
            out.append((r, g, b, round(a * (1.0 - wgt))))
        bak = bdir / tp.name
        if not bak.exists():
            shutil.copy2(tp, bak)
        res = Image.new("RGBA", img.size)
        res.putdata(out)
        res.save(tp)
        n = len(out)
        opaque = 100 * sum(1 for p in out if p[3] >= 250) / n
        transp = 100 * sum(1 for p in out if p[3] <= 5) / n
        feather = 100 * sum(1 for p in out if 5 < p[3] < 250) / n
        print(f"{tp.name}: 불투명 {opaque:.0f}% 투명 {transp:.0f}% 페더 {feather:.0f}% (백업 {bak})")


if __name__ == "__main__":
    main()
