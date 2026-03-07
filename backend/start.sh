#!/usr/bin/env bash
# Start both gunicorn (web server) and Django-Q qcluster (background worker)
# in a single Render service.

# Start qcluster in the background
python manage.py qcluster &

# Start gunicorn in the foreground
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
