const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

/** Klein bord (puur HTML). `marks` kleurt velden: bad (rood) of good (groen). */
export function miniBoard(fen: string, flip: boolean, marks: Record<string, 'bad' | 'good'> = {}): string {
  const rows = fen.split(' ')[0].split('/');
  const cells: string[] = [];
  rows.forEach((r, ri) => {
    let f = 0;
    const put = (inner: string) => {
      const sq = 'abcdefgh'[f] + (8 - ri);
      cells.push(`<span${marks[sq] ? ` class="${marks[sq]}"` : ''}>${inner}</span>`);
      f++;
    };
    for (const ch of r) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) put('');
      else put(`<i class="${ch === ch.toLowerCase() ? 'b' : 'w'}">${GLYPH[ch.toLowerCase()]}</i>`);
    }
  });
  return `<div class="mini">${(flip ? cells.reverse() : cells).join('')}</div>`;
}
