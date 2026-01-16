/**
 * Budget calculation service
 * Handles calculation of allowed sells and buy budget
 */

import type { AssetState } from "../domain/types.js";

/**
 * Calculate allowed sell proceeds from assets that can be sold
 * Only assets with negative difference can be sold if allowSell is true
 */
export function calculateAllowedSellProceeds(
	assetStates: AssetState[],
	allowSell: boolean
): number {
	if (!allowSell) {
		return 0;
	}

	return assetStates.reduce((total, asset) => {
		if (asset.difference < 0) {
			// Asset is overweight and can be sold (if allowSell is true)
			return total + Math.abs(asset.difference);
		}
		return total;
	}, 0);
}

/**
 * Calculate the buy budget available for purchases
 * Includes available cash plus proceeds from allowed sells
 */
export function calculateBuyBudget(
	availableCash: number,
	allowedSellProceeds: number
): number {
	return availableCash + allowedSellProceeds;
}

/**
 * Determine if an asset can be sold based on global allowSell flag
 */
export function canSellAsset(asset: AssetState, allowSell: boolean): boolean {
	return asset.difference < 0 && allowSell;
}
