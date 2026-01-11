import type { Config } from "../../rebalance.config.js";
import { resolve } from "path";

// Dynamically load config with cache busting to get fresh data
export async function loadConfig(): Promise<Config> {
	const configPath = resolve(import.meta.dir, "../../rebalance.config.ts");

	// Use Bun's cache busting with timestamp query param
	const timestamp = Date.now();
	const module = await import(`${configPath}?v=${timestamp}`);

	return module.config as Config;
}

