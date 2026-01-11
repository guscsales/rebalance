import {Asset, Currency} from "./src/models";

export interface Config {
	allowSell: boolean;
	currency: Currency;
	assets: Asset[];
}

export const config: Config = {
	allowSell: false,
	currency: "brl",
	assets: [
		{ticker: "BBAS3", priority: 5, quantity: 477},
		{ticker: "H1SB34", priority: 3, quantity: 113},
		{ticker: "SAPR11", priority: 4, quantity: 290},
		{ticker: "V1OD34", priority: 3, quantity: 342},
		{ticker: "VBBR3", priority: 5, quantity: 461},
		{ticker: "XPLG11", priority: 8, quantity: 181},
		{ticker: "XPML11", priority: 8, quantity: 175},
		{ticker: "KNHY11", priority: 10, quantity: 0},
		{ticker: "RBRR11", priority: 10, quantity: 0},
	],
};
