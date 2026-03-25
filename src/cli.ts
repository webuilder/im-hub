#!/usr/bin/env node
// bot-hub CLI

import { program } from 'commander'
import { homedir } from 'os'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { registry } from './core/registry.js'
import { sessionManager } from './core/session.js'

const CONFIG_DIR = join(homedir(), '.bot-hub')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

interface Config {
  messengers: string[]
  agents: string[]
  defaultAgent: string
  [key: string]: unknown
}

async function loadConfig(): Promise<Config> {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      messengers: [],
      agents: [],
      defaultAgent: 'claude-code',
    }
  }
}

async function saveConfig(config: Config): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

program
  .name('bot-hub')
  .description('Universal messenger-to-agent bridge')
  .version('0.0.1.0')

program
  .command('start')
  .description('Start the bot-hub server')
  .action(async () => {
    console.log('🚀 Starting bot-hub...')

    const config = await loadConfig()
    console.log(`Config loaded from ${CONFIG_FILE}`)

    // Initialize session manager
    await sessionManager.start()

    // Load plugins
    await registry.loadBuiltInPlugins()

    // TODO: Start messenger adapters based on config
    console.log('Messengers:', config.messengers)
    console.log('Agents:', config.agents)
    console.log('Default agent:', config.defaultAgent)

    console.log('\n✅ Bot hub is running!')
    console.log('Press Ctrl+C to stop')

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down...')
      sessionManager.stop()
      process.exit(0)
    })

    // Wait forever
    await new Promise(() => {})
  })

program
  .command('config [component]')
  .description('Configure a messenger or agent')
  .action(async (component?: string) => {
    if (!component) {
      console.log('Available components to configure:')
      console.log('\nMessengers:')
      console.log('  wechat  - WeChat adapter')
      console.log('\nAgents:')
      console.log('  claude  - Claude Code agent')
      console.log('\nUsage: bot-hub config <component>')
      return
    }

    const config = await loadConfig()

    switch (component) {
      case 'wechat':
        console.log('📱 Configuring WeChat adapter...')
        console.log('Scan the QR code with WeChat to login.')
        // TODO: Implement wechaty QR login
        if (!config.messengers.includes('wechat')) {
          config.messengers.push('wechat')
        }
        break

      case 'claude':
        console.log('🤖 Configuring Claude Code agent...')
        // Check if claude CLI is available
        const { spawn } = await import('child_process')
        const checkProcess = spawn('claude', ['--version'], { stdio: 'ignore' })
        checkProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Claude Code CLI found!')
          } else {
            console.log('❌ Claude Code CLI not found.')
            console.log('Install with: npm install -g @anthropic-ai/claude-code')
          }
        })
        if (!config.agents.includes('claude-code')) {
          config.agents.push('claude-code')
        }
        config.defaultAgent = 'claude-code'
        break

      default:
        console.log(`Unknown component: ${component}`)
        console.log('Run "bot-hub config" to see available components.')
        return
    }

    await saveConfig(config)
    console.log(`\n✅ Configuration saved to ${CONFIG_FILE}`)
  })

program
  .command('agents')
  .description('List available agents')
  .action(() => {
    const agents = registry.listAgents()
    if (agents.length === 0) {
      console.log('No agents registered yet.')
      console.log('Run "bot-hub config claude" to configure Claude Code.')
      return
    }
    console.log('🤖 Available Agents:\n')
    for (const name of agents) {
      console.log(`  ${name}`)
    }
  })

program
  .command('messengers')
  .description('List available messengers')
  .action(() => {
    const messengers = registry.listMessengers()
    if (messengers.length === 0) {
      console.log('No messengers registered yet.')
      console.log('Run "bot-hub config wechat" to configure WeChat.')
      return
    }
    console.log('📱 Available Messengers:\n')
    for (const name of messengers) {
      console.log(`  ${name}`)
    }
  })

program.parse()
