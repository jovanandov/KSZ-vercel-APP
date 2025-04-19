import os
import sys

# Pot do vašega virtualnega okolja
path = '/home/Jovanandov/.virtualenvs/kontrolni-seznam-venv'
if path not in sys.path:
    sys.path.append(path)

# Pot do vašega Django projekta
project_path = '/home/Jovanandov/KszWebApp/backend'
if project_path not in sys.path:
    sys.path.append(project_path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
os.environ['DJANGO_DEBUG'] = 'False'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application() 