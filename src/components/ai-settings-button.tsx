"use client";

import { useState } from "react";
import { AISettingsModal } from "./ai-settings";

export function AISettingsButton({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nav-button"
      >
        ⚙ AI 设置
      </button>
      {open && <AISettingsModal boardId={boardId} onClose={() => setOpen(false)} />}
    </>
  );
}
