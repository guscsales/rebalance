import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import boxen from "boxen";
import { useQuery } from "@tanstack/react-query";
import { fetchAllPrices } from "../utils/fetchPrices";
import { loadConfig } from "../utils/loadConfig";
import { Currency } from "../models";
import { calculateRebalance, calculateTargetWeights } from "../services/rebalance";
import type { RebalanceInput } from "../domain/types";
import Table from "./Table";
// @ts-ignore - importing JSON
import packageJson from "../../package.json";

const APP_VERSION = packageJson.version;

const CURRENCY_LABELS: Record<Currency, string> = {
	brl: "BRL (Brazilian Real)",
	// TODO: add USD in the future
};

interface AppProps {
	initialValue?: string;
}

export default function App({ initialValue }: AppProps) {
	const [portfolioValue, setPortfolioValue] = useState("");
	const [balance, setBalance] = useState("");
	const [shouldFetch, setShouldFetch] = useState(false);
	const [configInitialized, setConfigInitialized] = useState(false);

	// React Query for loading config
	const configQuery = useQuery({
		queryKey: ["config"],
		queryFn: loadConfig,
		staleTime: 0,
	});

	// React Query for fetching prices
	const pricesQuery = useQuery({
		queryKey: ["prices", configQuery.data?.assets.map((a) => a.ticker)],
		queryFn: () =>
			fetchAllPrices(configQuery.data?.assets.map((a) => a.ticker) || []),
		enabled: shouldFetch && !!configQuery.data,
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: 2,
	});

	// Format number to Brazilian currency string (123456.78 → "123.456,78")
	const formatCurrency = (value: number): string => {
		if (value === 0) return "0,00";
		const [intPart, decPart = "00"] = value.toFixed(2).split(".");
		const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
		return `${formattedInt},${decPart}`;
	};

	// Auto-set values from config
	useEffect(() => {
		if (configInitialized || !configQuery.data) return;

		const config = configQuery.data;

		if (initialValue) {
			setPortfolioValue(initialValue);
			setBalance(config.balance !== undefined ? formatCurrency(config.balance) : "");
			setShouldFetch(true);
			setConfigInitialized(true);
		} else if (
			config.portfolioValue !== undefined &&
			config.balance !== undefined
		) {
			setPortfolioValue(formatCurrency(config.portfolioValue));
			setBalance(formatCurrency(config.balance));
			setShouldFetch(true);
			setConfigInitialized(true);
		} else if (config.portfolioValue !== undefined) {
			setPortfolioValue(formatCurrency(config.portfolioValue));
			setBalance("0,00");
			setShouldFetch(true);
			setConfigInitialized(true);
		} else {
			setPortfolioValue("0,00");
			setBalance("0,00");
			setShouldFetch(true);
			setConfigInitialized(true);
		}
	}, [configQuery.data, initialValue, configInitialized]);

	const config = configQuery.data;
	const availableBalance = config?.balance ?? 0;
	const assets = config?.assets || [];
	const prices = pricesQuery.data || {};

	// Calculate rebalance plan using the service
	let tradePlan = null;
	if (config && pricesQuery.data && Object.keys(prices).length > 0) {
		const targetWeights = calculateTargetWeights(assets);

		const input: RebalanceInput = {
			assets,
			prices,
			targetWeights,
			availableCash: availableBalance,
			allowSell: config.allowSell ?? false,
		};

		tradePlan = calculateRebalance(input);
	}

	function appInfoBox() {
		const currencyLabel = config?.currency
			? CURRENCY_LABELS[config.currency]
			: "Loading...";

		const allowSellStatus = config?.allowSell
			? "✅ Enabled - Selling allowed for all assets"
			: "🚫 Disabled - Selling locked for all assets";

		const appInfoBox = boxen(
			[
				"💰 Portfolio Rebalancer",
				`   v${APP_VERSION}`,
				"",
				`💵 Currency: ${currencyLabel}`,
				`📊 Assets: ${config?.assets.length || 0} configured`,
				`⚙️  Allow Sell: ${allowSellStatus}`,
			].join("\n"),
			{
				padding: 1,
				margin: { top: 0, bottom: 1, left: 0, right: 0 },
				borderStyle: "round",
				borderColor: "cyan",
				titleAlignment: "center",
			}
		);

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
				<Box marginBottom={1}>
					<Text dimColor>Portfolio Value: </Text>
					<Text color="green">
						{config?.currency === "brl" ? "R$" : "$"} {portfolioValue}
					</Text>
				</Box>
				<Box>
					<Text dimColor>Available Balance: </Text>
					<Text color="green">
						{config?.currency === "brl" ? "R$" : "$"} {balance}
					</Text>
				</Box>
			</Box>
		);
	}

	// Loading state
	if (
		configQuery.isLoading ||
		configQuery.isFetching ||
		pricesQuery.isLoading ||
		pricesQuery.isFetching
	) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text> Loading config & fetching prices...</Text>
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
			</Box>
		);
	}

	// Results state
	if (!tradePlan) {
		return (
			<Box flexDirection="column" padding={1}>
				{appInfoBox()}
				<Box marginTop={1}>
					<Text color="yellow">Waiting for price data...</Text>
				</Box>
			</Box>
		);
	}

	// Calculate total portfolio value after trades
	const totalAfterTrades = tradePlan.totalCurrentValue + tradePlan.totalBuys - tradePlan.totalSells;

	// Prepare table data with formatted values
	const tableData = tradePlan.assets.map((asset) => {
		const quantity = Math.floor(asset.currentValue / asset.price);
		const tradeSign = asset.tradeAmount > 0 ? "+" : "";
		const tradeDisplay = asset.tradeAmount === 0
			? "0,00"
			: `${tradeSign}${asset.tradeAmount.toFixed(2)}`;
		const tradeQtyDisplay = asset.tradeQuantity === 0
			? "0"
			: `${asset.tradeQuantity > 0 ? "+" : ""}${asset.tradeQuantity}`;

		// Calculate allocated percentage after trades
		const valueAfterTrade = asset.currentValue + asset.tradeAmount;
		const allocatedPercent = totalAfterTrades > 0 
			? (valueAfterTrade / totalAfterTrades) * 100 
			: 0;

		return {
			ticker: asset.ticker,
			qty: String(quantity),
			price: asset.price.toFixed(2),
			priority: String(asset.priority),
			targetPercent: `${(asset.targetWeight * 100).toFixed(1)}%`,
			allocatedPercent: `${allocatedPercent.toFixed(1)}%`,
			currentValue: asset.currentValue.toFixed(2),
			tradeAmount: tradeDisplay,
			tradeQty: tradeQtyDisplay,
			_tradeAmount: asset.tradeAmount, // For color logic
		};
	});

	const tableColumns = [
		{ key: "ticker", label: "Ticker", width: 10 },
		{ key: "qty", label: "Qty", width: 6, align: "right" as const },
		{ key: "price", label: "Price R$", width: 10, align: "right" as const },
		{ key: "priority", label: "Priority", width: 8, align: "right" as const },
		{ key: "targetPercent", label: "Target %", width: 9, align: "right" as const },
		{ key: "allocatedPercent", label: "Allocated %", width: 12, align: "right" as const },
		{ key: "currentValue", label: "Current R$", width: 12, align: "right" as const },
		{ key: "tradeAmount", label: "Trade R$", width: 11, align: "right" as const },
		{ key: "tradeQty", label: "Trade Qty", width: 10, align: "right" as const },
	];

	const summaryLines = [
		`💰 Current Portfolio:  R$ ${tradePlan.totalCurrentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
		`💵 Available Cash:     R$ ${availableBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
		`📈 Total Buys:         R$ ${tradePlan.totalBuys.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
		`📉 Total Sells:        R$ ${tradePlan.totalSells.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
		``,
		`💼 Portfolio After:    R$ ${totalAfterTrades.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
	];

	// Validation warnings
	if (tradePlan.totalBuys > tradePlan.buyBudget) {
		summaryLines.push(
			"",
			`⚠️  ERROR: Total buys exceed buy budget!`
		);
	}

	if (tradePlan.totalBuys < tradePlan.buyBudget && tradePlan.totalBuys > 0) {
		const remaining = tradePlan.buyBudget - tradePlan.totalBuys;
		summaryLines.push(
			"",
			`ℹ️  Remaining budget: R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
		);
	}

	const summaryBox = boxen(summaryLines.join("\n"),
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
				</Box>

				{/* Table */}
				<Table data={tableData} columns={tableColumns} />

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
