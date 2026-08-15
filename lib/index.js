// dsh-turn-rail — host half.
// Registers one small session projection that folds the durable session log
// into an ordered list of user messages: { seq, time, text }.
// The browser half reads this projection so a page reload can paint the full
// turn rail immediately without replaying the whole conversation.

export const name = 'dsh-turn-rail';
export const TURN_RAIL_PROJECTION_KEY = 'turnRailMessages';

const TEXT_LIMIT = 160;

function textOf(content) {
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      out += block.text;
    }
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
}

export function apply(ctx) {
  const projections = ctx.get('sessionProjections');
  if (projections === undefined) return;

  projections.register({
    key: TURN_RAIL_PROJECTION_KEY,
    schema: {
      parse(value) {
        if (!Array.isArray(value)) throw new TypeError('turnRailMessages must be an array');
        for (const item of value) {
          if (
            item === null || typeof item !== 'object' ||
            typeof item.seq !== 'number' ||
            typeof item.time !== 'number' ||
            typeof item.text !== 'string' ||
            (item.id !== undefined && typeof item.id !== 'string')
          ) {
            throw new TypeError('invalid turnRailMessages entry');
          }
        }
        return value;
      },
    },
    init: () => [],
    apply(state, event) {
      if (
        event &&
        event.type === 'user/message' &&
        event.data &&
        event.data.source &&
        event.data.source.kind === 'user'
      ) {
        const next = state.slice();
        next.push({
          seq: event.seq,
          time: event.time,
          text: textOf(event.data.content),
          ...(typeof event.data.id === 'string' ? { id: event.data.id } : {}),
        });
        return next;
      }
      return state;
    },
    view: (state) => state,
    stateVersion: 2,
  });
}
