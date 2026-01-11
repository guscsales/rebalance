export interface PriceResult {
	ticker: string;
	price: number;
	success: boolean;
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

		return { ticker, price, success: price > 0 };
	} catch {
		return { ticker, price: 0, success: false };
	}
}

export async function fetchAllPrices(
	tickers: string[],
	onProgress?: (completed: number, total: number, result: PriceResult) => void
): Promise<Record<string, number>> {
	const prices: Record<string, number> = {};

	const results = await Promise.all(
		tickers.map(async (ticker, index) => {
			const result = await fetchPrice(ticker);
			onProgress?.(index + 1, tickers.length, result);
			return result;
		})
	);

	for (const { ticker, price } of results) {
		prices[ticker] = price;
	}

	return prices;
}

