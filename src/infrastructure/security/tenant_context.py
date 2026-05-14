from contextvars import ContextVar

current_tenant: ContextVar[str | None] = ContextVar("current_tenant", default=None)
current_user: ContextVar[str | None] = ContextVar("current_user", default=None)
current_trace_id: ContextVar[str | None] = ContextVar("current_trace_id", default=None)

def set_request_context(tenant_id: str, user_id: str | None, trace_id: str):
    current_tenant.set(tenant_id)
    current_user.set(user_id)
    current_trace_id.set(trace_id)
