"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import type { AnatomicalSystem, StructureIndex } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useWorkspace } from "../store";
import { systemRoots } from "../use-anatomy-data";

function TreeNode({
  id,
  depth,
  names,
  childMap,
  onSelect,
}: {
  id: string;
  depth: number;
  names: Map<string, string>;
  childMap: Map<string, string[]>;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useWorkspace((s) => s.selectedId === id);
  const kids = childMap.get(id) ?? [];
  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={selected}>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-accent/60",
          selected && "bg-primary/15 text-primary",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          aria-label={open ? "Collapse" : "Expand"}
          disabled={!kids.length}
          onClick={() => setOpen((o) => !o)}
          className="grid size-5 place-items-center text-muted-foreground disabled:invisible"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        </button>
        <button type="button" onClick={() => onSelect(id)} className="min-w-0 flex-1 truncate py-1 text-left">
          {names.get(id)}
        </button>
        {kids.length > 0 && <span className="text-[10px] text-muted-foreground">{kids.length}</span>}
      </div>
      {open && kids.length > 0 && (
        <ul role="group">
          {kids.map((k) => (
            <TreeNode key={k} id={k} depth={depth + 1} names={names} childMap={childMap} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function HierarchyPanel({
  systems,
  index,
  names,
  childMap,
  onSelect,
}: {
  systems: AnatomicalSystem[];
  index: StructureIndex | undefined;
  names: Map<string, string>;
  childMap: Map<string, string[]>;
  onSelect: (id: string) => void;
}) {
  const withStructures = systems.filter((s) => s.structure_count > 0);
  const [systemId, setSystemId] = useState<string>("cardiovascular");
  const roots = useMemo(
    () =>
      index
        ? systemRoots(systemId, index).sort((a, b) => names.get(a)!.localeCompare(names.get(b)!))
        : [],
    [index, systemId, names],
  );
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-xs text-muted-foreground">
        System
        <select
          value={systemId}
          onChange={(e) => setSystemId(e.target.value)}
          className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm text-foreground"
        >
          {withStructures.map((s) => (
            <option key={s.id} value={s.id} className="bg-popover">
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground">
        PART-OF hierarchy from BodyParts3D / FMA. Expand to navigate; click to select.
      </p>
      <ul role="tree" aria-label="Anatomical hierarchy" className="grid">
        {roots.map((r) => (
          <TreeNode key={r} id={r} depth={0} names={names} childMap={childMap} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}
