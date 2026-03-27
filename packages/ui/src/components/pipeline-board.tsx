"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface PipelineItem {
  id: string;
  [key: string]: unknown;
}

export interface PipelineStage {
  id: string;
  name: string;
  color?: string;
  items: PipelineItem[];
}

export interface PipelineDragResult {
  itemId: string;
  fromStageId: string;
  toStageId: string;
  item: PipelineItem;
}

export interface PipelineBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  stages: PipelineStage[];
  onDragEnd?: (result: PipelineDragResult) => void;
  renderCard?: (item: PipelineItem, stageId: string) => React.ReactNode;
}

const PipelineBoard = React.forwardRef<HTMLDivElement, PipelineBoardProps>(
  ({ className, stages, onDragEnd, renderCard, ...props }, ref) => {
    const [dragState, setDragState] = React.useState<{
      itemId: string;
      fromStageId: string;
      item: PipelineItem;
    } | null>(null);
    const [dropTarget, setDropTarget] = React.useState<string | null>(null);

    const handleDragStart = (
      e: React.DragEvent,
      item: PipelineItem,
      stageId: string
    ) => {
      setDragState({ itemId: item.id, fromStageId: stageId, item });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.id);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    };

    const handleDragEnd = (e: React.DragEvent) => {
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "1";
      }
      setDragState(null);
      setDropTarget(null);
    };

    const handleDragOver = (e: React.DragEvent, stageId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(stageId);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      const currentTarget = e.currentTarget as HTMLElement;
      if (relatedTarget && currentTarget.contains(relatedTarget)) return;
      setDropTarget(null);
    };

    const handleDrop = (e: React.DragEvent, toStageId: string) => {
      e.preventDefault();
      setDropTarget(null);

      if (!dragState) return;
      if (dragState.fromStageId === toStageId) return;

      onDragEnd?.({
        itemId: dragState.itemId,
        fromStageId: dragState.fromStageId,
        toStageId,
        item: dragState.item,
      });
    };

    const defaultRenderCard = (item: PipelineItem) => (
      <div className="rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
        <p className="text-sm font-medium">
          {(item.name as string) ?? (item.title as string) ?? item.id}
        </p>
        {item.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {item.description as string}
          </p>
        )}
      </div>
    );

    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-4 overflow-x-auto pb-4",
          className
        )}
        {...props}
      >
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={cn(
              "flex w-72 min-w-[18rem] flex-col rounded-lg bg-muted/50",
              dropTarget === stage.id &&
                dragState?.fromStageId !== stage.id &&
                "ring-2 ring-primary/50"
            )}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Stage header */}
            <div className="flex items-center gap-2 px-3 py-3">
              {stage.color && (
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
              )}
              <h3 className="text-sm font-semibold">{stage.name}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {stage.items.length}
              </span>
            </div>

            {/* Stage content */}
            <div className="flex flex-1 flex-col gap-2 px-2 pb-2 min-h-[8rem]">
              {stage.items.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item, stage.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "cursor-grab active:cursor-grabbing",
                    dragState?.itemId === item.id && "opacity-50"
                  )}
                >
                  {renderCard
                    ? renderCard(item, stage.id)
                    : defaultRenderCard(item)}
                </div>
              ))}

              {stage.items.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 p-4">
                  <p className="text-xs text-muted-foreground">
                    Drop items here
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
);
PipelineBoard.displayName = "PipelineBoard";

export { PipelineBoard };
