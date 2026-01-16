export type AssetType = "stock" | "reit";

export interface Asset {
	ticker: string;
	priority: number;
	quantity: number;
}

// TODO: add "usd" support in the future
export type Currency = "brl";
