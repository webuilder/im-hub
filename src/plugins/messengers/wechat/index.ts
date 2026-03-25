// WeChat messenger adapter using wechaty
// MVP: Basic QR code login + message handling

import type { MessengerAdapter, Message, MessageContext } from '../../core/types.js'
import { ScanStatus } from 'wechaty'

export class WeChatAdapter implements MessengerAdapter {
  readonly name = 'wechat'
  private bot: any = null
  private messageHandler?: (ctx: MessageContext) => Promise<void>

  async start(): Promise<void> {
    // Dynamic import to avoid bundling if not used
    const { WechatyBuilder } = await import('wechaty')

    this.bot = WechatyBuilder.build({
      name: 'bot-hub-wechat',
      puppet: 'wechaty-puppet-wechat',
    })

    // QR code for login
    this.bot.on('scan', (qrcode: string, status: ScanStatus) => {
      if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
        console.log('\n📱 Scan QR code with WeChat:\n')
        // Print QR code as ASCII
        const qrUrl = `https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`
        console.log(qrUrl)
        console.log('\nOr scan the URL above.')
      }
    })

    // Login success
    this.bot.on('login', (user: any) => {
      console.log(`✅ Logged in as ${user}`)
    })

    // Logout
    this.bot.on('logout', (user: any) => {
      console.log(`👋 Logged out from ${user}`)
    })

    // Message received
    this.bot.on('message', async (msg: any) => {
      if (msg.self()) return // Skip own messages

      const contact = msg.talker()
      const room = msg.room()
      const text = msg.text()

      // Build message context
      const message: Message = {
        id: msg.id,
        threadId: room ? `room:${room.id}` : `user:${contact.id}`,
        userId: contact.id,
        text,
        timestamp: msg.date() || new Date(),
      }

      const ctx: MessageContext = {
        message,
        platform: 'wechat',
      }

      if (this.messageHandler) {
        await this.messageHandler(ctx)
      }
    })

    await this.bot.start()
    console.log('🚀 WeChat adapter started')
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop()
      this.bot = null
    }
  }

  onMessage(handler: (ctx: MessageContext) => Promise<void>): void {
    this.messageHandler = handler
  }

  async sendMessage(threadId: string, text: string): Promise<void> {
    if (!this.bot) {
      throw new Error('WeChat adapter not started')
    }

    // Split long messages (WeChat limit ~2048 chars)
    const chunks = this.splitMessage(text)

    for (const chunk of chunks) {
      // Determine if room or direct message
      if (threadId.startsWith('room:')) {
        const roomId = threadId.replace('room:', '')
        const room = await this.bot.Room.find({ id: roomId })
        if (room) {
          await room.say(chunk)
        }
      } else if (threadId.startsWith('user:')) {
        const userId = threadId.replace('user:', '')
        const contact = await this.bot.Contact.find({ id: userId })
        if (contact) {
          await contact.say(chunk)
        }
      }
    }
  }

  private splitMessage(text: string, maxLength = 2000): string[] {
    if (text.length <= maxLength) {
      return [text]
    }

    const chunks: string[] = []
    let remaining = text

    while (remaining.length > maxLength) {
      // Try to split at newline
      let splitPoint = remaining.lastIndexOf('\n', maxLength)
      if (splitPoint < maxLength / 2) {
        // No good break point, just split at max
        splitPoint = maxLength
      }

      chunks.push(remaining.slice(0, splitPoint))
      remaining = remaining.slice(splitPoint).trim()
    }

    if (remaining) {
      chunks.push(remaining)
    }

    // Add continuation markers
    if (chunks.length > 1) {
      for (let i = 0; i < chunks.length - 1; i++) {
        chunks[i] += '\n\n[continued...]'
      }
    }

    return chunks
  }
}

// Singleton instance
export const wechatAdapter = new WeChatAdapter()
