/**
 * DiffSeekApp - Standalone core application
 * 
 * This is the main entry point for using DiffSeek core without React.
 * It provides a complete, framework-independent implementation using only DOM APIs.
 * 
 * Core principles:
 * - No React dependencies
 * - Pure DOM/Canvas rendering
 * - Can be used standalone or integrated with any framework
 * 
 * Usage example:
 * ```typescript
 * import { DiffSeekApp } from '@/core';
 * 
 * const app = new DiffSeekApp({
 *   leftContainer: document.getElementById('left-editor'),
 *   rightContainer: document.getElementById('right-editor'),
 *   rendererContainer: document.getElementById('renderer')
 * });
 * 
 * app.setLeftContent('Hello world');
 * app.setRightContent('Hello world!');
 * ```
 */

import { DiffController } from "./DiffController";
import { Editor } from "./Editor";
import { Renderer } from "./Renderer";
import type { DiffContext } from "./DiffContext";
import { getDefaultDiffOptions } from "./defaultDiffOptions";

export interface DiffSeekAppOptions {
	leftContainer?: HTMLElement;
	rightContainer?: HTMLElement;
	rendererContainer?: HTMLElement;
	diffOptions?: Partial<DiffOptions>;
}

export class DiffSeekApp {
	#leftEditor: Editor;
	#rightEditor: Editor;
	#renderer: Renderer;
	#diffController: DiffController;

	constructor(options?: DiffSeekAppOptions) {
		this.#leftEditor = new Editor("left");
		this.#rightEditor = new Editor("right");
		this.#renderer = new Renderer(this.#leftEditor, this.#rightEditor);

		this.#diffController = new DiffController(
			this.#leftEditor,
			this.#rightEditor,
			this.#renderer,
			{ ...getDefaultDiffOptions(), ...options?.diffOptions }
		);

		// Mount to DOM if containers provided
		if (options?.leftContainer) {
			this.#leftEditor.mount(options.leftContainer);
		}
		if (options?.rightContainer) {
			this.#rightEditor.mount(options.rightContainer);
		}
		if (options?.rendererContainer) {
			this.#renderer.mount(options.rendererContainer);
		}
	}

	// Public API for content management
	async setLeftContent(content: string, asHTML = false): Promise<void> {
		await this.#leftEditor.setContent({ text: content, asHTML });
	}

	async setRightContent(content: string, asHTML = false): Promise<void> {
		await this.#rightEditor.setContent({ text: content, asHTML });
	}

	// Public API for diff control
	startDiff(): void {
		this.#diffController.startDiffWorkflow();
	}

	cancelDiff(): void {
		this.#diffController.cancelDiffWorkflow();
	}

	// Public API for options
	updateDiffOptions(options: Partial<DiffOptions>): void {
		this.#diffController.updateDiffOptions(options);
	}

	// Public API for sync mode
	get syncMode(): boolean {
		return this.#diffController.syncMode;
	}

	set syncMode(value: boolean) {
		this.#diffController.syncMode = value;
	}

	// Public API for events
	onDiffComplete(callback: (context: DiffContext) => void): () => void {
		return this.#diffController.onDiffWorkflowDone(callback);
	}

	onDiffStart(callback: () => void): () => void {
		return this.#diffController.onDiffWorkflowStart(callback);
	}

	// Access to core instances for advanced usage
	get leftEditor(): Editor {
		return this.#leftEditor;
	}

	get rightEditor(): Editor {
		return this.#rightEditor;
	}

	get renderer(): Renderer {
		return this.#renderer;
	}

	get diffController(): DiffController {
		return this.#diffController;
	}

	// Cleanup
	destroy(): void {
		this.#leftEditor.unmount();
		this.#rightEditor.unmount();
		this.#renderer.unmount();
	}
}
