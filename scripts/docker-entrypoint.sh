#!/bin/sh
set -eu

# Explicit commands (for example an updater invocation) must not be replaced by npm start.
if [ "${1:-}" = "npm" ] && [ "${2:-}" = "start" ]; then
  if [ "${IPDB_AUTO_INSTALL:-1}" = "1" ] && [ ! -e data/db/current/manifest.json ]; then
    python scripts/ipdb.py install --repo "${IPDB_REPO:-lucking7/leveling.zone}" --store data/db
  fi
  if [ "${IPDB_AUTO_INSTALL:-1}" = "1" ]; then
    python scripts/ipdb.py verify --directory data/db/current
  fi
fi
exec "$@"
