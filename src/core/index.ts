import { DiffController } from "./DiffController";
import { Editor } from "./Editor";
import { Renderer } from "./Renderer";

export const defaultDiffOptions: DiffOptions = {
	algorithm: "histogram",
	tokenization: "word",
	ignoreWhitespace: "ignore",
	greedyMatch: false,
	useLengthBias: true,
	maxGram: 4,
	lengthBiasFactor: 0.7,
	containerStartMultiplier: 1 / 0.85,
	containerEndMultiplier: 1 / 0.9,
	sectionHeadingMultiplier: 1 / 0.75,
	lineStartMultiplier: 1 / 0.9,
	lineEndMultiplier: 1 / 0.95,
	uniqueMultiplier: 1 / 0.6667,
};

export const leftEditor = new Editor("left");
export const rightEditor = new Editor("right");
export const renderer = new Renderer(leftEditor, rightEditor);
export const diffController = new DiffController(leftEditor, rightEditor, renderer, defaultDiffOptions);
