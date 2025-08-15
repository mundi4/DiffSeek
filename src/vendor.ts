// vendor.ts
import * as ReactNS from "react";
import * as ReactDOMNS from "react-dom";
import * as ReactDOMClientNS from "react-dom/client";
import * as ReactJSXRuntimeNS from "react/jsx-runtime";
// import * as ReactJSXDevRuntimeNS from "react/jsx-dev-runtime";

import * as jotaiNS from "jotai";
//import clsxDefault, { clsx as clsxNamed } from "clsx";
import clsxDefault from "clsx"; // <- default only

import * as Slot from "@radix-ui/react-slot";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import * as VanillaExtractDynamicNS from "@vanilla-extract/dynamic"; // <- new

// Named exports -> become properties on global Vendor (IIFE lib)
export const React = ReactNS;
export const ReactDOM = { ...ReactDOMNS, ...ReactDOMClientNS };
export const ReactJSXRuntime = ReactJSXRuntimeNS;
// export const ReactJSXDevRuntime = ReactJSXDevRuntimeNS;

export const jotai = jotaiNS;
// crucial: put the actual function on the global
//export const clsx = clsxNamed ?? clsxDefault;
const _clsx = clsxDefault;
export const clsx = Object.assign(_clsx, { default: _clsx, clsx: _clsx });

export const VanillaExtractDynamic = VanillaExtractDynamicNS;

export const RadixUI = {
  Slot,
  DropdownMenuPrimitive,
  TogglePrimitive,
  ToggleGroupPrimitive,
};

// import * as React from "react";
// import * as ReactDOM from "react-dom/client";
// import * as jotai from "jotai";
// import clsxDefault, { clsx as clsxNamed } from "clsx";
// import * as Slot from "@radix-ui/react-slot";
// import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
// import * as TogglePrimitive from "@radix-ui/react-toggle";
// import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

// (window as any).Vendor = {
// 	React,
// 	ReactDOM,
// 	jotai,
// 	clsx: clsxNamed ?? clsxDefault,
// 	RadixUI: {
// 		Slot,
// 		DropdownMenuPrimitive,
// 		TogglePrimitive,
// 		ToggleGroupPrimitive,
// 	},
// };
