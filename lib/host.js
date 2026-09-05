import { realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  DEFAULT_REHOME_MODE,
  REHOME_MODE_FIELD,
  REHOME_MODES,
  SETTINGS_NAMESPACE,
  normalizeRehomeMode,
  rehomePolicy,
} from './logic.js'
export {
  DEFAULT_REHOME_MODE,
  REHOME_MODE_FIELD,
  REHOME_MODES,
  SETTINGS_NAMESPACE,
  normalizeRehomeMode,
  rehomePolicy,
}

/** Factory receives the versioned StarPivot host API after admission. */
export default function createHost(api) {
  const { snapshotSessionEvents, dshHomePath, sessionWorkingDirectory, setSessionHome, settingsNamespace, defineTool, z } = api


const name = 'session-rehome'

const inject = ['tools', 'agents', 'workspaceRegistry', 'systemPrompt']


const Config = z.object({
  /** Prompt-section order (default 118, after AgentTeams usage). */
  promptSectionOrder: z.number().default(118),
})


/** Durable schema; also the wire envelope the browser scope validates against. */
const RehomeModeSchema = z.object({
  [REHOME_MODE_FIELD]: z.union([...REHOME_MODES]).default(DEFAULT_REHOME_MODE),
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
function sessionLog(session) {
  return snapshotSessionEvents(session)
}


function foldHome(session) {
  const events = sessionLog(session)
  try {
    const home = sessionWorkingDirectory({
      header: session.header ?? {},
      events,
    })
    if (typeof home === 'string' && home.length > 0) return home
  } catch {
    // sandbox-policy may throw in a thin composition without a header
  }
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
 * Optional Host `session.rehome` via ctx.apiProxy. Production Web does not
 * provide apiProxy (host-apiproxy is gone); this branch is only for a test
 * stub or a composition that still mounts one. Never required.
 * @param ctx plugin context
 * @returns the Host RPC, or undefined
 */
function hostRehome(ctx) {
  const api = ctx.get('apiProxy')
  const rehome = api?.sessions?.rehome
  return typeof rehome === 'function' ? rehome : undefined
}


/**
 * Call optional Host session.rehome, else the live production path:
 * workspaceRegistry.create + setSessionHome + detach/attach.
 * @param ctx plugin context
 * @param session live session
 * @param canonical target directory
 */
async function rehome(ctx, session, canonical) {
  const host = hostRehome(ctx)
  if (host !== undefined) {
    const response = await host({
      rpcId: `rehome-${session.id}`,
      payload: { sessionId: session.id, path: canonical },
    })
    if (response.result.ok !== true) {
      const error = response.result.error
      throw new Error(error?.message ?? `session.rehome failed for ${canonical}`)
    }
    return response.result.value
  }
  if (session.header?.origin === 'subagent') {
    throw new Error(`session "${session.id}" is owned by subagent routing`)
  }
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


/**
 * Read the live ask/auto preference, defaulting to ask.
 * @param ctx plugin context
 * @returns {'ask' | 'auto'}
 */
function readRehomeMode(ctx) {
  const settings = ctx.get('settings')
  if (settings === undefined) return DEFAULT_REHOME_MODE
  try {
    const section = settings.get(settingsNamespace(SETTINGS_NAMESPACE))
    return normalizeRehomeMode(section?.[REHOME_MODE_FIELD])
  } catch {
    // namespace not registered yet, or a thin composition without settings
    return DEFAULT_REHOME_MODE
  }
}


function apply(ctx, config = {}) {
  const order = Number(config.promptSectionOrder) > 0 ? Number(config.promptSectionOrder) : 118
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(settingsNamespace(SETTINGS_NAMESPACE), RehomeModeSchema)
  })
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
      const policy = rehomePolicy({
        mode: readRehomeMode(ctx),
        onNoRepo,
        leavingProject: !onNoRepo && homeCanonical !== canonical,
        matchCount: matches.length,
      })
      if (policy.remapUnique) canonical = matches[0].path

      if (policy.confirmLeave) {
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
      } else if (policy.chooseMatch) {
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
  return { name, inject, Config, RehomeModeSchema, apply }
}
