from typing import List, Optional

from fastapi import Depends, HTTPException, status

from app.core.auth import get_current_user
from app.models.role import Permission, get_role_permissions
from app.models.user import User


class PermissionChecker:
    def __init__(self, required_permissions: List[Permission] = None, allow_own: bool = False):
        self.required_permissions = required_permissions or []
        self.allow_own = allow_own

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        # Superusers have all permissions
        if current_user.is_superuser:
            return current_user

        # Get user's role permissions
        user_permissions = get_role_permissions(current_user.role.value)

        # Check if user has required permissions
        for permission in self.required_permissions:
            if permission not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied. Required: {permission.value}",
                )

        return current_user


def check_permission(user: User, permission: Permission) -> bool:
    """Check if a user has a specific permission"""
    if user.is_superuser:
        return True

    user_permissions = get_role_permissions(user.role.value)
    return permission in user_permissions


def check_ticket_permission(
    user: User, permission: Permission, ticket_assignee_id: Optional[int] = None
) -> bool:
    """Check permission for ticket operations, considering ownership"""
    if user.is_superuser:
        return True

    user_permissions = get_role_permissions(user.role.value)

    # Check if user has the general permission
    if permission in user_permissions:
        return True

    # For update operations, check if user can update their own tickets
    if permission == Permission.UPDATE_TICKET and ticket_assignee_id == user.id:
        return Permission.UPDATE_OWN_TICKET in user_permissions

    return False


# Pre-defined permission dependencies for common operations
require_admin = PermissionChecker([Permission.MANAGE_USERS])
require_board_create = PermissionChecker([Permission.CREATE_BOARD])
require_board_delete = PermissionChecker([Permission.DELETE_BOARD])
require_board_update = PermissionChecker([Permission.UPDATE_BOARD])
require_board_view = PermissionChecker([Permission.VIEW_BOARD])

require_ticket_create = PermissionChecker([Permission.CREATE_TICKET])
require_ticket_delete = PermissionChecker([Permission.DELETE_TICKET])
require_ticket_update = PermissionChecker([Permission.UPDATE_TICKET], allow_own=True)
require_ticket_view = PermissionChecker([Permission.VIEW_TICKET])

require_comment_create = PermissionChecker([Permission.CREATE_COMMENT])
require_comment_delete = PermissionChecker([Permission.DELETE_COMMENT])
require_comment_update = PermissionChecker([Permission.UPDATE_COMMENT])
require_comment_view = PermissionChecker([Permission.VIEW_COMMENT])

require_analytics = PermissionChecker([Permission.VIEW_ANALYTICS])
