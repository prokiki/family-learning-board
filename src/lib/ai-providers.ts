export type AIProvider = {
  id: string;
  name: string;
  baseURL?: string; // 自定义 API 地址（OpenAI 兼容接口）
  models: AIModel[];
};

export type AIModel = {
  id: string;
  name: string;
  description: string;
};

/**
 * 支持的 AI 服务商和模型列表
 * 所有服务商都使用 OpenAI 兼容接口格式
 */
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "极速低价，日常轻量任务" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "快速均衡，推荐日常使用" },
      { id: "gpt-4.1", name: "GPT-4.1", description: "最强非推理模型，复杂任务" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "多模态，支持图片/音频" },
      { id: "gpt-4o", name: "GPT-4o", description: "多模态旗舰，支持图片/音频" },
      { id: "o4-mini", name: "o4-mini", description: "推理模型，数学/编码强" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    baseURL: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "均衡之选，推荐" },
      { id: "claude-haiku-3-20250414", name: "Claude Haiku 3", description: "快速且便宜" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3.2", description: "最新旗舰，GPT-5 级性能" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner", description: "深度推理增强" },
    ],
  },
  {
    id: "zhipu",
    name: "智谱 AI (GLM)",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    models: [
      { id: "glm-4-flash", name: "GLM-4 Flash", description: "免费快速" },
      { id: "glm-4-plus", name: "GLM-4 Plus", description: "高质量" },
      { id: "glm-4.5-flash", name: "GLM-4.5 Flash", description: "新一代快速模型" },
      { id: "glm-4.7", name: "GLM-4.7", description: "最新旗舰，编码强" },
    ],
  },
  {
    id: "qwen",
    name: "通义千问 (Qwen)",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-turbo", name: "Qwen Turbo", description: "快速便宜" },
      { id: "qwen-plus", name: "Qwen Plus", description: "均衡之选" },
      { id: "qwen-max", name: "Qwen Max", description: "最强模型" },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseURL: "https://api.minimax.io/v1",
    models: [
      { id: "MiniMax-M2.7", name: "MiniMax M2.7", description: "最新旗舰" },
      { id: "MiniMax-M2.7-highspeed", name: "M2.7 极速", description: "同性能更快" },
      { id: "MiniMax-M2.5", name: "MiniMax M2.5", description: "性价比高" },
      { id: "MiniMax-M2.5-highspeed", name: "M2.5 极速", description: "同性能更快" },
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    baseURL: "https://api.moonshot.ai/v1",
    models: [
      { id: "kimi-k2.5", name: "Kimi K2.5", description: "最新旗舰模型" },
      { id: "kimi-k2", name: "Kimi K2", description: "均衡性能与速度" },
      { id: "moonshot-v1-8k", name: "Moonshot v1 8K", description: "快速轻量" },
    ],
  },
];

export function getProvider(providerId: string) {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}

export function getProviderModel(providerId: string, modelId: string) {
  const provider = getProvider(providerId);
  return provider?.models.find((m) => m.id === modelId);
}
