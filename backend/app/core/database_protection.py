"""
Database Protection Module
Prevents accidental data loss by intercepting dangerous operations.
"""

import logging
from functools import wraps
from typing import Any, Callable

from sqlmodel import SQLModel

logger = logging.getLogger(__name__)


class ProtectedDatabase:
    """Singleton to manage database protection state."""

    _instance = None
    _protected = True

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_protected(self) -> bool:
        return self._protected

    def enable_protection(self):
        """Enable database protection."""
        self._protected = True
        logger.warning("🔒 Database protection ENABLED")

    def disable_protection(self):
        """Disable database protection (use with extreme caution!)."""
        logger.warning("⚠️ WARNING: Database protection DISABLED - Be very careful!")
        self._protected = False


def prevent_dangerous_operation(operation_name: str):
    """Decorator to prevent dangerous database operations."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            protection = ProtectedDatabase()

            if protection.is_protected:
                # Check if this is a test database
                if args and hasattr(args[0], "url"):
                    db_url = str(args[0].url)
                    if ":memory:" in db_url or "test" in db_url.lower():
                        # Allow operation on test databases
                        return func(*args, **kwargs)

                # Block operation on production database
                error_msg = (
                    f"CRITICAL: Attempted to execute '{operation_name}' on production database!\n"
                    f"This operation has been BLOCKED to prevent data loss.\n"
                    f"If you absolutely need to do this:\n"
                    f"1. Create a backup first\n"
                    f"2. Use ProtectedDatabase().disable_protection()\n"
                    f"3. Execute your operation\n"
                    f"4. Use ProtectedDatabase().enable_protection()"
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            # Protection is disabled, allow operation but log warning
            logger.warning(f"⚠️ DANGEROUS: Executing '{operation_name}' with protection disabled!")
            return func(*args, **kwargs)

        return wrapper

    return decorator


def install_database_protection():
    """Install protection on SQLModel metadata methods."""
    # Store original methods
    if not hasattr(SQLModel.metadata, "_original_drop_all"):
        SQLModel.metadata._original_drop_all = SQLModel.metadata.drop_all

        # Replace with protected version
        @prevent_dangerous_operation("drop_all")
        def protected_drop_all(bind=None, tables=None, checkfirst=True):
            return SQLModel.metadata._original_drop_all(bind, tables, checkfirst)

        SQLModel.metadata.drop_all = protected_drop_all
        logger.warning("✅ Database protection installed - drop_all is now protected")

    # Protect other dangerous operations if they exist
    dangerous_methods = ["drop", "clear"]
    for method_name in dangerous_methods:
        if hasattr(SQLModel.metadata, method_name):
            original_method = getattr(SQLModel.metadata, method_name)
            protected_method = prevent_dangerous_operation(method_name)(original_method)
            setattr(SQLModel.metadata, method_name, protected_method)
            logger.warning(f"✅ Protected method: {method_name}")


# Auto-install protection when module is imported
install_database_protection()
