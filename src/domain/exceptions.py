class ContaProException(Exception): pass
class TenantRequiredException(ContaProException): pass
class PeriodLockedException(ContaProException): pass
class UnbalancedEntryException(ContaProException): pass
class LedgerIntegrityException(ContaProException): pass
class UnauthorizedException(ContaProException): pass
class ForbiddenException(ContaProException): pass
class SunatCircuitOpenException(ContaProException): pass


class ExpertValidationException(ContaProException):
	def __init__(self, message: str, checks: list[dict] | None = None):
		super().__init__(message)
		self.checks = checks or []
