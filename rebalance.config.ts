import {Asset, Currency} from "./src/models";

export interface Config {
	allowSell: boolean;
	currency: Currency;
	portfolioValue: number;
	balance: number;
	assets: Asset[];
}

export const config: Config = {
	allowSell: false,
	currency: "brl",
	portfolioValue: 95917.85,
	balance: 27000,
	assets: [
		{ticker: "H1SB34", priority: 3, quantity: 113},
		{ticker: "M1TA34", priority: 1, quantity: 48},
		{ticker: "TSLA34", priority: 1, quantity: 95},
		{ticker: "V1OD34", priority: 3, quantity: 342},
		{ticker: "XPLG11", priority: 8, quantity: 181},
		{ticker: "XPML11", priority: 8, quantity: 175},
		{ticker: "KNCR11", priority: 10, quantity: 0},
		{ticker: "RBRR11", priority: 10, quantity: 232},
	],
};
