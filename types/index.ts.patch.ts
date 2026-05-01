// ─────────────────────────────────────────────────────────────────────────────
// ADD THIS to types/index.ts  — DataGrid artifact
// Place alongside the other artifact interfaces (DocumentArtifact, ChartArtifact…)
// and add DataGridArtifact to the Artifact union at the bottom.
// ─────────────────────────────────────────────────────────────────────────────

export interface DataGridContent {
  /** Column header labels */
  headers: string[]
  /** 2-D array of cell values (all strings; numbers stored as strings) */
  rows: string[][]
  /** Per-column pixel widths persisted after resize */
  columnWidths?: number[]
  /** Optional title shown in the grid header */
  title?: string
  /** Original file name if CSV was uploaded */
  sourceFile?: string
}

export interface DataGridArtifact extends ArtifactBase {
  type: 'datagrid'
  content: DataGridContent
  renderer: 'datagrid'
}

// ── UPDATE the Artifact union to include DataGridArtifact: ──────────────────
//
// export type Artifact =
//   | DocumentArtifact
//   | EmailArtifact
//   | VideoArtifact
//   | ChartArtifact
//   | CodeArtifact
//   | SlidesArtifact
//   | DataGridArtifact   // ← ADD THIS