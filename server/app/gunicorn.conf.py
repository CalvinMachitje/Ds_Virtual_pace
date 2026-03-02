# Gunicorn configuration for Flask-SocketIO app
# server/app/gunicorn.conf.py
bind = "0.0.0.0:5000"
workers = 4
worker_class = "eventlet"  # required for Flask-SocketIO scaling
timeout = 60
graceful_timeout = 30
keepalive = 5
loglevel = "info"
accesslog = "-"
errorlog = "-"