import type { AssetType } from "../models";

export interface PriceResult {
	ticker: string;
	price: number;
	type?: AssetType;
	success: boolean;
}

/**
 * Detect asset type from ticker or Yahoo Finance data
 * Brazilian REITs (FIIs) typically end with "11"
 */
function detectAssetType(ticker: string, yahooData?: any): AssetType {
	// Check Yahoo Finance instrument type
	const instrumentType = yahooData?.chart?.result?.[0]?.meta?.instrumentType;

	if (instrumentType === "MUTUALFUND" || instrumentType === "ETF" || ticker.endsWith("11")) {
		return "reit"; // FIIs are often classified as mutual funds
	}

	return "stock";
}

export async function fetchPrice(ticker: string): Promise<PriceResult> {
	const yahooTicker = `${ticker}.SA`;
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		const json = await response.json();
		const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
		const type = detectAssetType(ticker, json);

		return { ticker, price, type, success: price > 0 };
	} catch {
		return { ticker, price: 0, success: false };
	}
}

export interface PriceData {
	prices: Record<string, number>;
	types: Record<string, AssetType>;
}

export async function fetchAllPrices(
	tickers: string[],
	onProgress?: (completed: number, total: number, result: PriceResult) => void
): Promise<PriceData> {
	const prices: Record<string, number> = {};
	const types: Record<string, AssetType> = {};

	const results = await Promise.all(
		tickers.map(async (ticker, index) => {
			const result = await fetchPrice(ticker);
			onProgress?.(index + 1, tickers.length, result);
			return result;
		})
	);

	for (const { ticker, price, type } of results) {
		prices[ticker] = price;
		if (type) {
			types[ticker] = type;
		}
	}

	return { prices, types };
}
