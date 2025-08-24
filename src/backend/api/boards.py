"""Board and column API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..models import (
    Board,
    BoardColumn,
    BoardCreate,
    BoardResponse,
    ColumnCreate,
    ColumnResponse,
    Ticket,
)
from .websocket import manager

router = APIRouter()


@router.get("/", response_model=list[BoardResponse])
async def get_boards(session: Session = Depends(get_session)) -> list[Board]:
    """Get all boards."""
    boards = session.exec(select(Board)).all()
    return boards


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(board_id: int, session: Session = Depends(get_session)) -> Board:
    """Get a specific board by ID."""
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Board with id {board_id} not found"
        )
    return board


@router.post("/", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
async def create_board(board_data: BoardCreate, session: Session = Depends(get_session)) -> Board:
    """Create a new board with default columns."""
    # Create board
    board = Board(name=board_data.name, description=board_data.description)
    session.add(board)
    session.flush()  # Get the board ID

    # Create columns
    for position, column_name in enumerate(board_data.column_names):
        column = BoardColumn(board_id=board.id, name=column_name, position=position)
        session.add(column)

    session.commit()
    session.refresh(board)

    # Broadcast update
    await manager.broadcast(
        {
            "type": "board_created",
            "board_id": board.id,
            "data": BoardResponse.model_validate(board).model_dump(),
        }
    )

    return board


@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: int,
    name: str | None = None,
    description: str | None = None,
    session: Session = Depends(get_session),
) -> Board:
    """Update a board."""
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Board with id {board_id} not found"
        )

    if name is not None:
        board.name = name
    if description is not None:
        board.description = description

    session.add(board)
    session.commit()
    session.refresh(board)

    # Broadcast update
    await manager.broadcast(
        {
            "type": "board_updated",
            "board_id": board.id,
            "data": BoardResponse.model_validate(board).model_dump(),
        }
    )

    return board


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(board_id: int, session: Session = Depends(get_session)) -> None:
    """Delete a board and all its contents."""
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Board with id {board_id} not found"
        )

    session.delete(board)
    session.commit()

    # Broadcast update
    await manager.broadcast({"type": "board_deleted", "board_id": board_id})


# Column endpoints
@router.get("/{board_id}/columns", response_model=list[ColumnResponse])
async def get_columns(board_id: int, session: Session = Depends(get_session)) -> list[BoardColumn]:
    """Get all columns for a board."""
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Board with id {board_id} not found"
        )

    columns = session.exec(
        select(BoardColumn).where(BoardColumn.board_id == board_id).order_by(BoardColumn.position)
    ).all()

    return columns


@router.post(
    "/{board_id}/columns", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED
)
async def create_column(
    board_id: int, column_data: ColumnCreate, session: Session = Depends(get_session)
) -> BoardColumn:
    """Create a new column in a board."""
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Board with id {board_id} not found"
        )

    # Determine position
    if column_data.position is None:
        max_position = session.exec(
            select(BoardColumn.position)
            .where(BoardColumn.board_id == board_id)
            .order_by(BoardColumn.position.desc())
        ).first()
        position = (max_position + 1) if max_position is not None else 0
    else:
        position = column_data.position

    column = BoardColumn(board_id=board_id, name=column_data.name, position=position)
    session.add(column)
    session.commit()
    session.refresh(column)

    # Broadcast update
    await manager.broadcast(
        {
            "type": "column_created",
            "board_id": board_id,
            "data": ColumnResponse.model_validate(column).model_dump(),
        }
    )

    return column


@router.put("/{board_id}/columns/{column_id}", response_model=ColumnResponse)
async def update_column(
    board_id: int,
    column_id: int,
    name: str | None = None,
    position: int | None = None,
    session: Session = Depends(get_session),
) -> BoardColumn:
    """Update a column."""
    column = session.get(BoardColumn, column_id)
    if not column or column.board_id != board_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Column with id {column_id} not found in board {board_id}",
        )

    if name is not None:
        column.name = name
    if position is not None:
        column.position = position

    session.add(column)
    session.commit()
    session.refresh(column)

    # Broadcast update
    await manager.broadcast(
        {
            "type": "column_updated",
            "board_id": board_id,
            "column_id": column_id,
            "data": ColumnResponse.model_validate(column).model_dump(),
        }
    )

    return column


@router.delete("/{board_id}/columns/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    board_id: int, column_id: int, session: Session = Depends(get_session)
) -> None:
    """Delete a column."""
    column = session.get(BoardColumn, column_id)
    if not column or column.board_id != board_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Column with id {column_id} not found in board {board_id}",
        )

    # Check if column has tickets
    tickets_count = session.exec(select(Ticket).where(Ticket.column_id == column_id)).first()

    if tickets_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete column with tickets. Move or delete tickets first.",
        )

    session.delete(column)
    session.commit()

    # Broadcast update
    await manager.broadcast(
        {"type": "column_deleted", "board_id": board_id, "column_id": column_id}
    )
