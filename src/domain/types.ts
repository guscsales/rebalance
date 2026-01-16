/**
 * Domain types for portfolio rebalancing
 * These represent the core business concepts
 */

export interface Asset {
	ticker: string;
	priority: number;
	quantity: number;
}

export interface AssetPrice {
	ticker: string;
	price: number;
}

export interface AssetState {
	ticker: string;
	currentValue: number;
	targetValue: number;
	targetWeight: number;
	difference: number; // targetValue - currentValue (can be negative)
	priority: number;
}

export interface TradePlan {
	assets: AssetTrade[];
	totalCurrentValue: number;
	referenceTotal: number;
	buyBudget: number;
	totalBuys: number;
	totalSells: number;
}

export interface AssetTrade {
	ticker: string;
	tradeAmount: number; // Positive = buy, Negative = sell, Zero = no trade
	tradeQuantity: number; // Number of shares to buy/sell
	currentValue: number;
	targetValue: number;
	targetWeight: number;
	difference: number;
	priority: number;
	price: number;
}

export interface RebalanceInput {
	assets: Asset[];
	prices: Record<string, number>; // ticker -> price
	targetWeights: Record<string, number>; // ticker -> weight (0-1)
	availableCash: number;
	allowSell: boolean; // Global flag: if true, selling is allowed for all assets
}
