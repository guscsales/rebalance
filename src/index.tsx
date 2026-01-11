#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./components/App.js";

// Create a client
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnMount: false,
		},
	},
});

// Clear console for a clean start
console.clear();

// Get portfolio value from command line argument if provided
const portfolioValue = process.argv[2];

render(
	<QueryClientProvider client={queryClient}>
		<App initialValue={portfolioValue} />
	</QueryClientProvider>
);
