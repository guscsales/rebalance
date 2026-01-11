import React, { useState } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import Spinner from "ink-spinner";
import boxen from "boxen";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllPrices } from "../utils/fetchPrices.js";
import { loadConfig } from "../utils/loadConfig.js";
import { Asset, Currency } from "../models.js";
import CurrencyInput from "./CurrencyInput.js";
// @ts-ignore - importing JSON
import packageJson from "../../package.json";

const APP_VERSION = packageJson.version;

const CURRENCY_LABELS: Record<Currency, string> = {
	brl: "BRL (Brazilian Real)",
	// TODO: add USD in the future
};

interface CalculatedAsset extends Asset {
	price: number;
	currentValue: number;
	weight: number;
	target: number;
	diff: number;
	diffQty: number;
}

interface AppProps {
	initialValue?: string;
}

export default function App({ initialValue }: AppProps) {
	const { exit } = useApp();
	const { isRawModeSupported } = useStdin();
	const queryClient = useQueryClient();
	const [portfolioValue, setPortfolioValue] = useState(initialValue || "");
	const [shouldFetch, setShouldFetch] = useState(!!initialValue);

	// React Query for loading config (loads immediately, reloads on refresh)
	const configQuery = useQuery({
		queryKey: ["config"],
		queryFn: loadConfig,
		staleTime: 0, // Always refetch when invalidated
	});

	// React Query for fetching prices (depends on config)
	const pricesQuery = useQuery({
		queryKey: ["prices", configQuery.data?.assets.map((a) => a.ticker)],
		queryFn: () =>
			fetchAllPrices(configQuery.data?.assets.map((a) => a.ticker) || []),
		enabled: shouldFetch && !!configQuery.data,
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: 2,
	});

	useInput(
		(input, key) => {
			if (key.escape || (key.ctrl && input === "c")) {
				exit();
			}
			// Press 'r' to refresh config and prices
			if (input === "r" && pricesQuery.data) {
				// Invalidate both queries to force refetch
				queryClient.invalidateQueries({ queryKey: ["config"] });
				queryClient.invalidateQueries({ queryKey: ["prices"] });
			}
		},
		{ isActive: isRawModeSupported }
	);

	// Parse Brazilian number format (123.456,78 → 123456.78)
	const parseNumber = (value: string): number => {
		const cleaned = value.replace(/\./g, "").replace(",", ".");
		return parseFloat(cleaned) || 0;
	};

	const handleSubmit = (value: string) => {
		const numValue = parseNumber(value);
		if (isNaN(numValue) || numValue <= 0) {
			return;
		}
		setPortfolioValue(value);
		setShouldFetch(true);
	};

	const config = configQuery.data;
	const totalValue = parseNumber(portfolioValue);
	const assets = config?.assets || [];
	const totalPriority = assets.reduce((sum, a) => sum + a.priority, 0);
	const prices = pricesQuery.data || {};

	const calculatedAssets: CalculatedAsset[] = assets.map((asset) => {
		const price = prices[asset.ticker] || 0;
		const currentValue = asset.quantity * price;
		const weight = totalPriority > 0 ? asset.priority / totalPriority : 0;
		const target = weight * totalValue;
		let diff = target - currentValue;

		// No-sell mode: clamp negative differences to 0
		if (!config?.allowSell && diff < 0) {
			diff = 0;
		}

		const diffQty = price > 0 ? Math.floor(diff / price) : 0;

		return { ...asset, price, currentValue, weight, target, diff, diffQty };
	});

	const totalCurrent = calculatedAssets.reduce(
		(sum, a) => sum + a.currentValue,
		0
	);
	const totalToBuy = calculatedAssets.reduce((sum, a) => sum + a.diff, 0);

	function appInfoBox() {
		const allowSellStatus = config?.allowSell
			? "✅ Enabled - Will show sell recommendations"
			: "🚫 Disabled - Only shows buy recommendations";

		const currencyLabel = config?.currency
			? CURRENCY_LABELS[config.currency]
			: "Loading...";

		const appInfoBox = boxen(
			[
				"💰 Portfolio Rebalancer",
				`   v${APP_VERSION}`,
				"",
				`⚙️  Allow Sell: ${allowSellStatus}`,
				`💵 Currency: ${currencyLabel}`,
				`📊 Assets: ${config?.assets.length || 0} configured`,
			].join("\n"),
			{
				padding: 1,
				margin: { top: 0, bottom: 1, left: 0, right: 0 },
				borderStyle: "round",
				borderColor: "cyan",
				titleAlignment: "center",
			}
		);

		// Loading config state
		if (configQuery.isLoading) {
			return (
				<Box flexDirection="column" padding={1}>
					<Box>
						<Text color="cyan">
							<Spinner type="dots" />
						</Text>
						<Text> Loading configuration...</Text>
					</Box>
				</Box>
			);
		}

		return (
			<Box flexDirection="column" padding={1}>
				<Text>{appInfoBox}</Text>

				<Box>
					<Text bold>Enter your total portfolio value: </Text>
					<CurrencyInput
						value={portfolioValue}
						onChange={setPortfolioValue}
						onSubmit={handleSubmit}
						currency={config?.currency || "brl"}
						placeholder="0,00"
					/>
				</Box>

				<Box marginTop={1}>
					<Text dimColor>
						Type numbers • Press Enter to continue • Esc to exit
					</Text>
				</Box>
			</Box>
		);
	}

	// Input state (before fetching)
	if (!shouldFetch) {
		return appInfoBox();
	}

	// Loading state
	if (
		configQuery.isLoading ||
		configQuery.isFetching ||
		pricesQuery.isLoading ||
		pricesQuery.isFetching
	) {
		const isRefreshing =
			(configQuery.isFetching && !configQuery.isLoading) ||
			(pricesQuery.isFetching && !pricesQuery.isLoading);

		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text>
						{" "}
						{isRefreshing
							? "Refreshing config & prices..."
							: "Loading config & fetching prices..."}
					</Text>
				</Box>

				<Box>
					<Text dimColor>
						{configQuery.isFetching
							? "Loading config..."
							: `Fetching ${assets.length} assets...`}
					</Text>
				</Box>
			</Box>
		);
	}

	// Error state
	if (configQuery.isError || pricesQuery.isError) {
		const error = configQuery.error || pricesQuery.error;
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text color="red">
						❌ {configQuery.isError ? "Failed to load config" : "Failed to fetch prices"}
					</Text>
				</Box>
				<Box>
					<Text dimColor>{String(error)}</Text>
				</Box>
				<Box marginTop={1}>
					<Text>Press </Text>
					<Text color="cyan" bold>
						r
					</Text>
					<Text> to retry • </Text>
					<Text color="yellow">Esc</Text>
					<Text> to exit</Text>
				</Box>
			</Box>
		);
	}

	// Build table header
	const header =
		"Ticker   | Qty   | Price R$  | Priority | Target % | Target R$   | Current R$  | Diff R$     | Diff Qty";
	const separator =
		"---------|-------|-----------|----------|----------|-------------|-------------|-------------|----------";

	// Results state
	const summaryBox = boxen(
		[
			`💰 Current Portfolio:  R$ ${totalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
			`🎯 Target Portfolio:   R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
			`📊 Total to Invest:    R$ ${totalToBuy.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
		].join("\n"),
		{
			padding: 1,
			margin: { top: 1, bottom: 1, left: 0, right: 0 },
			borderStyle: "round",
			borderColor: "cyan",
			title: "📈 Summary",
			titleAlignment: "center",
		}
	);

	return (
		<>
		{appInfoBox()}
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text bold color="cyan">
						💰 Portfolio Rebalancer
					</Text>
					<Text dimColor> • Press </Text>
					<Text color="cyan">r</Text>
					<Text dimColor> to refresh (config + prices) • </Text>
					<Text color="yellow">Esc</Text>
					<Text dimColor> to exit</Text>
				</Box>

				{/* Table */}
				<Box flexDirection="column">
					<Text bold>{header}</Text>
					<Text dimColor>{separator}</Text>

					{calculatedAssets.map((asset) => {
						const row = `${asset.ticker.padEnd(8)} | ${String(asset.quantity).padStart(5)} | R$ ${asset.price.toFixed(2).padStart(7)} | ${String(asset.priority).padEnd(8)} | ${(asset.weight * 100).toFixed(1).padStart(7)}% | R$ ${asset.target.toFixed(2).padStart(9)} | R$ ${asset.currentValue.toFixed(2).padStart(9)} | `;

						const diffColor = asset.diff > 0 ? "green" : "yellow";

						return (
							<Box key={asset.ticker}>
								<Text>{row}</Text>
								<Text color={diffColor}>
									R$ {asset.diff.toFixed(2).padStart(9)}
								</Text>
								<Text> | </Text>
								<Text color={diffColor} bold={asset.diffQty > 0}>
									{String(asset.diffQty).padStart(8)}
								</Text>
							</Box>
						);
					})}
				</Box>

				{/* Summary Box */}
				<Text>{summaryBox}</Text>

				<Box>
					<Text dimColor>📈 Prices from Yahoo Finance • </Text>
					<Text dimColor italic>
						{new Date().toLocaleString("pt-BR")}
					</Text>
					<Text dimColor> • {assets.length} assets</Text>
				</Box>
			</Box>
		</>
	);
}
