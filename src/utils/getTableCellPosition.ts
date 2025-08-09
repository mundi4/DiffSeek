export function getTableCellPosition(td: HTMLElement): [rowIndex: number, colIndex: number] | null {
	if (td.tagName !== "TD") return null;

	const tr = td.parentElement as HTMLTableRowElement;
	if (!tr || tr.tagName !== "TR") return null;

	const table = tr.parentElement as HTMLTableElement;
	if (!table || table.tagName !== "TABLE") return null;

	const rowIndex = Array.prototype.indexOf.call(table.rows, tr);
	const colIndex = Array.prototype.indexOf.call(tr.cells, td);

	if (rowIndex === -1 || colIndex === -1) return null;

	return [rowIndex, colIndex];
}
