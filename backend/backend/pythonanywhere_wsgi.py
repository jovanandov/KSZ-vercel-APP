import os
import sys

# Pot do virtualnega okolja
path = '/home/Jovanandov/.virtualenvs/kontrolni-seznam-venv/lib/python3.12/site-packages'
if path not in sys.path:
    sys.path.append(path)

# Pot do Django aplikacije
path = '/home/Jovanandov/KszWebApp/backend'
if path not in sys.path:
    sys.path.append(path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application() 