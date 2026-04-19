#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${HM_CLSS_BROWSER_ENV_FILE:-$ROOT_DIR/environment.browser-test.yml}"
CONDA_ENV_PATH="${HM_CLSS_BROWSER_ENV:-$ROOT_DIR/.conda/browser-test}"
CONDA_SOLVER="${HM_CLSS_CONDA_SOLVER:-classic}"

if ! command -v conda >/dev/null 2>&1; then
  printf 'conda is required for setup-browser-test.sh\n' >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Browser test environment file not found: %s\n' "$ENV_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$CONDA_ENV_PATH")"

if [[ -d "$CONDA_ENV_PATH/conda-meta" ]]; then
  printf 'Updating browser test environment at %s using solver=%s\n' "$CONDA_ENV_PATH" "$CONDA_SOLVER"
  conda --no-plugins env update \
    --prune \
    --solver "$CONDA_SOLVER" \
    --prefix "$CONDA_ENV_PATH" \
    --file "$ENV_FILE"
else
  printf 'Creating browser test environment at %s using solver=%s\n' "$CONDA_ENV_PATH" "$CONDA_SOLVER"
  conda --no-plugins env create \
    -y \
    --solver "$CONDA_SOLVER" \
    --prefix "$CONDA_ENV_PATH" \
    --file "$ENV_FILE"
fi

printf '\nVerifying browser test environment...\n'
conda run --no-capture-output -p "$CONDA_ENV_PATH" python --version
conda run --no-capture-output -p "$CONDA_ENV_PATH" python -c "import selenium; print('Selenium', selenium.__version__)"
conda run --no-capture-output -p "$CONDA_ENV_PATH" firefox --version
conda run --no-capture-output -p "$CONDA_ENV_PATH" geckodriver --version

printf '\nBrowser test environment is ready.\n'
printf 'Next step: bash scripts/browser-smoke.sh\n'
