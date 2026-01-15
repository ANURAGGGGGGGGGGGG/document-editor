"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";

const IndentRuler = Extension.create({
  name: "indentRuler",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          leftIndent: {
            default: 0,
            renderHTML: (attributes) => {
              const value = Number(attributes.leftIndent) || 0;
              return value ? { style: `padding-left: ${value}px;` } : {};
            },
          },
          rightIndent: {
            default: 0,
            renderHTML: (attributes) => {
              const value = Number(attributes.rightIndent) || 0;
              return value ? { style: `padding-right: ${value}px;` } : {};
            },
          },
          firstLineIndent: {
            default: 0,
            renderHTML: (attributes) => {
              const value = Number(attributes.firstLineIndent) || 0;
              return value ? { style: `text-indent: ${value}px;` } : {};
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setIndentRuler:
        ({ leftIndent = 0, rightIndent = 0, firstLineIndent = 0 }) =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          let targetDepth = -1;

          for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth);
            if (!node) {
              continue;
            }
            if (node.type.name === "paragraph" || node.type.name === "heading") {
              targetDepth = depth;
              break;
            }
          }

          if (targetDepth < 0) {
            return false;
          }

          const pos = $from.before(targetDepth + 1);
          const node = tr.doc.nodeAt(pos);
          if (!node) {
            return false;
          }

          const nextAttrs = {
            ...node.attrs,
            leftIndent,
            rightIndent,
            firstLineIndent,
          };

          tr.setNodeMarkup(pos, undefined, nextAttrs);

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },
    };
  },
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function Ruler({ editor }) {
  const trackRef = useRef(null);
  const dragStateRef = useRef({
    type: null,
    pointerId: null,
  });
  const isDraggingRef = useRef(false);

  const [trackWidth, setTrackWidth] = useState(0);
  const [leftIndent, setLeftIndent] = useState(0);
  const [rightIndent, setRightIndent] = useState(0);
  const [firstLineIndent, setFirstLineIndent] = useState(0);
  const [activeDragType, setActiveDragType] = useState(null);

  const minGap = 12;
  const pxPerInch = 96;

  const applyToEditor = useCallback(
    (next) => {
      if (!editor) {
        return;
      }
      editor
        .chain()
        .focus()
        .updateAttributes("paragraph", {
          leftIndent: next.leftIndent,
          rightIndent: next.rightIndent,
          firstLineIndent: next.firstLineIndent,
        })
        .updateAttributes("heading", {
          leftIndent: next.leftIndent,
          rightIndent: next.rightIndent,
          firstLineIndent: next.firstLineIndent,
        })
        .run();
    },
    [editor]
  );

  const syncFromSelection = useCallback(() => {
    if (!editor || isDraggingRef.current) {
      return;
    }

    const paragraphAttrs = editor.getAttributes("paragraph") || {};
    const headingAttrs = editor.getAttributes("heading") || {};
    const attrs = {
      leftIndent: Number(paragraphAttrs.leftIndent ?? headingAttrs.leftIndent ?? 0) || 0,
      rightIndent: Number(paragraphAttrs.rightIndent ?? headingAttrs.rightIndent ?? 0) || 0,
      firstLineIndent: Number(paragraphAttrs.firstLineIndent ?? headingAttrs.firstLineIndent ?? 0) || 0,
    };

    setLeftIndent(attrs.leftIndent);
    setRightIndent(attrs.rightIndent);
    setFirstLineIndent(attrs.firstLineIndent);
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    syncFromSelection();

    editor.on("selectionUpdate", syncFromSelection);
    editor.on("transaction", syncFromSelection);

    return () => {
      editor.off("selectionUpdate", syncFromSelection);
      editor.off("transaction", syncFromSelection);
    };
  }, [editor, syncFromSelection]);

  useEffect(() => {
    if (!trackRef.current) {
      return;
    }

    const element = trackRef.current;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setTrackWidth(rect.width);
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const positions = useMemo(() => {
    const rightX = clamp(trackWidth - rightIndent, 0, trackWidth);
    const leftX = clamp(leftIndent, 0, trackWidth);
    const firstLineX = clamp(leftIndent + firstLineIndent, 0, rightX);
    return { leftX, rightX, firstLineX };
  }, [trackWidth, leftIndent, rightIndent, firstLineIndent]);

  const majorTicks = useMemo(() => {
    if (!trackWidth) {
      return [];
    }
    const step = pxPerInch;
    const count = Math.floor(trackWidth / step);
    return Array.from({ length: count + 1 }, (_, index) => ({
      x: index * step,
      label: String(index),
    }));
  }, [pxPerInch, trackWidth]);

  const formatInches = useCallback(
    (px) => {
      const inches = px / pxPerInch;
      const rounded = Math.round(inches * 100) / 100;
      return `${rounded}in`;
    },
    [pxPerInch]
  );

  const getRelativeX = useCallback((event) => {
    if (!trackRef.current) {
      return 0;
    }
    const rect = trackRef.current.getBoundingClientRect();
    return event.clientX - rect.left;
  }, []);

  const setFromDrag = useCallback(
    (type, absoluteX) => {
      const width = trackWidth || 0;
      const next = {
        leftIndent,
        rightIndent,
        firstLineIndent,
      };

      const rightEdgeX = width - rightIndent;
      const currentFirstLineX = leftIndent + firstLineIndent;

      if (type === "left") {
        const maxLeftX = Math.max(0, rightEdgeX - minGap);
        const newLeftX = clamp(absoluteX, 0, maxLeftX);
        const minFirstLineX = 0;
        const maxFirstLineX = Math.max(minFirstLineX, width - rightIndent);
        const newFirstLineX = clamp(currentFirstLineX, minFirstLineX, maxFirstLineX);
        next.leftIndent = Math.round(newLeftX);
        next.firstLineIndent = Math.round(newFirstLineX - newLeftX);
      } else if (type === "firstLine") {
        const minFirstLineX = 0;
        const maxFirstLineX = Math.max(minFirstLineX, width - rightIndent);
        const newFirstLineX = clamp(absoluteX, minFirstLineX, maxFirstLineX);
        next.firstLineIndent = Math.round(newFirstLineX - leftIndent);
      } else if (type === "right") {
        const minRightX = Math.min(width, leftIndent + minGap);
        const newRightX = clamp(absoluteX, minRightX, width);
        next.rightIndent = Math.round(width - newRightX);

        const nextRightEdgeX = width - next.rightIndent;
        const minFirstLineX = 0;
        const maxFirstLineX = Math.max(minFirstLineX, nextRightEdgeX);
        const newFirstLineX = clamp(currentFirstLineX, minFirstLineX, maxFirstLineX);
        next.firstLineIndent = Math.round(newFirstLineX - leftIndent);
      }

      setLeftIndent(next.leftIndent);
      setRightIndent(next.rightIndent);
      setFirstLineIndent(next.firstLineIndent);
      applyToEditor(next);
    },
    [applyToEditor, firstLineIndent, leftIndent, rightIndent, trackWidth]
  );

  const handleMarkerPointerDown = useCallback(
    (type) => (event) => {
      if (!trackRef.current) {
        return;
      }
      isDraggingRef.current = true;
      dragStateRef.current = { type, pointerId: event.pointerId };
      setActiveDragType(type);
      event.currentTarget.setPointerCapture(event.pointerId);
      setFromDrag(type, getRelativeX(event));
    },
    [getRelativeX, setFromDrag]
  );

  const handleMarkerPointerMove = useCallback(
    (event) => {
      const { type, pointerId } = dragStateRef.current;
      if (!type || pointerId !== event.pointerId) {
        return;
      }
      setFromDrag(type, getRelativeX(event));
    },
    [getRelativeX, setFromDrag]
  );

  const handleMarkerPointerUp = useCallback((event) => {
    const { pointerId } = dragStateRef.current;
    if (pointerId !== event.pointerId) {
      return;
    }
    dragStateRef.current = { type: null, pointerId: null };
    isDraggingRef.current = false;
    setActiveDragType(null);
  }, []);

  return (
    <div className="doc-ruler" aria-label="Document ruler">
      <div className="doc-ruler-track" ref={trackRef}>
        <div className="doc-ruler-margin doc-ruler-margin-left" style={{ width: `${positions.leftX}px` }} />
        <div
          className="doc-ruler-margin doc-ruler-margin-right"
          style={{
            left: `${positions.rightX}px`,
            width: `${Math.max(0, trackWidth - positions.rightX)}px`,
          }}
        />
        <div
          className="doc-ruler-content"
          style={{
            left: `${positions.leftX}px`,
            width: `${Math.max(0, positions.rightX - positions.leftX)}px`,
          }}
        />
        <div
          className="doc-ruler-firstline-guide"
          style={{
            left: `${Math.min(positions.leftX, positions.firstLineX)}px`,
            width: `${Math.abs(positions.firstLineX - positions.leftX)}px`,
          }}
        />

        {majorTicks.map(({ x, label }) => (
          <div key={x} className="doc-ruler-tick" style={{ left: `${x}px` }}>
            <div className="doc-ruler-tick-line" />
            <div className="doc-ruler-tick-label">{label}</div>
          </div>
        ))}

        {activeDragType === "left" ? (
          <div className="doc-ruler-tooltip" style={{ left: `${positions.leftX}px` }}>
            Left {formatInches(leftIndent)}
          </div>
        ) : null}
        {activeDragType === "firstLine" ? (
          <div className="doc-ruler-tooltip doc-ruler-tooltip-blue" style={{ left: `${positions.firstLineX}px` }}>
            First line {formatInches(firstLineIndent)}
          </div>
        ) : null}
        {activeDragType === "right" ? (
          <div className="doc-ruler-tooltip" style={{ left: `${positions.rightX}px` }}>
            Right {formatInches(rightIndent)}
          </div>
        ) : null}

        <button
          type="button"
          className="doc-ruler-marker doc-ruler-marker-left"
          style={{ left: `${positions.leftX}px` }}
          onPointerDown={handleMarkerPointerDown("left")}
          onPointerMove={handleMarkerPointerMove}
          onPointerUp={handleMarkerPointerUp}
          onPointerCancel={handleMarkerPointerUp}
          aria-label="Left indent"
          title="Left indent"
        />
        <button
          type="button"
          className="doc-ruler-marker doc-ruler-marker-firstline"
          style={{ left: `${positions.firstLineX}px` }}
          onPointerDown={handleMarkerPointerDown("firstLine")}
          onPointerMove={handleMarkerPointerMove}
          onPointerUp={handleMarkerPointerUp}
          onPointerCancel={handleMarkerPointerUp}
          aria-label="First line indent"
          title="First line indent"
        />
        <button
          type="button"
          className="doc-ruler-marker doc-ruler-marker-right"
          style={{ left: `${positions.rightX}px` }}
          onPointerDown={handleMarkerPointerDown("right")}
          onPointerMove={handleMarkerPointerMove}
          onPointerUp={handleMarkerPointerUp}
          onPointerCancel={handleMarkerPointerUp}
          aria-label="Right indent"
          title="Right indent"
        />
      </div>
      <div className="doc-ruler-legend">
        <span>Left: {formatInches(leftIndent)}</span>
        <span>First: {formatInches(firstLineIndent)}</span>
        <span>Right: {formatInches(rightIndent)}</span>
      </div>
    </div>
  );
}

function AlignIcon({ align, className }) {
  if (align === "center") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
        <path d="M6 6h12" />
        <path d="M8 10h8" />
        <path d="M6 14h12" />
        <path d="M8 18h8" />
      </svg>
    );
  }

  if (align === "right") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
        <path d="M6 6h12" />
        <path d="M10 10h8" />
        <path d="M6 14h12" />
        <path d="M10 18h8" />
      </svg>
    );
  }

  if (align === "justify") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
        <path d="M4 6h16" />
        <path d="M4 10h16" />
        <path d="M4 14h16" />
        <path d="M4 18h16" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 10h10" />
      <path d="M4 14h16" />
      <path d="M4 18h10" />
    </svg>
  );
}

function ColorSwatch({ color, selected, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(color)}
      className={`color-swatch ${selected ? "is-selected" : ""}`}
      style={{ backgroundColor: color }}
      aria-label={color}
      title={color}
    />
  );
}

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value || "#000000");
  const inputRef = useRef(null);

  const palette = useMemo(
    () => [
      "#000000", "#404040", "#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#f3f4f6", "#ffffff",
      "#ef4444", "#f59e0b", "#facc15", "#22c55e", "#10b981", "#0ea5e9", "#3b82f6", "#a855f7",
      "#f87171", "#fbbf24", "#fde047", "#86efac", "#67e8f9", "#93c5fd", "#a5b4fc", "#f472b6",
      "#fca5a5", "#fcd34d", "#fef08a", "#bbf7d0", "#a7f3d0", "#bfdbfe", "#c7d2fe", "#f9a8d4",
      "#dc2626", "#ea580c", "#d97706", "#15803d", "#0d9488", "#2563eb", "#1d4ed8", "#7c3aed",
      "#b91c1c", "#c2410c", "#a16207", "#166534", "#115e59", "#1e40af", "#1e3a8a", "#6d28d9",
      "#7f1d1d", "#7c2d12", "#713f12", "#14532d", "#134e4a", "#172554", "#0b1a4a", "#4c1d95",
    ],
    []
  );

  const handlePick = useCallback(
    (color) => {
      onChange(color);
      setCustomColor(color);
      setOpen(false);
    },
    [onChange]
  );

  const handleOpenNative = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const handleEyedropper = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && "EyeDropper" in window) {
        // @ts-ignore
        const eye = new window.EyeDropper();
        const result = await eye.open();
        if (result?.sRGBHex) {
          handlePick(result.sRGBHex);
        }
      } else {
        handleOpenNative();
      }
    } catch {
      handleOpenNative();
    }
  }, [handleOpenNative, handlePick]);

  return (
    <div className="color-picker">
      <button
        type="button"
        className="color-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Text color"
        title={`Text color: ${value}`}
      >
        <span className="color-button-label" style={{ color: value }}>A</span>
        <span className="color-button-preview" style={{ background: value }} />
      </button>
      {open ? (
        <div className="color-popover">
          <div className="color-grid">
            {palette.map((c) => (
              <ColorSwatch key={c} color={c} selected={c.toLowerCase() === String(value).toLowerCase()} onPick={handlePick} />
            ))}
          </div>
          <div className="color-custom">
            <span className="color-custom-label">Custom</span>
            <div className="color-custom-actions">
              <button type="button" className="color-action" onClick={handleOpenNative} aria-label="Pick custom color" title="Pick custom color">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
              <button type="button" className="color-action" onClick={handleEyedropper} aria-label="Eyedropper" title="Eyedropper">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 3l-3 3" />
                  <path d="M16 8l-7 7" />
                  <path d="M9 15l-5 1 1-5" />
                </svg>
              </button>
              <input
                ref={inputRef}
                type="color"
                value={customColor}
                onChange={(e) => handlePick(e.target.value)}
                className="hidden"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BulletIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="1.5" />
      <path d="M10 6h8" />
      <circle cx="6" cy="12" r="1.5" />
      <path d="M10 12h8" />
      <circle cx="6" cy="18" r="1.5" />
      <path d="M10 18h8" />
    </svg>
  );
}

function UndoIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M9 14H5l4-4" />
      <path d="M5 14a7 7 0 1 0 7-7v3" />
    </svg>
  );
}

function Toolbar({ editor, fontSize, onIncreaseFontSize, onDecreaseFontSize, textColor, onChangeTextColor }) {
  if (!editor) {
    return null;
  }

  const [isAlignMenuOpen, setIsAlignMenuOpen] = useState(false);

  const currentTextAlign =
    editor.getAttributes("heading")?.textAlign ??
    editor.getAttributes("paragraph")?.textAlign ??
    "left";

  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className="toolbar-button rounded px-2 py-1 text-sm bg-white text-zinc-800 border border-zinc-300"
          aria-label="Undo"
          title="Undo"
        >
          <UndoIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className="toolbar-button rounded px-2 py-1 text-sm bg-white text-zinc-800 border border-zinc-300"
          aria-label="Redo"
          title="Redo"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 7v6h-6"></path>
            <path d="M21 13a9 9 0 1 1-3.6-7.2"></path>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`toolbar-button rounded px-2 py-1 text-sm ${
            editor.isActive("heading", { level: 1 })
              ? "is-active bg-zinc-900 text-white font-semibold shadow-inner"
              : "bg-white text-zinc-800 border border-zinc-300"
          }`}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`toolbar-button rounded px-2 py-1 text-sm ${
            editor.isActive("heading", { level: 2 })
              ? "is-active bg-zinc-900 text-white font-semibold shadow-inner"
              : "bg-white text-zinc-800 border border-zinc-300"
          }`}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`toolbar-button rounded px-2 py-1 text-sm ${
            editor.isActive("bold")
              ? "is-active bg-zinc-900 text-white font-semibold shadow-inner"
              : "bg-white text-zinc-800 border border-zinc-300"
          }`}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`toolbar-button rounded px-2 py-1 text-sm ${
            editor.isActive("italic")
              ? "is-active bg-zinc-900 text-white font-semibold shadow-inner"
              : "bg-white text-zinc-800 border border-zinc-300"
          }`}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`toolbar-button rounded px-2 py-1 text-sm ${
            editor.isActive("bulletList")
              ? "is-active bg-zinc-900 text-white font-semibold shadow-inner"
              : "bg-white text-zinc-800 border border-zinc-300"
          }`}
        >
          <BulletIcon className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAlignMenuOpen((value) => !value)}
            onBlur={() => setIsAlignMenuOpen(false)}
            className="toolbar-button flex items-center rounded px-2 py-1 text-sm bg-white text-zinc-800 border border-zinc-300"
            aria-haspopup="menu"
            aria-expanded={isAlignMenuOpen}
            aria-label={`Align: ${currentTextAlign}`}
            title={`Align: ${currentTextAlign}`}
          >
            <AlignIcon align={currentTextAlign} className="h-4 w-4" />
          </button>
          {isAlignMenuOpen ? (
            <div
              role="menu"
              className="absolute left-0 top-full z-10 mt-1 w-36 overflow-hidden rounded border border-zinc-200 bg-white shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setTextAlign("left").run();
                  setIsAlignMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  currentTextAlign === "left" ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <AlignIcon align="left" className="h-4 w-4" />
                Left
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setTextAlign("center").run();
                  setIsAlignMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  currentTextAlign === "center" ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <AlignIcon align="center" className="h-4 w-4" />
                Center
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setTextAlign("right").run();
                  setIsAlignMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  currentTextAlign === "right" ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <AlignIcon align="right" className="h-4 w-4" />
                Right
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setTextAlign("justify").run();
                  setIsAlignMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  currentTextAlign === "justify" ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <AlignIcon align="justify" className="h-4 w-4" />
                Justify
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 text-base text-zinc-700">
        <button
          type="button"
          onClick={onDecreaseFontSize}
          className="font-size-button text-danger bg-neutral-primary border border-danger hover:bg-danger hover:text-white focus:ring-4 focus:ring-neutral-tertiary font-medium leading-5 rounded-base text-xl px-3 py-1.5 focus:outline-none"
        >
          -
        </button>
        <span className="min-w-[2.5rem] text-center text-lg font-semibold">
          {fontSize}
        </span>
        <button
          type="button"
          onClick={onIncreaseFontSize}
          className="font-size-button text-success bg-neutral-primary border border-success hover:bg-success hover:text-white focus:ring-4 focus:ring-neutral-tertiary font-medium leading-5 rounded-base text-xl px-3 py-1.5 focus:outline-none"
        >
          +
        </button>
        <ColorPicker value={textColor} onChange={onChangeTextColor} />
      </div>
    </div>
  );
}

function PageInfo({ pageCount, currentPage }) {
  if (!pageCount) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 rounded bg-zinc-900/90 px-3 py-1 text-xs font-medium text-white shadow-lg print:hidden">
      Page {currentPage} of {pageCount}
    </div>
  );
}

export default function Home() {
  const editorRef = useRef(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [textColor, setTextColor] = useState("#000000");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      IndentRuler,
    ],
    content: "",
    immediatelyRender: false,
  });

  const updatePagination = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    const container = editorRef.current;
    const pageHeightInches = 11;
    const pageHeightPx = (pageHeightInches * window.devicePixelRatio * 96) / window.devicePixelRatio;
    const scrollHeight = container.scrollHeight;
    const newPageCount = Math.max(1, Math.ceil(scrollHeight / pageHeightPx));
    const scrollTop = container.scrollTop;
    const viewportTop = scrollTop;
    const current = Math.min(
      newPageCount,
      Math.max(1, Math.floor(viewportTop / pageHeightPx) + 1)
    );

    setPageCount(newPageCount);
    setCurrentPage(current);
  }, []);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const container = editorRef.current;
    const handleScroll = () => {
      updatePagination();
    };

    container.addEventListener("scroll", handleScroll);
    updatePagination();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [updatePagination]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleUpdate = () => {
      updatePagination();
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, updatePagination]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  const handleIncreaseFontSize = useCallback(() => {
    setFontSize((value) => Math.min(72, value + 1));
  }, []);

  const handleDecreaseFontSize = useCallback(() => {
    setFontSize((value) => Math.max(8, value - 1));
  }, []);

  const handleChangeTextColor = useCallback(
    (color) => {
      setTextColor(color);
      if (editor) {
        editor.chain().focus().setColor(color).run();
      }
    },
    [editor]
  );

  const pageMetrics = useMemo(
    () => ({
      widthIn: 8.5,
      heightIn: 11,
      marginIn: 1,
    }),
    []
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-200">
      <header className="flex items-center justify-between border-b border-zinc-300 bg-white px-6 py-3 print:hidden">
        <div className="text-sm font-semibold tracking-tight text-zinc-900">
          Tiptap Paginated Document
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-600">
            US Letter {pageMetrics.widthIn}in × {pageMetrics.heightIn}in, margins {pageMetrics.marginIn}in
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            Print / PDF
          </button>
        </div>
      </header>
      <main className="flex flex-1 justify-center overflow-hidden py-6 print:py-0">
        <div
          ref={editorRef}
          className="editor-scroll-container relative h-full w-full overflow-y-auto px-6 pb-12 pt-2 print:px-0 print:pb-0"
        >
          <div className="mb-3 mx-auto flex max-w-full flex-col rounded border border-zinc-300 bg-white shadow-sm print:border-none print:shadow-none">
            <Toolbar
              editor={editor}
              fontSize={fontSize}
              onIncreaseFontSize={handleIncreaseFontSize}
              onDecreaseFontSize={handleDecreaseFontSize}
              textColor={textColor}
              onChangeTextColor={handleChangeTextColor}
            />
            <div className="editor-page-surface">
              <Ruler editor={editor} />
              <EditorContent
                editor={editor}
                className="editor-content"
                style={{ fontSize: `${fontSize}pt` }}
              />
            </div>
          </div>
        </div>
      </main>
      <PageInfo pageCount={pageCount} currentPage={currentPage} />
    </div>
  );
}
