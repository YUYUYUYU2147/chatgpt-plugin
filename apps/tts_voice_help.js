import plugin from '../../../lib/plugins/plugin.js';
import common from '../../../lib/common/common.js';
import { Config } from '../utils/config.js'
import {
    getUserReplySetting,
    parseSourceImg,
    generateAudio,
} from '../utils/common.js'
import {
    get_matce_cn_speaker,
    speakers,
    vits_emotion_map,
    post_to_api_fish_audio_for_token
} from '../utils/tts.js'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'
import cfg from '../../../lib/config/config.js'
import {
    recognitionResultsByGemini,
    url2Base64,
} from '../utils/paimonFuction.js'
import sfApi from '../utils/tts/siliconflow.js';
import { getOnebotFileOrMediaUrl } from '../utils/paimonFuction.js';

const paimonChuoYiChouSavePicDirectory = `${process.cwd()}/data/autoEmoticons/PaimonChuoYiChouPictures/savePics`
const sleep_pai = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

export class voicechangehelp extends plugin {
    constructor() {
        super({
            name: 'tts语音替换帮助',
            dsc: 'tts语音替换帮助',
            event: 'message',
            priority: 999,
            rule: [
                {
                    reg: `^#tts(语音)?(替换)?帮助`,
                    fnc: 'voicechangehelp'
                },
                {
                    reg: '^#tts情感(设置)?(帮助)?',
                    fnc: 'set_vits_emotion',
                },
                {
                    reg: '^#tts语言设置(帮助)?',
                    fnc: 'set_tts_language',
                    permission: 'master'
                },
                {
                    reg: '^#ttslength(Scale)?设置(帮助)?',
                    fnc: 'set_lengthScale',
                    permission: 'master'
                },
                {
                    reg: '^#tts(语音)?转日语(帮助)?',
                    fnc: 'set_autoJapanese',
                    permission: 'master'
                },
                {
                    reg: '^#tts(语音)?切片生成(帮助)?',
                    fnc: 'set_tts_slice_is_slice_generation',
                    permission: 'master'
                },
                {
                    reg: '^#chatgpt设置(AI|ai)?第一人称(称谓)?(帮助)?',
                    fnc: 'set_firstPerson',
                    permission: 'master'
                },
                {
                    reg: '^#tts(设置|查看)?融合文本(帮助)?',
                    fnc: 'set_style_text',
                },
                {
                    reg: '^#tts(设置|查看)?融合权重(帮助)?',
                    fnc: 'set_style_text_weights',
                },
                {
                    reg: '^#chatgpt(设置|查看)?输出黑名单(帮助)?',
                    fnc: 'set_blockWords',
                    permission: 'master'
                },
                {
                    reg: '^#chatgpt(设置|查看)?输入黑名单(帮助)?',
                    fnc: 'set_promptBlockWords',
                    permission: 'master'
                },
                {
                    reg: '^#tts(删除|重置)所有(chatgpt)?用户(回复|单独)设置',
                    fnc: 'delete_redis_all_user_config',
                    permission: 'master'
                },
                {
                    reg: '^#派蒙戳一戳设置(CD|cd)',
                    fnc: 'chuo_set_paimon_chou_cd',
                    permission: 'master'
                },
                {
                    reg: '^#派蒙戳(一戳)?(保存|添加)(图片|表情(包)?)$',
                    fnc: 'paimon_chuo_save_img',
                    permission: 'master'
                },
                {
                    reg: '^#tts(可选)?人物(可选)?列表$',
                    fnc: 'tts_show_speakers',
                },
                {
                    reg: '^#tts查看((当|目)前)?(语音)?设置$',
                    fnc: 'show_tts_voice_help_config',
                    permission: 'master'
                },
                {
                    reg: '^#chatgpt对话中图片识别(帮助)?',
                    fnc: 'set_recognitionByGemini',
                    permission: 'master'
                },
                {
                    reg: '^#派蒙tts查看fish用量$',
                    fnc: 'paimon_tts_check_fish_audio_token_usage',
                    permission: 'master'
                },
                {
                    reg: '^#派蒙tts强制刷新fish账号$',
                    fnc: 'paimon_tts_refresh_fish_account_token',
                    permission: 'master'
                },
                {
                    reg: '^#搜索fish发音人(.*)$',
                    fnc: 'searchFishVoices'
                },
                {
                    reg: '^#派蒙chatgpt立即执行每日自动任务$',
                    fnc: 'paimon_tts_Auto_tasker',
                    permission: 'master'
                },
                {
                    reg: '^#派蒙tts测试$',
                    fnc: 'paimon_tts_test',
                    permission: 'master'
                },
                {
                    reg: '^#删除所有(gemini|Gemini)(对话|会话)记录$',
                    fnc: 'delete_redis_all_gemini_msg',
                    permission: 'master'
                },
                {
                    reg: /^#gpt偷(图|表情包?)$/i,
                    fnc: 'save_EmojiImg',
                },
                {
                    // 删除是破坏性操作，权限只给主人，不套用偷图那个白名单 ——
                    // 白名单是「谁能往里加」，用在「谁能删」上太松。
                    reg: /^#gpt删(图|表情包?)(?:\s+(.*))?$/i,
                    fnc: 'delete_EmojiImg',
                    permission: 'master',
                },
                {
                    reg: /^#(chat)?gptsf语音模型(创建|删除|列表|上传|新增)$/i,
                    fnc: 'handleSfVoiceManage',
                    permission: 'master'
                },
                {
                    reg: /^#(chat)?gpt发语音/i,
                    fnc: 'manualSendTTSAudio',
                },
            ]
        })
        this.task = [
            {
                // 每日 0:01 am
                cron: '0 1 0 * * ?',
                name: '派蒙tts自动任务',
                fnc: this.paimon_tts_Auto_tasker.bind(this)
            },
        ]
    }

    /** /^#(chat)?gpt发语音/i */
    async manualSendTTSAudio(e) {
        if (!e.isMaster && !Config.enableManualSendTTSAudio) {
            return false;
        }
        const message = e.msg.replace(/^#(chat)?gpt发语音/i, '').trim();
        if (!message) {
            await e.reply('请提供需要转化为语音的文字内容，例如：#gpt发语音 早上好！', true);
            return true;
        }
        try {
            const sendable = await generateAudio(e, message, undefined, 1, { noTranslate: true });
            if (sendable) {
                await e.reply(sendable);
            } else {
                await e.reply('语音生成失败，请检查TTS配置或后台日志。', true);
            }
        } catch (err) {
            logger.error('手动发送语音异常：', err);
            await e.reply(`语音生成出现错误: ${err.message}`, true);
        }
        return true;
    }

    /** /^#(chat)?gptsf语音模型(创建|删除|列表|上传|新增)$/i */
    async handleSfVoiceManage(e) {
        /** make 列表 */
        async function buildVoiceListForwardMsg(e, localApi, title) {
            let msgArr = [title];
            let currIdx = Config.siliconflow_Voice_Current_Index || 0;
            localApi.forEach((v, idx) => {
                let isCurr = (currIdx === idx + 1) ? ' 【当前使用】' : '';
                msgArr.push(`[${idx + 1}] 备注名: ${v.remark || '未命名'}${isCurr}\nID: ${v.siliconflow_Voice_ReferenceId}`);
            });
            msgArr.push("可用指令：\n #gptsf语音模型(创建|删除|列表)");
            return await common.makeForwardMsg(e, msgArr, e.msg);
        }
        // 1. 获取配置中的 API Key
        const apiKey = Config.siliconflow_Voice_ApiKey;
        if (!apiKey) {
            return await e.reply("请先在锅巴面板中配置 siliconflow_Voice_ApiKey", true);
        }

        const action = e.msg.replace(/#(chat)?gptsf语音模型/i, '').trim();

        // ======= 【列表查询 / 同步 / 选择】 =======
        if (action === '列表') {
            await e.reply("正在获取云端列表并同步到本地配置，请稍候...", true);
            const res = await sfApi.listVoices(apiKey);

            let localApi = [...(Config.siliconflow_VoiceApi || [])];
            let addedCount = 0;
            let hasChanges = false;
            if (!res.error && res.result) {
                const cloudIdSet = new Set(res.result.map(v => v.uri));
                res.result.forEach(v => {
                    const exists = localApi.find(item => item.siliconflow_Voice_ReferenceId === v.uri);
                    if (exists) {
                        // 如果之前标记了“云端不存在”，现在云端又出现了，则移除标记
                        if (exists.remark && exists.remark.endsWith('(云端不存在)')) {
                            exists.remark = exists.remark.slice(0, -'(云端不存在)'.length).trim();
                            hasChanges = true;
                        }
                        // 更新 model 和 text（remark 保持已处理的结果）
                        if (exists.siliconflow_Voice_Model !== v.model || exists.siliconflow_Voice_ReferenceText !== v.text) {
                            exists.siliconflow_Voice_Model = v.model;
                            exists.siliconflow_Voice_ReferenceText = v.text;
                            hasChanges = true;
                        }
                    } else {
                        // 不存在则新增
                        localApi.push({
                            siliconflow_Voice_Model: v.model,
                            siliconflow_Voice_ReferenceId: v.uri,
                            siliconflow_Voice_ReferenceText: v.text,
                            remark: v.customName
                        });
                        addedCount++;
                        hasChanges = true;
                    }
                });
                // 标记本地有但云端不存在的音色
                for (let item of localApi) {
                    if (!cloudIdSet.has(item.siliconflow_Voice_ReferenceId)) {
                        let base = item.remark || '未命名';
                        if (!base.endsWith('(云端不存在)') && !base.endsWith('(系统预置音色)')) {
                            item.remark = base + '(云端不存在)';
                            hasChanges = true;
                        }
                    }
                }
            }
            if (hasChanges) {
                Config.siliconflow_VoiceApi = localApi;
            }

            if (localApi.length === 0) {
                return await e.reply("当前本地配置及账号下均无自定义音色。\n(提示: 使用自定义音色前需在SiliconFlow官网完成实名认证)\n可用指令：#gptsf语音模型(创建|删除|列表)", true);
            }

            let titleText = `同步完成 (新增 ${addedCount} 个)\n当前共有 ${localApi.length} 个本地音色配置`;
            let forwardMsg = await buildVoiceListForwardMsg(e, localApi, titleText);
            await e.reply(forwardMsg);

            await e.reply(`请在60秒内回复【序号】切换发音人 (发送 0 取消)`, true, { recallMsg: 59 });

            const e_index = await this.awaitContext();
            if (!e_index || !e_index.msg || ['0', '退出', '取消'].includes(e_index.msg.trim())) {
                return await e.reply('[SF音色选择] 操作已取消。', true);
            }

            const selIdx = parseInt(e_index.msg.trim());
            if (isNaN(selIdx)) {
                return await e.reply('输入的序号无效，操作取消。', true);
            }
            if (selIdx < 1 || selIdx > localApi.length) {
                return await e.reply('序号超出范围，操作取消。', true);
            }

            Config.siliconflow_Voice_Current_Index = selIdx;
            return await e.reply(`切换成功！当前正在使用发音人: [${selIdx}] ${localApi[selIdx - 1].remark}`, true);
        }

        // ======= 【删除流程】 =======
        if (action === '删除') {
            // 直接读取本地配置作为删除列表的依据
            let localApi = [...(Config.siliconflow_VoiceApi || [])];

            if (localApi.length === 0) {
                return await e.reply("本地配置中暂无自定义音色，无法执行删除。", true);
            }

            let titleText = `【音色删除】当前共有 ${localApi.length} 个本地音色配置`;
            let forwardMsg = await buildVoiceListForwardMsg(e, localApi, titleText);
            await e.reply(forwardMsg);

            await e.reply(`请在60秒内回复您要删除的音色【序号】（发送 0 或 退出 取消）`, true, { recallMsg: 59 });

            const e_index = await this.awaitContext();
            if (!e_index || !e_index.msg || ['0', '退出', '取消'].includes(e_index.msg.trim())) {
                return await e.reply('[SF音色删除] 操作已取消。', true);
            }

            const idx = parseInt(e_index.msg.trim()) - 1;
            if (isNaN(idx) || idx < 0 || idx >= localApi.length) {
                return await e.reply('输入的序号无效，操作取消。', true);
            }

            const targetVoice = localApi[idx];

            await e.reply(`确认要【从云端删除音色】 ${idx + 1}. [${targetVoice.remark || '未命名'}] 吗？（确认/取消）`, true, { recallMsg: 59 });
            const e_Confir = await this.awaitContext();
            if (!e_Confir || !e_Confir.msg || e_Confir.msg.trim() !== '确认') {
                return await e.reply('[SF音色删除] 操作已取消。', true);
            }

            await e.reply(`正在尝试从云端删除音色 [${targetVoice.remark || '未命名'}] ...`, true);

            let cloudDeleteSuccess = false;
            let cloudErrorMsg = "";
            try {
                const delRes = await sfApi.deleteVoice(apiKey, targetVoice.siliconflow_Voice_ReferenceId);

                // 综合判断 SiliconFlow API 的返回是否包含错误特征
                if (delRes && delRes.error) {
                    cloudErrorMsg = typeof delRes.error === 'string' ? delRes.error : (delRes.error.message || JSON.stringify(delRes.error));
                } else if (delRes && delRes.status && delRes.status >= 400) {
                    cloudErrorMsg = delRes.message || `HTTP 错误码: ${delRes.status}`;
                } else if (delRes && typeof delRes.code !== 'undefined' && delRes.code !== 0 && delRes.code !== 20000 && delRes.code !== 200) {
                    cloudErrorMsg = delRes.message || `错误码: ${delRes.code}`;
                } else if (delRes && delRes.message && !delRes.code && !delRes.status && !delRes.id && !delRes.uri) {
                    cloudErrorMsg = delRes.message;
                } else {
                    cloudDeleteSuccess = true;
                }
            } catch (err) {
                cloudErrorMsg = err.message;
            }

            // 若云端删除未成功，询问是否要继续清理本地
            if (!cloudDeleteSuccess) {
                await e.reply(`⚠️ 云端删除未成功 (或记录已不存在)。\n原因提示：${cloudErrorMsg}\n\n是否仍然要强制删除本地的该音色配置？\n请在60秒内回复【是】或【否】(1/0)`, true);
                const e_confirm = await this.awaitContext();
                if (!e_confirm || !e_confirm.msg) {
                    return await e.reply('[SF音色删除] 操作已取消，未删除本地配置。', true);
                }
                const confirmMsg = e_confirm.msg.trim();
                if (!['是', '1', 'y', 'yes', '确认', '确定'].includes(confirmMsg.toLowerCase())) {
                    return await e.reply('[SF音色删除] 操作已取消，未删除本地配置。', true);
                }
            }

            // 执行本地删除
            localApi.splice(idx, 1);
            Config.siliconflow_VoiceApi = localApi;

            let syncMsg = '';
            let currIdx = Config.siliconflow_Voice_Current_Index || 0;

            if (currIdx === idx + 1) {
                // 删除的是正在使用的发音人，将序号重置为 0 (关闭状态)
                Config.siliconflow_Voice_Current_Index = 0;
                syncMsg = '\n本地同步：因删除了当前发音人，已自动关闭SF转语音。';
            } else if (currIdx > idx + 1) {
                // 删除了当前使用之前的项，当前序号减一，防止数组错位导致发音人改变
                Config.siliconflow_Voice_Current_Index = currIdx - 1;
                syncMsg = '\n本地同步：已移除本地配置，并自动更正当前发音人序号。';
            } else {
                syncMsg = '\n本地同步：已移除本地配置。';
            }

            return await e.reply(`✅ 删除操作完成。${syncMsg}\n请通过 #gptsf语音模型列表 检查当前配置。`, true);
        }

        // ======= 【创建/上传流程】 =======
        if (['上传', '创建', '新增'].includes(action)) {
            await e.reply("【SF音色创建指引】\n(注: 1. 此功能需要您的SF账号已实名认证；2. 音频时长建议8～10秒)\n\n请在120秒内发送新音色的【名称】(只能包含字母、数字、_、-，且不超过64字符，发送0取消)：", true);

            // 步骤 1：获取名称
            const e_name = await this.awaitContext();
            if (!e_name || !e_name.msg || e_name.msg.trim() === '0') return await e.reply('操作已取消', true);
            const customName = e_name.msg.trim();
            if (!(/^[A-Za-z0-9_-]{1,64}$/.test(customName))) {
                return await e.reply("操作已取消: 【名称】(只能包含字母、数字、_、-，且不超过64字符)", true);
            }

            // 步骤 2：获取使用模型
            await e.reply(`音色名称记录为: "${customName}"\n\n请选择语音模型：\n1. FunAudioLLM/CosyVoice2-0.5B （推荐）\n2. fnlp/MOSS-TTSD-v0.5\n或直接输入完整模型名称（发送 0 取消）：`, true);
            const e_model = await this.awaitContext();
            if (!e_model || !e_model.msg || e_model.msg.trim() === '0') return await e.reply('操作已取消', true);
            let selectedModel = '';
            const modelInput = e_model.msg.trim();
            if (modelInput === '1') {
                selectedModel = "FunAudioLLM/CosyVoice2-0.5B";
            } else if (modelInput === '2') {
                selectedModel = "fnlp/MOSS-TTSD-v0.5";
            } else {
                selectedModel = e_model.msg.trim();
                if (!selectedModel) return await e.reply('操作已取消', true);
            }

            // 步骤 3：获取参考文本
            await e.reply(`使用模型: "${selectedModel}"\n\n请在120秒内发送该【参考文本】(音频对应的文字内容)(发送0取消)：`, true);
            const e_text = await this.awaitContext();
            if (!e_text || !e_text.msg || e_text.msg.trim() === '0') return await e.reply('操作已取消');
            const referenceText = e_text.msg.trim();

            // 步骤 4：获取语音/音频文件
            await e.reply(`参考文本已记录。\n\n请在120秒内发送一段【语音】或【音频文件】(建议8-10秒，无杂音，发送0取消)：`, true);
            const e_audio = await this.awaitContext();
            if (!e_audio || (e_audio.msg && e_audio.msg.trim() === '0')) return await e.reply('操作已取消', true);

            // 解析 Yunzai 消息中的音频 URL
            let audioUrl = '';
            for (let msg of e_audio.message) {
                if (msg.type === 'record' || msg.type === 'audio' || msg.type === 'file') {
                    audioUrl = await getOnebotFileOrMediaUrl(e_audio, msg);
                    if (audioUrl) break;
                }
            }
            if (!audioUrl) {
                return await e.reply('未检测到有效的语音/音频内容，操作取消。', true);
            }

            await e.reply('正在获取并转换音频，请稍候...', true);
            let audioBase64 = '';
            try {
                const rawBase64 = await url2Base64(audioUrl, false, false, { maxSizeBytes: 10 * 1024 * 1024 }, e);

                if (!rawBase64) {
                    // 如果返回 null，说明解析/下载失败，url2Base64 内部已自动 e.reply 提示用户，直接 return 即可。
                    return;
                }

                // 拼接 API 需要的数据前缀
                audioBase64 = `data:audio/mpeg;base64,${rawBase64}`;

            } catch (err) {
                return await e.reply(`音频获取/转换失败：${err.message}`, true);
            }

            // 步骤 5：发起API请求（使用用户选择的模型）
            await e.reply(`资料收集完毕，正在向 SiliconFlow 提交...\n模型: ${selectedModel}`, true);
            try {
                const result = await sfApi.uploadVoice(apiKey, selectedModel, customName, audioBase64, referenceText);
                if (result.uri) {
                    // 同步到本地配置并设定为当前发音人
                    let localApi = [...(Config.siliconflow_VoiceApi || [])];
                    localApi.push({
                        siliconflow_Voice_Model: result.model || selectedModel,
                        siliconflow_Voice_ReferenceId: result.uri,
                        siliconflow_Voice_ReferenceText: result.text || referenceText,
                        remark: result.customName || customName,
                    });
                    Config.siliconflow_VoiceApi = localApi;
                    Config.siliconflow_Voice_Current_Index = localApi.length;

                    await e.reply(`🎉 创建成功！\n\n音色名称: ${customName}\n模型: ${selectedModel}\n音色ID: \n${result.uri}\n\n✅ 已自动同步到本地配置，并切换当前发音人为: ${customName} (序号: ${localApi.length})\n可用指令：#gptsf语音模型列表`, true);
                } else {
                    await e.reply(`创建失败：${JSON.stringify(result)}`, true);
                }
            } catch (err) {
                await e.reply(`请求发生错误：${err.message}`, true);
            }
        }
    }

    async checkStealImgWhitelist(e) {
        let whitelist = Config.stealImgWhitelist || [];
        if (typeof whitelist === 'string') {
            whitelist = whitelist.length > 0 ? whitelist.split(',').map(item => item.trim()) : [];
        }
        if (whitelist.length === 0) return true;
        if (e.isMaster) return true;

        const userId = e.sender?.user_id?.toString() || '';
        const groupId = e.isGroup && e.group_id ? e.group_id.toString() : '';
        for (const item of whitelist) {
            if (!item) continue;
            if (item.startsWith('^')) {
                if (item.slice(1) === userId) return true;
            } else if (item.includes('^')) {
                const [g, q] = item.split('^');
                if (e.isGroup && g === groupId && q === userId) return true;
            } else if (e.isGroup && item === groupId) {
                return true;
            }
        }
        e.reply('你没有使用该指令的权限', true);
        return false;
    }

    /** /^#偷(图|表情包?)$/i */
    async save_EmojiImg(e) {
        if (!await this.checkStealImgWhitelist(e)) return false;
        await parseSourceImg(e);
        if (!e.img || !e.img.length) {
            e.reply(`请引用图片或将图片一起发送后重试`, true);
            return true;
        }

        const emotions = [
            'happy', 'sad', 'angry', 'love', 'confused', 'tired',
            'excited', 'scared', 'laugh', 'cry', 'cute', 'shy',
            'thumbsup', 'thinking', 'surprised', 'bored', 'cool',
            'sick', 'sleep', 'eat'
        ];

        // e.reply('正在识别表情包并分析情感中...', true);
        const systemPrompt = `分析这个表情包或图片的情感，从以下分类中选出一个最合适的分类：\n${emotions.join(', ')}\n\n请严格按以下格式回复：\n[分类]: 简短分析（10个字以内）\n例如：\nhappy: 看起来非常开心`;
        let aiText = await recognitionResultsByGemini(e, (e.img || []), [], systemPrompt);

        let emotion = '';
        let analysis = '';

        if (aiText && !aiText.includes('识别出错：')) {
            // 尝试提取分类和分析
            const match = aiText.match(/^([a-zA-Z]+)[:：]\s*(.*)/);
            if (match) {
                emotion = match[1].toLowerCase();
                analysis = match[2].trim();
            } else {
                // 如果格式不完全匹配，尝试在文本中寻找关键字
                const foundEmotion = emotions.find(em => aiText.toLowerCase().includes(em));
                if (foundEmotion) {
                    emotion = foundEmotion;
                    analysis = aiText.replace(new RegExp(foundEmotion, 'i'), '').trim();
                }
            }
        }

        if (!emotions.includes(emotion)) {
            // Gemini 在部分地区会返回 FAILED_PRECONDITION / User location is not supported。
            // 偷表情不应该因此失败：识别失败时兜底保存到 cute 分类。
            logger.warn(`[偷表情] 表情类别识别失败，已使用默认分类 cute：${aiText || '无返回'}`);
            emotion = 'cute';
            analysis = '识别失败，默认分类';
        }

        const directory = path.join(process.cwd(), 'data', 'chatgpt', 'sendEmojiTool', emotion);

        try {
            const imgResponse = await fetch(e.img[0]);
            if (imgResponse.ok) {
                let imgSize = (imgResponse.headers.get('size') || imgResponse.headers.get('content-length')) / 1024 / 1024;
                if (imgSize > 10) {
                    e.reply(`这图片超过10MB了，还是不要保存了吧QAQ`, true);
                    return true;
                }
                const imageUrl = await reNameAndSavePic(imgResponse, e.img[0], directory);
                if (imageUrl) {
                    // 登记索引：删图时靠它把「那条偷图消息」和「本地这个文件」对上。
                    // 原消息里的图是 NapCat 临时地址，本地是 sha256 命名的文件，
                    // 两者没有任何关联，不登记就没法从引用消息反查该删哪个文件。
                    const shortId = saveEmojiIndex(e, emotion, path.basename(imageUrl));
                    const suffix = shortId
                        ? `\n编号: ${shortId}（发 #gpt删图 ${shortId} 或直接引用本条消息即可删除）`
                        : '';
                    const replyRes = await e.reply(`偷图成功！\n已将表情包储存在 [${emotion}] 文件夹中~\nAI简评: ${analysis}${suffix}`, true);
                    // 记下 Bot 这条「偷图成功」消息的 ID，之后引用它也能反查到文件
                    if (shortId) {
                        updateEmojiIndexReplyMsgId(shortId, replyRes?.message_id || replyRes?.messageId || replyRes?.data?.message_id);
                    }
                } else {
                    e.reply(`保存表情包失败了呢QAQ`, true);
                }
            } else {
                e.reply('图片下载失败了呢QAQ', true);
            }
        } catch (err) {
            logger.error('偷图失败：', err);
            e.reply('偷图过程中发生错误：' + err.message, true);
        }
        return true;
    }

    /**
     * 按引用消息里的图片反查已存文件 —— 老图（索引机制之前偷的）只能走这条路。
     *
     * 依据：偷图时本地文件名是 sha256(原图URL) 的十六进制（见 reNameAndSavePic），
     * 而原图 URL 就在那条含图消息里。所以拿到引用消息的图地址，重算哈希，
     * 在所有分类目录里找同名前缀的文件即可，不必依赖索引。
     *
     * 前提：引用的必须是**当初那张图的消息**（自己发的图、群友发的图都行），
     * 引用「偷图成功」那条纯文字消息拿不到图，只能走索引。
     */
    async findEmojiBySourceImage(e, rootDir) {
        await parseSourceImg(e);
        const url = e.img?.[0];
        if (!url || typeof url !== 'string') return null;

        // URL 可能被平台转义过（如 %2F），两种形态都试一遍
        const hashOf = (u) => crypto.createHash('sha256').update(u).digest('hex');
        const hashes = new Set([hashOf(url)]);
        try {
            const decoded = decodeURIComponent(url);
            if (decoded !== url) hashes.add(hashOf(decoded));
        } catch (_) { }

        for (const dir of this.listEmojiDirs(rootDir)) {
            for (const f of this.listEmojiImgs(path.join(rootDir, dir))) {
                const base = f.replace(/\.[^.]+$/, '');
                if (hashes.has(base)) return { emotion: dir, file: f };
            }
        }
        return null;
    }

    /**
     * 按图片内容反查老图。
     *
     * 老文件是 sha256(原图 URL) 命名，URL 一过期/换 CDN，哈希就对不上；
     * 这里改成下载引用消息里的图，按**文件内容** sha256 比对本地文件。
     * 只比同尺寸的文件，避免无谓读取大图。
     */
    async findEmojiByContent(e, rootDir) {
        const url = e.img?.[0];
        if (!url || typeof url !== 'string') return null;

        let remote;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            remote = Buffer.from(await res.arrayBuffer());
        } catch (err) {
            logger.debug('删图内容比对：下载引用图失败', err?.message || err);
            return null;
        }
        if (!remote.length) return null;
        const remoteHash = crypto.createHash('sha256').update(remote).digest('hex');

        for (const dir of this.listEmojiDirs(rootDir)) {
            for (const f of this.listEmojiImgs(path.join(rootDir, dir))) {
                const file = path.join(rootDir, dir, f);
                try {
                    if (fs.statSync(file).size !== remote.length) continue;
                    const localHash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
                    if (localHash === remoteHash) return { emotion: dir, file: f };
                } catch (_) { /* 单个文件读失败不影响其它候选 */ }
            }
        }
        return null;
    }

    /** 取「被引用/回复的那条消息」原始对象，供 ID 与文本两条反查路径共用 */
    async getSourceMessage(e) {
        try {
            if (e.reply_id) return await e.getReply(e.reply_id);
            if (e.source) {
                const item = e.isGroup
                    ? (await e.group.getChatHistory(e.source.seq, 1)).pop()
                    : (await e.friend.getChatHistory(e.source.time, 1)).pop();
                return item || null;
            }
        } catch (err) {
            logger.debug('获取引用消息失败：', err?.message || err);
        }
        return null;
    }

    /**
     * 取「被引用/回复的那条消息」的 message_id。
     * 删图要靠它反查索引 —— 引用的是哪条偷图消息，决定删哪张图。
     */
    async getSourceMessageId(e) {
        const obj = await this.getSourceMessage(e);
        return obj?.message_id || obj?.message?.message_id || e.source?.message_id || null;
    }

    /** 真正执行删除：校验文件确实在 rootDir 下，删完顺手清掉索引 */
    doDeleteEmoji(e, rootDir, emotion, file) {
        const dirPath = this.safeEmojiDir(rootDir, emotion);
        if (!dirPath) {
            e.reply(`分类「${emotion}」不存在，记录可能已失效`, true);
            removeEmojiIndexByFile(emotion, file);
            return false;
        }
        const target = path.join(dirPath, file);
        if (path.dirname(target) !== dirPath) {
            e.reply('记录里的文件名不合法，已拒绝删除', true);
            return false;
        }
        if (!fs.existsSync(target)) {
            e.reply(`文件已经不在了（${emotion}/${file}）`, true);
            removeEmojiIndexByFile(emotion, file);
            return false;
        }
        try {
            fs.unlinkSync(target);
        } catch (err) {
            logger.error('删除表情图失败：', err);
            e.reply(`删除失败：${err.message}`, true);
            return false;
        }
        removeEmojiIndexByFile(emotion, file);
        const left = this.countEmojiImgs(dirPath);
        e.reply(`已删除 ${emotion}/${file}\n该分类还剩 ${left} 张`, true);
        return true;
    }

    /**
     * #gpt删图 —— 删除 #gpt偷图 存下的表情图。
     *
     * 三段式，逐级收窄，避免一条指令就把整个目录删了：
     *   #gpt删图            列出所有情绪分类及各自图片数
     *   #gpt删图 <分类>      列出该分类下的图（序号 + 文件名）
     *   #gpt删图 <分类> <序号> 删除指定的那张
     *
     * 刻意不做的事：不提供「整目录删除」「按分类删除」「回收站」。
     * 前两者一次手滑就没了，后者要额外占磁盘且和偷图目录的语义纠缠。
     * 想批量清理请直接进服务器删文件夹。
     */
    async delete_EmojiImg(e) {
        if (!Config.enableDeleteEmojiImg) {
            e.reply('删图功能未开启，请在锅巴中开启「工具新增-删表情」', true);
            return false;
        }

        const rootDir = path.join(process.cwd(), 'data', 'chatgpt', 'sendEmojiTool');
        if (!fs.existsSync(rootDir)) {
            e.reply('表情库还不存在，先用 #gpt偷图 存几张吧~', true);
            return false;
        }

        const args = String(e.msg || '')
            .replace(/^#gpt删(图|表情包?)/i, '')
            .trim();

        // —— 快捷方式一：引用某条消息来删 ——
        // 三条路径：新图靠消息 ID 索引；引用「偷图成功」文字消息时从文本里的
        //           4 位编号反查；老图靠原图 URL 哈希（引用含图的那条消息）。
        const src = !args ? await this.getSourceMessage(e) : null;
        const msgId = src?.message_id || src?.message?.message_id || e.source?.message_id || null;
        if (!args && (src || msgId)) {
            if (msgId) {
                const rec = findEmojiIndexByMsgId(e, msgId);
                if (rec) return this.doDeleteEmoji(e, rootDir, rec.emotion, rec.file);
            }

            // 引用的是「偷图成功」那条纯文字消息：正文里有「编号: XXXX」
            const text = (Array.isArray(src?.message) ? src.message : [])
                .filter(v => v?.type === 'text')
                .map(v => v.text || '')
                .join(' ');
            const shortId = text.match(/编号[:：]\s*([2-9A-HJ-NP-Z]{4,})/i)?.[1];
            if (shortId) {
                const rec = findEmojiIndex(shortId);
                if (rec) return this.doDeleteEmoji(e, rootDir, rec.emotion, rec.file);
            }

            const byHash = await this.findEmojiBySourceImage(e, rootDir);
            if (byHash) return this.doDeleteEmoji(e, rootDir, byHash.emotion, byHash.file);

            // URL 哈希对不上（老图 URL 过期/换 CDN）时，再按图片内容比对
            const byContent = await this.findEmojiByContent(e, rootDir);
            if (byContent) return this.doDeleteEmoji(e, rootDir, byContent.emotion, byContent.file);

            e.reply('没找到对应的已存图片。可以试试：\n1. 引用「偷图成功」那条文字消息（需本指令开启后偷的）\n2. 引用当初那张图的消息本身\n3. 或者用 #gpt删图 分类名 序号', true);
            return false;
        }

        // —— 快捷方式二：#gpt删图 <短ID> ——
        if (args && !/\s/.test(args)) {
            const rec = findEmojiIndex(args.toUpperCase());
            if (rec) return this.doDeleteEmoji(e, rootDir, rec.emotion, rec.file);
            // 不是短 ID 就继续按「分类名」往下走，不在这里报错
        }

        // —— 第一段：列出所有分类 ——
        if (!args) {
            const lines = [];
            for (const name of this.listEmojiDirs(rootDir)) {
                lines.push(`${name}（${this.countEmojiImgs(path.join(rootDir, name))} 张）`);
            }
            if (!lines.length) {
                e.reply('表情库是空的，先用 #gpt偷图 存几张吧~', true);
                return false;
            }
            e.reply([
                `表情库共 ${lines.length} 个分类：\n${lines.join('\n')}`,
                '用法：\n#gpt删图 分类名 —— 查看该分类下的图片\n#gpt删图 分类名 序号 —— 删除指定的那张'
            ], true);
            return false;
        }

        const parts = args.split(/\s+/).filter(Boolean);
        const [maybeDir, maybeIndex] = parts;

        // 分类名直接来自用户输入，必须挡住 ../ 这类路径穿越
        const dirPath = this.safeEmojiDir(rootDir, maybeDir);
        if (!dirPath) {
            e.reply(`没有名为「${maybeDir}」的分类，用 #gpt删图 看看有哪些分类吧`, true);
            return false;
        }

        const files = this.listEmojiImgs(dirPath);

        // —— 第二段：列出该分类下的图 ——
        if (parts.length === 1 || maybeIndex === undefined) {
            if (!files.length) {
                e.reply(`「${maybeDir}」分类下还没有图片`, true);
                return false;
            }
            const MAX = 40;
            const shown = files.slice(0, MAX).map((f, i) => `${i + 1}. ${f}`);
            const more = files.length > MAX ? `\n…… 还有 ${files.length - MAX} 张，用序号可继续翻` : '';
            e.reply([
                `「${maybeDir}」共 ${files.length} 张：\n${shown.join('\n')}${more}`,
                `删除其中一张：#gpt删图 ${maybeDir} 序号（删除不可恢复）`
            ], true);
            return false;
        }

        // —— 第三段：执行删除 ——
        const idx = Number(maybeIndex);
        if (!Number.isInteger(idx) || idx < 1 || idx > files.length) {
            e.reply(`序号要在 1 ~ ${files.length} 之间，或用 #gpt删图 ${maybeDir} 看看有哪些`, true);
            return false;
        }

        const target = path.join(dirPath, files[idx - 1]);
        try {
            fs.unlinkSync(target);
        } catch (err) {
            logger.error('删除表情图失败：', err);
            e.reply(`删除失败：${err.message}`, true);
            return false;
        }

        const left = this.countEmojiImgs(dirPath);
        e.reply(`已删除 ${maybeDir}/${files[idx - 1]}\n该分类还剩 ${left} 张`, true);
        return true;
    }

    /** 列出表情分类目录名（只取目录，按名排序，保证列表顺序稳定） */
    listEmojiDirs(rootDir) {
        try {
            return fs.readdirSync(rootDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name)
                .sort();
        } catch (err) {
            return [];
        }
    }

    /** 列出某分类下的图片文件名 */
    listEmojiImgs(dirPath) {
        try {
            return fs.readdirSync(dirPath, { withFileTypes: true })
                .filter(d => d.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name))
                .map(d => d.name)
                .sort();
        } catch (err) {
            return [];
        }
    }

    countEmojiImgs(dirPath) {
        return this.listEmojiImgs(dirPath).length;
    }

    /**
     * 把用户输入的分类名解析成目录路径，解析不出来返回 null。
     * 不直接 path.join(rootDir, 用户输入) —— 那等于把删除接口开放给路径穿越，
     * `#gpt删图 ../../..` 就能删到仓库外的东西去。
     */
    safeEmojiDir(rootDir, name) {
        if (!name) return null;
        if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
        const full = path.join(rootDir, name);
        if (path.dirname(full) !== rootDir) return null;
        try {
            if (!fs.statSync(full).isDirectory()) return null;
        } catch (err) {
            return null;
        }
        return full;
    }

    /** ^#tts(语音)?(替换)?帮助 */
    async voicechangehelp(e) {
        let input_tts = e.msg.replace(/^#tts(语音)?(替换)?帮助/, '').trim()
        // let show_tts_voice_help_config_msg1 = `tts语音当前设置：\n 默认角色：${Config.defaultTTSRole}\n 发音语言：${Config.tts_language}\n tts情感设置上锁：${Config.vits_emotion_locker}\n vits_emotion：${Config.vits_emotion}\n 情感自动设置：${Config.vits_auto_emotion}\n noiseScale：${Config.noiseScale}\n noiseScaleW：${Config.noiseScaleW}\n lengthScale：${Config.lengthScale}\n sdp_ratio：${Config.sdp_ratio}\n 融合文本：${Config.style_text}\n 融合权重：${Config.style_text_weights}\n 切片生成：${Config.tts_slice_is_slice_generation}\n 段间停顿时长：${Config.tts_slice_pause_between_paragraphs_seconds} 秒\n 按句切分：${Config.tts_slice_is_Split_by_sentence}\n 句间停顿时长：${Config.tts_slice_pause_between_sentences_seconds} 秒\n 全局语音模式：${Config.defaultUseTTS}\n AI第一人称：${Config.tts_First_person}`
        let show_tts_voice_help_config_msg1 = `tts语音当前设置：\n 默认角色：${Config.defaultTTSRole}\n AI第一人称：${Config.tts_First_person}\n 全局语音模式：${Config.defaultUseTTS}\n${Config.ttsSpace?.includes("bv2.firefly.matce.cn") ? `以下为Bert-Vits参数：\n 发音语言：强制自动\n tts情感设置上锁：${Config.vits_emotion_locker} \n vits_emotion：${Config.vits_emotion} \n 情感自动设置：${Config.vits_auto_emotion} \n noiseScale：${Config.noiseScale} \n noiseScaleW：${Config.noiseScaleW} \n lengthScale：${Config.lengthScale} \n sdp_ratio：${Config.sdp_ratio} \n 融合文本：${Config.style_text} \n 融合权重：${Config.style_text_weights} \n 切片生成：${Config.tts_slice_is_slice_generation} \n 段间停顿时长：${Config.tts_slice_pause_between_paragraphs_seconds} 秒\n 按句切分：${Config.tts_slice_is_Split_by_sentence} \n 句间停顿时长：${Config.tts_slice_pause_between_sentences_seconds} 秒` : ''}${Config.ttsSpace?.includes("fs.firefly.matce.cn") ? `以下为Fish-Vits参数：\n exampleAudio：${Config.exampleAudio} \n Iterative Prompt Length：${Config.Fish_Iterative_Prompt_Length} \n Maximum tokens per batch：${Config.Fish_Maximum_tokens_per_batch} \n Top-P：${Config.Fish_Top_P} \n Repetition Penalty：${Config.Fish_Repetition_Penalty} \n Temperature：${Config.Fish_Temperature}` : ''}${Config.ttsSpace?.includes("api.fish.audio") ? `以下为api.fish.audio参数：\n 发音人ID：${Config.fish_reference_id} \n token：[已隐藏]` : ''}${Config.ttsSpace?.includes("hf.space") ? `以下为vits-uma参数：\n noiseScale：${Config.noiseScale} \n noiseScaleW：${Config.noiseScaleW} \n lengthScale：${Config.lengthScale}` : ''}`

        let msg1 = `tts语音帮助：\n` +
            ` #tts可选人物列表\n` +
            ` #tts语音转日语帮助\n` +
            ` #tts语言设置帮助\n` +
            ` #ttslength设置帮助\n` +
            ` #tts语音切片生成帮助\n` +
            ` #搜索fish发音人[名称]\n` +
            ` #chatgpt(开启|关闭)本地SILK转码` +
            // ` （2024年1月4日备注：api更新了，目前只支持[角色_ZH]和中文语言语音，等待恢复）` +
            ''
        let msg1_1 = `情感设置：\n` +
            ` #tts情感帮助\n` +
            ` #tts情感自动(开启|关闭)\n` +
            ` #tts情感设置上锁(开启|关闭)\n` +
            ` #tts(查看|设置)融合文本\n` +
            ` #tts(查看|设置)融合权重` +
            ''
        let msg2 = `必要锅巴设置：\n1. vits-uma-genshin-honkai语音转换API地址 填入：\n` +
            `https://bv2.firefly.matce.cn\n` +
            `2. 云转码API发送数据模式 选择：[文件]/[url]都可以`
        let msg3 = '感谢genshinvoice.top提供的api支持！'

        let msg1_isn_master = `tts语音帮助：\n` +
            ` #tts可选人物列表\n` +
            ` #chatgpt设置语音角色派蒙_ZH\n` +
            ` #chatgpt(图片|语音)模式\n` +
            ` （↑每人独立设置且优先级最高）\n` +
            ` 主人请使用#tts帮助pro 获取管理指令` +
            ''

        let msg_for_master = `Chatgpt管理帮助：\n` +
            ` #派蒙戳一戳设置CD\n` +
            ` #tts重置所有用户单独设置帮助\n` +
            ` （↑每人独立设置且优先级最高）\n` +
            ` #chatgpt设置AI第一人称帮助\n` +
            ` #chatgpt(查看|设置)输出黑名单\n` +
            ` #chatgpt(查看|设置)输入黑名单\n` +
            ` #chatgpt[开启|关闭]回复确认\n` +
            ` #chatgpt[对话|管理|娱乐|绘图|人物设定|聊天记录]?指令表[帮助|搜索]?\n` +
            ` #派蒙戳一戳保存表情` +
            ` #派蒙chatgpt立即执行每日自动任务` +
            ''

        let msg_for_master2 = `Chatgpt管理杂项：\n` +
            ` #chatgpt必应(开启|关闭)搜索\n` +
            ` #chatgpt对话中图片识别(帮助|开启|关闭)\n` +
            ` #chatgpt设置geminikey\n` +
            ` #chatgpt设置翻译来源(openai|responses|gemini|baidu|百度翻译)\n` +
            ` #chatgpt工具箱\n` +
            ` #chatgpt[开启|关闭]工具箱\n` +
            ''

        let msg_outdata = `已经用不上的功能：\n` +
            `#tts查看当前语音设置\n` +
            `#chatgpt查看回复设置\n` +
            `#chatgpt(图片|语音)模式\n` +
            ''
        const userSetting = await getUserReplySetting(this.e)
        let msg4_1 = `${this.e.sender.user_id}的回复设置:
（每人独立设置且优先级最高）
图片模式: ${userSetting.usePicture === true ? '开启' : '关闭'}
语音模式: ${userSetting.useTTS === true ? '开启' : '关闭'}
Vits语音角色: ${userSetting.ttsRole}
Azure语音角色: ${userSetting.ttsRoleAzure}
${userSetting.useTTS === true ? '当前语音模式为' + Config.ttsMode : ''}`
        msg4_1 = msg4_1.replace(/\n\s*$/, '')
        let msgx
        if (e.isMaster && (input_tts == 'pro' || input_tts == 'm' || input_tts == 'p')) {
            msgx = await common.makeForwardMsg(e, [show_tts_voice_help_config_msg1, msg1, msg_for_master, msg_for_master2, msg4_1], `tts语音帮助-m`)
        } else {
            msgx = await common.makeForwardMsg(e, [show_tts_voice_help_config_msg1, msg1_isn_master, msg4_1], `tts语音帮助`)
        }
        e.reply(msgx);
        return true;
    }

    /** ^#tts(可选)?人物(可选)?列表$ */
    async tts_show_speakers(e) {
        let strs = (Config.ttsSpace?.includes('api.fish.audio') ? ["api.fish.audio不支持可选人物列表"]
            : [`tts可选人物列表：\n#chatgpt设置全局vits语音角色${speakers.find(speaker => speaker.includes("派蒙"))}\n#chatgpt设置语音角色${speakers.find(speaker => speaker.includes("可莉"))}\n#chatgpt设置语音角色${speakers.find(speaker => speaker.includes("纳西妲"))}\n  （↑每名用户都可以单独设置）`])

        if (Config.ttsSpace.includes('matce.cn')) {
            strs.push(`` +
                `其中BA角色集仅支持日语语言，若#tts语音转日语关闭 则自动使用网址api的转日语功能（已失效），若#tts语音转日语开启 则使用本插件内置的#gpt翻日 功能（需要设置翻译源）。`)
            let batchSpeakersNum = get_matce_cn_speaker("ZH").length / 50
            let speakersSliced
            let strsLenght = strs.length
            for (let i = 0; i < batchSpeakersNum; i++) {
                speakersSliced = get_matce_cn_speaker("ZH").slice(i * 50, (i + 1) * 50)
                strs[i + strsLenght] = '中文ZH角色：\n'
                for (let j = 0; j < speakersSliced.length; j++) {
                    if (j % 2 == 0) {
                        strs[i + strsLenght] += speakersSliced[j] + "　　"
                    }
                    else {
                        strs[i + strsLenght] += speakersSliced[j] + "\n"
                    }
                }
            }

            batchSpeakersNum = get_matce_cn_speaker("JP").length / 50
            strsLenght = strs.length
            for (let i = 0; i < batchSpeakersNum; i++) {
                speakersSliced = get_matce_cn_speaker("JP").slice(i * 50, (i + 1) * 50)
                strs[i + strsLenght] = '日文JP角色：\n'
                for (let j = 0; j < speakersSliced.length; j++) {
                    if (j % 2 == 0) {
                        strs[i + strsLenght] += speakersSliced[j] + "　　"
                    }
                    else {
                        strs[i + strsLenght] += speakersSliced[j] + "\n"
                    }
                }
            }

            batchSpeakersNum = get_matce_cn_speaker("EN").length / 50
            strsLenght = strs.length
            for (let i = 0; i < batchSpeakersNum; i++) {
                speakersSliced = get_matce_cn_speaker("EN").slice(i * 50, (i + 1) * 50)
                strs[i + strsLenght] = '英文EN角色：\n'
                for (let j = 0; j < speakersSliced.length; j++) {
                    if (j % 2 == 0) {
                        strs[i + strsLenght] += speakersSliced[j] + "　　"
                    }
                    else {
                        strs[i + strsLenght] += speakersSliced[j] + "\n"
                    }
                }
            }

            batchSpeakersNum = get_matce_cn_speaker("BA").length / 50
            strsLenght = strs.length
            for (let i = 0; i < batchSpeakersNum; i++) {
                speakersSliced = get_matce_cn_speaker("BA").slice(i * 50, (i + 1) * 50)
                strs[i + strsLenght] = 'BA角色：\n'
                for (let j = 0; j < speakersSliced.length; j++) {
                    if (j % 2 == 0) {
                        strs[i + strsLenght] += speakersSliced[j] + "　　"
                    }
                    else {
                        strs[i + strsLenght] += speakersSliced[j] + "\n"
                    }
                }
            }
        } else {
            let batchSpeakersNum = speakers.length / 50
            let speakersSliced
            let strsLenght = strs.length
            for (let i = 0; i < batchSpeakersNum; i++) {
                speakersSliced = speakers.slice(i * 50, (i + 1) * 50)
                strs[i + strsLenght] = '可选角色：\n'
                for (let j = 0; j < speakersSliced.length; j++) {
                    if (j % 2 == 0) {
                        strs[i + strsLenght] += speakersSliced[j] + "　　"
                    }
                    else {
                        strs[i + strsLenght] += speakersSliced[j] + "\n"
                    }
                }
            }
        }

        let msgx = await common.makeForwardMsg(e, strs, `tts可选人物列表`);
        e.reply(msgx);
        return true;
    }


    /** ^#tts情感(设置)?(帮助)?  #tts情感设置上锁(开启|关闭) */
    async set_vits_emotion(e) {
        let input_tts = e.msg.replace(/^#tts情感(设置)?(帮助)?/, '').trim()
        if (!input_tts) {
            let msg1 = `tts情感设置帮助：\n`
            let msg_show = `tts语音当前情感：${Config.vits_emotion}`
            let msg_auto = `tts语音启动自动情感：${Config.vits_auto_emotion}\n（自动根据句子中的感情词匹配tts中的100种情感，将会覆盖当前tts情感）`
            let msg1_1 = `若有需要可\n#tts情感设置为空值`
            let msg2 = `输入整数，如：\n#tts情感设置1\n#tts情感自动开启/关闭`
            let msg3 = JSON.stringify(vits_emotion_map, null, 2).replace(/\"|,/g, "")
            let msgx = await common.makeForwardMsg(e, [msg1, msg_show, msg_auto, msg2, msg3, msg1_1], `tts情感设置帮助`);
            return e.reply(msgx, false)
        }
        if (input_tts === '上锁开启' || input_tts === '上锁关闭') {
            if (!e.isMaster) return e.reply('只有主人可以使用#tts情感设置上锁开启|关闭')
            Config.vits_emotion_locker = input_tts === '上锁开启' ? true : false
            return e.reply(`#tts情感设置已${input_tts}！`)
        } else if (input_tts === '自动开启' || input_tts === '自动关闭') {
            if (!e.isMaster && Config.vits_emotion_locker) {
                return e.reply('tts情感设置已上锁，请主人使用#tts情感设置上锁开启|关闭')
            }
            Config.vits_auto_emotion = input_tts === '自动开启' ? true : false
            return e.reply(`#tts情感-自动情感已设置为${input_tts === '自动开启' ? true : false}！`)
        }
        else if (input_tts === '为空' || input_tts === '为空值') {
            if (!e.isMaster && Config.vits_emotion_locker) {
                return e.reply('tts情感设置已上锁，请主人使用#tts情感设置上锁开启|关闭')
            }
            Config.vits_emotion = ''
            return e.reply(`tts情感已修改为空值！`)
        } else if (RegExp("^([1-9]|[1-9]\\d|100)$").test(input_tts)) {
            if (!e.isMaster && Config.vits_emotion_locker) {
                return e.reply('tts情感设置已上锁，请主人使用#tts情感设置上锁开启|关闭')
            }
            let input_vits_map = vits_emotion_map[input_tts - 1].replace(/(\s+)|([(].*[)])/g, "").replace(/:|([0-9]*)/g, '')
            /* 	.replace()
                '1: Happy (开心)',
                '2: Sad (伤心)',
                '3: Excited (兴奋)',
                ... */
            Config.vits_emotion = input_vits_map
            return e.reply(`tts情感已修改为${input_tts}：${input_vits_map}！`)
        } else {
            return e.reply('喵?请输入#tts情感设置帮助', false)
        }
    }

    /** ^#tts语言设置(帮助)? */
    async set_tts_language(e) {
        let input_tts = e.msg.replace(/^#tts语言设置(帮助)?/, '').trim()
        if (!input_tts) {
            return e.reply(`选择发音的语言（但不会自动翻译过去哦，你用外语和人家说话人家可能就会用外语回复你了）。\n可选ZH, JP, EN, mix(api暂不支持), auto(支持中日英自动,但api目前罗马数字会用英文)\n例如#tts语言设置auto\n注意：（2024年3月31日）api仍不支持多语种切换，为适配碧蓝档案人物仅有JP语言，故而本插件改为根据角色自动判断语言，可以暂时无视该设置了`, false)
        }
        input_tts = input_tts.toLowerCase()
        if (/^zh$|^jp$|^en$|^mix$|^auto$/.test(input_tts)) {
            if (/^zh$|^jp$|^en$/.test(input_tts)) input_tts = input_tts.toUpperCase()
            Config.tts_language = input_tts
            return e.reply(`tts语言已设置为${input_tts}！\n注意：（2024年3月31日）api仍不支持多语种切换，为适配碧蓝档案人物仅有JP语言，故而本插件改为根据角色自动判断语言，可以暂时无视该设置了`)
        } else {
            return e.reply('可选ZH, JP, EN, mix(api暂不支持), auto\n例如#tts语言设置ZH', false)
        }
    }

    /** '^#ttslength(Scale)?设置(帮助)?' */
    async set_lengthScale(e) {
        let input_tts = e.msg.replace(/^#ttslength(Scale)?设置(帮助)?/, '').trim()
        if (!input_tts) {
            return e.reply(`控制整体语速，范围0.1-2.0，越小语速越快。\n例如#ttslength设置1`, false)
        }
        input_tts = parseFloat(input_tts).toFixed(1)
        if (input_tts > 0 && input_tts <= 2) {
            Config.lengthScale = input_tts
            return e.reply(`tts的lengthScale已设置为${input_tts}！`)
        } else {
            return e.reply('输入范围0.1-2.0哦。\n例如#ttslength设置1', false)
        }
    }

    /** '^#chatgpt设置(AI|ai)?第一人称(称谓)?(帮助)?' */
    async set_firstPerson(e) {
        let input_tts = e.msg.replace(/^#chatgpt设置(AI|ai)?第一人称(称谓)?(帮助)?/, '').trim()
        if (!input_tts) {
            let msg1 = `tts第一人称帮助：`
            let msg_show = `指定某些情况指定回复下AI的第一人称`
            let msg1_1 = `#chatgpt设置AI第一人称派蒙`
            let msg2 = `如果需要触发“AI回应第一人称呼叫”，请重启；\n如果不触发，则考虑指令冲突，例如先去锅巴把喵仔设置里面的机器人别名给删掉。`
            let msgx = await common.makeForwardMsg(e, [msg1, msg_show, msg1_1, msg2], `tts第一人称帮助`);
            return e.reply(msgx, false)
        } else {
            Config.tts_First_person = input_tts
            Config.chatViewBotName = input_tts
            return e.reply(`AI的第一人称已设置为“${input_tts}”！\n如果需要触发“AI回应第一人称呼叫”请重启。`)
        }
    }

    /** ^#派蒙戳一戳设置(CD|cd) */
    async chuo_set_paimon_chou_cd(e) {
        const match = e.msg.trim().match(/^#派蒙戳一戳设置(CD|cd)([0-9]\d*)/)
        if (!match || !Number(match[2])) {
            let msg1 = `#派蒙戳一戳设置CD[num]`
            let msg_show = `当前戳一戳响应CD为${Config.paimon_chou_cd}s，QQ默认戳一戳CD为10s，建议填写大于10的整数。设置为0则禁用戳一戳响应CD`
            let msg1_1 = `#派蒙戳一戳设置CD20`
            let msgx = await common.makeForwardMsg(e, [msg1, msg_show, msg1_1], `#派蒙戳一戳设置CD`);
            return e.reply(msgx, false)
        }
        else {
            Config.paimon_chou_cd = parseInt(match[2]);
            return e.reply(`派蒙戳一戳CD已设置为${parseInt(match[2])}秒`)
        }
    }

    /** ^#tts(设置|查看)?融合权重(帮助)? */
    async set_style_text_weights(e) {
        let input_tts = e.msg.replace(/^#tts(设置|查看)?融合权重(帮助)?/, '').trim()
        if (!input_tts) {
            let show_msg1 = 'tts当前融合权重：'
            let show_msg2 = `${Config.style_text_weights}`
            let show_msg3 = '主文本和辅助文本的bert混合比率，0表示仅主文本，1表示仅辅助文本，范围0.0-1.0，默认0.7'
            let show_msg4_1 = '#tts设置融合权重0.7'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg2, show_msg3, show_msg4_1], 'tts融合文本帮助');
            return e.reply(show_msgx, false);
        }
        input_tts = parseFloat(input_tts).toFixed(1)
        if (input_tts >= 0 && input_tts <= 1) {
            if (!e.isMaster && Config.vits_emotion_locker) {
                return e.reply('tts设置已上锁，请主人使用#tts情感设置上锁开启|关闭')
            }
            Config.style_text_weights = input_tts
            return e.reply(`tts融合权重已设置为${input_tts}！`)
        } else {
            return e.reply('输入范围0.0-1.0哦。\n例如#tts设置融合权重0.7', false)
        }
    }

    /** ^#tts(设置|查看)?融合文本(帮助)? */
    async set_style_text(e) {
        let input_tts = e.msg.replace(/^#tts(设置|查看)?融合文本(帮助)?/, '').trim()
        if (!input_tts) {
            let show_msg1 = 'tts当前融合文本：'
            let show_msg2 = `${Config.style_text}`
            let show_msg3 = '使用辅助文本的语意来辅助生成对话（语言保持与主文本相同）注意：不要使用指令式文本（如：开心），要使用带有强烈情感的文本（如：我好快乐！！！）效果较不明确，留空即为不使用该功能。'
            let show_msg4_1 = '#tts设置融合文本为空值'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg2, show_msg3, show_msg4_1], 'tts融合文本帮助');
            return e.reply(show_msgx, false);
        } else if (input_tts === '为空' || input_tts === '为空值') {
            if (!e.isMaster && Config.vits_emotion_locker) {
                return e.reply('tts设置已上锁，请主人使用#tts情感设置上锁开启|关闭')
            }
            Config.style_text = ""
            let show_msg1 = '融合文本已设置为空值'
            let show_msg3 = '可使用#tts查看融合文本'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg3], 'tts融合文本');
            return e.reply(show_msgx);
        } else {
            if (!e.isMaster && Config.vits_emotion_locker) {
                return e.reply('tts设置已上锁，请主人使用#tts情感设置上锁开启|关闭')
            }
            Config.style_text = input_tts
            let show_msg1 = '融合文本已设置为：'
            let show_msg2 = `${input_tts}`
            let show_msg3 = '可使用#tts查看融合文本'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg2, show_msg3], 'tts融合文本');
            return e.reply(show_msgx);
        }
    }

    /** ^#chatgpt(设置|查看)?输出黑名单(帮助)? */
    async set_blockWords(e) {
        let input_tts = e.msg.replace(/^#chatgpt(设置|查看)?输出黑名单(帮助)?/, '').trim()
        if (!input_tts) {
            let show_msg1 = 'chatgpt当前输出黑名单：'
            let show_msg2 = `${Config.blockWords}`
            let show_msg3 = '检查输出结果中是否有违禁词，如果存在黑名单中的违禁词则不输出。英文逗号隔开。如：\n#chatgpt设置输出黑名单屏蔽词1,屏蔽词b'
            let show_msg4 = '#chatgpt设置输出黑名单是bing,this is bing,是 bing,これはBing,これは Bing'
            let show_msg4_1 = '#chatgpt设置输出黑名单为空值'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg2, show_msg3, show_msg4, show_msg4_1], 'chatgpt输出黑名单帮助');
            return e.reply(show_msgx, false);
        } else if (input_tts === '为空' || input_tts === '为空值') {
            Config.blockWords = ['']
            let show_msg1 = '输出黑名单已设置为空值'
            let show_msg3 = '可使用#chatgpt查看输出黑名单'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg3], 'chatgpt输出黑名单');
            return e.reply(show_msgx);
        } else {
            let input_array = input_tts.split(",");
            Config.blockWords = input_array
            let show_msg1 = '输出黑名单已设置为：'
            let show_msg2 = `${input_array}`
            let show_msg3 = '可使用#chatgpt查看输出黑名单'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg2, show_msg3], 'chatgpt输出黑名单');
            return e.reply(show_msgx);
        }
    }

    /** ^#chatgpt(设置|查看)?输入黑名单(帮助)? */
    async set_promptBlockWords(e) {
        let input_tts = e.msg.replace(/^#chatgpt(设置|查看)?输入黑名单(帮助)?/, '').trim()
        if (!input_tts) {
            let show_msg1 = 'chatgpt当前输入黑名单：'
            let show_msg2 = `${Config.promptBlockWords}`
            let show_msg3 = '检查对话输入中是否有违禁词，如果存在黑名单中的违禁词则不输出。英文逗号隔开。如：\n#chatgpt设置输入黑名单屏蔽词1,屏蔽词b'
            let show_msg4_1 = '#chatgpt设置输入黑名单为空值'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg2, show_msg3, show_msg4_1], 'chatgpt输入黑名单帮助');
            return e.reply(show_msgx, false);
        } else if (input_tts === '为空' || input_tts === '为空值') {
            Config.promptBlockWords = ['']
            let show_msg1 = '输入黑名单已设置为空值'
            let show_msg3 = '可使用#chatgpt查看输入黑名单'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg3], 'chatgpt输入黑名单');
            return e.reply(show_msgx);
        } else {
            let input_array = input_tts.split(",");
            Config.promptBlockWords = input_array
            let show_msg1 = '输入黑名单已设置为：'
            let show_msg2 = `${input_array}`
            let show_msg3 = '可使用#chatgpt查看输入黑名单'
            let show_msgx = await common.makeForwardMsg(e, [show_msg1, show_msg2, show_msg3], 'chatgpt输入黑名单');
            return e.reply(show_msgx);
        }
    }

    /** ^#tts(语音)?转日语(帮助)? */
    async set_autoJapanese(e) {
        let input_tts = e.msg.replace(/^#tts(语音)?转日语(帮助)?/, '').trim()
        if (!input_tts) {
            let msg1 = `可以选择把文本翻译成日语再发音哦`
            let msg_show = `tts语音转日语当前设置：${Config.autoJapanese}`
            let msg1_1 = `#tts语音转日语(开启|关闭)`
            let msgx = await common.makeForwardMsg(e, [msg1, msg_show, msg1_1], `tts语音转日语帮助`);
            return e.reply(msgx, false)
        }
        if (input_tts === '开启' || input_tts === '关闭') {
            Config.autoJapanese = input_tts === '开启' ? true : false
            return e.reply(`tts转日语已设置为${input_tts}！`)
        } else {
            return e.reply('喵？可以选择把文本翻译成日语再发音哦\n#tts转日语(开启|关闭)')
        }
    }

    /** ^#chatgpt对话中图片识别(帮助)? */
    async set_recognitionByGemini(e) {
        let input_tts = e.msg.replace(/^#chatgpt对话中图片识别(帮助)?/, '').trim()
        if (!input_tts) {
            let msg1 = `识别引用的图片的内容；对话的前面加上gemini的识图结果`
            let msg_show = `当前设置：${Config.mediaRecognitionSource}`
            let msg1_1 = `#chatgpt对话中图片识别(开启|关闭)`
            let msgx = await common.makeForwardMsg(e, [msg1, msg_show, msg1_1], `#chatgpt对话中图片识别帮助`);
            return e.reply(msgx, false)
        }
        if (input_tts === '开启' || input_tts === '关闭') {
            Config.mediaRecognitionSource = input_tts === '开启' ? "Gemini" : "Orignal"
            return e.reply(`对话中图片识别已设置为${input_tts}！`)
        } else {
            return e.reply('喵？请输入\n#chatgpt对话中图片识别帮助')
        }
    }

    /** ^#tts(语音)?切片生成(帮助)? */
    async set_tts_slice_is_slice_generation(e) {
        let input_tts = e.msg.replace(/^#tts(语音)?切片生成(帮助)?/, '').trim()
        if (!input_tts) {
            let msg1 = `使用切片生成而不是普通生成，可以突破字数300的限制，可以控制段间停顿和句间停顿；但1、会增加生成耗时，2、会导致每一段句子语气不一致，3、增加post失败概率\n（2024年3月7日 API更新了，目前只支持切片生成，所有语音已强制使用切片生成）`
            let msg_show = `tts语音切片生成当前设置：\n 是否开启：${Config.tts_slice_is_slice_generation}\n 段间停顿时长（秒）：${Config.tts_slice_pause_between_paragraphs_seconds}\n 开启按句切分：${Config.tts_slice_is_Split_by_sentence}\n 句间停顿时长（秒）：${Config.tts_slice_pause_between_sentences_seconds}\n -具体参数请在锅巴设置修改`
            let msg1_1 = `#tts语音切片生成(开启|关闭)`
            let msgx = await common.makeForwardMsg(e, [msg1, msg_show, msg1_1], `tts语音切片生成帮助`);
            return e.reply(msgx, false)
        }
        if (input_tts === '开启' || input_tts === '关闭') {
            Config.tts_slice_is_slice_generation = input_tts === '开启' ? true : false
            return e.reply(`tts切片生成已设置为${input_tts}！`)
        } else {
            return e.reply('喵？请使用#tts语音切片生成帮助')
        }
    }

    /** ^#tts(删除|重置)所有(chatgpt)?用户(回复|单独)设置 */
    async delete_redis_all_user_config(e) {
        let input_tts = e.msg.replace(/^#tts(删除|重置)所有(chatgpt)?用户(回复|单独)设置/, '').trim()
        if (input_tts) {
            let msg1 = `重置所有用户单独回复设置，所有用户将重新使用默认配置。用户单独回复设置的优先级高于默认设置，删除后用户可重新设置。\n 查看单独设置：#chatgpt查看回复设置`
            let msg1_1 = `#tts重置所有用户单独设置`
            let msgx = await common.makeForwardMsg(e, [msg1, msg1_1], `tts重置所有用户单独设置`);
            return e.reply(msgx, false)
        }
        let chatgpt_user = await redis.keys('CHATGPT:USER:*')
        let deleted = 0
        for (let i = 0; i < chatgpt_user.length; i++) {
            await redis.del(chatgpt_user[i])
            if (Config.debug) {
                logger.info('delete chatgpt_user: ' + chatgpt_user[i])
            }
            deleted++
        }
        return e.reply(`已经重置${deleted}个用户的单独回复设置，所有用户将使用默认配置。\n#chatgpt查看回复设置`, true)
    }

    /** 发送当前设置 */
    async show_tts_voice_help_config(e) {
        let show_tts_voice_help_config_msg1 = 'tts语音当前设置：'
        let show_tts_voice_help_config_msg2 = ` 默认角色：${Config.defaultTTSRole}\n AI第一人称：${Config.tts_First_person}\n 全局语音模式：${Config.defaultUseTTS}\n${Config.ttsSpace?.includes("bv2.firefly.matce.cn") ? `以下为Bert-Vits参数：\n 发音语言：强制自动\n tts情感设置上锁：${Config.vits_emotion_locker} \n vits_emotion：${Config.vits_emotion} \n 情感自动设置：${Config.vits_auto_emotion} \n noiseScale：${Config.noiseScale} \n noiseScaleW：${Config.noiseScaleW} \n lengthScale：${Config.lengthScale} \n sdp_ratio：${Config.sdp_ratio} \n 融合文本：${Config.style_text} \n 融合权重：${Config.style_text_weights} \n 切片生成：${Config.tts_slice_is_slice_generation} \n 段间停顿时长：${Config.tts_slice_pause_between_paragraphs_seconds} 秒\n 按句切分：${Config.tts_slice_is_Split_by_sentence} \n 句间停顿时长：${Config.tts_slice_pause_between_sentences_seconds} 秒` : ''}${Config.ttsSpace?.includes("fs.firefly.matce.cn") ? `以下为Fish-Vits参数：\n exampleAudio：${Config.exampleAudio} \n Iterative Prompt Length：${Config.Fish_Iterative_Prompt_Length} \n Maximum tokens per batch：${Config.Fish_Maximum_tokens_per_batch} \n Top-P：${Config.Fish_Top_P} \n Repetition Penalty：${Config.Fish_Repetition_Penalty} \n Temperature：${Config.Fish_Temperature}` : ''}${Config.ttsSpace?.includes("api.fish.audio") ? `以下为api.fish.audio参数：\n 发音人ID：${Config.fish_reference_id} \n token：[已隐藏]` : ''}${Config.ttsSpace?.includes("hf.space") ? `以下为vits-uma参数：\n noiseScale：${Config.noiseScale} \n noiseScaleW：${Config.noiseScaleW} \n lengthScale：${Config.lengthScale}` : ''}`

        const userSetting = await getUserReplySetting(this.e)
        let msg4_1 = `${this.e.sender.user_id}的回复设置:
图片模式: ${userSetting.usePicture === true ? '开启' : '关闭'}
语音模式: ${userSetting.useTTS === true ? '开启' : '关闭'}
Vits语音角色: ${userSetting.ttsRole}
Azure语音角色: ${userSetting.ttsRoleAzure}
${userSetting.useTTS === true ? '当前语音模式为' + Config.ttsMode : ''}`
        msg4_1 = msg4_1.replace(/\n\s*$/, '')

        let show_tts_voice_help_config_msg2_msgx = await common.makeForwardMsg(e, [show_tts_voice_help_config_msg1, show_tts_voice_help_config_msg2, msg4_1], '小呆毛tts语音当前设置');
        return e.reply(show_tts_voice_help_config_msg2_msgx);
    }

    /** ^#派蒙戳(一戳)?(保存|添加)(图片|表情)$ */
    async paimon_chuo_save_img(e) {
        await parseSourceImg(e)
        if (e.img) {
            const imgResponse = await fetch(e.img[0])
            if (imgResponse.ok) {
                let imgSize = (imgResponse.headers.get('size') / 1024 / 1024).toFixed(2)
                if (imgSize > 1024 * 1024 * 50) {
                    this.e.reply(`这图片超过50MB了，还是不要保存了吧QAQ`, true)
                    return false
                }
                const imageUrl = await reNameAndSavePic(imgResponse, e.img[0], paimonChuoYiChouSavePicDirectory)
                if (imageUrl) e.reply(`派蒙戳一戳图片已保存`, true)
                else e.reply(`派蒙戳一戳图片保存失败,请确认`, true)
                return true
            }
            else return e.reply('图片下载失败了呢QAQ', true)
        } else {
            return e.reply('请将图片一起发送或引用图片', true)
        }
    }

    /** ^#派蒙tts查看fish用量$ */
    async paimon_tts_check_fish_audio_token_usage(e) {
        /** 把 Config.api_fish_audio_account_ID 分割为对象 */
        const accounts = {};
        Config.api_fish_audio_account_ID.split(',').forEach(item => {
            const [accountId, password] = item.split(':');
            accounts[accountId] = password;
        });
        /** 将 accounts 的 key 提出为数组 */
        const accountIdArray = Object.keys(accounts);

        let msg1 = '当前api_fish_audio_token：'
        let msg2 = ''
        for (let i = 0; i < accountIdArray.length; i++) {
            const token = await redis.get(`CHATGPT:api_fish_audio_redis_token:${accountIdArray[i]}`) || "未获取，将自动获取"
            msg2 += `┌ ${i + 1}. `
            msg2 += accountIdArray[i]
            msg2 += '\n├ token：'
            msg2 += token.replace(/(.{7}).{160}(.*)/, '$1****$2')
            msg2 += '\n├ 今日用量：'
            msg2 += await redis.get(`CHATGPT:api_fish_audio_redis_usage:${accountIdArray[i]}`) || 0
            msg2 += '\n├ 今日出错：'
            msg2 += await redis.get(`CHATGPT:api_fish_audio_redis_errorTimes:${accountIdArray[i]}`) || 0
            msg2 += '\n└ 出错代码：'
            msg2 += await redis.get(`CHATGPT:api_fish_audio_redis_lastErrorStatus:${accountIdArray[i]}`) || "未出错"
            msg2 += '\n\n'
        }
        if (!msg2) msg2 = '当前未配置api_fish_audio_token，请使用锅巴设置。'

        const msgx = await common.makeForwardMsg(e, [msg1, msg2], '派蒙tts查看fish用量');
        e.reply(msgx);
        return true
    }

    /** ^#派蒙tts强制刷新fish账号$ */
    async paimon_tts_refresh_fish_account_token(e) {
        /** 把 Config.api_fish_audio_account_ID 分割为对象 */
        const accounts = {};
        Config.api_fish_audio_account_ID.split(',').forEach(item => {
            const [accountId, password] = item.split(':');
            accounts[accountId] = password;
        });
        e.reply("为防止触发人机验证，正在使用单进程刷新fish账号token，请等待" + Object.keys(accounts).length * 20 + "秒", true);

        let falseNum = 0;
        let successNum = 0;
        for (const accountId in accounts) {
            const password = accounts[accountId];
            let token = await post_to_api_fish_audio_for_token(accountId, password);
            if (token)
                successNum++
            else
                falseNum++
            await sleep_pai(10000)
        }
        e.reply(`成功刷新${successNum}个token，失败${falseNum}个`, true);
        return true
    }

    /** task任务: 派蒙tts自动任务 */
    async paimon_tts_Auto_tasker(e = null) {
        /** ^#tts(删除|重置)所有(chatgpt)?用户(回复|单独)设置 */
        let chatgpt_user = await redis.keys('CHATGPT:USER:*')
        let deleted = 0
        for (let i = 0; i < chatgpt_user.length; i++) {
            if (cfg.masterQQ?.includes(parseInt(chatgpt_user[0]?.split(':')?.[2]))) continue
            await redis.del(chatgpt_user[i])
            if (Config.debug) {
                logger.info('delete chatgpt_user: ' + chatgpt_user[i])
            }
            deleted++
        }
        logger.mark(`[派蒙tts自动任务]已经重置${deleted}个用户的单独回复设置，所有用户将使用默认配置。`)

        // chatgpt-tts-自动全局语音模式
        // if (Config.api_fish_control_defaultUseTTS && Config.api_fish_audio_token.length && Config.ttsSpace?.includes('api.fish.audio')) {
        //     Config.defaultUseTTS = true
        //     logger.mark(`[chatgpt-tts-自动全局语音模式]全局语音模式已开启，将在fish.audio达到配额后自动关闭`)
        // }

        return true
    }

    /**
     * 以合并转发形式列出本次拉取到的 Gemini 模型名，每个模型名一个节点
     * @param {*} e 事件对象
     * @param {string[]} models getGeminiModelsByFetch 的返回值（已剥离 models/ 前缀）
     */
    async replyGeminiModelList(e, models) {
        if (!Array.isArray(models) || models.length === 0) {
            e.reply('[派蒙chatgpt自动任务] 本次未获取到任何 Gemini 模型')
            return
        }
        // 合并转发节点数有上限（QQ 一般为 99），超出部分只截断展示，不影响已写入的完整列表
        const maxNodes = 90
        const shown = models.slice(0, maxNodes)
        const messages = shown.map((name) => String(name))
        let title = `Gemini 模型列表（共 ${models.length} 个）`
        if (shown.length < models.length) {
            messages.push(`…… 还有 ${models.length - shown.length} 个未展示`)
            title += `，仅展示前 ${shown.length} 个`
        }
        try {
            await e.reply(await common.makeForwardMsg(e, messages, title))
        } catch (err) {
            logger.error(`[派蒙chatgpt自动任务]发送Gemini模型列表合并转发失败:\n` + err)
            e.reply(`[派蒙chatgpt自动任务] 模型列表发送失败，共 ${models.length} 个模型，请查看日志`)
        }
    }

    async searchFishVoices(e) {
        if (Config.getFishApiKey.length == 0) {
            e.reply("请先在锅巴中设置fish.audio的Api Key", true);
            return
        }
        const keyword = e.msg.replace(/^#搜索fish发音人/, '').trim();

        const options = {
            method: 'GET',
            headers: { Authorization: `Bearer ${Config.getFishApiKey}` }
        };

        const fish_base_url = Config.fish_base_url || "https://api.fish.audio"

        let optionMsg = "可用指令：#chatgpt设置全局vits语音角色"
        let msgArr = [`Fish发音人列表 ${keyword}：`];
        await fetch(`${fish_base_url}/model?tag=${encodeURIComponent(keyword)}`, options)
            .then(response => response.json())
            .then(response => {
                for (let index = 0; index < response.total; index++) {
                    if (0 == index) optionMsg += response.items[0]._id
                    msgArr.push(`名称：${response.items[index].title}\n发音人ID：${response.items[index]._id}`)
                }
            })
            .catch(err => logger.error(err));

        msgArr.push(optionMsg)
        const msgx = await common.makeForwardMsg(e, msgArr, `Fish发音人`)
        await e.reply(msgx);
    }

    async paimon_tts_test(e) {
        return e.reply('获取模型列表请使用 #chatgpt获取可用模型，再按数字选择提供商。', true)
    }

    /** ^#删除所有(gemini|Gemini)(对话|会话)记录$ */
    async delete_redis_all_gemini_msg(e) {
        let gemini_messages = await redis.keys('CHATGPT:MESSAGE_Gemini:*')
        let deleted = 0
        for (let i = 0; i < gemini_messages.length; i++) {
            await redis.del(gemini_messages[i])
            if (Config.debug) {
                logger.info('delete gemini_message: ' + gemini_messages[i])
            }
            deleted++
        }
        e.reply(`已经删除${deleted}个Gemini会话记录。建议：\n#结束全部对话`, true)
        return true;
    }

}

/** 下载好的图片重命名并存档在directory */
/* ---------------- 偷图索引 ----------------
 * 为什么需要：偷图时本地文件名是 sha256(url) 的哈希（见 reNameAndSavePic），
 * 而原消息里是 NapCat 的临时图地址，两边毫无关联。没有索引就无法从「用户引用的
 * 那条偷图消息」反查「本地该删哪个文件」，只能靠翻分类 + 数序号。
 *
 * 索引只服务删除，结构保持最简：
 *   { 短ID: { msgId, emotion, file } }
 * 存 .index.json（点开头，默认隐藏），与表情图同目录，便于一起删。
 */

const EMOJI_INDEX_FILE = path.join(process.cwd(), 'data', 'chatgpt', 'sendEmojiTool', '.index.json');

function readEmojiIndex() {
    try {
        if (!fs.existsSync(EMOJI_INDEX_FILE)) return {};
        const raw = JSON.parse(fs.readFileSync(EMOJI_INDEX_FILE, 'utf-8'));
        return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch (err) {
        logger.warn('[偷图索引] 读取失败，已忽略：', err?.message || err);
        return {};
    }
}

function writeEmojiIndex(index) {
    try {
        fs.mkdirSync(path.dirname(EMOJI_INDEX_FILE), { recursive: true });
        fs.writeFileSync(EMOJI_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
        return true;
    } catch (err) {
        logger.warn('[偷图索引] 写入失败：', err?.message || err);
        return false;
    }
}

/** 生成不重复的短 ID：用 base32 去掉容易读错的 0/1/I/O，4 位约 100 万种 */
function genEmojiShortId(index) {
    const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let attempt = 0; attempt < 20; attempt++) {
        let id = '';
        for (let i = 0; i < 4; i++) {
            id += ALPHABET[crypto.randomInt(ALPHABET.length)];
        }
        if (!index[id]) return id;
    }
    // 极端情况下（4 位空间耗尽）退回时间戳，保证一定能存下
    return 'T' + Date.now().toString(36).toUpperCase().slice(-6);
}

function saveEmojiIndex(e, emotion, file) {
    const index = readEmojiIndex();
    const id = genEmojiShortId(index);
    index[id] = {
        msgId: e.reply_id || e.source?.message_id || e.message_id || '',
        emotion,
        file,
        at: Date.now(),
    };
    return writeEmojiIndex(index) ? id : '';
}

/** 偷图成功后补记 Bot 回复消息的 ID：引用「偷图成功」那条文字消息也能删 */
function updateEmojiIndexReplyMsgId(shortId, msgId) {
    if (!shortId || !msgId) return false;
    const index = readEmojiIndex();
    const rec = index[String(shortId).toUpperCase()];
    if (!rec) return false;
    rec.replyMsgId = String(msgId);
    return writeEmojiIndex(index);
}

function findEmojiIndex(shortId) {
    const rec = readEmojiIndex()[String(shortId || '').toUpperCase()];
    return rec && rec.emotion && rec.file ? rec : null;
}

/** 引用消息查索引：同一条消息可能对应多个短 ID（重复偷同一张图），取最近一个 */
function findEmojiIndexByMsgId(e, msgId) {
    if (!msgId) return null;
    const idStr = String(msgId);
    const index = readEmojiIndex();
    let best = null;
    for (const [id, rec] of Object.entries(index)) {
        if ((String(rec?.msgId || '') === idStr || String(rec?.replyMsgId || '') === idStr)
            && rec.emotion && rec.file) {
            if (!best || (rec.at || 0) > (best.at || 0)) best = { ...rec, id };
        }
    }
    return best;
}

/** 文件已删掉或分类消失后，把对应索引条目清掉，避免越积越多 */
function removeEmojiIndexByFile(emotion, file) {
    const index = readEmojiIndex();
    let changed = false;
    for (const [id, rec] of Object.entries(index)) {
        if (rec?.emotion === emotion && rec?.file === file) {
            delete index[id];
            changed = true;
        }
    }
    if (changed) writeEmojiIndex(index);
}

async function reNameAndSavePic(response, url, directory) {
    try {
        if (!fs.existsSync(directory))
            fs.mkdirSync(directory, { recursive: true });

        // 计算URL的哈希值并将其作为文件名
        let hash_name = crypto.createHash('sha256').update(url).digest('hex')
        // 获取文件后缀
        let type = response.headers.get('content-type').split('/')[1]
        if (type == 'jpeg') type = 'jpg'

        let localPath = path.join(directory, hash_name + '.' + type)

        // 检查文件是否已经存在
        if (fs.existsSync(localPath)) return localPath

        const imageData = await response.arrayBuffer()
        fs.writeFileSync(localPath, Buffer.from(imageData))
        return localPath
    } catch (err) {
        logger.error(err)
        return null
    }
}
