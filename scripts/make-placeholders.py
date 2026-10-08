"""Writes simple temporary SVG placeholders into public/assets.
Real artwork replaces them: drop the file in public/assets and change one line in src/config/assets.ts."""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
os.makedirs(OUT, exist_ok=True)


def write(name, body):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(body)


# hero: 16:9, empty sky on top, ridge, ledge, table, small figure
write('hero.placeholder.svg', '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
<rect width="1920" height="1080" fill="#1767C9"/>
<polygon points="0,1080 0,760 260,560 430,680 700,380 930,640 1180,440 1460,700 1700,560 1920,720 1920,1080" fill="#5d6b7f"/>
<polygon points="0,1080 0,860 300,720 560,820 860,610 1120,800 1400,700 1650,820 1920,760 1920,1080" fill="#434c5a"/>
<polygon points="0,1080 0,960 420,900 900,950 1400,890 1920,960 1920,1080" fill="#4f6b4a"/>
<rect x="720" y="905" width="520" height="22" fill="#2f3640"/>
<rect x="880" y="840" width="200" height="14" fill="#8a6a45"/>
<rect x="900" y="854" width="10" height="52" fill="#6d5236"/>
<rect x="1050" y="854" width="10" height="52" fill="#6d5236"/>
<circle cx="985" cy="812" r="12" fill="#f6efdd"/>
<rect x="976" y="822" width="18" height="20" fill="#f6efdd"/>
</svg>''')

# bird: dark body, wings at 4 heights
WING = {1: 14, 2: 62, 3: 112, 4: 62}
for i, tip in WING.items():
    mid = 80 if i in (1, 3) else (70 if i == 2 else 90)
    write(f'bird-frame-{i}.placeholder.svg', f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
<path d="M120 84 C90 {mid-20} 50 {tip+10} 8 {tip} C58 {tip+34} 92 {mid+20} 120 96 Z" fill="#101a28"/>
<path d="M120 84 C150 {mid-20} 190 {tip+10} 232 {tip} C182 {tip+34} 148 {mid+20} 120 96 Z" fill="#16273b"/>
<ellipse cx="120" cy="90" rx="34" ry="12" fill="#101a28"/>
<circle cx="150" cy="84" r="8" fill="#101a28"/>
<polygon points="156,84 170,87 156,90" fill="#f0913a"/>
</svg>''')

write('bird-back.placeholder.svg', '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
<path d="M120 90 C96 60 56 40 14 52 C60 74 90 100 120 112 Z" fill="#101a28"/>
<path d="M120 90 C144 60 184 40 226 52 C180 74 150 100 120 112 Z" fill="#16273b"/>
<ellipse cx="120" cy="96" rx="14" ry="34" fill="#101a28"/>
<circle cx="120" cy="58" r="10" fill="#101a28"/>
<polygon points="108,128 132,128 120,152" fill="#101a28"/>
</svg>''')

# icons: simple cream line shapes
ICONS = {
    'education': '<path d="M16 22 H48 V50 H16 Z M32 22 V50" fill="none"/>',
    'experience': '<path d="M14 26 H50 V50 H14 Z M24 26 V20 H40 V26" fill="none"/>',
    'projects': '<path d="M16 16 H30 V30 H16 Z M34 16 H48 V30 H34 Z M16 34 H30 V48 H16 Z M34 34 H48 V48 H34 Z" fill="none"/>',
    'skills': '<path d="M32 14 L50 48 H14 Z" fill="none"/>',
    'interests': '<circle cx="32" cy="32" r="16" fill="none"/><circle cx="32" cy="32" r="5" fill="#f0913a" stroke="none"/>',
}
for k, shape in ICONS.items():
    write(f'icon-{k}.placeholder.svg', f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" stroke="#f6efdd" stroke-width="2.5" stroke-linejoin="round">{shape}</svg>''')
