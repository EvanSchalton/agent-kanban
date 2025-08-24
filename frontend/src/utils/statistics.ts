import type { Ticket } from "../types";

export interface ColumnStatistics {
  mean: number;
  stdDev: number;
}

export function calculateColumnStatistics(
  tickets: Ticket[],
  columnId: string,
  excludeColumns: string[] = [],
): ColumnStatistics {
  if (excludeColumns.includes(columnId)) {
    return { mean: 0, stdDev: 0 };
  }

  const columnTickets = tickets.filter(
    (t) => t.column_id === columnId && t.time_in_column !== undefined,
  );

  if (columnTickets.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const times = columnTickets.map((t) => t.time_in_column || 0);

  const mean = times.reduce((sum, time) => sum + time, 0) / times.length;

  const squaredDiffs = times.map((time) => Math.pow(time - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((sum, diff) => sum + diff, 0) / times.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return { mean, stdDev };
}

export function getTicketColorClass(
  timeInColumn: number,
  stats: ColumnStatistics,
  isExcludedColumn: boolean = false,
  ticket?: { priority: string; created_at: string; column_id: string },
  tickets: Array<{
    priority: string;
    created_at: string;
    column_id: string;
    time_in_column?: number;
  }> = [],
): string {
  if (isExcludedColumn) {
    return "statistical-gray";
  }

  // Convert timeInColumn from milliseconds to hours for spec compliance
  const timeInColumnHours = timeInColumn / (1000 * 60 * 60);
  const meanHours = stats.mean / (1000 * 60 * 60);
  const stdDevHours = stats.stdDev / (1000 * 60 * 60);

  // Gray - Insufficient Data: < 1 hour OR < 10 sample size
  if (timeInColumnHours < 1) {
    return "statistical-gray";
  }

  const allColumnTickets = tickets.filter(
    (t) => t.column_id === ticket?.column_id,
  );
  if (allColumnTickets.length < 10) {
    return "statistical-gray";
  }

  // Calculate thresholds per spec
  const greenThreshold = meanHours - 0.5 * stdDevHours;
  const redThreshold = meanHours + 1.0 * stdDevHours;

  // Apply coloring logic per spec
  if (timeInColumnHours < greenThreshold) {
    return "statistical-green"; // Fast (performing better)
  } else if (timeInColumnHours > redThreshold) {
    return "statistical-red"; // Slow (needs attention)
  } else {
    return "statistical-yellow"; // Normal (average performance)
  }
}

export function getTicketTooltip(
  timeInColumn: number,
  stats: ColumnStatistics,
  isExcludedColumn: boolean = false,
  ticket?: { priority: string; created_at: string },
): string {
  if (isExcludedColumn) {
    return "Statistical analysis not available for this column";
  }

  if (stats.stdDev === 0) {
    return "Not enough data for statistical analysis";
  }

  const deviations = Math.abs(timeInColumn - stats.mean) / stats.stdDev;
  const timeDisplay = formatTimeInColumn(timeInColumn);
  const meanDisplay = formatTimeInColumn(stats.mean);

  let status = "";
  if (deviations <= 1) {
    status = "Normal processing time";
  } else if (deviations <= 2) {
    status = "Taking longer than usual";
  } else {
    status = "Significantly delayed";
  }

  let tooltip = `${status}: ${timeDisplay} in column (avg: ${meanDisplay})`;

  if (ticket) {
    const ticketAge = Date.now() - new Date(ticket.created_at).getTime();
    const ageDays = Math.floor(ticketAge / (1000 * 60 * 60 * 24));
    if (ageDays > 0) {
      tooltip += `\nTicket age: ${ageDays} day${ageDays > 1 ? "s" : ""}`;
    }
    tooltip += `\nPriority: ${ticket.priority}`;
  }

  return tooltip;
}

export function formatTimeInColumn(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}
