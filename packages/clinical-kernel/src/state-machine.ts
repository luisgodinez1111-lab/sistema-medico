export type Transition<S extends string,E extends string> = Readonly<{
  from:S; event:E; to:S; guard?:string; effect?:string;
}>;

export type StateMachineDefinition<S extends string,E extends string> = Readonly<{
  id:`SM-${string}`;
  authority:`ENG-${string}`;
  initial:S;
  states:readonly S[];
  terminal:readonly S[];
  transitions:readonly Transition<S,E>[];
  reconciliation?:Readonly<{ owner:string; detection:string; recovery:string; evidence:string }>;
}>;

export function assertTransition<S extends string,E extends string>(
  machine:StateMachineDefinition<S,E>, from:S, event:E
): S {
  const t=machine.transitions.find(x=>x.from===from && x.event===event);
  if(!t) throw new Error(`ILLEGAL_TRANSITION:${machine.id}:${from}:${event}`);
  return t.to;
}
