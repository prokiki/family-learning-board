"use client";

import { useEffect, useState } from "react";
import { AI_PROVIDERS } from "@/lib/ai-providers";

type AIConfig = {
  provider: string;
  api_key_masked: string;
  model: string;
  is_active: boolean;
  has_key: boolean;
};

export function AISettingsModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-config")
      .then((res) => res.json())
      .then((data: AIConfig) => {
        setConfig(data);
        setProvider(data.provider);
        setModel(data.model);
      })
      .catch(() => setMessage("加载配置失败"));
  }, []);

  const currentProvider = AI_PROVIDERS.find((p) => p.id === provider);
  const models = currentProvider?.models ?? [];

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: apiKey || undefined,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存失败");
      } else {
        setMessage("保存成功");
        /* 刷新配置显示 */
        const refreshRes = await fetch("/api/ai-config");
        const refreshData = await refreshRes.json();
        setConfig(refreshData);
        setApiKey("");
      }
    } catch {
      setMessage("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-20">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-card shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--line-light)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">AI 设置</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-[var(--line)] bg-[var(--card-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]"
          >
            关闭
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {!config ? (
            <p className="text-sm text-[var(--text-secondary)]">加载中...</p>
          ) : (
            <div className="space-y-5">
              {/* 服务商选择 */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">
                  AI 服务商
                </label>
                <div className="flex flex-wrap gap-2">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProvider(p.id);
                        setModel(p.models[0]?.id ?? "");
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        provider === p.id
                          ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                          : "border-[var(--line)] bg-card text-[var(--text-secondary)]"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">
                  模型
                </label>
                <div className="space-y-2">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`flex w-full items-center justify-between rounded-[12px] border p-3 text-left transition-colors ${
                        model === m.id
                          ? "border-[var(--primary)] bg-[var(--primary-light)]"
                          : "border-[var(--line)] bg-card"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${model === m.id ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                          {m.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{m.description}</p>
                      </div>
                      {model === m.id && (
                        <span className="text-sm text-[var(--primary)]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">
                  API Key
                </label>
                {config.has_key && (
                  <p className="mb-2 rounded-[10px] bg-[var(--card-alt)] px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">
                    当前：{config.api_key_masked}
                  </p>
                )}
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config.has_key ? "留空保持不变，输入新值则替换" : "粘贴你的 API Key"}
                  className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                />
              </div>

              {/* 提示信息 */}
              {message && (
                <p className={`rounded-[10px] px-3 py-2 text-sm font-medium ${
                  message.includes("成功")
                    ? "bg-[var(--success-subtle)] text-[var(--success)]"
                    : "bg-[var(--error-subtle)] text-[var(--error)]"
                }`}>
                  {message}
                </p>
              )}

              {/* 保存按钮 */}
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="w-full rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存配置"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
