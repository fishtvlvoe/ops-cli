#!/usr/bin/env bash
set -euo pipefail

INSTALL_MISSING=false
REPO_REF="${OPS_CLI_REF:-main}"

for arg in "$@"; do
  case "$arg" in
    --install-missing)
      INSTALL_MISSING=true
      ;;
    --ref=*)
      REPO_REF="${arg#--ref=}"
      ;;
    -h|--help)
      cat <<'USAGE'
ops CLI installer

Usage:
  scripts/install.sh [--install-missing] [--ref=main]

Default behavior:
  - installs ops CLI from GitHub via npm
  - checks prerequisites with ops doctor/setup
  - does not silently install Spectra/GSD/system tools

Options:
  --install-missing  install safe, supported missing tools where possible
  --ref=main         Git ref to install from
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

have() {
  command -v "$1" >/dev/null 2>&1
}

if ! have node || ! have npm; then
  if [[ "$INSTALL_MISSING" == "true" ]] && [[ "$(uname -s)" == "Darwin" ]] && have brew; then
    brew install node
  else
    cat >&2 <<'MSG'
Node.js and npm are required before ops can be installed.

Install Node.js 20+ first, then rerun this installer.
On macOS with Homebrew:
  brew install node
MSG
    exit 1
  fi
fi

if [[ "$INSTALL_MISSING" == "true" ]]; then
  if ! have git && [[ "$(uname -s)" == "Darwin" ]] && have brew; then
    brew install git
  fi
  if ! have gh && [[ "$(uname -s)" == "Darwin" ]] && have brew; then
    brew install gh
  fi
fi

npm install -g "github:fishtvlvoe/ops-cli#${REPO_REF}"

echo
echo "ops installed:"
command -v ops
ops --version

echo
echo "Running ops doctor:"
if ! ops doctor; then
  echo
  echo "Some prerequisites are missing. Run:"
  echo "  ops setup"
  echo
  echo "To try supported installs explicitly:"
  echo "  ops setup --install-missing"
fi
