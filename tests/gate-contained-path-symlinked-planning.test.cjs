'use strict';

/**
 * #5474: the gate path-containment helper (`resolveContainedPath`) must accept a phase directory
 * reached through the project's OWN symlinked, out-of-repo `.planning`, and nothing wider.
 * Covers both gates the issue names: check decision-coverage-plan and check gap-analysis.plan-post.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGsdTools, createTempDir, cleanup } = require('./helpers.cjs');

const REL_PHASE = path.join('.planning', 'phases', '01-demo');
const ESCAPES = 'path escapes its allowed directory';

function seedPhase(phaseDir) {
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(
    path.join(phaseDir, 'CONTEXT.md'),
    '<decisions>\n- **D-01:** Use PostgreSQL for the primary datastore layer\n</decisions>\n',
  );
  fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '<objective>Unrelated work REQ-01</objective>\n');
}

function decisionGate(proj, phaseArg) {
  return runGsdTools(['check', 'decision-coverage-plan', phaseArg, '--context', path.join(phaseArg, 'CONTEXT.md')], proj);
}
function gapGate(proj, phaseArg) {
  return runGsdTools(['check', 'gap-analysis.plan-post', phaseArg, 'REQ-01,REQ-02', '--raw'], proj);
}
const GATES = [['decision-coverage-plan', decisionGate], ['gap-analysis.plan-post', gapGate]];

describe('#5474: gate containment with a symlinked out-of-repo .planning', () => {
  let root, proj, store, realProj;

  beforeEach(() => {
    root = fs.realpathSync(createTempDir('gsd-5474-'));
    proj = path.join(root, 'proj');
    store = path.join(root, 'store');
    fs.mkdirSync(proj);
    fs.mkdirSync(store);
    seedPhase(path.join(store, 'phases', '01-demo'));
    fs.symlinkSync(store, path.join(proj, '.planning'), process.platform === 'win32' ? 'junction' : 'dir');
    // control: identical content under a real .planning directory
    realProj = path.join(root, 'real');
    seedPhase(path.join(realProj, REL_PHASE));
  });

  afterEach(() => cleanup(root));

  for (const [name, gate] of GATES) {
    test(`${name}: relative and real absolute store paths give the real-directory verdict`, () => {
      const control = gate(realProj, REL_PHASE);
      assert.ok(control.success, `control failed: ${control.error}`);
      for (const arg of [REL_PHASE, path.join(store, 'phases', '01-demo')]) {
        const r = gate(proj, arg);
        assert.ok(r.success, `${arg} refused: ${r.error}`);
        assert.equal(r.output, control.output);
      }
    });

    test(`${name}: still refuses an in-store symlink to outside, an outside absolute path, .. traversal and a prefix sibling`, () => {
      const outside = path.join(root, 'outside');
      seedPhase(outside);
      fs.symlinkSync(outside, path.join(store, 'phases', 'link-out'), process.platform === 'win32' ? 'junction' : 'dir');
      const evil = path.join(root, 'store-evil');
      seedPhase(evil);
      for (const arg of [
        path.join('.planning', 'phases', 'link-out'),
        outside,
        path.join('.planning', '..', '..', 'outside'),
        evil,
        path.join(store + '-evil'),
      ]) {
        const r = gate(proj, arg);
        assert.equal(r.success, false, `${arg} was accepted`);
        assert.ok(r.error.includes(ESCAPES), `${arg}: ${r.error}`);
      }
    });

    test(`${name}: real .planning directory still refuses an outside path`, () => {
      const outside = path.join(root, 'outside');
      seedPhase(outside);
      const r = gate(realProj, outside);
      assert.equal(r.success, false);
      assert.ok(r.error.includes(ESCAPES), r.error);
    });
  }
});
