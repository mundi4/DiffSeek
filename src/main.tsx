//import './globals.css'

import { createRoot } from "react-dom/client";

import "./styles/vars.css";
import "./globals.css";
import "./core/core.css";
import "./styles/globals.css";


import { StrictMode } from "react";
import App from "./App.tsx";
import { DiffControllerProvider } from "./hooks/useDiffController.tsx";
import { diffController, leftEditor, renderer, rightEditor } from "./core/index.ts";

// const app = new DiffseekApp(document.getElementById("root")!);
// (window as any).DiffSeek = app;

// const leftEditor = new Editor("left");
// const rightEditor = new Editor("right");
// const renderer = new Renderer(leftEditor, rightEditor);
// const diffController = new DiffController(leftEditor, rightEditor, renderer);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<DiffControllerProvider value={{ diffController: diffController, leftEditor, rightEditor, renderer }}>
			<App />
		</DiffControllerProvider>
	</StrictMode>
);
