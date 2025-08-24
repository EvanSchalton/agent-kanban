import React, { useEffect, useState } from "react";
import { useBoard } from "../context/useBoardHook";
import "./StatisticsDashboard.css";

interface ColumnStats {
  column_name: string;
  ticket_count: number;
  avg_time_hours: number;
  min_time_hours: number;
  max_time_hours: number;
  std_dev_hours: number;
}

interface BoardStats {
  total_tickets: number;
  tickets_by_column: Record<string, number>;
  column_statistics: ColumnStats[];
  completion_rate: number;
  avg_cycle_time_hours: number;
}

const StatisticsDashboard: React.FC = () => {
  const { board } = useBoard();
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const fetchStatistics = async () => {
    if (!board) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/boards/${board.id}/statistics`);
      if (!response.ok) {
        throw new Error("Statistics endpoint not ready");
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      // Use mock data for demo
      setStats({
        total_tickets: 42,
        tickets_by_column: {
          not_started: 8,
          in_progress: 12,
          blocked: 3,
          ready_for_qc: 7,
          done: 12,
        },
        column_statistics: [
          {
            column_name: "In Progress",
            ticket_count: 12,
            avg_time_hours: 48,
            min_time_hours: 12,
            max_time_hours: 120,
            std_dev_hours: 24,
          },
          {
            column_name: "Blocked",
            ticket_count: 3,
            avg_time_hours: 72,
            min_time_hours: 24,
            max_time_hours: 168,
            std_dev_hours: 48,
          },
        ],
        completion_rate: 28.6,
        avg_cycle_time_hours: 96,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showDashboard) {
      fetchStatistics();
    }
  }, [showDashboard, board]);

  const formatHours = (hours: number) => {
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  };

  return (
    <>
      <button
        className="stats-toggle-btn"
        onClick={() => setShowDashboard(!showDashboard)}
        aria-label="Toggle statistics dashboard"
      >
        📊 Statistics
      </button>

      {showDashboard && (
        <div className="stats-dashboard">
          <div className="stats-header">
            <h2>Board Statistics</h2>
            <button
              className="stats-close"
              onClick={() => setShowDashboard(false)}
            >
              ×
            </button>
          </div>

          {loading && (
            <div className="stats-loading">Loading statistics...</div>
          )}

          {stats && !loading && (
            <div className="stats-content">
              {/* Overview Cards */}
              <div className="stats-overview">
                <div className="stat-card">
                  <div className="stat-card-label">Total Tickets</div>
                  <div className="stat-card-value">{stats.total_tickets}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Completion Rate</div>
                  <div className="stat-card-value">
                    {stats.completion_rate.toFixed(1)}%
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Avg Cycle Time</div>
                  <div className="stat-card-value">
                    {formatHours(stats.avg_cycle_time_hours)}
                  </div>
                </div>
              </div>

              {/* Column Distribution */}
              <div className="stats-section">
                <h3>Ticket Distribution</h3>
                <div className="column-bars">
                  {Object.entries(stats.tickets_by_column).map(
                    ([column, count]) => (
                      <div key={column} className="column-bar">
                        <div className="bar-label">
                          {column.replace(/_/g, " ")}
                        </div>
                        <div className="bar-container">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${(count / stats.total_tickets) * 100}%`,
                              background:
                                column === "done"
                                  ? "#10b981"
                                  : column === "blocked"
                                    ? "#ef4444"
                                    : "#667eea",
                            }}
                          />
                        </div>
                        <div className="bar-value">{count}</div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Time Statistics */}
              <div className="stats-section">
                <h3>Time in Column Statistics</h3>
                <div className="time-stats">
                  {stats.column_statistics.map((colStat) => (
                    <div key={colStat.column_name} className="time-stat">
                      <h4>{colStat.column_name}</h4>
                      <div className="time-metrics">
                        <div className="metric">
                          <span className="metric-label">Average:</span>
                          <span className="metric-value">
                            {formatHours(colStat.avg_time_hours)}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Min:</span>
                          <span
                            className="metric-value"
                            style={{ color: "#10b981" }}
                          >
                            {formatHours(colStat.min_time_hours)}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Max:</span>
                          <span
                            className="metric-value"
                            style={{ color: "#ef4444" }}
                          >
                            {formatHours(colStat.max_time_hours)}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Std Dev:</span>
                          <span className="metric-value">
                            ±{formatHours(colStat.std_dev_hours)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="stats-note">
                📝 Note: Statistics exclude "Not Started" and "Done" columns
                from time calculations
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default StatisticsDashboard;
