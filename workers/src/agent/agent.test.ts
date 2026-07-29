/**
 * Phase 7 tests (PLAN.md): cap enforcement on all three axes, schema rejection
 * of evidence-free claims, the kill switch stopping a run, and an audit that
 * the tool catalogue cannot send or delete.
 *
 * The loop is tested against a fake Anthropic client so none of this needs a
 * key or a network.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { qualificationSchema, researchSchema } from '@wms/shared';
import { runAgent } from './loop.js';
import { ToolRegistry, newToolContext, type AnyAgentTool } from './tools/registry.js';
import { isPrivateAddress } from './tools/url-guard.js';
import { qualifierTools } from './tools/index.js';
import { submitQualificationSpec } from './qualifier.js';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/** Only the two fields the loop reads; the rest of Usage is irrelevant here. */
function usage(input = 10, output = 5): Anthropic.Usage {
  return { input_tokens: input, output_tokens: output } as unknown as Anthropic.Usage;
}

/** Returns canned model turns in order; repeats the last one forever. */
function fakeClient(turns: Array<Partial<Anthropic.Message>>): Anthropic {
  let i = 0;
  return {
    messages: {
      create: async () => {
        const turn = turns[Math.min(i, turns.length - 1)];
        i += 1;
        return { content: [], usage: usage(), ...turn } as unknown as Anthropic.Message;
      },
    },
  } as unknown as Anthropic;
}

const toolUse = (name: string, input: unknown, id = 't1') =>
  ({ type: 'tool_use', id, name, input }) as Anthropic.ToolUseBlock;

const echoTool: AnyAgentTool = {
  name: 'echo',
  description: 'echo',
  schema: z.object({ v: z.string() }),
  jsonSchema: { type: 'object', properties: { v: { type: 'string' } }, required: ['v'] },
  writes: 'none',
  cost: { usdPerCall: 0 },
  async run(input: { v: string }) {
    return { ok: true as const, text: input.v };
  },
};

const okSchema = z.object({ confidence: z.number(), rationale: z.string() });
const registry = () => new ToolRegistry([echoTool, submitQualificationSpec()]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = () => newToolContext({} as any, 'lead1', 'run1');

const baseParams = {
  caps: { maxSteps: 10, maxTokens: 100_000, maxSeconds: 60 },
  system: 's',
  userMessage: 'u',
  submitToolName: 'submit_qualification',
};

// ---------------------------------------------------------------------------

describe('loop caps', () => {
  it('caps on steps', async () => {
    // Always calls a normal tool, never submits.
    const client = fakeClient([{ content: [toolUse('echo', { v: 'hi' })] }]);
    const res = await runAgent({
      ...baseParams,
      caps: { maxSteps: 3, maxTokens: 100_000, maxSeconds: 60 },
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: okSchema,
    });
    expect(res.status).toBe('capped');
    expect(res.steps).toBe(3);
    expect(res.rationale).toContain('3-step cap');
  });

  it('caps on tokens', async () => {
    const client = fakeClient([{ content: [toolUse('echo', { v: 'hi' })], usage: usage(400, 400) }]);
    const res = await runAgent({
      ...baseParams,
      caps: { maxSteps: 50, maxTokens: 1000, maxSeconds: 60 },
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: okSchema,
    });
    expect(res.status).toBe('capped');
    expect(res.rationale).toContain('token cap');
    expect(res.steps).toBeLessThan(50);
  });

  it('caps on wall clock', async () => {
    let t = 0;
    const client = fakeClient([{ content: [toolUse('echo', { v: 'hi' })] }]);
    const res = await runAgent({
      ...baseParams,
      caps: { maxSteps: 50, maxTokens: 100_000, maxSeconds: 5 },
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: okSchema,
      now: () => (t += 2000), // 2s per check
    });
    expect(res.status).toBe('capped');
    expect(res.rationale).toContain('5s wall-clock cap');
  });

  it('never throws when the model call fails', async () => {
    const client = {
      messages: {
        create: async () => {
          throw new Error('network down');
        },
      },
    } as unknown as Anthropic;
    const res = await runAgent({
      ...baseParams,
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: okSchema,
    });
    expect(res.status).toBe('failed');
    expect(res.rationale).toContain('network down');
  });
});

describe('kill switch', () => {
  it('aborts before the first model call', async () => {
    let called = 0;
    const client = {
      messages: {
        create: async () => {
          called += 1;
          return { content: [], usage: usage() } as unknown as Anthropic.Message;
        },
      },
    } as unknown as Anthropic;
    const res = await runAgent({
      ...baseParams,
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: okSchema,
      shouldAbort: async () => true,
    });
    expect(res.status).toBe('aborted');
    expect(called).toBe(0);
  });

  it('aborts a run already in flight', async () => {
    let steps = 0;
    const client = fakeClient([{ content: [toolUse('echo', { v: 'hi' })] }]);
    const res = await runAgent({
      ...baseParams,
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: okSchema,
      shouldAbort: async () => ++steps > 2,
    });
    expect(res.status).toBe('aborted');
  });
});

describe('output validation', () => {
  const good = {
    verdict: 'qualified',
    fitScore: 70,
    confidence: 0.8,
    rationale: 'Alive, reachable, dated site.',
    signals: {
      alive: true,
      reachable: true,
      siteVerdict: 'dated',
      sizeProxy: 'small',
      isChain: false,
    },
    disqualifiers: [],
    evidence: [{ claim: 'No viewport meta', source: 'https://example.com' }],
  };

  it('accepts a well-formed qualification', async () => {
    const client = fakeClient([{ content: [toolUse('submit_qualification', good)] }]);
    const res = await runAgent({
      ...baseParams,
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: qualificationSchema as unknown as z.ZodType<typeof good>,
    });
    expect(res.status).toBe('done');
    expect(res.confidence).toBe(0.8);
    expect(res.rationale).toContain('Alive');
  });

  it('rejects a claim with no source, then fails after one retry', async () => {
    const bad = { ...good, evidence: [{ claim: 'Looks old', source: '   ' }] };
    const client = fakeClient([{ content: [toolUse('submit_qualification', bad)] }]);
    const res = await runAgent({
      ...baseParams,
      client,
      tools: registry(),
      toolContext: ctx(),
      outputSchema: qualificationSchema as unknown as z.ZodType<typeof good>,
    });
    expect(res.status).toBe('failed');
    expect(res.rationale).toContain('validation');
  });

  it('rejects evidence-free output at the schema level', () => {
    expect(qualificationSchema.safeParse({ ...good, evidence: [] }).success).toBe(false);
    expect(
      qualificationSchema.safeParse({
        ...good,
        evidence: [{ claim: 'x', source: '' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a qualified verdict carrying disqualifiers', () => {
    const r = qualificationSchema.safeParse({ ...good, disqualifiers: ['chain'] });
    expect(r.success).toBe(false);
  });

  it('rejects a discard that names no disqualifier', () => {
    const r = qualificationSchema.safeParse({ ...good, verdict: 'discard', disqualifiers: [] });
    expect(r.success).toBe(false);
  });

  it('rejects a pain point with no evidence', () => {
    const base = {
      ownerName: null,
      ownerSource: null,
      summary: 'A salon.',
      services: [],
      differentiators: [],
      painPoints: [{ claim: 'Slow site', evidence: '', severity: 'high' }],
      reviewThemes: { praised: [], complained: [] },
      socials: [],
      openingHours: null,
      competitorNote: null,
    };
    expect(researchSchema.safeParse(base).success).toBe(false);
  });

  it('rejects an owner name with no source', () => {
    const base = {
      ownerName: 'Ana',
      ownerSource: null,
      summary: 'A salon.',
      services: [],
      differentiators: [],
      painPoints: [],
      reviewThemes: { praised: [], complained: [] },
      socials: [],
      openingHours: null,
      competitorNote: null,
    };
    expect(researchSchema.safeParse(base).success).toBe(false);
  });
});

describe('tool registry', () => {
  it('enforces per-run call caps', async () => {
    const capped: AnyAgentTool = { ...echoTool, name: 'capped', cost: { usdPerCall: 0, maxCallsPerRun: 2 } };
    const reg = new ToolRegistry([capped]);
    const c = ctx();
    expect((await reg.invoke('capped', { v: 'a' }, c)).ok).toBe(true);
    expect((await reg.invoke('capped', { v: 'b' }, c)).ok).toBe(true);
    const third = await reg.invoke('capped', { v: 'c' }, c);
    expect(third.ok).toBe(false);
    expect(third.text).toContain('capped at 2 calls');
  });

  it('turns a thrown tool into an error result rather than ending the run', async () => {
    const boom: AnyAgentTool = {
      ...echoTool,
      name: 'boom',
      async run() {
        throw new Error('kaboom');
      },
    };
    const out = await new ToolRegistry([boom]).invoke('boom', { v: 'x' }, ctx());
    expect(out.ok).toBe(false);
    expect(out.text).toContain('kaboom');
  });

  it('refuses an unknown tool', async () => {
    const out = await new ToolRegistry([echoTool]).invoke('nope', {}, ctx());
    expect(out.ok).toBe(false);
  });
});

describe('safety rails as code', () => {
  it('no qualifier tool writes anything but storage', () => {
    const tools = qualifierTools({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      places: {} as any,
      lang: 'en',
      shooter: null,
      bucket: null,
      search: null,
    });
    for (const t of tools) {
      expect(['none', 'storage']).toContain(t.writes);
    }
  });

  it('no tool name suggests sending, deleting or writing config', () => {
    const tools = qualifierTools({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      places: {} as any,
      lang: 'en',
      shooter: null,
      bucket: null,
      search: null,
    });
    const banned = /send|email|delete|remove|write_config|set_config/i;
    for (const t of tools) expect(t.name).not.toMatch(banned);
  });
});

describe('url guard', () => {
  it('blocks private, loopback, link-local and CGNAT ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.5',
      '172.16.9.9',
      '169.254.169.254', // cloud metadata
      '100.64.0.1',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
