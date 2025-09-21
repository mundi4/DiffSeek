import { style } from "@vanilla-extract/css";

export const container = style({
    position: "fixed",
    transform: "translateX(-50%)",
    background: "white",                 
    color: "#222",                       
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #ddd",            
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    fontSize: "12px",
    fontWeight: 500,
    zIndex: 10000,
    pointerEvents: "none",
})