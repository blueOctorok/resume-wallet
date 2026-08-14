#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
compile() {
  echo "[MIDNIGHT] compact compile $1"
  compact compile "$root/$1" "$root/$2"
}
compile compact/mvr-clean-36/mvr-clean-36.compact midnight/runtime/managed/mvr-clean-36
compile compact/cdl-class-a/cdl-class-a.compact midnight/runtime/managed/cdl-class-a
compile compact/previous-employer-verified/previous-employer-verified.compact midnight/runtime/managed/previous-employer-verified
compile compact/cdl-class/cdl-class.compact midnight/runtime/managed/cdl-class
compile compact/cdl-endorsements/cdl-endorsements.compact midnight/runtime/managed/cdl-endorsements
compile compact/cdl-restrictions/cdl-restrictions.compact midnight/runtime/managed/cdl-restrictions
compile compact/med-cert-valid/med-cert-valid.compact midnight/runtime/managed/med-cert-valid
echo "[MIDNIGHT] compile complete"
