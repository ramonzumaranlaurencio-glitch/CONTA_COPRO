from celery import Celery
from src.config import settings

celery_app = Celery("contapro", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_routes = {
    "src.infrastructure.workers.tasks.process_sunat_outbox": {"queue": "sunat"},
    "src.infrastructure.workers.tasks.process_integration_outbox": {"queue": "integrations"},
    "src.infrastructure.workers.tasks.run_pre_closure_audit": {"queue": "ai"},
}
