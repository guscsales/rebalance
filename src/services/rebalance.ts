/**
 * Portfolio rebalancing service
 * Pure calculation functions for portfolio rebalancing
 */

import type {
	RebalanceInput,
	AssetState,
	AssetTrade,
	TradePlan,
} from "../domain/types.js";
import {
	calculateAllowedSellProceeds,
	calculateBuyBudget,
	canSellAsset,
} from "./budget.js";

/**
 * Calculate current values and initial asset states
 */
function calculateAssetStates(
	assets: RebalanceInput["assets"],
	prices: Record<string, number>,
	targetWeights: Record<string, number>,
	referenceTotal: number
): AssetState[] {
	return assets.map((asset) => {
		const price = prices[asset.ticker] || 0;
		const currentValue = asset.quantity * price;
		const targetWeight = targetWeights[asset.ticker] || 0;
		const targetValue = targetWeight * referenceTotal;
		const difference = targetValue - currentValue;

		return {
			ticker: asset.ticker,
			currentValue,
			targetValue,
			targetWeight,
			difference,
			priority: asset.priority,
		};
	});
}

/**
 * Allocate buy budget to underweight assets proportionally by priority
 * Allocates whole shares only, not fractional amounts
 */
function allocateBuyBudget(
	underweightAssets: AssetState[],
	buyBudget: number,
	prices: Record<string, number>
): Map<string, number> {
	const shareAllocations = new Map<string, number>(); // ticker -> number of shares

	if (underweightAssets.length === 0 || buyBudget <= 0) {
		return new Map(); // Return empty map (will be converted to R$ amounts later)
	}

	// Initialize share allocations to 0
	underweightAssets.forEach((asset) => {
		shareAllocations.set(asset.ticker, 0);
	});

	let remainingBudget = buyBudget;
	const maxIterations = 10000; // High limit since we're buying 1 share at a time

	// Iteratively buy shares until budget is exhausted
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		// Find assets that can still accept more shares
		const assetsNeedingMore = underweightAssets.filter((asset) => {
			const price = prices[asset.ticker] || 0;
			if (price === 0 || price > remainingBudget) {
				return false; // Can't afford even 1 share
			}

			const currentShares = shareAllocations.get(asset.ticker) || 0;
			const currentAllocation = currentShares * price;
			const remaining = asset.difference - currentAllocation;
			return remaining >= price; // Can fit at least 1 more share
		});

		if (assetsNeedingMore.length === 0) {
			// No assets can accept more shares with remaining budget
			break;
		}

		// Calculate total priority for assets that can still accept shares
		const totalPriority = assetsNeedingMore.reduce(
			(sum, asset) => sum + asset.priority,
			0
		);

		// Calculate allocation scores (priority / price ratio)
		// Higher priority and lower price = higher score
		const assetScores = assetsNeedingMore.map((asset) => {
			const price = prices[asset.ticker] || 0;
			const priorityWeight = totalPriority > 0 ? asset.priority / totalPriority : 1 / assetsNeedingMore.length;
			
			// Score: priority weight divided by price (normalized)
			// This favors high priority and affordable shares
			return {
				ticker: asset.ticker,
				score: priorityWeight / price,
				price: price,
			};
		});

		// Sort by score descending
		assetScores.sort((a, b) => b.score - a.score);

		// Buy 1 share of the highest scoring asset
		const winner = assetScores[0];
		if (winner.price <= remainingBudget) {
			const currentShares = shareAllocations.get(winner.ticker) || 0;
			shareAllocations.set(winner.ticker, currentShares + 1);
			remainingBudget -= winner.price;
		} else {
			// Can't afford any more shares
			break;
		}
	}

	// Convert share allocations to R$ amounts
	const allocations = new Map<string, number>();
	shareAllocations.forEach((shares, ticker) => {
		const price = prices[ticker] || 0;
		allocations.set(ticker, shares * price);
	});

	return allocations;
}

/**
 * Main rebalancing function
 * Calculates trade plan based on inputs
 */
export function calculateRebalance(input: RebalanceInput): TradePlan {
	const { assets, prices, targetWeights, availableCash, allowSell } = input;

	// STEP 1: Calculate current portfolio value
	const totalCurrentValue = assets.reduce((sum, asset) => {
		const price = prices[asset.ticker] || 0;
		return sum + asset.quantity * price;
	}, 0);

	// STEP 2: Iteratively calculate reference total until convergence
	// Reference total = current + cash + allowed sell proceeds
	// But allowed sell proceeds depend on targets, which depend on reference total
	// So we iterate until convergence (usually 2-3 iterations)
	let referenceTotal = totalCurrentValue + availableCash;
	let previousReferenceTotal = 0;
	let allowedSellProceeds = 0;
	let assetStates: AssetState[] = [];

	// Iterate until reference total converges (or max iterations)
	const maxIterations = 10;
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		// Calculate asset states with current reference total
		assetStates = calculateAssetStates(
			assets,
			prices,
			targetWeights,
			referenceTotal
		);

		// Calculate allowed sell proceeds based on current targets
		allowedSellProceeds = calculateAllowedSellProceeds(assetStates, allowSell);

		// Update reference total
		previousReferenceTotal = referenceTotal;
		referenceTotal = totalCurrentValue + availableCash + allowedSellProceeds;

		// Check for convergence (change < 0.01)
		if (Math.abs(referenceTotal - previousReferenceTotal) < 0.01) {
			break;
		}
	}

	// Final asset states with converged reference total
	assetStates = calculateAssetStates(
		assets,
		prices,
		targetWeights,
		referenceTotal
	);

	// STEP 7: Calculate buy budget
	const buyBudget = calculateBuyBudget(availableCash, allowedSellProceeds);

	// STEP 8: Determine executable trades
	const underweightAssets: AssetState[] = [];
	const assetTrades: AssetTrade[] = [];

	assetStates.forEach((asset) => {
		const price = prices[asset.ticker] || 0;
		let tradeAmount = 0;

		if (asset.difference < 0) {
			// Overweight asset
			if (canSellAsset(asset, allowSell)) {
				tradeAmount = -Math.abs(asset.difference); // Negative = sell
			} else {
				tradeAmount = 0; // Locked, cannot sell
			}
		} else if (asset.difference > 0) {
			// Underweight asset - will be allocated in next step
			underweightAssets.push(asset);
			tradeAmount = 0; // Placeholder
		} else {
			// At target
			tradeAmount = 0;
		}

		const tradeQuantity =
			tradeAmount !== 0 && price > 0 ? Math.floor(Math.abs(tradeAmount) / price) : 0;

		assetTrades.push({
			ticker: asset.ticker,
			tradeAmount,
			tradeQuantity: asset.difference < 0 ? -tradeQuantity : tradeQuantity, // Negative for sells
			currentValue: asset.currentValue,
			targetValue: asset.targetValue,
			targetWeight: asset.targetWeight,
			difference: asset.difference,
			priority: asset.priority,
			price,
		});
	});

	// STEP 9: Allocate buy budget to underweight assets
	const buyAllocations = allocateBuyBudget(underweightAssets, buyBudget, prices);

	// Update trade amounts for underweight assets
	assetTrades.forEach((trade) => {
		if (trade.difference > 0) {
			// Underweight asset
			const allocatedBuy = buyAllocations.get(trade.ticker) || 0;
			trade.tradeAmount = allocatedBuy;
			trade.tradeQuantity =
				trade.price > 0 ? Math.floor(allocatedBuy / trade.price) : 0;
		}
	});

	// STEP 10: Calculate totals
	const totalBuys = assetTrades.reduce(
		(sum, trade) => (trade.tradeAmount > 0 ? sum + trade.tradeAmount : sum),
		0
	);

	const totalSells = assetTrades.reduce(
		(sum, trade) => (trade.tradeAmount < 0 ? sum + Math.abs(trade.tradeAmount) : sum),
		0
	);

	return {
		assets: assetTrades,
		totalCurrentValue,
		referenceTotal,
		buyBudget,
		totalBuys,
		totalSells,
	};
}

/**
 * Calculate target weights from priorities
 * Converts priority values to normalized weights (sum to 1)
 */
export function calculateTargetWeights(
	assets: RebalanceInput["assets"]
): Record<string, number> {
	const totalPriority = assets.reduce((sum, asset) => sum + asset.priority, 0);

	if (totalPriority === 0) {
		// Equal weights if no priorities
		const equalWeight = 1 / assets.length;
		return Object.fromEntries(
			assets.map((asset) => [asset.ticker, equalWeight])
		);
	}

	return Object.fromEntries(
		assets.map((asset) => [asset.ticker, asset.priority / totalPriority])
	);
}
