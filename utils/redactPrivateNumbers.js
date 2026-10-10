/**
 * 回复文本中的私密号码脱敏。
 *
 * 提示词层的禁止外泄属于软约束：长对话中模型仍可能将号码与"某位特定用户"
 * 一类表达自然衔接，或在追问下变形输出。此处作为发送前的最后一道硬过滤，
 * 命中即替换为等长掩码，确保号码不进入聊天记录。
 */

/**
 * 把配置里的号码列表解析成去重后的纯数字串数组。
 *
 * @param {string|string[]|undefined} raw 逗号/分号/空白分隔的号码，或已是数组
 * @returns {string[]} 去重后的纯数字串，每项至少 4 位
 */
export function parsePrivateNumbers(raw) {
  const parts = Array.isArray(raw) ? raw : String(raw || '').split(/[,;\s]+/)
  const seen = new Set()
  for (const part of parts) {
    const digits = String(part).replace(/\D/g, '')
    // 下限取 4 位：更短的片段会与"第 3 组""LV51"等正常内容大面积冲突
    if (digits.length >= 4) seen.add(digits)
  }
  return [...seen]
}

/**
 * 构造脱敏替换函数。
 *
 * 除完整号码外，另覆盖两类常见变形：号码嵌入更长数字串（末位追加一位），
 * 以及首位补 0 的手机号写法。
 *
 * @param {string|string[]|undefined} raw 待脱敏的号码
 * @returns {(text: string) => string} 替换函数
 */
export function createRedactor(raw) {
  const numbers = parsePrivateNumbers(raw)
  if (numbers.length === 0) return (text) => text

  // 长号优先匹配，避免短号先行命中后残留数字片段
  const sorted = numbers.slice().sort((a, b) => b.length - a.length)

  // 允许号码数字之间插入空格或连字符分组。
  // 匹配要求完整数字序列连续出现，不会与正常内容冲突。
  const spaced = sorted
    .map((n) => `0*[\\s-]*${n.split('').join('[\\s-]*')}`)
    .join('|')
  const pattern = new RegExp(sorted.map((n) => `0*${n}`).join('|'), 'g')
  const spacedPattern = new RegExp(spaced, 'g')

  return (text) => {
    if (typeof text !== 'string' || !text) return text
    return text
      .replace(spacedPattern, (matched) => '*'.repeat(matched.replace(/\D/g, '').length || matched.length))
      .replace(pattern, (matched) => '*'.repeat(matched.length))
  }
}
/** 把全角标点与空格归一，便于招呼语按「词」比较而非逐字符 */
function normalize(text) {
  return String(text || '')
    .replace(/[！!]/g, '!')
    .replace(/[，,]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/[？?]/g, '?')
    .replace(/[：:]/g, ':')
    .replace(/[、]/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 将招呼语与正文拆分为独立消息。
 *
 * 提示词要求招呼语独占一条，但模型仍常将其拼在正文前（无工具调用时尤其明显）。
 * 格式类要求交由提示词并不稳妥，故在发送前强制拆分。
 *
 * 比较前会把全角标点归一：锅巴里常配成半角「Ciallo!」，而模型倾向输出
 * 全角「Ciallo！」，此前按原字符串比对导致两者不匹配，拆分静默失效。
 *
 * @param {string} text 回复文本
 * @param {string} greeting 招呼语，为空时不拆分
 * @returns {string[]} 待发送的消息片段
 */
export function splitGreeting(text, greeting) {
  if (typeof text !== 'string' || !text) return [text]
  const rawPrefix = String(greeting || '').trim()
  if (!rawPrefix) return [text]

  const trimmed = text.trimStart()
  const normPrefix = normalize(rawPrefix)
  const normText = normalize(trimmed)
  if (!normPrefix || !normText) return [text]
  if (!normText.startsWith(normPrefix)) return [text]

  // 按归一后的前缀长度回切原文：逐字符推进直到归一结果与 normPrefix 等长，
  // 这样切出的 rest 仍保留模型原始的大小写与标点
  let cut = 0
  let normalized = ''
  while (cut < trimmed.length) {
    normalized = normalize(trimmed.slice(0, cut + 1))
    cut++
    if (normalized.length >= normPrefix.length) break
  }
  const rest = trimmed.slice(cut).replace(/^[\s，,、:：。.!！?？~-]+/, '')
  // 其余为空说明本条仅有招呼语，无需拆分
  if (!rest) return [text]
  return [trimmed.slice(0, cut).trim(), rest]
}
