from enum import Enum
from typing import List, Optional

from sqlalchemy import JSON
from sqlmodel import Column, Field, SQLModel


class Permission(str, Enum):
    CREATE_BOARD = "create_board"
    DELETE_BOARD = "delete_board"
    UPDATE_BOARD = "update_board"
    VIEW_BOARD = "view_board"

    CREATE_TICKET = "create_ticket"
    DELETE_TICKET = "delete_ticket"
    UPDATE_TICKET = "update_ticket"
    UPDATE_OWN_TICKET = "update_own_ticket"
    VIEW_TICKET = "view_ticket"

    CREATE_COMMENT = "create_comment"
    DELETE_COMMENT = "delete_comment"
    UPDATE_COMMENT = "update_comment"
    VIEW_COMMENT = "view_comment"

    MANAGE_USERS = "manage_users"
    VIEW_ANALYTICS = "view_analytics"


class Role(SQLModel, table=True):
    __tablename__ = "roles"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, nullable=False)
    description: Optional[str] = Field(default=None)
    permissions: List[str] = Field(default=[], sa_column=Column(JSON))

    class Config:
        json_schema_extra = {
            "example": {
                "name": "admin",
                "description": "Administrator role with full access",
                "permissions": ["create_board", "delete_board", "create_ticket", "manage_users"],
            }
        }


def get_role_permissions(role_name: str) -> List[Permission]:
    """Return the list of permissions for a given role"""
    role_permissions = {
        "admin": [
            Permission.CREATE_BOARD,
            Permission.DELETE_BOARD,
            Permission.UPDATE_BOARD,
            Permission.VIEW_BOARD,
            Permission.CREATE_TICKET,
            Permission.DELETE_TICKET,
            Permission.UPDATE_TICKET,
            Permission.VIEW_TICKET,
            Permission.CREATE_COMMENT,
            Permission.DELETE_COMMENT,
            Permission.UPDATE_COMMENT,
            Permission.VIEW_COMMENT,
            Permission.MANAGE_USERS,
            Permission.VIEW_ANALYTICS,
        ],
        "pm": [
            Permission.CREATE_BOARD,
            Permission.DELETE_BOARD,
            Permission.UPDATE_BOARD,
            Permission.VIEW_BOARD,
            Permission.CREATE_TICKET,
            Permission.DELETE_TICKET,
            Permission.UPDATE_TICKET,
            Permission.VIEW_TICKET,
            Permission.CREATE_COMMENT,
            Permission.DELETE_COMMENT,
            Permission.UPDATE_COMMENT,
            Permission.VIEW_COMMENT,
            Permission.VIEW_ANALYTICS,
        ],
        "agent": [
            Permission.VIEW_BOARD,
            Permission.CREATE_TICKET,
            Permission.UPDATE_OWN_TICKET,
            Permission.VIEW_TICKET,
            Permission.CREATE_COMMENT,
            Permission.UPDATE_COMMENT,
            Permission.VIEW_COMMENT,
        ],
        "viewer": [Permission.VIEW_BOARD, Permission.VIEW_TICKET, Permission.VIEW_COMMENT],
    }

    return role_permissions.get(role_name.lower(), [])
