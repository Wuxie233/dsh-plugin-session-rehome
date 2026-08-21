import { strict as assert } from 'node:assert'
import { normalizeRehomeMode, rehomePolicy } from '../lib/logic.js'

assert.equal(normalizeRehomeMode('auto'), 'auto')
assert.equal(normalizeRehomeMode('ask'), 'ask')
assert.equal(normalizeRehomeMode(undefined), 'ask')
assert.equal(normalizeRehomeMode('other'), 'ask')

const askNoRepoUnique = rehomePolicy({
  mode: 'ask',
  onNoRepo: true,
  leavingProject: false,
  matchCount: 1,
})
assert.deepEqual(askNoRepoUnique, {
  remapUnique: true,
  confirmLeave: false,
  chooseMatch: false,
})

const askNoRepoMany = rehomePolicy({
  mode: 'ask',
  onNoRepo: true,
  leavingProject: false,
  matchCount: 2,
})
assert.deepEqual(askNoRepoMany, {
  remapUnique: false,
  confirmLeave: false,
  chooseMatch: true,
})

const askLeave = rehomePolicy({
  mode: 'ask',
  onNoRepo: false,
  leavingProject: true,
  matchCount: 1,
})
assert.deepEqual(askLeave, {
  remapUnique: false,
  confirmLeave: true,
  chooseMatch: false,
})

const askSameHome = rehomePolicy({
  mode: 'ask',
  onNoRepo: false,
  leavingProject: false,
  matchCount: 0,
})
assert.deepEqual(askSameHome, {
  remapUnique: false,
  confirmLeave: false,
  chooseMatch: false,
})

const autoLeave = rehomePolicy({
  mode: 'auto',
  onNoRepo: false,
  leavingProject: true,
  matchCount: 2,
})
assert.deepEqual(autoLeave, {
  remapUnique: false,
  confirmLeave: false,
  chooseMatch: false,
})

const autoNoRepoMany = rehomePolicy({
  mode: 'auto',
  onNoRepo: true,
  leavingProject: false,
  matchCount: 2,
})
assert.deepEqual(autoNoRepoMany, {
  remapUnique: false,
  confirmLeave: false,
  chooseMatch: false,
})

const autoNoRepoUnique = rehomePolicy({
  mode: 'auto',
  onNoRepo: true,
  leavingProject: false,
  matchCount: 1,
})
assert.deepEqual(autoNoRepoUnique, {
  remapUnique: true,
  confirmLeave: false,
  chooseMatch: false,
})

console.log('rehome-policy.test.mjs: ok')
