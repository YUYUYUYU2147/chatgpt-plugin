import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

// 隔离媒体、持久化与模型边界，执行真实聊天入口和 abstractChat。
mock.module('../../../lib/plugins/plugin.js', { defaultExport: class {} })
mock.module('../../../lib/common/common.js', { defaultExport: {} })
mock.module('../utils/tts/microsoft-azure.js', { defaultExport: {} })
mock.module('../utils/common.js', { namedExports: {
  completeJSON() {}, formatDate() {}, formatDate2() {},
  generateAudio: async (e, text) => { globalThis.__spoken.push(text); return '[语音]' },
  getDefaultReplySetting() {},
  getImageOcrText() {}, parseSourceImg: async () => false, getUin: e => e.self_id,
  getUserData: async () => ({ mode: 'responses' }), getUserReplySetting: async () => globalThis.__replySetting || {},
  isImage() {},
  makeForwardMsg: async (e, content) => { globalThis.__forwards.push(content); return '[合并转发]' },
  normalizeChatMode: mode => mode, randomString() {}, render() {}, renderUrl() {}
} })
mock.module('../utils/conversation.js', { namedExports: { deleteConversation() {}, getConversations() {}, getLatestMessageIdByConversationId() {} } })
mock.module('../utils/tts.js', { namedExports: { convertSpeaker() {}, speakers: [] } })
mock.module('../utils/face.js', { namedExports: { convertFacesAndCQCode: text => Array.isArray(text) ? text : [text] } })
mock.module('../model/conversation.js', { namedExports: { ConversationManager: class {}, originalValues: {} } })
mock.module('../utils/proxy.js', { namedExports: { getProxy() {} } })
mock.module('../utils/chat.js', { namedExports: { generateSuggestedResponse() {} } })
mock.module('../utils/postprocessors/BasicProcessor.js', { namedExports: { collectProcessors: async () => [] } })
mock.module('../utils/paimonFuction.js', { namedExports: {
  hidePrivacyInfo: text => text, removeCQCode: text => text, recognitionResultsByGemini() {},
  convertSentenceToArray: text => (Array.isArray(text) ? text : [text]).flatMap(item => String(item).split('\n').filter(Boolean)),
  extractCharacterName() {}, splitString_Enter: text => (Array.isArray(text) ? text : [text]), processCQMessage: text => text
} })
mock.module('../utils/chatCooldown.js', { defaultExport: { check: async () => ({ canChat: true }), end() {} } })
const requests = []
mock.module('../model/core.js', { defaultExport: {
  async sendMessage(...args) { requests.push(args); return { noMsg: true } }
} })
const Config = { chat_for_First_person: false, smartMode: true, enableGroupContext: false, whitelist: [], blacklist: [], promptBlockWords: [] }
mock.module('../utils/config.js', { namedExports: { Config } })
globalThis.Bot = { uin: [] }
globalThis.redis = { get: async () => null }
globalThis.logger = { info() {}, error(error) { throw error } }
const { chatgpt } = await import('../apps/chat.js')
const { groupReply } = await import('../utils/groupReply.js')
const Core = (await import('../model/core.js')).default

test('回复正文在发送前完成号码脱敏，未配置时保持原样', async t => {
  const previous = { ...Config }
  t.after(() => {
    for (const key of Object.keys(Config)) delete Config[key]
    Object.assign(Config, previous)
    delete redis.set
  })
  Object.assign(Config, { blockWords: [], rateLimiting: 0, redactPrivateNumbers: '1390963734' })
  redis.set = async () => 'OK'
  const sent = []
  t.mock.method(Core, 'sendMessage', async () => ({ text: '他QQ号是1390963734，别忘了', conversationId: '', id: 'reply-id' }))
  const e = {
    isGroup: true, group_id: '100', self_id: '999', user_id: '123',
    sender: { user_id: '123', role: 'member' }, msg: '他QQ号多少', message: []
  }
  const chat = Object.create(chatgpt.prototype)
  chat.e = e
  chat.reply = async msg => { sent.push(msg) }
  await chat.abstractChat(e, e.msg, 'responses', false, { automatic: true })
  assert.equal(sent.length, 1)
  assert.doesNotMatch(String(sent[0]), /1390963734/)
  assert.match(String(sent[0]), /他QQ号是\*{10}，别忘了/)

  // 未配置号码时同一路径不做替换
  Config.redactPrivateNumbers = ''
  sent.length = 0
  await chat.abstractChat(e, e.msg, 'responses', false, { automatic: true })
  assert.equal(sent.length, 1)
  assert.equal(String(sent[0]), '他QQ号是1390963734，别忘了')
})

test('原本漏网的语音、图片、合并转发与分句出口同样完成脱敏', async t => {
  const previous = { ...Config }
  t.after(() => {
    for (const key of Object.keys(Config)) delete Config[key]
    Object.assign(Config, previous)
    delete redis.set
    delete globalThis.__replySetting
  })
  Object.assign(Config, {
    blockWords: [], rateLimiting: 0, redactPrivateNumbers: '1390963734',
    ttsRegex: '', alsoSendText: false
  })
  redis.set = async () => 'OK'
  t.mock.method(Core, 'sendMessage', async () => ({
    text: '第一句他QQ号是1390963734\n第二句还是1390963734', conversationId: '', id: 'reply-id'
  }))
  const e = {
    isGroup: true, group_id: '100', self_id: '999', user_id: '123',
    sender: { user_id: '123', role: 'member' }, msg: '他QQ号多少', message: []
  }

  const run = async () => {
    const sent = []
    globalThis.__spoken = []
    globalThis.__forwards = []
    const chat = Object.create(chatgpt.prototype)
    chat.e = e
    chat.reply = async msg => { sent.push(msg) }
    chat.renderImage = async (target, use, response) => { sent.push(response) }
    return { chat, sent }
  }
  const assertNoNumber = (payload) => assert.doesNotMatch(JSON.stringify(payload), /1390963734/)

  // 语音模式：合成文本也要掩码，否则号码被念出来
  globalThis.__replySetting = { useTTS: true }
  let { chat, sent } = await run()
  await chat.abstractChat(e, e.msg, 'responses', false, { automatic: true })
  assert.deepEqual(globalThis.__spoken.length, 1)
  assertNoNumber(globalThis.__spoken)
  globalThis.__replySetting = {}

  // 图片模式：渲染正文取自同一变量
  ;({ chat, sent } = await run())
  await chat.abstractChat(e, e.msg, 'responses', true, { automatic: true })
  assert.equal(sent.length, 1)
  assertNoNumber(sent[0])

  // 合并转发与分句：切分前已脱敏，两条分支都拿不到原号码
  Config.auto_makeForwardMsg = 5
  ;({ chat, sent } = await run())
  await chat.abstractChat(e, e.msg, 'responses', false, { automatic: true })
  assert.equal(globalThis.__forwards.length, 1)
  assertNoNumber(globalThis.__forwards[0])
  Config.auto_makeForwardMsg = 0

  Config.isConvertSentenceToArrayReply = true
  ;({ chat, sent } = await run())
  await chat.abstractChat(e, e.msg, 'responses', false, { automatic: true })
  assert.equal(sent.length, 2)
  assertNoNumber(sent)
})

test('自主回复复用正常聊天入口和用户模式，不传禁用工具参数，仍受黑名单约束', async () => {
  const e = {
    isGroup: true, group_id: '100', group: { group_id: '100' }, self_id: '999', user_id: '123',
    sender: { user_id: '123', role: 'member' }, msg: '开放话题', raw_message: '开放话题', message: [],
    message_id: 'selected-message', seq: 101
  }
  const chat = Object.create(chatgpt.prototype)
  chat.e = e
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  assert.equal(requests.length, 1)
  const [prompt, , use, target, options] = requests[0]
  assert.equal(prompt, '开放话题')
  assert.equal(use, 'responses')
  assert.equal(target, e)
  assert.equal(target.message_id, 'selected-message')
  assert.equal(target.seq, 101)
  assert.deepEqual(options.settings, { enableGroupContext: true, groupContextFromLatest: true })
  assert.equal(Config.enableGroupContext, false)
  assert.equal(options?.disableTools, undefined)
  assert.equal(options?.enableSmart, undefined)
  assert.equal(Config.smartMode, true)
  Config.blacklist = ['^123']
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  assert.equal(requests.length, 1)
})

test('聊天记忆日志按实际注入条目计数，不能把非空召回显示为零条', async (t) => {
  const { MemoryStore } = await import('../utils/memory/store.js')
  const candidates = [
    { factKey: 'identity.nickname', factValue: '小玉', text: '用户昵称小玉' },
    { factKey: 'preference.coffee', factValue: 'hand_brew', text: '用户偏好手冲咖啡' },
    { factKey: 'preference.sport', factValue: 'basketball', text: '用户爱打篮球' }
  ].map(m => ({ ...m, scope: 'user', ownerId: '123', status: 'active', importance: 0.8, confidence: 0.9 }))
  // 只替换存储边界，真实执行召回筛选、正文格式化和聊天入口日志。
  t.mock.method(MemoryStore.prototype, 'listRecallCandidates', async () => candidates)
  const logs = []
  t.mock.method(globalThis.logger, 'info', message => logs.push(message))
  const previousEnableMemory = Config.enableMemory
  Config.enableMemory = true
  t.after(() => { Config.enableMemory = previousEnableMemory })
  requests.length = 0
  const e = {
    isGroup: true, group_id: '100', self_id: '999', user_id: '123',
    sender: { user_id: '123', role: 'member' }, msg: '咖啡怎么冲', message: []
  }
  const chat = Object.create(chatgpt.prototype)
  chat.e = e
  await chat.abstractChat(e, e.msg, 'responses', false, { automatic: true })
  assert.equal(requests.length, 1)
  const [prompt] = requests[0]
  assert.match(prompt, /用户昵称小玉/)
  assert.match(prompt, /用户偏好手冲咖啡/)
  assert.doesNotMatch(prompt, /用户爱打篮球/)
  assert.deepEqual(logs.filter(message => message.startsWith('[Memory]')), [
    '[Memory] 为用户 123 召回了 2 条相关记忆'
  ])
})

test('自主回复消耗共享限额并复查，直接呼叫超限后不转自主回复，权限拦截仍生效', async t => {
  const previous = { ...Config }
  t.after(() => {
    for (const key of Object.keys(Config)) delete Config[key]
    Object.assign(Config, previous)
    groupReply.prune()
  })
  Object.assign(Config, {
    rateLimiting: 1, blacklist: [], whitelist: [], chat_for_First_person: true,
    groupReply: { enabled: true, groups: [{ groupId: '100', switchOn: true }] }
  })
  let count = 0
  const expirations = []
  const rateCalls = []
  let blocked = false, muted = false
  t.mock.method(redis, 'get', async key => {
    if (key.startsWith('CHATGPT:rateLimit')) rateCalls.push(key)
    if (key.startsWith('CHATGPT:SHUT_UP:')) return muted ? '1' : null
    if (key.startsWith('CHATGPT:blockUser:')) return blocked ? '{}' : null
    return null
  })
  redis.incr = async key => { rateCalls.push(key); return ++count }
  redis.expire = async (...args) => { expirations.push(args) }
  t.after(() => { delete redis.incr; delete redis.expire })
  const e = {
    isGroup: true, group_id: '100', group: { group_id: '100' }, self_id: '999', user_id: '123',
    sender: { user_id: '123', role: 'member' }, msg: '开放话题', raw_message: '开放话题',
    message: [], message_id: 'rate-limit-message', reply: async () => {}
  }
  const chat = Object.create(chatgpt.prototype)
  chat.e = e
  requests.length = 0
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  assert.equal(requests.length, 1)
  assert.deepEqual(rateCalls, ['CHATGPT:rateLimit_fifteen:123'])
  assert.equal(count, 1)
  assert.deepEqual(expirations, [['CHATGPT:rateLimit_fifteen:123', 900]])
  // 预筛之后额度也可能被并发请求用完，正式入口必须再次拒绝。
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  assert.equal(requests.length, 1)
  assert.equal(count, 2)

  for (const kind of ['at', 'command', 'name']) {
    const direct = { ...e, message_id: kind, msg: kind === 'command' ? '#chat 问题' : '派蒙问题', atme: kind === 'at' }
    chat.e = direct
    chat.toggleMode = kind === 'command' ? 'command' : 'at'
    groupReply.observe({ ...e, message_id: `pending-${kind}` })
    groupReply.observe(direct)
    if (kind === 'name') await chat.chatgpt_for_firstperson_call(direct)
    else await chat.chatgpt(direct)
    assert.equal(requests.length, 1, `${kind} 超限不调用模型`)
    assert.equal(groupReply.groups.get('999:100').pending.size, 0, `${kind} 不留自主回复候选`)
  }
  assert.equal(count, 5)
  chat.e = e
  Config.rateLimiting = 0
  Config.blacklist = ['^123']
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  Config.blacklist = []
  Config.whitelist = ['^456']
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  Config.whitelist = []
  blocked = true
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  blocked = false
  muted = true
  await chat.chatgpt_for_firstperson_call(e, { automatic: true })
  assert.equal(requests.length, 1)
  assert.equal(count, 5)
})
