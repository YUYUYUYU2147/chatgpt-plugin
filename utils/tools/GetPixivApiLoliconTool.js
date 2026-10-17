import { AbstractTool } from './AbstractTool.js'
import { get_url_from_api_lolicon } from '../../apps/派蒙戳一戳.js'
import { Config } from '../config.js'

/**
 * Tool: 从 Lolicon API 获取图片
 * 通过标签搜索并返回图片URL
 */
export class GetPixivApiLoliconTool extends AbstractTool {
    name = 'get_pixiv_images'

    parameters = {
        properties: {
            tag1: {
                type: 'string',
                description: '主标签（日文）。可用 "|" 分隔多个标签（OR 逻辑，最多20个）。示例："白髪", "猫耳|メイド"'
            },
            tag2: {
                type: 'string',
                description: '可选副标签（日文），格式同 tag1。与 tag1 为 AND 关系'
            },
            num: {
                type: 'number',
                description: '获取数量，1-10，默认 3'
            }
        },
        required: ['tag1']
    }

    description = '通过日文标签搜索并返回 Pixiv 动漫/插画图片。当用户索要带有特定特征（发色、服装等）的动漫图时调用。标签内支持 "|" 或逻辑，tag1 与 tag2 为与逻辑。图片会自动发送给用户。'

    constructor() {
        super()
    }

    func = async function (opts, e) {
        let { tag1, tag2, num = 3 } = opts

        if (!tag1 || typeof tag1 !== 'string') {
            return 'Error: tag1 parameter is required and must be a string'
        }

        if (typeof num !== 'number' || num < 1) {
            num = 1
        } else if (num > 10) {
            num = 10
        }

        try {
            // R-18 只对 Bot 主人生效：锅巴开关本身由主人控制，但开关一开，
            // 群里任何人 / 私聊任何人都能借 bot 的手把 18+ 图发出来。
            // 因此这里再叠一层 e.isMaster 判定 —— 开关 + 主人，两个条件同时满足才放开。
            const allowR18 = !!Config.getPixiv18Tool && !!e?.isMaster
            // 开关已开但当前不是主人 = 这次搜索被降级成全年龄，出图后要补一句说明，
            // 否则对方只会觉得「开了开关怎么还是这种图」，不知道是被权限挡了。
            const r18Downgraded = !!Config.getPixiv18Tool && !allowR18
            if (r18Downgraded) {
                logger.debug?.('[GetPixivApiLoliconTool] 18+ 开关已开但当前非主人，按全年龄处理')
            }

            const picUrls = await get_url_from_api_lolicon(tag1, tag2, num, allowR18 ? 2 : 0)

            if (!picUrls || !Array.isArray(picUrls) || picUrls.length === 0) {
                // 非主人 + 18+ 开关已开时，这里明确告诉模型「这条路走不通」，
                // 免得它拿着 R-18 标签反复重试、把 token 浪费在注定失败的搜索上。
                const suffix = r18Downgraded
                    ? ' Note: R-18 search is only available to the bot owner. For other users only all-ages results are returned, so avoid R-18 specific tags.'
                    : ''
                return `No images found for tags: ${tag1}${tag2 ? ` and ${tag2}` : ''}. Try using different or more general tags.${suffix}`
            }

            for (const url of picUrls) {
                e.reply(segment.image(url))
            }

            // 图发完补一句说明。走 e.reply 而不是在返回值里写，是因为返回值只喂给模型、
            // 不会发到聊天里；这句是要让人看见的。
            if (r18Downgraded) {
                e.reply('只有主人能涩涩哦~')
            }

            return `Successfully sent ${picUrls.length} image(s) with tags: ${tag1}${tag2 ? ` and ${tag2}` : ''}. Image URLs: ${JSON.stringify(picUrls)}. You may also use sendPicture tool if needed.`

        } catch (err) {
            logger.error('[GetPicsApiLoliconTool] Error:', err)
            return `Failed to retrieve image: ${err.message || 'Unknown error occurred'}`
        }
    }
}
