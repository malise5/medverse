"use client";

import { Camera, FlipHorizontal2, PanelLeft, PanelRight, RotateCcw, Scissors, View } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useWorkspace, type ClipAxis, type ViewPreset } from "../store";

const VIEWS: [ViewPreset, string][] = [
  ["anterior", "Anterior"],
  ["posterior", "Posterior"],
  ["left", "Left lateral"],
  ["right", "Right lateral"],
  ["superior", "Superior"],
  ["inferior", "Inferior"],
  ["oblique", "Anterolateral oblique"],
];

function screenshot() {
  const canvas = document.querySelector<HTMLCanvasElement>("#anatomy-canvas canvas");
  if (!canvas) return;
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `medverse-anatomy-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
  a.click();
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TopToolbar({
  onToggleLeft,
  onToggleRight,
}: {
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  const requestView = useWorkspace((s) => s.requestView);
  const reset = useWorkspace((s) => s.reset);
  const isolated = useWorkspace((s) => s.isolatedMeshes);
  const hiddenCount = useWorkspace((s) => s.hiddenMeshes.size);
  const showAll = useWorkspace((s) => s.showAll);

  return (
    <div className="flex h-11 items-center gap-1 border-b px-2">
      <IconButton label="Toggle explorer panel" onClick={onToggleLeft}>
        <PanelLeft />
      </IconButton>
      <div className="mx-1 hidden items-center gap-2 sm:flex">
        <span className="text-sm font-medium">Adult male</span>
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          BodyParts3D 4.0 · FMA
        </Badge>
      </div>
      <div className="ml-auto flex items-center gap-1">
        {(isolated || hiddenCount > 0) && (
          <Button size="sm" variant="secondary" onClick={showAll}>
            {isolated ? "Exit isolation" : `Show ${hiddenCount} hidden`}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="View presets">
              <View /> <span className="hidden md:inline">View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Anatomical view</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {VIEWS.map(([v, l]) => (
              <DropdownMenuItem key={v} onSelect={() => requestView(v)}>
                {l}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton label="Save screenshot (PNG)" onClick={screenshot}>
          <Camera />
        </IconButton>
        <IconButton label="Reset workspace" onClick={reset}>
          <RotateCcw />
        </IconButton>
        <IconButton label="Toggle information panel" onClick={onToggleRight}>
          <PanelRight />
        </IconButton>
      </div>
    </div>
  );
}

const AXES: [ClipAxis, string][] = [
  ["none", "Off"],
  ["sagittal", "Sagittal"],
  ["coronal", "Coronal"],
  ["transverse", "Transverse"],
];

export function BottomToolbar() {
  const clip = useWorkspace((s) => s.clip);
  const setClip = useWorkspace((s) => s.setClip);
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Scissors className="size-3.5" /> Section plane
      </span>
      <ToggleGroup
        type="single"
        size="sm"
        value={clip.axis}
        onValueChange={(v) => v && setClip({ axis: v as ClipAxis })}
        aria-label="Section plane"
      >
        {AXES.map(([v, l]) => (
          <ToggleGroupItem key={v} value={v} className="px-2 text-xs">
            {l}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {clip.axis !== "none" && (
        <>
          <Slider
            aria-label="Section plane position"
            className="w-40 sm:w-56"
            min={0}
            max={1}
            step={0.005}
            value={[clip.position]}
            onValueChange={([v]) => setClip({ position: v })}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Flip retained side"
            aria-pressed={clip.flip}
            onClick={() => setClip({ flip: !clip.flip })}
          >
            <FlipHorizontal2 />
          </Button>
          <span className="text-[11px] text-muted-foreground">Cut surfaces are open (not capped).</span>
        </>
      )}
    </div>
  );
}
