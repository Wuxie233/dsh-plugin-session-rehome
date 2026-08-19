/**
 * Session rehome: model-facing `move_agent_to_root` over Host session.rehome.
 *
 * From No Repo, a unique registered match executes immediately. Leaving a
 * real project, or several matches, asks via ctx.userQuestions. Existing
 * unregistered directories are registered by the Host. The canonical No Repo
 * directory is refused. Directories are not created.
 *
 * @module @wuxie/dsh-session-rehome
 */

import { realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { sessionWorkingDirectory } from '@deepseek-ai/dsh-sandbox-policy'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

export const name = 'session-rehome'
export const inject = ['tools', 'agents', 'workspaceRegistry', 'systemPrompt']

export const Config = z.object({
  /** Prompt-section order (default 118, after AgentTeams usage). */
  promptSectionOrder: z.number().default(118),
})

const USAGE = `When the user starts in No Repo (or names a different project than the current conversation) and you can identify the target directory, call move_agent_to_root with that absolute path. Do not mkdir. Do not rehome back to No Repo. After a successful move, read the new project's AGENTS.md / package.json before editing.`

/**
 * Canonical No Repo directory.
 * @returns absolute no-repo path
 */
function noRepoPath() {
  return dshHomePath('no-repo')
}

/**
 * Fold last workspace/home or git/worktree, else header cwd.
 * @param session live session
 */
function foldHome(session) {
  try {
    const home = sessionWorkingDirectory(session)
    if (typeof home === 'string' && home.length > 0) return home
  } catch {
    // sandbox-policy may be absent in a thin composition
  }
  const events = session.events ?? []
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type === 'workspace/home' || event.type === 'git/worktree') {
      const path = event.data?.path
      if (typeof path === 'string' && path.length > 0) return path
    }
  }
  return session.header?.cwd
}

/**
 * Whether this workspace is the No Repo bucket.
 * @param workspace workspace entity
 * @param noRepo canonical no-repo path
 */
function isNoRepoWorkspace(workspace, noRepo) {
  return workspace.path === noRepo || workspace.title === 'No Repo'
}

/**
 * Match registered workspaces (excluding No Repo) against a canonical path.
 * @param workspaces registry list
 * @param canonical target path
 * @param noRepo canonical no-repo path
 */
function matchWorkspaces(workspaces, canonical, noRepo) {
  const name = basename(canonical)
  const candidates = workspaces.filter(workspace => !isNoRepoWorkspace(workspace, noRepo))
  const exact = candidates.filter(workspace => workspace.path === canonical)
  if (exact.length > 0) return exact
  return candidates.filter(workspace => workspace.title === name || basename(workspace.path) === name)
}

/**
 * Call Host session.rehome or fall back to registry + setSessionHome.
 * @param ctx plugin context
 * @param session live session
 * @param canonical target directory
 */
async function rehome(ctx, session, canonical) {
  const api = ctx.get('apiProxy')
  if (api?.sessions?.rehome !== undefined) {
    const response = await api.sessions.rehome({
      rpcId: `rehome-${session.id}`,
      payload: { sessionId: session.id, path: canonical },
    })
    if (response.result.ok !== true) {
      const error = response.result.error
      throw new Error(error?.message ?? `session.rehome failed for ${canonical}`)
    }
    return response.result.value
  }
  const { setSessionHome } = await import('@deepseek-ai/dsh-sandbox-policy')
  const target = await ctx.workspaceRegistry.create(canonical)
  const current = foldHome(session)
  if (current !== canonical) setSessionHome(session, canonical)
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (workspace.id !== target.id && workspace.sessionIds.includes(session.id)) {
      await workspace.detachSession(session.id)
    }
  }
  await target.attachSession(session.id)
  return { workspaceId: target.id, path: target.path, cwd: canonical }
}

/**
 * Ask one confirmation or choice question.
 * @param ctx plugin context
 * @param agent calling agent
 * @param signal abort
 * @param question question payload
 */
async function ask(ctx, agent, signal, question) {
  const questions = ctx.get('userQuestions')
  if (questions === undefined) {
    throw new Error('need user confirmation to leave the current project; ask in chat and call move_agent_to_root again after they confirm')
  }
  const result = await questions.ask({
    questions: [question],
    ...agent === undefined ? {} : { agent },
    signal,
  })
  const answer = result.answers.find(item => item.id === question.id)
  return answer
}

export function apply(ctx, config = {}) {
  const order = Number(config.promptSectionOrder) > 0 ? Number(config.promptSectionOrder) : 118
  ctx.systemPrompt.section({
    name: 'session-rehome:usage',
    order,
    text: USAGE,
  })

  ctx.tools.register(defineTool({
    name: 'move_agent_to_root',
    description: 'Move this conversation to an existing project directory: sidebar group and later bash/fs/AGENTS.md follow the new root in the current turn. Do not mkdir. Do not rehome to No Repo.',
    parameters: {
      rootPath: { type: 'string', required: true, description: 'Absolute existing directory to make this conversation\'s home.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          workspaceId: { type: 'string', required: true },
          cwd: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Moved this conversation to ${value.path}. Continue from that root.`,
      }],
    },
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('move_agent_to_root requires an agent-bound session')
      const session = agent.session
      let canonical
      try {
        canonical = await realpath(args.rootPath)
        if (!(await stat(canonical)).isDirectory()) {
          throw new Error(`rootPath is not a directory: ${args.rootPath}`)
        }
      } catch (error) {
        throw new Error(`rootPath does not resolve to an existing directory: ${args.rootPath}`)
      }
      const noRepo = await realpath(noRepoPath()).catch(() => noRepoPath())
      if (canonical === noRepo) {
        throw new Error('cannot rehome this conversation back to No Repo')
      }
      const home = foldHome(session)
      const homeCanonical = home === undefined ? undefined : await realpath(home).catch(() => home)
      const onNoRepo = homeCanonical === noRepo || homeCanonical === undefined
      const workspaces = ctx.workspaceRegistry.list()
      const matches = matchWorkspaces(workspaces, canonical, noRepo)

      if (!onNoRepo && homeCanonical !== canonical) {
        const answer = await ask(ctx, agent, exec.signal, {
          id: 'confirm-rehome',
          header: 'Move conversation',
          question: `Move this conversation from ${homeCanonical} to ${canonical}?`,
          options: [
            { label: 'Move', description: 'Sidebar group and tools follow the new project in this turn.' },
            { label: 'Stay', description: 'Keep the current project; do not rehome.' },
          ],
        })
        const selected = answer?.selected?.[0]
        if (selected !== 'Move') {
          return { path: homeCanonical, workspaceId: '', cwd: homeCanonical }
        }
      } else if (onNoRepo && matches.length > 1) {
        const answer = await ask(ctx, agent, exec.signal, {
          id: 'choose-workspace',
          header: 'Choose project',
          question: `Several registered workspaces match ${canonical}. Which one?`,
          options: matches.map(workspace => ({
            label: workspace.title,
            description: workspace.path,
          })),
        })
        const selected = answer?.selected?.[0]
        const chosen = matches.find(workspace => workspace.title === selected)
        if (chosen === undefined) throw new Error('no workspace selected')
        canonical = chosen.path
      }

      const value = await rehome(ctx, session, canonical)
      return {
        path: value.path,
        workspaceId: String(value.workspaceId),
        cwd: value.cwd,
      }
    },
  }))
}
