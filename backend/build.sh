#!/usr/bin/env bash
# Render build script — runs on every deploy
set -o errexit

# Use python -m pip to ensure packages install to the correct environment
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

python manage.py collectstatic --noinput
python manage.py migrate
python manage.py createcachetable || true   # safe if table already exists
