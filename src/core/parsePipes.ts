import { parsePipe } from './parsePipe.ts';
import { Vars } from './vars.ts';
import { safeSplitPipes } from './safeSplitPipes.ts';

export function parsePipes(pipes: string, _vars?: Vars) {
  let current = '';
  const vars = { ..._vars };
  for (const pipe of safeSplitPipes(pipes)) {
    vars['$cur'] = current;
    let res = parsePipe(current, pipe, vars);
    if (res === undefined || res === null) {
      console.warn('undefined received from pipe: ' + pipe);
      res = '';
    }
    current = res;
  }

  return current;
}
