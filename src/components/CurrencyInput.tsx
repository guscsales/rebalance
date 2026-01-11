import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { Currency } from "../models.js";

interface CurrencyInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (value: string) => void;
	currency: Currency;
	placeholder?: string;
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
	brl: "R$",
	// TODO: add USD in the future
	// usd: "$",
};

// Format number as Brazilian currency (123456.78 → 123.456,78)
function formatCurrency(cents: number): string {
	if (cents === 0) return "";

	const value = cents / 100;
	const [intPart, decPart = "00"] = value.toFixed(2).split(".");

	// Add thousands separator (dot for BRL)
	const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

	return `${formattedInt},${decPart}`;
}

// Parse formatted string back to cents
function parseToCents(formatted: string): number {
	if (!formatted) return 0;
	// Remove dots (thousands) and replace comma with dot (decimal)
	const cleaned = formatted.replace(/\./g, "").replace(",", ".");
	return Math.round(parseFloat(cleaned) * 100) || 0;
}

export default function CurrencyInput({
	value,
	onChange,
	onSubmit,
	currency,
	placeholder = "0,00",
}: CurrencyInputProps) {
	// Store value as cents internally for easier manipulation
	const [cents, setCents] = useState(() => parseToCents(value));

	const handleInput = useCallback(
		(input: string, key: { return?: boolean; backspace?: boolean; delete?: boolean }) => {
			if (key.return) {
				const formatted = formatCurrency(cents);
				onChange(formatted);
				onSubmit(formatted);
				return;
			}

			if (key.backspace || key.delete) {
				// Remove last digit
				const newCents = Math.floor(cents / 10);
				setCents(newCents);
				onChange(formatCurrency(newCents));
				return;
			}

			// Only accept digits
			if (/^\d$/.test(input)) {
				// Shift existing value left and add new digit
				const newCents = cents * 10 + parseInt(input, 10);
				// Limit to reasonable max (999,999,999.99)
				if (newCents <= 99999999999) {
					setCents(newCents);
					onChange(formatCurrency(newCents));
				}
			}
		},
		[cents, onChange, onSubmit]
	);

	useInput(handleInput);

	const displayValue = formatCurrency(cents);
	const symbol = CURRENCY_SYMBOLS[currency];

	return (
		<Box>
			<Text color="green">{symbol} </Text>
			<Text color={displayValue ? "white" : "gray"}>
				{displayValue || placeholder}
			</Text>
			<Text color="cyan">▋</Text>
		</Box>
	);
}

