"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronDown, ImagePlus, Loader2, ScanLine } from "lucide-react";
import { FORM_PRIMARY_BUTTON_CLASS } from "@/lib/ui/form-styles";

/** iOS Safari ignores programmatic clicks on `display:none` file inputs — keep them in the layout. */
const IOS_FILE_INPUT_CLASS =
  "pointer-events-none fixed left-0 top-0 -z-10 h-px w-px opacity-[0.01] overflow-hidden";

type PhotoImportDropdownProps = {
  disabled?: boolean;
  isLoading?: boolean;
  buttonLabel: string;
  onFileSelected: (file: File) => void;
};

export function PhotoImportDropdown({
  disabled = false,
  isLoading = false,
  buttonLabel,
  onFileSelected,
}: PhotoImportDropdownProps) {
  const baseId = useId().replace(/:/g, "");
  const uploadId = `${baseId}-upload`;
  const cameraId = `${baseId}-camera`;
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) {
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const menuWidth = 176;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left,
        width: menuWidth,
        zIndex: 10000,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    }
    document.addEventListener("click", closeOnOutside, true);
    return () => document.removeEventListener("click", closeOnOutside, true);
  }, [menuOpen]);

  function handleInputChange(file: File | undefined, input: HTMLInputElement | null) {
    if (input) {
      input.value = "";
    }
    if (!file) {
      return;
    }
    setMenuOpen(false);
    onFileSelected(file);
  }

  const menu = menuOpen ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className="overflow-hidden rounded-xl border border-app-border bg-panel py-1 shadow-lg"
      role="menu"
      onClick={(event) => event.stopPropagation()}
    >
      <label
        htmlFor={cameraId}
        role="menuitem"
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-app-fg active:bg-app-muted"
      >
        <Camera className="h-4 w-4 text-app-accent" />
        Take photo
      </label>
      <label
        htmlFor={uploadId}
        role="menuitem"
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-app-fg active:bg-app-muted"
      >
        <ImagePlus className="h-4 w-4 text-app-violet" />
        Upload photo
      </label>
    </div>
  ) : null;

  return (
    <>
      <input
        id={uploadId}
        type="file"
        accept="image/*"
        className={IOS_FILE_INPUT_CLASS}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => handleInputChange(event.target.files?.[0], event.currentTarget)}
      />
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className={IOS_FILE_INPUT_CLASS}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => handleInputChange(event.target.files?.[0], event.currentTarget)}
      />
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled || isLoading}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className={`inline-flex items-center gap-1.5 ${FORM_PRIMARY_BUTTON_CLASS}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ScanLine className="h-4 w-4" />
        )}
        {buttonLabel}
        <ChevronDown className="h-4 w-4 opacity-80" />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
