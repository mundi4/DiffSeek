import { createRoot } from "react-dom/client";

import "./core/core.css";
import "./styles/vars.css";
import "./styles/globals.css";

import { StrictMode } from "react";
import App from "./App.tsx";
import { DiffControllerProvider } from "./hooks/DiffControllerProvider.tsx";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<DiffControllerProvider>
			<App />
		</DiffControllerProvider>
	</StrictMode>
);
