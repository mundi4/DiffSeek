class Renderer2 {
	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#highlightCanvas: HTMLCanvasElement;
	#highlightCtx: CanvasRenderingContext2D;

	constructor(container: HTMLElement) {
		this.#canvas = document.createElement("canvas");
		this.#ctx = this.#canvas.getContext("2d")!;
		container.appendChild(this.#canvas);

		this.#highlightCanvas = document.createElement("canvas");
		this.#highlightCtx = this.#highlightCanvas.getContext("2d")!;
	}

    
}
