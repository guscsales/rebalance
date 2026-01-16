import React from "react";
import { Box, Text } from "ink";

interface Column {
	key: string;
	label: string;
	width?: number;
	align?: "left" | "right" | "center";
}

interface TableProps<T extends Record<string, any>> {
	data: T[];
	columns: Column[];
}

export default function Table<T extends Record<string, any>>({
	data,
	columns,
}: TableProps<T>) {
	if (data.length === 0) {
		return <Text>No data</Text>;
	}

	// Calculate column widths if not specified
	const columnWidths = columns.map((col) => {
		if (col.width) return col.width;
		
		// Calculate max width from header and all data
		const headerWidth = col.label.length;
		const maxDataWidth = Math.max(
			...data.map((row) => String(row[col.key] || "").length)
		);
		return Math.max(headerWidth, maxDataWidth, 8); // Minimum width of 8
	});

	// Format cell content
	const formatCell = (value: any, width: number, align: "left" | "right" | "center" = "left"): string => {
		const str = String(value || "");
		if (align === "right") {
			return str.padStart(width);
		} else if (align === "center") {
			return str.padStart(Math.floor((width + str.length) / 2)).padEnd(width);
		}
		return str.padEnd(width);
	};

	// Build separator line
	const separator = columns
		.map((_, i) => "-".repeat(columnWidths[i]))
		.join("-+-");

	// Build header
	const header = columns
		.map((col, i) => formatCell(col.label, columnWidths[i], col.align || "left"))
		.join(" | ");

	return (
		<Box flexDirection="column">
			{/* Header */}
			<Text bold>{header}</Text>
			<Text dimColor>{separator}</Text>

			{/* Rows */}
			{data.map((row, rowIndex) => {
				// Check if this row has trade data for coloring
				const tradeAmount = (row as any)._tradeAmount;
				const tradeColor = tradeAmount > 0 ? "green" : tradeAmount < 0 ? "yellow" : undefined;
				const isTradeRow = tradeAmount !== undefined && tradeAmount !== 0;

				// Build row as individual cells for proper color support
				const cells = columns.map((col, colIndex) => {
					const cellValue = formatCell(row[col.key], columnWidths[colIndex], col.align || "left");
					const isTradeColumn = col.key === "tradeAmount" || col.key === "tradeQty";
					const shouldColor = isTradeColumn && tradeColor;

					return (
						<React.Fragment key={col.key}>
							{colIndex > 0 && <Text> | </Text>}
							<Text color={shouldColor ? tradeColor : undefined} bold={shouldColor && isTradeRow}>
								{cellValue}
							</Text>
						</React.Fragment>
					);
				});

				return (
					<Box key={rowIndex} flexDirection="row">
						{cells}
					</Box>
				);
			})}
		</Box>
	);
}
