// The Android flows in .maestro/ must keep working when lesson content changes: they answer whatever
// step is on screen through one shared subflow, instead of scripting each unit's exercises and score.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAESTRO = join(__dirname, '..', '..', '.maestro');
const ANSWER_STEP = 'steps/answer-step.yaml';

/** The top-level flows, the ones `maestro test .maestro` runs, without their comments. */
const flows = readdirSync(MAESTRO)
  .filter((name) => name.endsWith('.yaml'))
  .map((name) => ({
    name,
    lines: readFileSync(join(MAESTRO, name), 'utf8')
      .split('\n')
      .map((line) => line.replace(/(^|\s)#.*$/, '')),
  }));

/** testIDs of the controls that answer an exercise; only the shared subflow touches them. */
const ANSWER_CONTROLS = /id: "(option-|tile-|placed-|answer-input|check|speak|mic-|stop-listening|self-)/;

describe('Maestro flows', () => {
  it('finds the flows', () => {
    expect(flows.map((flow) => flow.name).sort()).toEqual(['lesson.yaml', 'review.yaml']);
  });

  it.each(flows)('$name asserts no fixed count such as "đúng 14/14" or "Từ 1/9"', ({ lines }) => {
    expect(lines.filter((line) => /\d\s*\/\s*\d/.test(line))).toEqual([]);
  });

  it.each(flows)(
    '$name repeats only while a condition holds, never a fixed number of exercises or cards',
    ({ lines }) => {
      const repeats = lines.flatMap((line, i) => (/^\s*- repeat:/.test(line) ? [i] : []));
      for (const at of repeats) expect(lines[at + 1]).toMatch(/^\s*while:/);
    }
  );

  it.each(flows)('$name leaves answering exercises to the shared step subflow', ({ lines }) => {
    expect(lines.filter((line) => ANSWER_CONTROLS.test(line))).toEqual([]);
  });

  it('answers each kind of step in the shared subflow', () => {
    const subflow = readFileSync(join(MAESTRO, ANSWER_STEP), 'utf8');
    for (const id of [
      'word-card',
      'option-0',
      'answer-input',
      'tile-.*',
      'speak',
      'mic-decline',
      'self-pass',
      'feedback',
    ]) {
      expect(subflow).toContain(`id: "${id}"`);
    }
  });

  it('plays the lesson and the review through the shared subflow until the result', () => {
    for (const name of ['lesson.yaml', 'review.yaml']) {
      const text = readFileSync(join(MAESTRO, name), 'utf8');
      expect(text).toMatch(/while:\s+notVisible:\s+id: "score"[\s\S]*?- runFlow: steps\/answer-step\.yaml/);
    }
  });

  it('presses Android back after leaving the lesson result, and checks the result does not come back', () => {
    const text = readFileSync(join(MAESTRO, 'lesson.yaml'), 'utf8');
    expect(text).toMatch(
      /- tapOn:\s+id: "back-to-track"[\s\S]*?\n- back\n- assertNotVisible: "Xong bài học!"\n- assertNotVisible:\s+id: "score"/
    );
  });
});

