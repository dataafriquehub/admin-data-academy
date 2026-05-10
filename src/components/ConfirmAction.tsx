"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

type Variant = "danger" | "warning" | "primary";

type Props = {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  icon?: string;
};

const VARIANTS: Record<Variant, { iconBg: string; iconColor: string; btnConfirm: string }> = {
  danger: {
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    btnConfirm: "bg-red-500 hover:bg-red-600 text-white",
  },
  warning: {
    iconBg: "bg-secondary-5",
    iconColor: "text-secondary-1",
    btnConfirm: "bg-secondary-1 hover:bg-secondary-6 text-white",
  },
  primary: {
    iconBg: "bg-primary-5",
    iconColor: "text-primary-1",
    btnConfirm: "bg-primary-1 hover:bg-primary-2 text-white",
  },
};

const ConfirmAction = ({
  isOpen,
  onConfirm,
  onCancel,
  title = "Confirmer l'action",
  description = "Êtes-vous sûr de vouloir effectuer cette action ?",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  icon,
}: Props) => {
  const style = VARIANTS[variant] || VARIANTS.danger;

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-modal-fade"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm bg-neutral-1 rounded-2xl shadow-xl p-6 flex flex-col gap-5 animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-lg text-neutral-5 hover:text-neutral-8 hover:bg-neutral-3 transition-colors"
          aria-label="Fermer"
          type="button"
        >
          <Icon icon="solar:close-bold" width={16} height={16} />
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          {icon ? (
            <div className={`flex items-center justify-center w-14 h-14 rounded-full ${style.iconBg}`}>
              <Icon icon={icon} width={28} height={28} className={style.iconColor} />
            </div>
          ) : null}
          <h2 className="text-h6 font-semibold text-neutral-8">{title}</h2>
          <p className="text-small text-neutral-6 leading-relaxed">{description}</p>
        </div>

        <div className="flex gap-3 flex-col sm:flex-row">
          <button
            onClick={onCancel}
            type="button"
            className="flex-1 px-4 py-2.5 rounded-xl text-small font-medium border border-neutral-4 text-neutral-7 bg-neutral-1 hover:bg-neutral-3 transition-colors duration-150"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            type="button"
            className={`flex-1 px-4 py-2.5 rounded-xl text-small font-medium transition-colors duration-150 ${style.btnConfirm}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmAction;
